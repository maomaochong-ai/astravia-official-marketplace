/**
 * ConnectionTree — 左栏连接树主容器。
 *
 * 职责：
 * - 标题工具条（导入/导出、展开/收起、刷新、搜索过滤）见 ConnectionTreeToolbar
 * - 渲染 connection → table → column 递归节点
 * - 触发懒加载（通过 use-workbench）
 */

import { useEffect, useRef, useState, type JSX } from "react";
import { useWorkbench } from "../hooks/use-workbench";
import { ConnectionNode } from "./connection-node";
import { ConnectionTreeToolbar } from "./connection-tree-toolbar";
import { connectionNodeKey, type TreeNode } from "../../../domain/tree-node-key";
import { buildMultiSelectPrompt, buildDashboardPrompt, buildScreenPrompt } from "../../../shared/ai/send-context";
import { SendToAiDialog } from "./send-to-ai-dialog";
import { searchTables, type TableSearchHit } from "../services/table-search";

/** 搜表防抖：每个字符都打一轮 list_tables 会把引擎打满（引擎侧读路径是共享子进程）。 */
const SEARCH_DEBOUNCE_MS = 300;

export function ConnectionTree({ onCollapse }: { onCollapse?: () => void }): JSX.Element {
	const {
		state,
		refreshConnections,
		openPreviewTab,
		dispatch,
		selectionMode,
		selectedNodes,
		toggleSelectionMode,
		clearNodeSelection,
	} = useWorkbench();
	const [query, setQuery] = useState("");
	const [aiDialogOpen, setAiDialogOpen] = useState(false);
	const [aiPrompt, setAiPrompt] = useState("");
	// v0.0.102: 合并看板/大屏下拉状态
	const [vizMenuOpen, setVizMenuOpen] = useState(false);
	const vizMenuRef = useRef<HTMLDivElement | null>(null);

	/** 把多选对象构建成上下文，打开 AI 对话框确认后发送。 */
	function sendSelectionToAi(): void {
		setAiPrompt(buildMultiSelectPrompt(Array.from(selectedNodes.values())));
		setAiDialogOpen(true);
	}

	/** 多选生成看板。 */
	function sendSelectionToDashboard(): void {
		setAiPrompt(buildDashboardPrompt(Array.from(selectedNodes.values())));
		setAiDialogOpen(true);
	}

	/** 多选生成大屏。 */
	function sendSelectionToScreen(): void {
		setAiPrompt(buildScreenPrompt(Array.from(selectedNodes.values())));
		setAiDialogOpen(true);
	}
	const needle = query.trim().toLowerCase();

	const [hits, setHits] = useState<TableSearchHit[]>([]);
	const [searching, setSearching] = useState(false);
	const [failedConnections, setFailedConnections] = useState<string[]>([]);
	/** 连接名清单：连接增删才需要重搜，避免每次 refresh 产生的新数组引用把请求打飞。 */
	const connectionKey = state.connections.map((c) => c.name).join("|");

	// 搜表要问引擎：树是懒加载的，只在已加载节点上做子串过滤永远搜不到没展开的表
	//（刚建的新表正好就是没展开的那类）。输入必须防抖，否则每个字符打一轮 list_tables。
	useEffect(() => {
		if (!needle) {
			setHits([]);
			setFailedConnections([]);
			setSearching(false);
			return;
		}
		let cancelled = false;
		setSearching(true);
		const timer = setTimeout(() => {
			void searchTables(
				state.connections.map((c) => ({ name: c.name, dbType: c.db_type, schemas: c.schemas })),
				needle,
			)
				.then((result) => {
					if (cancelled) return;
					setHits(result.hits);
					setFailedConnections(result.failedConnections);
				})
				.catch(() => {
					if (cancelled) return;
					setHits([]);
				})
				.finally(() => {
					if (!cancelled) setSearching(false);
				});
		}, SEARCH_DEBOUNCE_MS);
		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	}, [needle, connectionKey]);

	/** 点击命中项：按限定名预览，避免再出现「树里看得到、SQL 里查不到」。 */
	function openHit(hit: TableSearchHit): void {
		const qualified = hit.schema ? `${hit.schema}.${hit.name}` : hit.name;
		void openPreviewTab(hit.connection, `SELECT * FROM ${qualified} LIMIT 100;`, hit.name);
	}

	function expandAll(): void {
		for (const [key, children] of state.treeChildren) {
			if (children.length > 0 && !state.expandedNodes.has(key)) {
				dispatch({ type: "toggleNode", key });
			}
		}
	}

	function collapseAll(): void {
		for (const key of [...state.expandedNodes]) {
			dispatch({ type: "toggleNode", key });
		}
	}

	// 初始化：连接列表加载完后，给每个连接创建一个 tree connection 节点，并设置 dbType
	const connectionNodes: TreeNode[] = state.connections.map((c) => ({
		key: connectionNodeKey(c.name),
		kind: "connection",
		label: c.name,
		dbType: c.db_type,
		hasChildren: true,
	}));

	// 过滤
	const visibleConnectionNodes = needle
		? connectionNodes.filter((n) => n.label.toLowerCase().includes(needle))
		: connectionNodes;

	return (
		<div className="flex h-full flex-col bg-surface-raised">
			<ConnectionTreeToolbar
				connectionCount={connectionNodes.length}
				selectionMode={selectionMode}
				onExpandAll={expandAll}
				onCollapseAll={collapseAll}
				onRefresh={() => void refreshConnections()}
				onToggleSelectionMode={() => toggleSelectionMode()}
				onAfterTransfer={() => void refreshConnections()}
				onCollapsePanel={onCollapse}
			/>
			{/* 搜索（新增/刷新统一走顶栏，此处不重复） */}
			<div className="shrink-0 border-b border-border px-2 py-1.5">
				<div
					className="flex items-center gap-1 rounded-control border border-border bg-surface px-2 py-1"
				>
					<span className="icon-[lucide--search] size-3 shrink-0 text-muted" />
					<input
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="过滤连接/表..."
						className="min-w-0 flex-1 bg-transparent text-[12px] text-surface-foreground outline-none placeholder:text-faint"
					/>
					{query && (
						<button
							type="button"
							onClick={() => setQuery("")}
							className="shrink-0 text-muted hover:text-surface-foreground"
						>
							<span className="icon-[lucide--x] h-3 w-3" />
						</button>
					)}
				</div>
			</div>

			{/* 树内容 */}
			<div className="dbx-scroll min-h-0 flex-1 overflow-y-auto py-1">
				{needle && (
					<div className="mb-1">
						<div className="flex items-center gap-1 px-1 py-0.5 text-[11px] text-muted">
							<span className="icon-[lucide--table-2] h-2.5 w-2.5" />
							<span>
								表命中 <span className="font-semibold">{hits.length}</span>
							</span>
							{searching && <span className="ml-1 animate-pulse">搜索中…</span>}
						</div>
						{hits.map((hit) => (
							<button
								key={`${hit.connection}|${hit.schema ?? ""}|${hit.name}`}
								type="button"
								onClick={() => openHit(hit)}
								title={`${hit.connection} · ${hit.schema ? `${hit.schema}.` : ""}${hit.name}\n点击预览前 100 行`}
								className="flex w-full items-center gap-1 rounded-control px-1.5 py-1 text-left text-[12px] hover:bg-neutral-muted"
							>
								<span className={`h-3 w-3 shrink-0 ${hit.kind?.toUpperCase() === "VIEW" ? "icon-[lucide--eye]" : "icon-[lucide--table]"} text-muted`} />
								<span className="min-w-0 flex-1 truncate">
									{hit.schema ? <span className="text-muted">{hit.schema}.</span> : null}
									{hit.name}
								</span>
								<span className="shrink-0 text-[11px] text-faint">{hit.connection}</span>
							</button>
						))}
						{!searching && hits.length === 0 && (
							<p className="px-1 py-1 text-[11px] text-faint">没有匹配的表</p>
						)}
						{failedConnections.length > 0 && (
							<p className="px-1 py-1 text-[10px] text-warning">
								{failedConnections.join("、")} 读取失败，结果可能不完整
							</p>
						)}
						<div className="my-1 border-t border-border" />
						<div className="px-1 py-0.5 text-[11px] text-muted">连接</div>
					</div>
				)}
				{!needle && visibleConnectionNodes.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-10 text-center">
						<span className="icon-[lucide--database] size-8 text-faint" />
						<p className="mt-3 text-[12px] text-muted">
							{query ? "无匹配" : "暂无连接"}
						</p>
						{!query && (
							<p className="mt-1 text-[11px] text-faint">
								点右侧面板添加
							</p>
						)}
					</div>
				) : (
					visibleConnectionNodes.map((n) => (
						<ConnectionNode
							key={n.key}
							node={n}
							depth={0}
							connectionName={n.label}
						/>
					))
				)}
			</div>

			{/* 底部：多选操作条（v0.0.102 重构：纯图标 + 合并看板/大屏下拉 + 响应式） */}
			{selectionMode ? (
				<div
					className="dbx-tree-bottom-bar"
				>
					{/* 左侧：已选 N 项（窄屏自动隐藏文字） */}
					<span className="dbx-tree-bottom-bar__count">
						<span className="icon-[lucide--check-square] h-2.5 w-2.5 shrink-0" />
						<span className="dbx-tree-bottom-bar__count-text">已选 <span className="font-semibold">{selectedNodes.size}</span> 项</span>
					</span>
					<span className="min-w-1 flex-1" />
					{/* 右侧：纯图标按钮组 */}
					<div className="dbx-tree-bottom-bar__actions">
						{/* 清空 */}
						<button
							type="button"
							onClick={() => clearNodeSelection()}
							disabled={selectedNodes.size === 0}
							className="dbx-icon-btn"
							title="清空选择"
						>
							<span className="icon-[lucide--trash-2] h-3 w-3" />
						</button>
						{/* 合并下拉：看板 / 大屏 */}
						<div className="relative" ref={vizMenuRef}>
							<button
								type="button"
								onClick={() => setVizMenuOpen((v) => !v)}
								disabled={selectedNodes.size === 0}
								className={`dbx-icon-btn ${vizMenuOpen ? "dbx-icon-btn--active" : ""}`}
								title="生成看板 / 大屏"
							>
								<span className="icon-[lucide--sparkles] h-3 w-3" />
							</button>
							{vizMenuOpen && (
								<>
									<div className="fixed inset-0 z-40" onClick={() => setVizMenuOpen(false)} />
									<div className="dbx-tree-bottom-bar__viz-menu">
										<button
											type="button"
											onClick={() => { setVizMenuOpen(false); sendSelectionToDashboard(); }}
											className="dbx-tree-bottom-bar__viz-item"
										>
											<span className="icon-[lucide--layout-dashboard] h-3 w-3" />
											<span>企业看板</span>
										</button>
										<button
											type="button"
											onClick={() => { setVizMenuOpen(false); sendSelectionToScreen(); }}
											className="dbx-tree-bottom-bar__viz-item"
										>
											<span className="icon-[lucide--monitor] h-3 w-3" />
											<span>数据大屏</span>
										</button>
									</div>
								</>
							)}
						</div>
						{/* 发送到 AI（主色，图标） */}
						<button
							type="button"
							onClick={sendSelectionToAi}
							disabled={selectedNodes.size === 0}
							className="dbx-icon-btn dbx-icon-btn--primary"
							title="发送到 AI"
						>
							<span className="icon-[lucide--send] h-3 w-3" />
						</button>
						{/* 退出 */}
						<button
							type="button"
							onClick={() => toggleSelectionMode(false)}
							className="dbx-icon-btn"
							title="退出多选模式"
						>
							<span className="icon-[lucide--log-out] h-3 w-3" />
						</button>
					</div>
				</div>
			) : (
				<div className="flex shrink-0 items-center gap-1 border-t border-border px-3 py-1 text-[11px] text-faint">
					{state.activeConnectionName ? (
						<>
							<span className="icon-[lucide--activity] h-2.5 w-2.5 text-success" />
							<span className="truncate">当前: {state.activeConnectionName}</span>
						</>
					) : (
						<span>未选择连接</span>
					)}
				</div>
			)}

			<SendToAiDialog open={aiDialogOpen} prompt={aiPrompt} onClose={() => setAiDialogOpen(false)} />
		</div>
	);
}

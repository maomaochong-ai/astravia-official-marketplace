/**
 * ConnectionTree — 左栏连接树主容器。
 *
 * 职责：
 * - 顶部工具栏（刷新、搜索过滤）
 * - 渲染 connection → table → column 递归节点
 * - 触发懒加载（通过 use-workbench）
 */

import { useState, type JSX } from "react";
import { useWorkbench } from "../hooks/use-workbench";
import { ConnectionNode } from "./connection-node";
import { connectionNodeKey, type TreeNode } from "../../../domain/tree-node-key";

export function ConnectionTree({ onCollapse, onNewQuery }: { onCollapse?: () => void; onNewQuery?: () => void }): JSX.Element {
	const { state, refreshConnections, dispatch } = useWorkbench();
	const [query, setQuery] = useState("");
	const needle = query.trim().toLowerCase();

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
		<div className="flex h-full flex-col bg-background">
			{/* 标题工具条（对齐 dbx 桌面壳：浅色底 + 紧凑高，右侧 20px ghost 图标） */}
			<div
				className="flex h-9 shrink-0 items-center gap-1 px-2 text-[11px] font-medium text-muted-foreground"
				style={{ backgroundColor: "var(--dbx-surface)", borderBottom: "1px solid var(--dbx-line-soft)" }}
			>
				<span className="flex items-center gap-1.5 pl-1">
					<span className="icon-[lucide--database] h-3.5 w-3.5" />
					连接
					{connectionNodes.length > 0 && (
						<span className="text-[10px] text-muted-foreground/70">{connectionNodes.length}</span>
					)}
				</span>
			<span className="flex-1" />
			{onNewQuery && (
				<button
					type="button"
					onClick={onNewQuery}
					title="新建查询"
					className="dbx-iconbtn"
					style={{ height: 22, minWidth: 22, padding: 0 }}
				>
					<span className="icon-[lucide--file-plus-2] h-3 w-3" />
				</button>
			)}
			<button
				type="button"
				onClick={expandAll}
				title="展开已加载节点"
				className="dbx-iconbtn"
				style={{ height: 22, minWidth: 22, padding: 0 }}
			>
				<span className="icon-[lucide--chevrons-down-up] h-3 w-3" />
			</button>
			<button
				type="button"
				onClick={collapseAll}
				title="收起全部"
				className="dbx-iconbtn"
				style={{ height: 22, minWidth: 22, padding: 0 }}
			>
				<span className="icon-[lucide--chevrons-up-down] h-3 w-3" />
			</button>
			<button
				type="button"
				onClick={() => { void refreshConnections(); }}
				title="刷新连接"
				className="dbx-iconbtn"
				style={{ height: 22, minWidth: 22, padding: 0 }}
			>
				<span className="icon-[lucide--refresh-cw] h-3 w-3" />
			</button>
			{onCollapse && (
				<button
					type="button"
					onClick={onCollapse}
					title="收起连接树"
					className="dbx-iconbtn"
					style={{ height: 22, minWidth: 22, padding: 0 }}
				>
					<span className="icon-[lucide--panel-left-close] h-3 w-3" />
				</button>
			)}
		</div>

			{/* 搜索（新增/刷新统一走顶栏，此处不重复） */}
			<div className="shrink-0 px-2 py-1.5" style={{ borderBottom: "1px solid var(--dbx-line-soft)" }}>
				<div
					className="flex items-center gap-1 rounded-md px-2 py-1"
					style={{ backgroundColor: "var(--dbx-surface-2)" }}
				>
					<span className="icon-[lucide--search] h-3 w-3 shrink-0 text-muted-foreground" />
					<input
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="过滤连接/表..."
						className="min-w-0 flex-1 bg-transparent text-[11px] text-foreground outline-none placeholder:text-muted-foreground/70"
					/>
					{query && (
						<button
							type="button"
							onClick={() => setQuery("")}
							className="shrink-0 text-muted-foreground hover:text-foreground"
						>
							<span className="icon-[lucide--x] h-3 w-3" />
						</button>
					)}
				</div>
			</div>

			{/* 树内容 */}
			<div className="dbx-scroll min-h-0 flex-1 overflow-y-auto px-1 py-1">
				{visibleConnectionNodes.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-10 text-center">
						<span className="icon-[lucide--database] h-8 w-8 text-muted-foreground/60" />
						<p className="mt-3 text-[11px] text-muted-foreground">
							{query ? "无匹配" : "暂无连接"}
						</p>
						{!query && (
							<p className="mt-1 text-[10px] text-muted-foreground/70">
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

			{/* 底部状态 */}
			<div className="flex shrink-0 items-center gap-1 border-t border-border px-3 py-1 text-[10px] text-muted-foreground/70">
				{state.activeConnectionName ? (
					<>
						<span className="icon-[lucide--activity] h-2.5 w-2.5 text-emerald-500" />
						<span className="truncate">当前: {state.activeConnectionName}</span>
					</>
				) : (
					<span>未选择连接</span>
				)}
			</div>
		</div>
	);
}

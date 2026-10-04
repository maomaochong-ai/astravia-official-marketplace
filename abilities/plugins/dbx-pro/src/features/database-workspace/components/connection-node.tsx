/**
 * 连接树节点 — 递归渲染 connection / table / column。
 *
 * 交互（对标 dbx 桌面壳）：
 * - 单击 connection：设为活动连接并绑定当前 tab；单击 table：选中查看结构
 * - 双击 connection：新建查询 tab；双击 table：SELECT * 预览
 * - 右键：新建查询 / 预览 / 查看结构 / 复制名称 / COUNT
 * - 箭头：展开懒加载子节点
 */

import { useState, type JSX } from "react";
import { useWorkbench } from "../hooks/use-workbench";
import type { TreeNode } from "../../../domain/tree-node-key";
import { getDatabaseTypeVisual } from "../../../domain/database-type-visual";
import { ContextMenu, type ContextMenuState } from "../../../shared/components/context-menu";
import { sendConnectionToAi, sendTableToAi } from "../../../shared/ai/send-context";

interface Props {
	node: TreeNode;
	depth: number;
	connectionName?: string;
	schema?: string;
}

let querySeq = 0;

export function ConnectionNode({ node, depth, connectionName, schema }: Props): JSX.Element {
	const { state, dispatch, loadNodeChildren, openPreviewTab, settings } = useWorkbench();
	const [menu, setMenu] = useState<ContextMenuState | null>(null);

	const isExpanded = state.expandedNodes.has(node.key);
	const isLoading = state.loadingNodes.has(node.key);
	const children = state.treeChildren.get(node.key) ?? [];
	const hasLoadedChildren = state.treeChildren.has(node.key);

	const selected =
		node.kind === "table" &&
		state.rightPanelTable?.connectionName === connectionName &&
		state.rightPanelTable?.tableName === node.label;

	const active = node.kind === "connection" && state.activeConnectionName === connectionName;

	/** schema 节点本身的名字就是 schema，展开时用它当 scope。 */
	const childScope = node.kind === "schema" ? node.label : schema;

	const qualifiedName = childScope ? `${childScope}.${node.label}` : node.label;

	function expand(): void {
		dispatch({ type: "toggleNode", key: node.key });
	}

	async function ensureChildren(): Promise<void> {
		if (!hasLoadedChildren) {
			await loadNodeChildren(node.key, connectionName ?? node.label, { schema: childScope });
		}
	}

	function activateConnection(): void {
		dispatch({ type: "setActiveConnection", name: node.label });
		if (state.activeTabId) {
			dispatch({ type: "updateTab", id: state.activeTabId, patch: { connectionName: node.label } });
		}
	}

	/** connection 双击：新建查询 tab 并绑定。 */
	function newQueryForConnection(): void {
		dispatch({ type: "setActiveConnection", name: node.label });
		const id = `tab-${Date.now().toString(36)}-${(querySeq++).toString(36)}`;
		dispatch({
			type: "addTab",
			tab: { id, label: node.label, connectionName: node.label, sql: "", isRunning: false },
		});
	}

	function handleClick(): void {
		if (node.kind === "connection") {
			activateConnection();
			void ensureChildren();
			if (!isExpanded) expand();
		} else if (node.kind === "schema") {
			// schema 节点只做展开/折叠：它本身不是可查询对象。
			void ensureChildren();
			if (!isExpanded) expand();
		} else if (node.kind === "table") {
			if (!connectionName) return;
			if (settings.tableSingleClickAction === "preview") {
				void openPreviewTab(connectionName, `SELECT * FROM ${qualifiedName} LIMIT 200;`, node.label);
			} else {
				dispatch({
					type: "selectRightTable",
					selection: { connectionName, tableName: node.label, schema: childScope },
				});
				void loadNodeChildren(node.key, connectionName, { schema: childScope });
			}
		}
	}

	function handleDoubleClick(): void {
		if (node.kind === "connection") {
			newQueryForConnection();
		} else if (node.kind === "table" && connectionName) {
			if (settings.tableDoubleClickAction === "preview") {
				void openPreviewTab(connectionName, `SELECT * FROM ${qualifiedName} LIMIT 200;`, node.label);
			} else {
				dispatch({
					type: "selectRightTable",
					selection: { connectionName, tableName: node.label, schema: childScope },
				});
				void loadNodeChildren(node.key, connectionName, { schema: childScope });
			}
		} else {
			void ensureChildren();
			if (!isExpanded) expand();
		}
	}

	function previewTable(): void {
		if (!connectionName) return;
		void openPreviewTab(connectionName, `SELECT * FROM ${qualifiedName} LIMIT 200;`, node.label);
	}

	function showStructure(): void {
		if (!connectionName) return;
		dispatch({
			type: "selectRightTable",
			selection: { connectionName, tableName: node.label, schema: childScope },
		});
		void loadNodeChildren(node.key, connectionName, { schema: childScope });
	}

	function countTable(): void {
		if (!connectionName) return;
		void openPreviewTab(connectionName, `SELECT COUNT(*) AS cnt FROM ${qualifiedName};`, "计数");
	}

	function handleContextMenu(e: React.MouseEvent): void {
		e.preventDefault();
		e.stopPropagation();
		if (node.kind === "connection") {
			setMenu({
				x: e.clientX,
				y: e.clientY,
				items: [
					{ type: "item", label: "新建查询", icon: "icon-[lucide--file-plus-2]", onClick: newQueryForConnection },
					{
						type: "item",
						label: isExpanded ? "折叠" : "展开表",
						icon: isExpanded ? "icon-[lucide--chevron-down]" : "icon-[lucide--chevron-right]",
						onClick: () => {
							void ensureChildren();
							if (!isExpanded) expand();
							else dispatch({ type: "toggleNode", key: node.key });
						},
					},
					{ type: "separator" },
					{
						type: "item",
						label: "发送到 AI 分析",
						icon: "icon-[lucide--sparkles]",
						onClick: () => sendConnectionToAi({ connectionName: node.label, dbType: node.dbType ?? "database" }),
					},
					{
						type: "item",
						label: "复制连接名",
						icon: "icon-[lucide--copy]",
						onClick: () => void navigator.clipboard.writeText(node.label).catch(() => {}),
					},
				],
			});
			return;
		}
if (node.kind === "schema") {
			setMenu({
				x: e.clientX,
				y: e.clientY,
				items: [
					{
						type: "item",
						label: isExpanded ? "折叠" : "展开表",
						icon: isExpanded ? "icon-[lucide--chevron-down]" : "icon-[lucide--chevron-right]",
						onClick: () => {
							void ensureChildren();
							if (!isExpanded) expand();
							else dispatch({ type: "toggleNode", key: node.key });
						},
					},
					{ type: "separator" },
					{
						type: "item",
						label: "复制 Schema 名",
						icon: "icon-[lucide--copy]",
						onClick: () => void navigator.clipboard.writeText(node.label).catch(() => {}),
					},
				],
			});
			return;
		}
		if (node.kind === "table" && connectionName) {
			setMenu({
				x: e.clientX,
				y: e.clientY,
				items: [
					{ type: "item", label: "SELECT * 预览", icon: "icon-[lucide--table-2]", onClick: previewTable },
					{ type: "item", label: "查看表结构", icon: "icon-[lucide--columns-3]", onClick: showStructure },
					{ type: "item", label: "统计行数", icon: "icon-[lucide--hash]", onClick: countTable },
					{ type: "separator" },
					{
						type: "item",
						label: "发送到 AI 分析",
						icon: "icon-[lucide--sparkles]",
						onClick: () => sendTableToAi({ connectionName, schema: childScope, table: node.label }),
					},
					{
						type: "item",
						label: "复制表名",
						icon: "icon-[lucide--copy]",
						onClick: () => void navigator.clipboard.writeText(node.label).catch(() => {}),
					},
					{
						type: "item",
						label: "复制限定名",
						icon: "icon-[lucide--clipboard-copy]",
						onClick: () => void navigator.clipboard.writeText(qualifiedName).catch(() => {}),
					},
				],
			});
		}
	}

	const statusDot = node.kind === "connection" ? state.connectionStatuses[node.label] ?? "idle" : undefined;

	return (
		<div>
			<div
				className={`group flex cursor-pointer items-center gap-1 rounded px-1.5 py-[3px] text-[12px] outline-none transition-colors focus-visible:ring-1 focus-visible:ring-foreground/40 ${
					active
						? "text-foreground"
						: selected
							? "text-foreground/90"
							: "text-foreground/70 hover:bg-[var(--dbx-hover)]"
				}`}
				style={{
					paddingLeft: 6 + depth * 14,
					backgroundColor: active ? "var(--dbx-surface-2)" : selected ? "var(--dbx-surface)" : undefined,
				}}
				onClick={handleClick}
				onDoubleClick={handleDoubleClick}
				onContextMenu={handleContextMenu}
				tabIndex={0}
			>
				{(node.kind === "connection" || node.kind === "schema" || node.kind === "table") && (
					<span
						onClick={(e) => {
							e.stopPropagation();
							void ensureChildren();
							expand();
						}}
						className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center text-muted-foreground transition-transform hover:text-foreground ${isExpanded ? "rotate-90" : ""}`}
					>
						<span className="icon-[lucide--chevron-right] h-3 w-3" />
					</span>
				)}
				{node.kind === "connection" && <ConnectionIcon dbType={node.dbType} status={statusDot} />}
				{node.kind === "schema" && (
					<span className="icon-[lucide--layers] h-3 w-3 shrink-0 text-sky-400/70" />
				)}
				{node.kind === "table" && (
					<span
						className={`h-3 w-3 shrink-0 ${node.tableKind === "VIEW" ? "icon-[lucide--eye-off] text-sky-400/70" : "icon-[lucide--table-2] text-emerald-400/70"}`}
					/>
				)}
				{node.kind === "column" && (
					<span
						className={`h-3 w-3 shrink-0 ${node.label.includes("(PK)") ? "icon-[lucide--key-round] text-amber-400" : "icon-[lucide--columns-3] text-muted-foreground"}`}
					/>
				)}
				<span className="min-w-0 flex-1 truncate">{node.label}</span>
				{isLoading && <span className="icon-[lucide--loader] h-3 w-3 shrink-0 animate-spin text-muted-foreground" />}
			</div>
			{isExpanded && children.length > 0 && (
				<div>
					{children.map((c) => (
						<ConnectionNode
							key={c.key}
							node={c}
							depth={depth + 1}
							connectionName={connectionName ?? (node.kind === "connection" ? node.label : undefined)}
							schema={childScope}
						/>
					))}
				</div>
			)}
			{menu && <ContextMenu menu={menu} onClose={() => setMenu(null)} />}
		</div>
	);
}

function ConnectionIcon({ dbType, status }: { dbType?: string; status?: string }): JSX.Element {
	if (!dbType) return <span className="icon-[lucide--database] h-3.5 w-3.5 shrink-0 text-muted-foreground" />;
	const visual = getDatabaseTypeVisual(dbType);
	const dotCls =
		status === "ok"
			? "bg-emerald-500"
			: status === "error"
				? "bg-red-500"
				: status === "running"
					? "animate-pulse bg-amber-400"
					: "bg-[var(--dbx-surface-2)]";
	return (
		<span className="relative shrink-0">
			<span
				className="flex h-4 w-4 items-center justify-center rounded-[4px] text-[8px] font-bold"
				style={{ backgroundColor: visual.color, color: visual.badge === "DU" ? "#1e293b" : "#fff" }}
			>
				{visual.badge}
			</span>
			<span className={`absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full ring-2 ring-[#0f1218] ${dotCls}`} />
		</span>
	);
}

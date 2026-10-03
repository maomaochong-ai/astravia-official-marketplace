/**
 * 连接树节点 — 递归渲染 connection / table / column 节点。
 */

import { useState, type JSX } from "react";
import { useWorkbench, type TreeNode as TreeNodeType } from "./workbench-context";
import { getDatabaseTypeVisual } from "../../../domain/database-type-visual";

interface Props {
	node: TreeNodeType;
	depth: number;
	connectionName?: string;
	schema?: string;
}

export function ConnectionNode({ node, depth, connectionName, schema }: Props): JSX.Element {
	const { state, dispatch, loadNodeChildren } = useWorkbench();
	const isExpanded = state.expandedNodes.has(node.key);
	const isLoading = state.loadingNodes.has(node.key);
	const children = state.treeChildren.get(node.key) ?? [];
	const hasLoadedChildren = state.treeChildren.has(node.key);
	// hover 状态暂未消费，保留 useState 以便后续添加 hover 交互
	useState(false);

	const selected = (() => {
		if (state.rightPanelTable && node.kind === "table") {
			const sel = state.rightPanelTable;
			if (sel.connectionName === connectionName && sel.tableName === node.label) return true;
		}
		return false;
	})();

	const active = state.activeConnectionName === connectionName && node.kind === "connection";

	async function handleToggle() {
		if (node.kind === "connection" || node.kind === "table") {
			dispatch({ type: "toggleNode", key: node.key });
			if (!hasLoadedChildren) {
				await loadNodeChildren(node.key, connectionName ?? node.label, { schema });
			}
			if (isExpanded) return;
		}
	}

	function handleSelect(e: React.MouseEvent) {
		e.stopPropagation();
		if (node.kind === "connection") {
			dispatch({ type: "setActiveConnection", name: node.label });
			// 同时把首个 tab 绑定到这个连接
			if (state.activeTabId) {
				dispatch({ type: "updateTab", id: state.activeTabId, patch: { connectionName: node.label } });
			}
			void handleToggle();
		} else if (node.kind === "table") {
			if (!connectionName) return;
			dispatch({
				type: "selectRightTable",
				selection: { connectionName, tableName: node.label, schema },
			});
			// 确保表详情被懒加载（列信息）
			void loadNodeChildren(node.key, connectionName, { schema });
		}
	}

	function handleContextMenu(e: React.MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		if (node.kind === "table" && connectionName) {
			// 预览
			const qualified = schema ? `${schema}.${node.label}` : node.label;
			const sql = `SELECT * FROM ${qualified} LIMIT 200;`;
			// 直接用 workbench 打开预览 tab
			setPreview(connectionName, sql, node.label);
		}
	}

	const statusDot = node.kind === "connection"
		? state.connectionStatuses[node.label] ?? "idle"
		: undefined;

	return (
		<div>
			<div
				className={`group flex cursor-pointer items-center gap-1 rounded px-1.5 py-[3px] text-[12px] transition-colors ${
					active
						? "bg-blue-500/15 text-blue-300"
						: selected
						? "bg-blue-500/10 text-blue-200"
						: "text-zinc-300 hover:bg-zinc-800/60"
				}`}
				style={{ paddingLeft: 6 + depth * 14 }}
				onClick={handleSelect}
				onDoubleClick={handleToggle}
				onContextMenu={handleContextMenu}
				tabIndex={0}
			>
				{(node.kind === "connection" || node.kind === "table") && (
					<span
						onClick={(e) => { e.stopPropagation(); void handleToggle(); }}
						className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center text-zinc-500 transition-transform ${isExpanded ? "rotate-90" : ""}`}
					>
						<span className="icon-[lucide--chevron-right] h-3 w-3" />
					</span>
				)}
				{node.kind === "connection" && (
					<ConnectionIcon dbType={node.dbType} status={statusDot} />
				)}
				{node.kind === "table" && (
					<span className={`h-3 w-3 shrink-0 ${node.tableKind === "VIEW" ? "icon-[lucide--eye-off] text-sky-400/70" : "icon-[lucide--table-2] text-emerald-400/70"}`} />
				)}
				{node.kind === "column" && (
					<span className={`h-3 w-3 shrink-0 ${node.label.includes("(PK)") ? "icon-[lucide--key-round] text-amber-400" : "icon-[lucide--columns-3] text-zinc-500"}`} />
				)}
				<span className="min-w-0 flex-1 truncate">{node.label}</span>
				{isLoading && (
					<span className="icon-[lucide--loader] h-3 w-3 shrink-0 animate-spin text-zinc-500" />
				)}
			</div>
			{isExpanded && children.length > 0 && (
				<div>
					{children.map((c) => (
						<ConnectionNode
							key={c.key}
							node={c}
							depth={depth + 1}
							connectionName={connectionName ?? (node.kind === "connection" ? node.label : undefined)}
							schema={schema}
						/>
					))}
				</div>
			)}
		</div>
	);
}

function ConnectionIcon({ dbType, status }: { dbType?: string; status?: string }): JSX.Element {
	if (!dbType) return <span className="icon-[lucide--database] h-3.5 w-3.5 shrink-0 text-muted-foreground" />;
	const visual = getDatabaseTypeVisual(dbType);
	const dotCls = status === "ok" ? "bg-emerald-500" : status === "error" ? "bg-red-500" : status === "running" ? "animate-pulse bg-amber-400" : "bg-zinc-500/40";
	return (
		<span className="relative shrink-0">
			<span
				className="flex h-4 w-4 items-center justify-center rounded-[4px] text-[8px] font-bold"
				style={{ backgroundColor: visual.color, color: visual.badge === "DU" ? "#1e293b" : "#fff" }}
			>
				{visual.badge}
			</span>
			<span className={`absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full ring-2 ring-[#0f1117] ${dotCls}`} />
		</span>
	);
}

// 在 ConnectionNode 内部通过 ref 间接拿 setPreview（避免循环 import）
function setPreview(_connectionName: string, _sql: string, _label?: string) {
	// 占位 — 由上层 ConnectionTree 注入
}

export function setPreviewHandler(fn: (connectionName: string, sql: string, label?: string) => void) {
	(setPreview as unknown as { fn: typeof fn }).fn = fn;
}

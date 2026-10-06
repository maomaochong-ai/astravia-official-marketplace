/**
 * 连接树节点 — 递归渲染 connection / schema / table / column。
 *
 * 交互：
 * - 单击 connection：设为活动连接并绑定当前 tab；单击 table：预览数据
 * - 双击 connection：新建查询 tab；双击 table：预览数据
 * - 右键：丰富的上下文菜单（新建查询/预览/查看结构/生成SQL/添加到AI/复制等）
 * - 箭头：展开懒加载子节点
 * - 拖拽：把节点（或多选整组）以 @提及 token 拖进宿主 AI 输入框，由宿主渲染为对象标签
 */

import { useState, type JSX } from "react";
import { useWorkbench } from "../hooks/use-workbench";
import type { TreeNode } from "../../../domain/tree-node-key";
import { parseColumnNodeKey } from "../../../domain/tree-node-key";
import { writeAiNodeDrag, setMentionDragImage, type AiNodeInfo } from "../../../domain/table-drag";
import { getDatabaseTypeVisual } from "../../../domain/database-type-visual";
import { engineDescribeByName } from "../../../shared/services/engine-client";
import { generateTableSql } from "../services/table-sql-template";
import type { EngineColumn } from "../state/workbench-types";
import { ContextMenu, type ContextMenuState } from "../../../shared/components/context-menu";
import {
	buildConnectionPrompt,
	buildTablePrompt,
	type SelectedNodeInfo,
} from "../../../shared/ai/send-context";
import { SendToAiDialog } from "./send-to-ai-dialog";

interface Props {
	node: TreeNode;
	depth: number;
	connectionName?: string;
	schema?: string;
}

let querySeq = 0;

export function ConnectionNode({ node, depth, connectionName, schema }: Props): JSX.Element {
	const {
		state,
		dispatch,
		loadNodeChildren,
		openPreviewTab,
		runTabSql,
		settings,
		selectionMode,
		selectedNodes,
		toggleNodeSelection,
	} = useWorkbench();
	const [menu, setMenu] = useState<ContextMenuState | null>(null);
	const [aiDialogOpen, setAiDialogOpen] = useState(false);
	const [aiPrompt, setAiPrompt] = useState("");

	const isExpanded = state.expandedNodes.has(node.key);
	const isLoading = state.loadingNodes.has(node.key);
	const children = state.treeChildren.get(node.key) ?? [];
	const hasLoadedChildren = state.treeChildren.has(node.key);

	const active = node.kind === "connection" && state.activeConnectionName === connectionName;

	/** schema 节点本身的名字就是 schema，展开时用它当 scope。 */
	const childScope = node.kind === "schema" ? node.label : schema;

	const qualifiedName = childScope ? `${childScope}.${node.label}` : node.label;

	// ─── 多选 ─────────────────────────────────────────────
	const isSelectable =
		selectionMode &&
		(node.kind === "connection" || node.kind === "schema" || node.kind === "table");
	const isNodeSelected = selectedNodes.has(node.key);
	/** 该节点在多选中的结构化信息。 */
	const nodeInfo: SelectedNodeInfo = {
		kind: node.kind as SelectedNodeInfo["kind"],
		connectionName: connectionName ?? node.label,
		// table 节点带上所属 schema；schema / connection 不需要。
		schema: node.kind === "table" ? childScope : undefined,
		label: node.label,
	};
	function toggleSelect(): void {
		toggleNodeSelection(node.key, nodeInfo);
	}

	function expand(): void {
		dispatch({ type: "toggleNode", key: node.key });
	}

	async function ensureChildren(): Promise<void> {
		if (!hasLoadedChildren) {
			await loadNodeChildren(node.key, connectionName ?? node.label, {
				schema: childScope,
				// 显式带节点自身方言，避免 state.connections 尚未同步时错走默认查询。
				dbType: node.kind === "connection" ? node.dbType : undefined,
			});
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
		// 多选模式：点行切换勾选，不执行预览 / 展开等原动作。
		if (isSelectable) {
			toggleSelect();
			return;
		}
		if (node.kind === "connection") {
			// activateConnection 经 reducer 已保证该连接展开，此处不再 toggle：
			// 否则会用陈旧 isExpanded 二次 dispatch，把刚展开的节点又折叠回去。
			activateConnection();
			void ensureChildren();
		} else if (node.kind === "schema") {
			void ensureChildren();
			if (!isExpanded) expand();
		} else if (node.kind === "table") {
			// 单击表节点：直接预览数据（不再显示右侧抽屉）
			if (!connectionName) return;
			// 不带 LIMIT，让服务端分页处理
			void openPreviewTab(connectionName, `SELECT * FROM ${qualifiedName};`, node.label);
		}
	}

	function handleDoubleClick(): void {
		// 多选模式：双击也只用于勾选，不触发新建 / 预览。
		if (isSelectable) return;
		if (node.kind === "connection") {
			newQueryForConnection();
		} else if (node.kind === "table" && connectionName) {
			// 双击表节点：在新标签页打开预览（不带 LIMIT，让服务端分页处理）
			void openPreviewTab(connectionName, `SELECT * FROM ${qualifiedName};`, node.label);
		} else {
			void ensureChildren();
			if (!isExpanded) expand();
		}
	}

	function previewTable(): void {
		if (!connectionName) return;
		// 不带 LIMIT，让服务端分页处理
		void openPreviewTab(connectionName, `SELECT * FROM ${qualifiedName};`, node.label);
	}

	function countTable(): void {
		if (!connectionName) return;
		void openPreviewTab(connectionName, `SELECT COUNT(*) AS cnt FROM ${qualifiedName};`, "计数");
	}

	function openAiDialog(prompt: string): void {
		setAiPrompt(prompt);
		setAiDialogOpen(true);
		setMenu(null);
	}

	/** 生成 SQL 模板并在新 tab 打开：按表真实列结构（/describe）生成，不写死 demo。 */
	async function generateSql(type: "select" | "insert" | "update" | "delete" | "create" | "alter" | "drop"): Promise<void> {
		const effectiveConnectionName = connectionName ?? (node.kind === "connection" ? node.label : undefined);
		if (!effectiveConnectionName) return;

		let columns: EngineColumn[] = [];
		// 所有模板都需要真实列结构（CREATE 也按列重建 DDL），统一走 describe；
		// 失败时模板内部降级为通用占位，不阻断用户。
		try {
			const outcome = await engineDescribeByName(effectiveConnectionName, {
				schema: childScope || undefined,
				table: node.label,
			});
			columns = outcome.columns.map((c) => ({
				name: c.name,
				type: c.type,
				nullable: c.nullable,
				hasDefault: c.hasDefault,
				defaultValue: c.defaultValue,
				comment: c.comment,
				isPrimaryKey: c.isPrimaryKey,
			}));
		} catch {
			// describe 失败时降级为无列模板（SELECT * 等），不阻断用户。
		}

		const sql = generateTableSql(type, {
			qualifiedName,
			dbType: state.connections.find((c) => c.name === effectiveConnectionName)?.db_type,
			columns,
		});

		const id = `tab-${Date.now().toString(36)}-${(querySeq++).toString(36)}`;
		dispatch({
			type: "addTab",
			tab: { id, label: `${node.label} ${type.toUpperCase()}`, connectionName: effectiveConnectionName, sql, isRunning: false },
		});
	}

	/**
	 * 危险操作（对齐 dbx 桌面壳「更多」）：开新 tab 并立即执行。
	 * 写 / DDL 会被引擎拦截（SQL_BLOCKED），由 Provider 的 WriteConfirmDialog
	 * 二次确认；只读连接在执行器内直接拒绝。不在浏览器侧用 window.confirm
	 * （宿主 webview 中是静默 no-op）。
	 */
	async function runDangerAction(params: {
		kind: "vacuum" | "truncate" | "delete" | "drop";
		cascade?: boolean;
	}): Promise<void> {
		const connName = connectionName ?? (node.kind === "connection" ? node.label : "");
		if (!connName) return;
		const dbType = (state.connections.find((c) => c.name === connName)?.db_type ?? "").toLowerCase();
		const t = qualifiedName;
		let sql = "";
		if (params.kind === "vacuum") {
			if (/postgres|pg|redshift|gaussdb|opengauss|kingbase|vastbase|highgo/.test(dbType)) {
				sql = `VACUUM${params.cascade ? " FULL" : ""} ${t};`;
			} else if (/mysql|maria|tidb|starrocks|doris/.test(dbType)) {
				sql = `OPTIMIZE TABLE ${t};`;
			} else {
				dispatch({ type: "setError", message: "当前数据库类型不支持表级 VACUUM / OPTIMIZE" });
				return;
			}
		} else if (params.kind === "truncate") {
			sql = `TRUNCATE TABLE ${t}${params.cascade ? " CASCADE" : ""};`;
		} else if (params.kind === "delete") {
			sql = `DELETE FROM ${t};`;
		} else {
			sql = `DROP TABLE IF EXISTS ${t}${params.cascade ? " CASCADE" : ""};`;
		}
		const id = `tab-${Date.now().toString(36)}-${(querySeq++).toString(36)}`;
		dispatch({
			type: "addTab",
			tab: { id, label: `${node.label} ${params.kind.toUpperCase()}`, connectionName: connName, sql, isRunning: false },
		});
		// 立即执行 → 触发写确认弹窗（非只读连接）或只读拒绝。写操作不分页。
		await runTabSql(id, sql);
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
						label: isExpanded ? "折叠" : "展开",
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
						label: "刷新",
						icon: "icon-[lucide--refresh-cw]",
						onClick: () => {
							dispatch({ type: "invalidateConnectionTree", name: node.label });
							void ensureChildren();
						},
					},
					{ type: "separator" },
					{
						type: "item",
						label: "发送到 AI 分析",
						icon: "icon-[lucide--sparkles]",
						onClick: () => openAiDialog(buildConnectionPrompt({ connectionName: node.label, dbType: node.dbType ?? "database" })),
					},
					{ type: "separator" },
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
						label: isExpanded ? "折叠" : "展开",
						icon: isExpanded ? "icon-[lucide--chevron-down]" : "icon-[lucide--chevron-right]",
						onClick: () => {
							void ensureChildren();
							if (!isExpanded) expand();
							else dispatch({ type: "toggleNode", key: node.key });
						},
					},
					{
						type: "item",
						label: "新建查询",
						icon: "icon-[lucide--file-plus-2]",
						onClick: () => {
							if (!connectionName) return;
							const id = `tab-${Date.now().toString(36)}-${(querySeq++).toString(36)}`;
							// schema 下新建空查询并绑定连接，不预置无效的 schema. 片段。
							dispatch({
								type: "addTab",
								tab: { id, label: `${node.label} 查询`, connectionName, sql: "", isRunning: false },
							});
						},
					},
					{ type: "separator" },
					{
						type: "item",
						label: "发送到 AI 分析",
						icon: "icon-[lucide--sparkles]",
						onClick: () => {
							const prompt = `请分析数据库 schema "${node.label}" 中的所有表结构和关系。`;
							openAiDialog(prompt);
						},
					},
					{ type: "separator" },
					{
						type: "item",
						label: "复制 Schema 名",
						icon: "icon-[lucide--copy]",
						onClick: () => void navigator.clipboard.writeText(node.label).catch(() => {}),
					},
					{
						type: "item",
						label: "复制为 SQL 引用",
						icon: "icon-[lucide--braces]",
						onClick: () => {
							const ref = `"${node.label}"`;
							void navigator.clipboard.writeText(ref).catch(() => {});
						},
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
					// 查看数据
					{ type: "item", label: "预览数据", icon: "icon-[lucide--table-2]", onClick: previewTable },
					{ 
						type: "item", 
						label: "在新标签页打开", 
						icon: "icon-[lucide--external-link]", 
						onClick: () => {
							if (!connectionName) return;
							const sql = `SELECT * FROM ${qualifiedName} LIMIT 100;`;
							const id = `tab-${Date.now().toString(36)}-${(querySeq++).toString(36)}`;
							dispatch({
								type: "addTab",
								tab: { id, label: node.label, connectionName, sql, isRunning: false },
							});
						}
					},
					{ type: "separator" },
					// 统计
					{ type: "item", label: "统计行数", icon: "icon-[lucide--hash]", onClick: countTable },
					{ type: "separator" },
					// 生成 SQL 子菜单
					{
						type: "submenu",
						label: "生成 SQL",
						icon: "icon-[lucide--code]",
						items: [
							{ type: "item", label: "SELECT", onClick: () => generateSql("select") },
							{ type: "item", label: "INSERT", onClick: () => generateSql("insert") },
							{ type: "item", label: "UPDATE", onClick: () => generateSql("update") },
							{ type: "item", label: "DELETE", onClick: () => generateSql("delete") },
							{ type: "separator" },
							{ type: "item", label: "CREATE TABLE", onClick: () => generateSql("create") },
							{ type: "item", label: "ALTER TABLE", onClick: () => generateSql("alter") },
							{ type: "item", label: "DROP TABLE", onClick: () => generateSql("drop") },
						],
					},
					{ type: "separator" },
					// AI 分析
					{
						type: "item",
						label: "添加到 AI",
						icon: "icon-[lucide--sparkles]",
						onClick: () => openAiDialog(buildTablePrompt({ connectionName, schema: childScope, table: node.label })),
					},
					{ type: "separator" },
					// 复制相关
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
					{
						type: "item",
						label: "复制为 SQL 引用",
						icon: "icon-[lucide--braces]",
						onClick: () => {
							const ref = childScope ? `"${childScope}"."${node.label}"` : `"${node.label}"`;
							void navigator.clipboard.writeText(ref).catch(() => {});
						},
					},
					{ type: "separator" },
				// 危险操作（对齐 dbx 桌面壳「更多」：红色展开项 + 二次确认）
				{
					type: "submenu",
					label: "更多",
					icon: "icon-[lucide--list-collapse]",
					items: [
						{
							type: "item",
							label: "执行 VACUUM",
							icon: "icon-[lucide--activity]",
							onClick: () => void runDangerAction({ kind: "vacuum" }),
						},
						{
							type: "item",
							label: "执行 VACUUM FULL",
							icon: "icon-[lucide--gauge]",
							onClick: () => void runDangerAction({ kind: "vacuum", cascade: true }),
						},
						{ type: "separator" },
						{
							type: "item",
							label: "截断表",
							icon: "icon-[lucide--scissors]",
							danger: true,
							onClick: () => void runDangerAction({ kind: "truncate" }),
						},
						{
							type: "item",
							label: "清空数据",
							icon: "icon-[lucide--eraser]",
							danger: true,
							onClick: () => void runDangerAction({ kind: "delete" }),
						},
						{
							type: "item",
							label: "删除表",
							icon: "icon-[lucide--trash-2]",
							danger: true,
							onClick: () => void runDangerAction({ kind: "drop" }),
						},
						{
							type: "item",
							label: "强制删除（CASCADE）",
							icon: "icon-[lucide--unlink]",
							danger: true,
							onClick: () => void runDangerAction({ kind: "drop", cascade: true }),
						},
					],
				},
				{ type: "separator" },
				// 刷新
				{
					type: "item",
					label: "刷新",
					icon: "icon-[lucide--refresh-cw]",
					onClick: () => {
						dispatch({ type: "invalidateConnectionTree", name: connectionName });
						void ensureChildren();
					},
				},
				],
			});
		}
	}

	const statusDot = node.kind === "connection" ? state.connectionStatuses[node.label] ?? "idle" : undefined;

	// ── 拖拽：把 @提及 token 拖进宿主 AI 输入框（多选时携带整组）────────────
	function handleDragStart(e: React.DragEvent): void {
		const conn = connectionName ?? node.label;

		// 当前节点的单对象载荷
		let single: AiNodeInfo;
		if (node.kind === "column") {
			const ref = parseColumnNodeKey(node.key);
			single = {
				kind: "column",
				connectionName: conn,
				schema: schema || ref?.schema || undefined,
				tableName: ref?.table,
				columnName: node.label,
				label: node.label,
			};
		} else if (node.kind === "table") {
			single = {
				kind: "table",
				connectionName: conn,
				schema: childScope || undefined,
				tableName: node.label,
				label: node.label,
			};
		} else {
			single = {
				kind: node.kind,
				connectionName: conn,
				schema: node.kind === "schema" ? node.label : childScope || undefined,
				label: node.label,
			};
		}

		// 多选模式且拖拽起点属于已选集合：携带全部已选连接 / schema / 表。
		let payloads: AiNodeInfo[] = [single];
		if (selectionMode && node.kind !== "column" && isNodeSelected) {
			const multi: AiNodeInfo[] = [...selectedNodes.values()].map((n) => ({
				kind: n.kind as AiNodeInfo["kind"],
				connectionName: n.connectionName,
				schema: n.kind === "table" ? n.schema : undefined,
				tableName: n.kind === "table" ? n.label : undefined,
				label: n.label,
			}));
			if (multi.length > 0) payloads = multi;
		}

		writeAiNodeDrag(e.dataTransfer, payloads);
		// 艾规范提及标签风格的拖拽幽灵（多选显示整组 chip）。
		setMentionDragImage(e, payloads);
	}

	const isDraggable = node.kind === "table" || node.kind === "schema" || node.kind === "connection" || node.kind === "column";

	return (
		<div>
			<div
				draggable={isDraggable}
				onDragStart={handleDragStart}
				className={`group flex cursor-pointer items-center gap-1 rounded px-1.5 py-[3px] text-[12px] outline-none transition-colors focus-visible:ring-1 focus-visible:ring-foreground/40 ${
					active
						? "text-foreground"
						: "text-foreground/70 hover:bg-[var(--dbx-hover)]"
				}`}
				style={{
					paddingLeft: 6 + depth * 14,
					backgroundColor: active ? "var(--dbx-surface-2)" : undefined,
					cursor: isDraggable ? "grab" : "default",
				}}
				onClick={handleClick}
				onDoubleClick={handleDoubleClick}
				onContextMenu={handleContextMenu}
				tabIndex={0}
			>
					{isSelectable && (
					<span
						onClick={(e) => {
							e.stopPropagation();
							toggleSelect();
						}}
						className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border"
						style={
							isNodeSelected
								? { backgroundColor: "var(--foreground)", borderColor: "var(--foreground)", color: "var(--background)" }
								: { borderColor: "var(--dbx-line)", color: "transparent" }
						}
						aria-hidden="true"
					>
						<span className="icon-[lucide--check] h-2.5 w-2.5" />
					</span>
				)}
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
			<SendToAiDialog open={aiDialogOpen} prompt={aiPrompt} onClose={() => setAiDialogOpen(false)} />
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
			<span className={`absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full ring-2 ring-[var(--background)] ${dotCls}`} />
		</span>
	);
}

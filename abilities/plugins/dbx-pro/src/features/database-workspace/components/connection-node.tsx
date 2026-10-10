/**
 * 连接树节点 — 递归渲染 connection / schema / table / column。
 *
 * 交互：
 * - 单击 connection：设为活动连接并绑定当前 tab；单击 table：仅选中，不打开也不执行查询
 * - 双击 connection：新建查询 tab；双击 table：预览数据（打开 tab 并立即执行 SELECT）
 * - 右键：丰富的上下文菜单（新建查询/预览/查看结构/生成SQL/添加到AI/复制等）
 * - 箭头：展开懒加载子节点
 * - 拖拽：把节点（或多选整组）以 @提及 token 拖进宿主 AI 输入框，由宿主渲染为对象标签
 */

import { useState, type JSX } from "react";
import { useWorkbench } from "../hooks/use-workbench";
import type { TreeNode } from "../../../domain/tree-node-key";
import { parseColumnNodeKey } from "../../../domain/tree-node-key";
import { isMentionableKind, writeAiNodeDrag, setMentionDragImage, type AiNodeInfo } from "../../../domain/table-drag";
import { getDatabaseTypeVisual } from "../../../domain/database-type-visual";
import { engineDescribeByName } from "../../../shared/services/engine-client";
import { buildNewTableTemplate, generateTableSql } from "../services/table-sql-template";
import { buildRoutineCallTemplate } from "../services/routines-catalog";
import type { EngineColumn } from "../state/workbench-types";
import { ContextMenu, type ContextMenuState } from "../../../shared/components/context-menu";
import {
	buildConnectionPrompt,
	buildTablePrompt,
	buildDashboardPrompt,
	buildScreenPrompt,
	type SelectedNodeInfo,
} from "../../../shared/ai/send-context";
import { SendToAiDialog } from "./send-to-ai-dialog";
import { nextTabId } from "../state/tab-ids";

interface Props {
	node: TreeNode;
	depth: number;
	connectionName?: string;
	schema?: string;
}

export function ConnectionNode({ node, depth, connectionName, schema }: Props): JSX.Element {
	const {
		state,
		dispatch,
		loadNodeChildren,
		openPreviewTab,
		runTabSql,
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
		const id = nextTabId();
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
		} else if (node.kind === "schema" || node.kind === "routine-folder") {
			void ensureChildren();
			if (!isExpanded) expand();
		}
		// table：单击只做选中（多选逻辑在外层处理），不再隐式打开或执行查询；
		// 预览数据与查看结构分别在双击、右键菜单里，避免单击就误跑一条大表 SELECT。
	}

	function handleDoubleClick(): void {
		// 多选模式：双击也只用于勾选，不触发新建 / 预览。
		if (isSelectable) return;
		if (node.kind === "connection") {
			newQueryForConnection();
		} else if (node.kind === "table" && connectionName) {
			previewTable();
		} else if (node.kind === "routine" && connectionName) {
			openRoutineCall();
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

	/** 查看表结构：走 DESCRIBE 等价 SQL，在新 tab 打开并执行。 */
	function viewStructure(): void {
		if (!connectionName) return;
		const dbType = state.connections.find((c) => c.name === connectionName)?.db_type;
		void openPreviewTab(connectionName, buildDescribeSql(node.label, childScope, dbType), `${node.label} 结构`);
	}

	function countTable(): void {
		if (!connectionName) return;
		void openPreviewTab(connectionName, `SELECT COUNT(*) AS cnt FROM ${qualifiedName};`, "计数");
	}

	/**
	 * 新建表：打开一个带 schema 限定名的 CREATE TABLE 模板。
	 * 必须写限定名 —— 不带 schema 的 CREATE TABLE 落在连接会话的 search_path 上，
	 * 未必是树里显示、用户以为的那个 schema；建完就会出现「树里能看到、SQL 里查不到」。
	 */
	function openNewTable(connName: string, targetSchema?: string): void {
		if (!connName) return;
		const id = nextTabId();
		dispatch({
			type: "addTab",
			tab: {
				id,
				label: targetSchema ? `${targetSchema} 新建表` : "新建表",
				connectionName: connName,
				sql: buildNewTableTemplate({ schema: targetSchema }),
				isRunning: false,
			},
		});
	}

	/**
	 * 例程：打开调用模板 tab。**不自动执行** —— 模板里的参数要用户自己填，
	 * 直接跑 `CALL f()` 只会报参数错误，或者更糟：在真有默认参数的库上误触发副作用。
	 */
	function openRoutineCall(): void {
		if (!connectionName || !node.routineName) return;
		dispatch({
			type: "addTab",
			tab: {
				id: nextTabId(),
				label: node.routineName,
				connectionName,
				sql: buildRoutineCallTemplate({
					schema: childScope ?? "",
					name: node.routineName,
					kind: node.routineKind ?? "",
					args: node.routineArgs ?? "",
				}),
				isRunning: false,
			},
		});
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

		const id = nextTabId();
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
	function runDangerAction(params: {
		kind: "vacuum" | "truncate" | "delete" | "drop";
		cascade?: boolean;
	}): void {
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
		const id = nextTabId();
		dispatch({
			type: "addTab",
			tab: { id, label: `${node.label} ${params.kind.toUpperCase()}`, connectionName: connName, sql, isRunning: false },
		});
		// 立即执行 → 触发写确认弹窗（非只读连接）或只读拒绝。写操作不分页。
		// 必须延迟到下一 tick：addTab 的 reducer 状态要等重渲染才同步进 stateRef，
		// 同一 tick 内执行器查不到该 tab，会直接报「Tab 不存在」（与 openPreviewTab 同构）。
		setTimeout(() => {
			void runTabSql(id, sql);
		}, 0);
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
					{
						type: "item",
						label: "新建表",
						icon: "icon-[lucide--table-2]",
						onClick: () => openNewTable(node.label),
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
							const id = nextTabId();
							// schema 下新建空查询并绑定连接，不预置无效的 schema. 片段。
							dispatch({
								type: "addTab",
								tab: { id, label: `${node.label} 查询`, connectionName, sql: "", isRunning: false },
							});
						},
					},
					{
						type: "item",
						label: "新建表",
						icon: "icon-[lucide--table-2]",
						onClick: () => openNewTable(connectionName ?? "", node.label),
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
		
		if (node.kind === "routine") {
			const routineName = node.routineName ?? node.label;
			const routineQualified = childScope ? `${childScope}.${routineName}` : routineName;
			setMenu({
				x: e.clientX,
				y: e.clientY,
				items: [
					{ type: "item", label: "生成调用模板", icon: "icon-[lucide--square-terminal]", onClick: openRoutineCall },
					{ type: "separator" },
					{
						type: "item",
						label: "复制例程名",
						icon: "icon-[lucide--copy]",
						onClick: () => void navigator.clipboard.writeText(routineName).catch(() => {}),
					},
					{
						type: "item",
						label: "复制限定名",
						icon: "icon-[lucide--clipboard-copy]",
						onClick: () => void navigator.clipboard.writeText(routineQualified).catch(() => {}),
					},
				],
			});
			return;
		}

		if (node.kind === "routine-folder") {
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
					{ type: "item", label: "查看表结构", icon: "icon-[lucide--columns-3]", onClick: viewStructure },
					{ 
						type: "item", 
						label: "在新标签页打开（不执行）",
						icon: "icon-[lucide--external-link]", 
						onClick: () => {
							if (!connectionName) return;
							const sql = `SELECT * FROM ${qualifiedName} LIMIT 100;`;
							const id = nextTabId();
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
				// 可视化
				{
					type: "submenu",
					label: "可视化",
					icon: "icon-[lucide--bar-chart-3]",
					items: [
						{
							type: "item",
							label: "生成企业看板",
							icon: "icon-[lucide--layout-dashboard]",
							// 同步置位即可：ContextMenu 只在菜单外的 mousedown 上关闭，
							// 同一批更新里「关菜单 + 开对话框」不会互相干扰（同菜单的「添加到 AI」就是这样）。
							// 用 setTimeout 延迟会多一次宏任务，节点在这期间被回收就成了空点击。
							onClick: () => {
							setAiPrompt(buildDashboardPrompt([{ kind: "table", connectionName: connectionName ?? "", schema: childScope, label: node.label }]));
							setAiDialogOpen(true);
						},
						},
						{
							type: "item",
							label: "生成数据大屏",
							icon: "icon-[lucide--monitor]",
							onClick: () => {
								setAiPrompt(buildScreenPrompt([{ kind: "table", connectionName: connectionName ?? "", schema: childScope, label: node.label }]));
								setAiDialogOpen(true);
							},
						},
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
		} else if (node.kind === "schema") {
			single = {
				kind: "schema",
				connectionName: conn,
				schema: node.label,
				label: node.label,
			};
		} else {
			// 例程 / 例程分组不参与 @提及 拖拽：宿主提及语法里没有它们的形态。
			return;
		}

		// 多选模式且拖拽起点属于已选集合：携带全部已选连接 / schema / 表。
		let payloads: AiNodeInfo[] = [single];
		if (selectionMode && node.kind !== "column" && isNodeSelected) {
			const multi: AiNodeInfo[] = [...selectedNodes.values()]
				.filter((n) => isMentionableKind(n.kind))
				.map((n) => ({
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

	// 例程与例程分组不可拖拽：宿主 AI 提及语法里没有它们的形态，拖了只会产生无效标签。
	const isDraggable = isMentionableKind(node.kind);

	return (
		<div>
			<div
				draggable={isDraggable}
				onDragStart={handleDragStart}
				className={`group flex h-6 cursor-pointer items-center gap-1.5 whitespace-nowrap pr-2 text-[12px] outline-none transition-colors focus-visible:ring-1 focus-visible:ring-link/40 ${
					isNodeSelected || active
						? "bg-link-soft font-medium text-surface-foreground"
						: "text-muted hover:bg-neutral-muted"
				}`}
				style={{
					paddingLeft: 8 + depth * 12,
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
						className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border border-border-strong"
						style={
							isNodeSelected
								? { backgroundColor: "var(--dbx-accent)", borderColor: "var(--dbx-accent)", color: "#fff" }
								: { color: "transparent" }
						}
						aria-hidden="true"
					>
						<span className="icon-[lucide--check] h-2.5 w-2.5" />
					</span>
				)}
				{(node.kind === "connection" || node.kind === "schema" || node.kind === "table" || node.kind === "routine-folder") && (
					<span
						onClick={(e) => {
							e.stopPropagation();
							void ensureChildren();
							expand();
						}}
						className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center text-muted transition-transform hover:text-surface-foreground ${isExpanded ? "rotate-90" : ""}`}
					>
						<span className="icon-[lucide--chevron-right] h-3 w-3" />
					</span>
				)}
				{node.kind === "connection" && <ConnectionIcon dbType={node.dbType} status={statusDot} />}
				{node.kind === "schema" && (
					<span className="icon-[lucide--layers] h-3 w-3 shrink-0 text-link/70" />
				)}
				{node.kind === "table" && (
					<span
						className={`h-3 w-3 shrink-0 ${node.tableKind === "VIEW" ? "icon-[lucide--eye-off] text-link/70" : "icon-[lucide--table-2] text-success/70"}`}
					/>
				)}
				{node.kind === "column" && (
					<span
						className={`h-3 w-3 shrink-0 ${node.label.includes("(PK)") ? "icon-[lucide--key-round] text-warning" : "icon-[lucide--columns-3] text-muted-foreground"}`}
					/>
				)}
				{node.kind === "routine-folder" && (
					<span className="icon-[lucide--braces] h-3 w-3 shrink-0 text-warning/70" />
				)}
				{node.kind === "routine" && (
					<span
						className={`h-3 w-3 shrink-0 ${node.routineKind === "PROCEDURE" ? "icon-[lucide--square-terminal] text-warning/80" : "icon-[lucide--sigma] text-link/80"}`}
					/>
				)}
				<span className={`min-w-0 flex-1 truncate ${node.kind === "schema" || node.kind === "table" || node.kind === "column" || node.kind === "routine" ? "font-mono" : "text-[13px]"}`}>{node.label}</span>
				{isLoading && <span className="icon-[lucide--loader] size-3 shrink-0 animate-spin text-muted" />}
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
	if (!dbType) return <span className="icon-[lucide--database] size-3.5 shrink-0 text-muted" />;
	const visual = getDatabaseTypeVisual(dbType);
	const dotCls =
		status === "ok"
			? "bg-success"
			: status === "error"
				? "bg-danger"
				: status === "running"
					? "animate-pulse bg-warning"
					: "bg-border-strong";
	return (
		<span className="relative shrink-0">
			<span
				className="flex h-4 w-4 items-center justify-center rounded-[4px] text-[8px] font-bold"
				style={{ backgroundColor: visual.color, color: visual.badge === "DU" ? "#1e293b" : "#fff" }}
			>
				{visual.badge}
			</span>
			<span className={`absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full ring-2 ring-[var(--dbx-surface)] ${dotCls}`} />
		</span>
	);
}

/**
 * 根据数据库类型生成查看表结构的 SQL。
 * 对齐 dbx 桌面壳的表结构查看行为。
 */
function buildDescribeSql(tableName: string, schema: string | undefined, dbType: string | undefined): string {
	const type = (dbType ?? "").toLowerCase();
	const qualifiedName = schema ? `${schema}.${tableName}` : tableName;
	// PostgreSQL 系：使用 information_schema
	if (/postgres|pg|redshift|gaussdb|opengauss|kingbase|vastbase|highgo/.test(type)) {
		const schemaFilter = schema ? `AND table_schema = '${schema.replace(/'/g, "''")}'` : "AND table_schema = current_schema()";
		return `SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = '${tableName.replace(/'/g, "''")}' ${schemaFilter}
ORDER BY ordinal_position;`;
	}
	// MySQL 系：使用 DESCRIBE
	if (/mysql|maria|tidb|starrocks|doris|oceanbase/.test(type)) {
		return `DESCRIBE ${qualifiedName};`;
	}
	// SQL Server：使用 INFORMATION_SCHEMA.COLUMNS
	if (/mssql|sqlserver/.test(type)) {
		const schemaFilter = schema ? `AND TABLE_SCHEMA = '${schema.replace(/'/g, "''")}'` : "";
		return `SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE, COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = '${tableName.replace(/'/g, "''")}' ${schemaFilter}
ORDER BY ORDINAL_POSITION;`;
	}
	// SQLite：使用 PRAGMA
	if (/sqlite|duckdb|cloudflare-d1|turso/.test(type)) {
		return `PRAGMA table_info('${tableName.replace(/'/g, "''")}');`;
	}
	// 默认：使用通用的 DESCRIBE 或 information_schema
	return `DESCRIBE ${qualifiedName};`;
}

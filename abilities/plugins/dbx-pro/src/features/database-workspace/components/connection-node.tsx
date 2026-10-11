/**
 * 连接树节点 — 递归渲染 connection / schema / table / column。
 *
 * 交互：
 * - 单击 connection：设为活动连接并绑定当前 tab；单击 table：仅选中，不打开也不执行查询
 * - 双击 connection：新建查询 tab；双击 table：查看数据（打开 tab 并立即执行 SELECT）
 * - 右键：上下文菜单按节点类型给出连接 / 库 / 表三套条目（对齐设计稿 contextMenus.ts）。
 * - 箭头：展开懒加载子节点
 * - 拖拽：把节点（或多选整组）以 @提及 token 拖进宿主 AI 输入框，由宿主渲染为对象标签
 */

import { useState, type JSX } from "react";
import { useWorkbench } from "../hooks/use-workbench";
import type { TreeNode } from "../../../domain/tree-node-key";
import { parseColumnNodeKey } from "../../../domain/tree-node-key";
import { isMentionableKind, writeAiNodeDrag, setMentionDragImage, type AiNodeInfo } from "../../../domain/table-drag";
import { DatabaseTypeIcon } from "../../../shared/components/database-type-icon";
import { engineDescribeByName, engineRemoveConnection } from "../../../shared/services/engine-client";
import { buildNewTableTemplate, generateTableSql } from "../services/table-sql-template";
import { buildRoutineCallTemplate, buildRoutineDefinitionSql } from "../services/routines-catalog";
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
		refreshConnections,
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
			openRoutineDefinition();
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
	 * 重命名表：打开 ALTER TABLE … RENAME TO … 模板（新表名留给用户填），**不自动执行**。
	 * 设计稿 TABLE_MENU 有「重命名」，插件没有就地重命名的表设计器；
	 * 与「生成 SQL」系列保持一致，用真实可执行的方言模板替代，避免做一个点了没反应的重命名框。
	 */
	function openRenameTable(): void {
		if (!connectionName) return;
		const dbType = state.connections.find((c) => c.name === connectionName)?.db_type;
		dispatch({
			type: "addTab",
			tab: {
				id: nextTabId(),
				label: `${node.label} 重命名`,
				connectionName,
				sql: buildRenameTableSql(qualifiedName, dbType),
				isRunning: false,
			},
		});
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

	/**
	 * 例程：打开「查看定义」tab —— 展示服务端原生定义（pg_get_functiondef /
	 * SHOW CREATE PROCEDURE / OBJECT_DEFINITION / all_source），而不是调用模板。
	 * 定义 SQL 没有参数，直接执行并把结果展示出来；方言拿不到定义时降级为调用模板，
	 * 且不自动执行（参数要用户自己填）。
	 */
	function openRoutineDefinition(): void {
		if (!connectionName || !node.routineName) return;
		const dbType = state.connections.find((c) => c.name === connectionName)?.db_type;
		const built = buildRoutineDefinitionSql(
			{
				schema: childScope ?? "",
				name: node.routineName,
				kind: node.routineKind ?? "",
				args: node.routineArgs ?? "",
			},
			dbType,
		);
		if (built.supported) {
			void openPreviewTab(connectionName, built.sql, `${node.routineName} 定义`);
			return;
		}
		dispatch({
			type: "addTab",
			tab: {
				id: nextTabId(),
				label: node.routineName,
				connectionName,
				sql: built.sql,
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

	/** 复制文本：webview 里剪贴板写入可能被拒，静默失败，不打断菜单操作。 */
	function copyText(text: string): void {
		void navigator.clipboard.writeText(text).catch(() => {});
	}

	/**
	 * 「复制连接信息」子菜单取值。DbConnection 没有现成的连接串字段，
	 * 这里用真实字段拼一个**不含密码**的 DSN（复制/导出都不带凭据）。
	 */
	function connectionFacts(connName: string): { endpoint: string; dsn: string; database?: string } {
		const conn = state.connections.find((c) => c.name === connName);
		if (!conn) return { endpoint: connName, dsn: connName };
		const database = conn.database || undefined;
		return {
			endpoint: `${conn.host}:${conn.port}`,
			dsn: `${conn.db_type}://${conn.host}:${conn.port}${database ? `/${database}` : ""}`,
			database,
		};
	}

	/** 创建数据库：只开模板 tab，不自动执行（与「新建表」同一约定）。 */
	function openCreateDatabase(connName: string): void {
		if (!connName) return;
		dispatch({
			type: "addTab",
			tab: {
				id: nextTabId(),
				label: "创建数据库",
				connectionName: connName,
				sql: "CREATE DATABASE new_database;",
				isRunning: false,
			},
		});
	}

	/** 新建 Schema：同样只开模板 tab，schema 名留给用户改写。 */
	function openCreateSchema(connName: string): void {
		if (!connName) return;
		dispatch({
			type: "addTab",
			tab: {
				id: nextTabId(),
				label: `${node.label} 新建 Schema`,
				connectionName: connName,
				sql: "CREATE SCHEMA new_schema;",
				isRunning: false,
			},
		});
	}

	/** 表级「新建查询」：空 tab 绑定连接，不预置 SQL（与库级「新建查询」一致）。 */
	function openEmptyQueryTab(connName: string): void {
		if (!connName) return;
		dispatch({
			type: "addTab",
			tab: { id: nextTabId(), label: `${node.label} 查询`, connectionName: connName, sql: "", isRunning: false },
		});
	}

	/** 「新标签页查看」：带 SELECT 的 tab 但**不执行**（用户可能先改 SQL 再跑）。 */
	function openTableInNewTab(connName: string): void {
		if (!connName) return;
		dispatch({
			type: "addTab",
			tab: {
				id: nextTabId(),
				label: node.label,
				connectionName: connName,
				sql: `SELECT * FROM ${qualifiedName} LIMIT 100;`,
				isRunning: false,
			},
		});
	}

	/** 刷新节点：先失效该连接的树缓存再重拉当前层（reducer 会清展开态与子节点）。 */
	function refreshNode(connName: string): void {
		if (!connName) return;
		dispatch({ type: "invalidateConnectionTree", name: connName });
		void ensureChildren();
	}

	/**
	 * 「复制表结构为」：列信息走 /describe（与生成 SQL 同一真值源），输出 TSV / Markdown。
	 * 设计稿只给了格式不给字段，列头取：列名 / 类型 / 可空 / 默认值 / 主键。
	 */
	async function copyStructure(format: "tsv" | "markdown"): Promise<void> {
		const effectiveConnectionName = connectionName ?? (node.kind === "connection" ? node.label : undefined);
		if (!effectiveConnectionName) return;
		try {
			const outcome = await engineDescribeByName(effectiveConnectionName, {
				schema: childScope || undefined,
				table: node.label,
			});
			const header = ["列名", "类型", "可空", "默认值", "主键"];
			const rows = outcome.columns.map((c) => [
				c.name,
				c.type,
				c.nullable === false ? "NO" : "YES",
				c.defaultValue,
				c.isPrimaryKey ? "PK" : "",
			]);
			const text =
				format === "tsv"
					? [header, ...rows].map((cells) => cells.join("\t")).join("\n")
					: [
							`| ${header.join(" | ")} |`,
							`| ${header.map(() => "---").join(" | ")} |`,
							...rows.map((cells) => `| ${cells.join(" | ")} |`),
						].join("\n");
			copyText(text);
		} catch (err) {
			dispatch({ type: "setError", message: `复制表结构失败：${err instanceof Error ? err.message : String(err)}` });
		}
	}

	/**
	 * 删除 Schema（设计稿 SCHEMA_MENU 的 danger 行）：与「强制删除」同路径 ——
	 * 开 tab 立即执行，DDL 由引擎拦截 + 写确认弹窗二次确认；只读连接在执行器被拒。
	 * CASCADE 只加在 PG 系方言：MySQL / MSSQL 的 DROP SCHEMA 不接受 CASCADE。
	 */
	function runDropSchema(): void {
		const connName = connectionName ?? "";
		if (!connName) return;
		const dbType = (state.connections.find((c) => c.name === connName)?.db_type ?? "").toLowerCase();
		const cascade = /postgres|pg|redshift|gaussdb|opengauss|kingbase|vastbase|highgo/.test(dbType);
		const sql = `DROP SCHEMA IF EXISTS ${node.label}${cascade ? " CASCADE" : ""};`;
		const id = nextTabId();
		dispatch({
			type: "addTab",
			tab: { id, label: `${node.label} DROP SCHEMA`, connectionName: connName, sql, isRunning: false },
		});
		setTimeout(() => {
			void runTabSql(id, sql);
		}, 0);
	}

	/**
	 * 删除连接：设计稿 CONNECTION_MENU 的 danger 行。
	 * 宿主 webview 里 window.confirm 是静默 no-op，所以二次确认用菜单自身的第二步
	 * （同坐标重开一个确认菜单），既不引入新原子类，也不假装已经问过用户。
	 */
	function confirmRemoveConnection(connName: string): void {
		if (!menu) return;
		setMenu({
			x: menu.x,
			y: menu.y,
			items: [
				{
					type: "item",
					label: `确认删除连接「${connName}」`,
					icon: "icon-[lucide--trash-2]",
					danger: true,
					onClick: () => void removeConnection(connName),
				},
				{ type: "separator" },
				{ type: "item", label: "取消", icon: "icon-[lucide--x]", onClick: () => setMenu(null) },
			],
		});
	}

	async function removeConnection(connName: string): Promise<void> {
		setMenu(null);
		try {
			await engineRemoveConnection(connName);
			// 删掉的正是当前活动连接时清空活动态，避免底部状态条继续显示已不存在的连接。
			if (state.activeConnectionName === connName) dispatch({ type: "setActiveConnection", name: null });
			await refreshConnections();
		} catch (err) {
			dispatch({ type: "setError", message: `删除连接失败：${err instanceof Error ? err.message : String(err)}` });
		}
	}

	function handleContextMenu(e: React.MouseEvent): void {
		e.preventDefault();
		e.stopPropagation();
		
		if (node.kind === "connection") {
			const facts = connectionFacts(node.label);
			setMenu({
				x: e.clientX,
				y: e.clientY,
				items: [
					// 设计稿 CONNECTION_MENU 的首行：复制名称（子菜单取 COPY_NAME_OPTIONS）
					{ type: "item", label: "复制名称", icon: "icon-[lucide--copy]", onClick: () => copyText(node.label) },
					{
						type: "submenu",
						label: "复制连接信息",
						icon: "icon-[lucide--link-2]",
						items: [
							{ type: "item", label: "连接字符串", icon: "icon-[lucide--link-2]", onClick: () => copyText(facts.dsn) },
							{ type: "item", label: "主机与端口", icon: "icon-[lucide--server]", onClick: () => copyText(facts.endpoint) },
							// 未指定数据库的连接（DbConnection.database 可选）不出这一行，避免复制出空串
							...(facts.database
								? [
									{
										type: "item" as const,
										label: "数据库名",
										icon: "icon-[lucide--database]",
										onClick: () => copyText(facts.database ?? ""),
									},
								]
								: []),
						],
					},
					{ type: "separator" },
					{ type: "item", label: "新建查询", icon: "icon-[lucide--square-terminal]", onClick: newQueryForConnection },
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
					{ type: "item", label: "新建表", icon: "icon-[lucide--table-2]", onClick: () => openNewTable(node.label) },
					{ type: "item", label: "创建数据库", icon: "icon-[lucide--plus]", onClick: () => openCreateDatabase(node.label) },
					{ type: "item", label: "刷新", icon: "icon-[lucide--refresh-cw]", onClick: () => refreshNode(node.label) },
					{ type: "separator" },
					{
						type: "item",
						label: "添加到 AI",
						icon: "icon-[lucide--sparkles]",
						onClick: () => openAiDialog(buildConnectionPrompt({ connectionName: node.label, dbType: node.dbType ?? "database" })),
					},
					{ type: "separator" },
					{
						type: "item",
						label: "删除连接",
						icon: "icon-[lucide--trash-2]",
						danger: true,
						onClick: () => confirmRemoveConnection(node.label),
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
					{ type: "item", label: "新建查询", icon: "icon-[lucide--file-plus-2]", onClick: () => openEmptyQueryTab(connectionName ?? "") },
					{
						type: "item",
						label: "添加到 AI",
						icon: "icon-[lucide--sparkles]",
						onClick: () => openAiDialog(`请分析数据库 schema "${node.label}" 中的所有表结构和关系。`),
					},
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
					{ type: "item", label: "新建表", icon: "icon-[lucide--table-2]", onClick: () => openNewTable(connectionName ?? "", node.label) },
					{ type: "item", label: "新建 Schema", icon: "icon-[lucide--plus]", onClick: () => openCreateSchema(connectionName ?? "") },
					{ type: "item", label: "刷新", icon: "icon-[lucide--refresh-cw]", onClick: () => refreshNode(connectionName ?? "") },
					{ type: "separator" },
					{ type: "item", label: "复制 Schema 名", icon: "icon-[lucide--copy]", onClick: () => copyText(node.label) },
					{ type: "item", label: "复制为 SQL 引用", icon: "icon-[lucide--braces]", onClick: () => copyText(`"${node.label}"`) },
					{ type: "separator" },
					// 设计稿 SCHEMA_MENU 的 danger 行；对话框/写确认交给引擎侧拦截
					{ type: "item", label: "删除 Schema", icon: "icon-[lucide--trash-2]", danger: true, onClick: runDropSchema },
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
					{ type: "item", label: "查看定义", icon: "icon-[lucide--file-code]", onClick: openRoutineDefinition },
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
					// 复制名称 ▸（设计稿 COPY_NAME_OPTIONS：名称 / 完整路径）
					{
						type: "submenu",
						label: "复制名称",
						icon: "icon-[lucide--copy]",
						items: [
							{ type: "item", label: "名称", icon: "icon-[lucide--copy]", onClick: () => copyText(node.label) },
							{ type: "item", label: "完整路径", icon: "icon-[lucide--copy]", onClick: () => copyText(qualifiedName) },
						],
					},
					{ type: "item", label: "新建查询", icon: "icon-[lucide--square-terminal]", onClick: () => openEmptyQueryTab(connectionName) },
					{
						type: "item",
						label: "添加到 AI",
						icon: "icon-[lucide--sparkles]",
						onClick: () => openAiDialog(buildTablePrompt({ connectionName, schema: childScope, table: node.label })),
					},
					{ type: "separator" },
					// 查看数据
					{ type: "item", label: "查看数据", icon: "icon-[lucide--table-2]", onClick: previewTable },
					{ type: "item", label: "新标签页查看", icon: "icon-[lucide--copy-plus]", onClick: () => openTableInNewTab(connectionName) },
					// 设计稿是「查看 DDL」；插件没有服务端原始 DDL，用真实列结构生成 CREATE 模板（同 generateSql 路径）
					{ type: "item", label: "查看 DDL", icon: "icon-[lucide--file-code]", onClick: () => void generateSql("create") },
					// 设计稿此处是「编辑表结构」（可写表设计器），插件只有只读 DESCRIBE，故沿用原名「查看表结构」
					{ type: "item", label: "查看表结构", icon: "icon-[lucide--columns-3]", onClick: viewStructure },
					// 设计稿「重命名」：插件没有就地重命名的表设计器，改成打开 ALTER TABLE … RENAME TO 模板（真可执行）
					{ type: "item", label: "重命名", icon: "icon-[lucide--pencil]", onClick: openRenameTable },
					{
						type: "submenu",
						label: "生成 SQL",
						icon: "icon-[lucide--file-plus]",
						items: [
							{ type: "item", label: "SELECT", icon: "icon-[lucide--terminal]", onClick: () => void generateSql("select") },
							{ type: "item", label: "INSERT", icon: "icon-[lucide--file-plus]", onClick: () => void generateSql("insert") },
							{ type: "item", label: "UPDATE", icon: "icon-[lucide--square-pen]", onClick: () => void generateSql("update") },
							{ type: "item", label: "DELETE", icon: "icon-[lucide--list-x]", onClick: () => void generateSql("delete") },
							{ type: "separator" },
							{ type: "item", label: "CREATE TABLE", onClick: () => void generateSql("create") },
							{ type: "item", label: "ALTER TABLE", onClick: () => void generateSql("alter") },
							{ type: "item", label: "DROP TABLE", onClick: () => void generateSql("drop") },
						],
					},
					{ type: "separator" },
					// 统计行数（插件能力，设计稿未列入，保留）
					{ type: "item", label: "统计行数", icon: "icon-[lucide--hash]", onClick: countTable },
					// 复制表结构 ▸（设计稿 COPY_STRUCTURE_OPTIONS，服务端返回格式为 TSV / Markdown 表格）
					{
						type: "submenu",
						label: "复制表结构为",
						icon: "icon-[lucide--clipboard]",
						items: [
							{ type: "item", label: "TSV", onClick: () => void copyStructure("tsv") },
							{ type: "item", label: "Markdown 表格", onClick: () => void copyStructure("markdown") },
						],
					},
					{
						type: "item",
						label: "复制为 SQL 引用",
						icon: "icon-[lucide--braces]",
						onClick: () => copyText(childScope ? `"${childScope}"."${node.label}"` : `"${node.label}"`),
					},
					// 可视化（插件能力，设计稿 TEXT_MENU 未列入，保留）
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
									setAiPrompt(
										buildDashboardPrompt([{ kind: "table", connectionName, schema: childScope, label: node.label }]),
									);
									setAiDialogOpen(true);
								},
							},
							{
								type: "item",
								label: "生成数据大屏",
								icon: "icon-[lucide--monitor]",
								onClick: () => {
									setAiPrompt(
										buildScreenPrompt([{ kind: "table", connectionName, schema: childScope, label: node.label }]),
									);
									setAiDialogOpen(true);
								},
							},
						],
					},
					{ type: "separator" },
					{ type: "item", label: "执行 VACUUM", icon: "icon-[lucide--activity]", onClick: () => void runDangerAction({ kind: "vacuum" }) },
					{ type: "item", label: "执行 VACUUM FULL", icon: "icon-[lucide--gauge]", onClick: () => void runDangerAction({ kind: "vacuum", cascade: true }) },
					// 危险操作（对齐 dbx 桌面壳「更多」：红色展开项 + 二次确认）
					{
						type: "submenu",
						label: "更多",
						icon: "icon-[lucide--list-tree]",
						items: [
							{ type: "item", label: "清空数据", icon: "icon-[lucide--eraser]", danger: true, onClick: () => void runDangerAction({ kind: "delete" }) },
							{ type: "item", label: "截断表", icon: "icon-[lucide--scissors]", danger: true, onClick: () => void runDangerAction({ kind: "truncate" }) },
							{ type: "item", label: "删除表", icon: "icon-[lucide--trash-2]", danger: true, onClick: () => void runDangerAction({ kind: "drop" }) },
							{ type: "item", label: "强制删除（CASCADE）", icon: "icon-[lucide--unlink]", danger: true, onClick: () => void runDangerAction({ kind: "drop", cascade: true }) },
						],
					},
					{ type: "separator" },
					// 刷新
					{ type: "item", label: "刷新", icon: "icon-[lucide--refresh-cw]", onClick: () => refreshNode(connectionName) },
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
				className={`group flex h-6 cursor-pointer items-center gap-1.5 whitespace-nowrap pr-2 outline-none transition-colors focus-visible:ring-1 focus-visible:ring-link/40 ${
					isNodeSelected || active
						? "bg-accent-soft font-medium text-surface-foreground"
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
				<span className={`min-w-0 flex-1 truncate ${node.kind === "schema" || node.kind === "table" || node.kind === "column" || node.kind === "routine" ? "font-mono text-[12px]" : "text-[14px]"}`}>{node.label}</span>
				{/* 行右侧 meta：设计稿给的是子节点计数（ml-auto + mono 12 + tabular-nums + faint）。 */}
				{isLoading ? (
					<span className="ml-auto shrink-0 icon-[lucide--loader] size-3 animate-spin text-muted" />
				) : hasLoadedChildren && children.length > 0 ? (
					<span className="ml-auto shrink-0 font-mono text-[12px] tabular-nums text-faint">{children.length}</span>
				) : null}
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
			<DatabaseTypeIcon dbType={dbType} size={16} />
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

/**
 * 生成重命名表的方言模板。设计稿 TABLE_MENU 有「重命名」，
 * 插件没有就地重命名的表设计器，用真实可执行的模板代替（新名留给用户填）。
 */
function buildRenameTableSql(tableName: string, dbType: string | undefined): string {
	const type = (dbType ?? "").toLowerCase();
	// SQL Server 没有 ALTER TABLE … RENAME TO，重命名走 sp_rename。
	if (/mssql|sqlserver/.test(type)) {
		return `EXEC sp_rename N'${tableName.replace(/'/g, "''")}', N'new_name';`;
	}
	// PostgreSQL / MySQL 8 / Oracle 都用 ALTER TABLE … RENAME TO（目标名不能带 schema）。
	return `ALTER TABLE ${tableName} RENAME TO new_name;`;
}

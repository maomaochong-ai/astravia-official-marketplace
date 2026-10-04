/**
 * WorkbenchContext — 三栏工作台的集中状态与异步流程。
 *
 * 涵盖：连接列表、活动连接、连接树展开/懒加载状态、编辑器 tab 集合、
 * 活动 tab、右栏选中表、查询执行与写确认。Action 类型集中声明，reducer 纯函数处理。
 *
 * 放在 hooks/ 而不是 components/：这里是状态机和副作用（跑 SQL、拉连接树、
 * 弹写确认），组件文件只负责可见状态和交互。
 */

import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import type { DbConnection } from "../../../domain/connection-config";
import { deleteConfig, PASSWORD_PREFIX, readAllConfigs } from "../../../domain/dbx-storage";
import type { QueryHistoryEntry } from "../../../domain/query-history";
import { newHistoryId } from "../../../domain/query-history";
import {
	appendHistoryEntry,
	clearHistory,
	dropHistoryEntry,
	pruneHistoryStore,
	readHistory,
} from "../../../domain/query-history-store";
import {
	DEFAULT_SETTINGS,
	type WorkbenchSettings,
} from "../../../domain/workbench-settings";
import { readSettings, resetSettings, writeSettings } from "../../../domain/workbench-settings-store";
import { getSecrets } from "../../../runtime-contract";
import {
	engineListTables,
	engineListSchemas,
	engineDescribeByName,
	engineExecuteByName,
	EngineClientError,
	toQueryResult,
} from "../../../shared/services/engine-client";
import { WriteConfirmDialog, type PendingWrite } from "../components/write-confirm-dialog";
import {
	connectionFromNodeKey,
	connectionNodeKey,
	parseTableNodeKey,
	schemaNodeKey,
	tableNodeKey,
	columnNodeKey,
	type TreeNode,
	treeNodeKind,
} from "../../../domain/tree-node-key";

// ─── 类型 ─────────────────────────────────────────────────

export interface EditorTab {
	id: string;
	label: string;
	connectionName: string | null;
	sql: string;
	/** 执行结果（成功/失败都写这里） */
	result?: {
		ok: boolean;
		columns: string[];
		rows: Record<string, unknown>[];
		rowCount: number;
		/** 写 / DDL 的影响行数（direct-write 返回）；SELECT 为 null。 */
		affectedRows?: number | null;
		elapsedMs: number;
		error?: string;
		note?: string;
	};
	isRunning: boolean;
}

export interface RightPanelSelection {
	connectionName: string;
	tableName: string;
	schema?: string;
}

export interface WorkbenchState {
	connections: DbConnection[];
	activeConnectionName: string | null;
	expandedNodes: Set<string>;
	loadingNodes: Set<string>;
	treeChildren: Map<string, TreeNode[]>;
	tabColumnsMap: Map<string, EngineColumn[]>;
	tabs: EditorTab[];
	activeTabId: string | null;
	rightPanelTable: RightPanelSelection | null;
	connectionStatuses: Record<string, "idle" | "ok" | "error" | "running">;
	errorBanner: string | null;
}

export interface EngineColumn {
	name: string;
	type: string;
	nullable: boolean;
	hasDefault: boolean;
	defaultValue: string;
	comment: string;
	isPrimaryKey: boolean;
}

// ─── Action ──────────────────────────────────────────────

export type WorkbenchAction =
	| { type: "setConnections"; connections: DbConnection[] }
	| { type: "refreshConnections" }
	| { type: "connectionsLoaded"; connections: DbConnection[] }
	| { type: "setActiveConnection"; name: string | null }
	| { type: "toggleNode"; key: string }
	| { type: "nodeLoading"; key: string }
	| { type: "nodeLoaded"; key: string; children: TreeNode[]; keepExpanded?: Set<string> }
	| { type: "nodeFailed"; key: string }
	| { type: "selectRightTable"; selection: RightPanelSelection | null }
	| { type: "setTabColumns"; connectionName: string; tableName: string; columns: EngineColumn[] }
	| { type: "addTab"; tab: EditorTab }
	| { type: "closeTab"; id: string }
	| { type: "setActiveTab"; id: string }
	| { type: "updateTab"; id: string; patch: Partial<EditorTab> }
	| { type: "renameTab"; id: string; label: string }
	| { type: "setError"; message: string | null }
	| { type: "setConnectionStatus"; name: string; status: WorkbenchState["connectionStatuses"][string] };

// ─── 初始状态 ─────────────────────────────────────────────

const INITIAL_TABS: EditorTab[] = [
	{
		id: "tab-1",
		label: "查询 1",
		connectionName: null,
		sql: "SELECT 1;",
		isRunning: false,
	},
];

function createInitialState(): WorkbenchState {
	return {
		connections: [],
		activeConnectionName: null,
		expandedNodes: new Set(),
		loadingNodes: new Set(),
		treeChildren: new Map(),
		tabColumnsMap: new Map(),
		tabs: INITIAL_TABS,
		activeTabId: "tab-1",
		rightPanelTable: null,
		connectionStatuses: {},
		errorBanner: null,
	};
}

// ─── Reducer ──────────────────────────────────────────────

function reducer(state: WorkbenchState, action: WorkbenchAction): WorkbenchState {
	switch (action.type) {
		case "setConnections":
		case "connectionsLoaded":
			return { ...state, connections: action.connections };

		case "setActiveConnection": {
			const nextActive = action.name;
			// 切换连接时自动展开该连接节点
			const newExpanded = new Set(state.expandedNodes);
			if (nextActive) newExpanded.add(connectionNodeKey(nextActive));
			return {
				...state,
				activeConnectionName: nextActive,
				expandedNodes: newExpanded,
			};
		}

		case "toggleNode": {
			const next = new Set(state.expandedNodes);
			if (next.has(action.key)) next.delete(action.key);
			else next.add(action.key);
			return { ...state, expandedNodes: next };
		}

		case "nodeLoading": {
			const next = new Set(state.loadingNodes);
			next.add(action.key);
			return { ...state, loadingNodes: next };
		}

		case "nodeLoaded": {
			const loading = new Set(state.loadingNodes);
			loading.delete(action.key);
			const children = new Map(state.treeChildren);
			children.set(action.key, action.children);
			const expanded = action.keepExpanded ?? state.expandedNodes;
			return { ...state, loadingNodes: loading, treeChildren: children, expandedNodes: expanded };
		}

		case "nodeFailed": {
			const loading = new Set(state.loadingNodes);
			loading.delete(action.key);
			return { ...state, loadingNodes: loading };
		}

		case "selectRightTable":
			return { ...state, rightPanelTable: action.selection };

		case "setTabColumns": {
			const key = `${action.connectionName}::${action.tableName}`;
			const next = new Map(state.tabColumnsMap);
			next.set(key, action.columns);
			return { ...state, tabColumnsMap: next };
		}

		case "addTab": {
			const tabs = [...state.tabs, action.tab];
			return { ...state, tabs, activeTabId: action.tab.id };
		}

		case "closeTab": {
			const tabs = state.tabs.filter((t) => t.id !== action.id);
			if (tabs.length === 0) return state;
			let active = state.activeTabId;
			if (active === action.id) {
				const idx = state.tabs.findIndex((t) => t.id === action.id);
				active = tabs[Math.min(idx, tabs.length - 1)].id;
			}
			return { ...state, tabs, activeTabId: active };
		}

		case "setActiveTab":
			return { ...state, activeTabId: action.id };

		case "updateTab":
			return {
				...state,
				tabs: state.tabs.map((t) => (t.id === action.id ? { ...t, ...action.patch } : t)),
			};

		case "renameTab":
			return {
				...state,
				tabs: state.tabs.map((t) => (t.id === action.id ? { ...t, label: action.label } : t)),
			};

		case "setError":
			return { ...state, errorBanner: action.message };

		case "setConnectionStatus":
			return {
				...state,
				connectionStatuses: { ...state.connectionStatuses, [action.name]: action.status },
			};

		default:
			return state;
	}
}

// ─── Context ──────────────────────────────────────────────

interface WorkbenchContextValue {
	state: WorkbenchState;
	dispatch: React.Dispatch<WorkbenchAction>;
	refreshConnections: () => Promise<void>;
	/** 加载树节点子节点（懒加载入口） */
	loadNodeChildren: (nodeKey: string, connectionName?: string, extra?: { schema?: string }) => Promise<void>;
	/** 执行一个 tab 的 SQL；overrideSql 存在时只执行给定片段（选中执行）。 */
	runTabSql: (tabId: string, overrideSql?: string) => Promise<void>;
	/** 停止当前 tab 的执行（视觉复位）。 */
	cancelExecution: (tabId: string) => void;
	/** 打开一个新 tab 并执行（常用于预览） */
	openPreviewTab: (connectionName: string, sql: string, label?: string) => Promise<void>;

	// ─── 设置 ───
	settings: WorkbenchSettings;
	updateSettings: (next: WorkbenchSettings) => Promise<void>;

	// ─── 查询历史 ───
	history: QueryHistoryEntry[];
	loadHistoryIntoEditor: (entry: QueryHistoryEntry) => void;
	rerunHistoryEntry: (entry: QueryHistoryEntry) => Promise<void>;
	removeHistory: (id: string) => Promise<void>;
	clearAllHistory: () => Promise<void>;

	// ─── 右栏视图（结构 / 历史） ───
	rightView: "inspector" | "history";
	setRightView: (view: "inspector" | "history") => void;

	/** 清除全部本地数据：连接（含引擎+密文）、历史、设置、密码 secret。 */
	wipeAllData: () => Promise<void>;
}

const WorkbenchContext = createContext<WorkbenchContextValue | null>(null);

let tabCounter = 2;
function nextTabId(): string {
	return `tab-${Date.now().toString(36)}-${(tabCounter++).toString(36)}`;
}

function nextTabLabel(tabs: EditorTab[], preferred?: string): string {
	if (preferred) return preferred;
	const maxIdx = tabs.reduce((max, t) => {
		const m = t.label.match(/^查询 (\d+)/);
		return m ? Math.max(max, Number(m[1])) : max;
	}, 0);
	return `查询 ${maxIdx + 1}`;
}

export function WorkbenchProvider({ children }: { children: ReactNode }) {
	const [state, dispatch] = useReducer(reducer, undefined, createInitialState);
	const stateRef = useRef(state);
	stateRef.current = state;

	const [settings, setSettings] = useState<WorkbenchSettings>(DEFAULT_SETTINGS);
	const settingsRef = useRef(settings);
	settingsRef.current = settings;

	const [history, setHistory] = useState<QueryHistoryEntry[]>([]);
	const [rightView, setRightView] = useState<"inspector" | "history">("inspector");

	const runningStartedAtRef = useRef<Record<string, number>>({});

	// 初始加载：连接 + 设置 + 历史
	useEffect(() => {
		async function bootstrap() {
			await refreshConnections();
			const [loadedSettings, loadedHistory] = await Promise.all([
				readSettings().catch(() => DEFAULT_SETTINGS),
				readHistory().catch(() => [] as QueryHistoryEntry[]),
			]);
			setSettings(loadedSettings);
			setHistory(loadedHistory);
		}
		void bootstrap();
	}, []);

	async function refreshConnections() {
		try {
			const cfgs = await readAllConfigs();
			dispatch({ type: "connectionsLoaded", connections: cfgs });
		} catch (e) {
			dispatch({ type: "setError", message: e instanceof Error ? e.message : String(e) });
			dispatch({ type: "connectionsLoaded", connections: [] });
		}
	}

	/**
	 * 懒加载树节点子节点，按 key 的种类分发：
	 * - connection → 优先列 schema（库支持目录视图时多一层 schema 节点）；
	 *   不支持时直接列表，行为与 dbx 桌面壳的扁平表树一致。
	 * - schema → 列该 schema 下的表。
	 * - table → 列该表的字段。
	 *
	 * schema scope 的优先级：节点自身带的 schema > 连接配置的默认 schema。
	 */
	async function loadNodeChildren(nodeKey: string, connectionName?: string, extra?: { schema?: string }) {
		if (state.treeChildren.has(nodeKey)) return; // 已加载

		dispatch({ type: "nodeLoading", key: nodeKey });
		try {
			const kind = treeNodeKind(nodeKey);
			if (kind === "connection") {
				const name = connectionName ?? connectionFromNodeKey(nodeKey) ?? "";
				const defaultSchema = extra?.schema ?? stateRef.current.connections.find((c) => c.name === name)?.schema;

				// 先试 schema 目录：不支持（SQLite / ClickHouse 等）时回退扁平表树。
				let children: TreeNode[];
				try {
					const schemas = await engineListSchemas(name);
					if (schemas.supported && schemas.schemas.length > 0) {
						children = schemas.schemas.map((s) => ({
							key: schemaNodeKey(name, s),
							kind: "schema" as const,
							label: s,
							hasChildren: true,
						}));
					} else {
						children = await listTableNodes(name, defaultSchema);
					}
				} catch {
					// 目录探测失败不该让整棵树空掉，退回扁平表清单。
					children = await listTableNodes(name, defaultSchema);
				}
				dispatch({ type: "nodeLoaded", key: nodeKey, children });
			} else if (kind === "schema") {
				// schema 名可能含冒号，由调用方通过 extra.schema 传入，不解析 key。
				const children = await listTableNodes(connectionName ?? "", extra?.schema);
				dispatch({ type: "nodeLoaded", key: nodeKey, children });
			} else if (kind === "table") {
				// 表节点 — 懒加载列。表名从 key 还原（连接名与 schema 优先用调用方带来的）。
				const ref = parseTableNodeKey(nodeKey);
				const conn = connectionName ?? ref?.connection ?? "";
				const schemaName = extra?.schema ?? ref?.schema ?? undefined;
				const table = ref?.table ?? nodeKey;
				const outcome = await engineDescribeByName(conn, { schema: schemaName, table });
				const cols: TreeNode[] = outcome.columns.map((c) => ({
					key: columnNodeKey(conn, schemaName, table, c.name),
					kind: "column",
					label: c.name,
					hasChildren: false,
				}));
				dispatch({ type: "nodeLoaded", key: nodeKey, children: cols });
				// 同时缓存完整列信息
				const fullCols: EngineColumn[] = outcome.columns.map((c) => ({
					name: c.name,
					type: c.type,
					nullable: c.nullable,
					hasDefault: c.hasDefault,
					defaultValue: c.defaultValue,
					comment: c.comment,
					isPrimaryKey: c.isPrimaryKey,
				}));
				dispatch({ type: "setTabColumns", connectionName: conn, tableName: table, columns: fullCols });
			} else {
				dispatch({ type: "nodeLoaded", key: nodeKey, children: [] });
			}
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			dispatch({ type: "nodeFailed", key: nodeKey });
			dispatch({ type: "setError", message: `加载失败：${msg}` });
		}
	}

	/** 列某个 schema（或默认 scope）下的表节点。 */
	async function listTableNodes(connectionName: string, schema?: string): Promise<TreeNode[]> {
		const outcome = await engineListTables(
			connectionName,
			schema ? { schema } : {},
		);
		return outcome.tables.map((t) => ({
			key: tableNodeKey(connectionName, schema, t.name),
			kind: "table",
			label: t.name,
			tableKind: t.kind,
			hasChildren: false,
		}));
	}

	const [pendingWrite, setPendingWrite] = useState<(PendingWrite & { tabId: string }) | null>(null);

	/** 写入成功/读取成功后的结果派发。 */
	function applySuccess(tabId: string, startedAt: number, outcome: ReturnType<typeof toQueryResult>) {
		dispatch({
			type: "updateTab",
			id: tabId,
			patch: {
				isRunning: false,
				result: {
					ok: true,
					columns: outcome.columns,
					rows: outcome.rows,
					rowCount: outcome.row_count,
					affectedRows: outcome.affected_rows ?? null,
					elapsedMs: Date.now() - startedAt,
					note: outcome.note,
				},
			},
		});
	}

	/** 按当前设置追加一条查询历史（关闭记录时跳过）。 */
	async function recordHistory(params: {
		connName: string;
		sql: string;
		status: "ok" | "error";
		rowCount: number;
		durationMs: number;
		error?: string;
	}): Promise<void> {
		const current = settingsRef.current;
		if (!current.historyEnabled) return;
		const conn = stateRef.current.connections.find((c) => c.name === params.connName);
		const entry: QueryHistoryEntry = {
			id: newHistoryId(),
			connName: params.connName,
			dbType: conn?.db_type ?? "",
			sql: params.sql,
			status: params.status,
			path: "engine",
			rowCount: params.rowCount,
			durationMs: params.durationMs,
			...(params.error ? { error: params.error } : {}),
			createdAt: new Date().toISOString(),
		};
		try {
			setHistory(await appendHistoryEntry(entry, current.historyLimit));
		} catch { /* 历史落盘失败不影响主流程 */ }
	}

	async function runTabSql(tabId: string, overrideSql?: string, overrideConn?: string) {
		const st = stateRef.current;
		const tab = st.tabs.find((t) => t.id === tabId);
		const connectionName = overrideConn ?? tab?.connectionName ?? null;
		if (!tab || tab.isRunning || !connectionName) {
			dispatch({ type: "setError", message: tab ? "请选择一个连接后再执行" : "Tab 不存在" });
			return;
		}
		const sqlToRun = overrideSql && overrideSql.trim() ? overrideSql : tab.sql;
		dispatch({ type: "updateTab", id: tabId, patch: { isRunning: true, result: undefined } });
		dispatch({ type: "setConnectionStatus", name: connectionName, status: "running" });
		const startedAt = Date.now();
		runningStartedAtRef.current[tabId] = startedAt;
		try {
			const current = settingsRef.current;
			const outcome = toQueryResult(
				await engineExecuteByName(connectionName, sqlToRun, {
					timeoutMs: current.queryTimeoutSecs * 1000,
					rowLimit: current.rowLimit,
				}),
			);
			applySuccess(tabId, startedAt, outcome);
			dispatch({ type: "setConnectionStatus", name: connectionName, status: "ok" });
			dispatch({ type: "setError", message: null });
			await recordHistory({
				connName: connectionName,
				sql: sqlToRun,
				status: "ok",
				rowCount: outcome.row_count,
				durationMs: Date.now() - startedAt,
			});
		} catch (e) {
			const isBlocked = e instanceof EngineClientError && e.code === "SQL_BLOCKED";
			if (isBlocked) {
				// 安全闸（弹确认框之前）：只读连接直接硬拒绝，不再弹写确认框。
				const targetConn = stateRef.current.connections.find((c) => c.name === connectionName);
			if (targetConn?.read_only) {
				const roMsg = "连接已设为只读，写/DDL 被拒绝";
				dispatch({ type: "updateTab", id: tabId, patch: { isRunning: false } });
				dispatch({ type: "setConnectionStatus", name: connectionName, status: "error" });
				dispatch({
					type: "updateTab",
					id: tabId,
					patch: { result: { ok: false, columns: [], rows: [], rowCount: 0, elapsedMs: 0, error: roMsg } },
				});
				dispatch({ type: "setError", message: roMsg });
				await recordHistory({
					connName: connectionName,
					sql: sqlToRun,
					status: "error",
					rowCount: 0,
					durationMs: Date.now() - startedAt,
					error: roMsg,
				});
				return;
			}
			// 非只读：复位执行态，弹出写确认框（生产连接在弹窗内额外强提示）。
			dispatch({ type: "updateTab", id: tabId, patch: { isRunning: false } });
			dispatch({ type: "setConnectionStatus", name: connectionName, status: "idle" });
			setPendingWrite({ tabId, sql: sqlToRun, connectionName });
			return;
		}
		const msg = e instanceof EngineClientError ? e.message : e instanceof Error ? e.message : String(e);
		dispatch({
			type: "updateTab",
			id: tabId,
			patch: {
				isRunning: false,
				result: { ok: false, columns: [], rows: [], rowCount: 0, elapsedMs: Date.now() - startedAt, error: msg },
			},
		});
		dispatch({ type: "setConnectionStatus", name: connectionName, status: "error" });
		dispatch({ type: "setError", message: msg });
		await recordHistory({
			connName: connectionName,
				sql: sqlToRun,
				status: "error",
				rowCount: 0,
				durationMs: Date.now() - startedAt,
				error: msg,
			});
		}
	}

	/** 停止当前 tab 的执行：视觉复位 + 记录取消历史。 */
	function cancelExecution(tabId: string): void {
		const tab = stateRef.current.tabs.find((t) => t.id === tabId);
		if (!tab || !tab.isRunning) return;
		const elapsedMs = Date.now() - (runningStartedAtRef.current[tabId] ?? Date.now());
		delete runningStartedAtRef.current[tabId];
		dispatch({ type: "updateTab", id: tabId, patch: { isRunning: false } });
		if (tab.connectionName) {
			dispatch({ type: "setConnectionStatus", name: tab.connectionName, status: "idle" });
			void recordHistory({
				connName: tab.connectionName,
				sql: tab.sql,
				status: "error",
				rowCount: 0,
				durationMs: elapsedMs,
				error: "用户取消执行",
			});
		}
	}

	/** 用户在确认弹窗中批准写操作：带授权 + 完整连接配置重跑。 */
	async function confirmPendingWrite() {
		const pending = pendingWrite;
		setPendingWrite(null);
		if (!pending) return;
		const st = stateRef.current;
		const conn: DbConnection | undefined = st.connections.find((c) => c.name === pending.connectionName);
		dispatch({ type: "updateTab", id: pending.tabId, patch: { isRunning: true } });
		dispatch({ type: "setConnectionStatus", name: pending.connectionName, status: "running" });
		const startedAt = Date.now();
		try {
			const current = settingsRef.current;
			const outcome = toQueryResult(
				await engineExecuteByName(pending.connectionName, pending.sql, {
					timeoutMs: current.queryTimeoutSecs * 1000,
					rowLimit: current.rowLimit,
					allowWrite: true,
					confirmedWriteSql: pending.sql,
					connection: conn
						? {
								db_type: conn.db_type,
								host: conn.host,
								port: conn.port,
								username: conn.username,
								password: conn.password,
								database: conn.database,
								ssl: conn.ssl,
								read_only: conn.read_only,
							}
						: undefined,
				}),
			);
			applySuccess(pending.tabId, startedAt, outcome);
			dispatch({ type: "setConnectionStatus", name: pending.connectionName, status: "ok" });
			await recordHistory({
				connName: pending.connectionName,
				sql: pending.sql,
				status: "ok",
				rowCount: outcome.row_count,
				durationMs: Date.now() - startedAt,
			});
		} catch (e) {
			const msg = e instanceof EngineClientError ? e.message : e instanceof Error ? e.message : String(e);
			dispatch({
				type: "updateTab",
				id: pending.tabId,
				patch: {
					isRunning: false,
					result: { ok: false, columns: [], rows: [], rowCount: 0, elapsedMs: Date.now() - startedAt, error: msg },
				},
			});
			dispatch({ type: "setConnectionStatus", name: pending.connectionName, status: "error" });
			dispatch({ type: "setError", message: msg });
			await recordHistory({
				connName: pending.connectionName,
				sql: pending.sql,
				status: "error",
				rowCount: 0,
				durationMs: Date.now() - startedAt,
				error: msg,
			});
		}
	}

	function cancelPendingWrite() {
		const pending = pendingWrite;
		setPendingWrite(null);
		if (pending) dispatch({ type: "setError", message: "已取消写操作" });
	}

	async function openPreviewTab(connectionName: string, sql: string, label?: string) {
		const st = stateRef.current;
		const id = nextTabId();
		const newTab: EditorTab = {
			id,
			label: nextTabLabel(st.tabs, label),
			connectionName,
			sql,
			isRunning: false,
		};
		dispatch({ type: "addTab", tab: newTab });
		// 等 reducer 更新完再跑
		setTimeout(() => { void runTabSql(id); }, 0);
	}

	// ─── 设置 ─────────────────────────────────────────────
	async function updateSettings(next: WorkbenchSettings) {
		const saved = await writeSettings(next);
		setSettings(saved);
		if (saved.historyEnabled) {
			try { setHistory(await pruneHistoryStore(saved.historyLimit)); } catch { /* ignore */ }
		}
	}

	// ─── 历史 ─────────────────────────────────────────────
	function loadHistoryIntoEditor(entry: QueryHistoryEntry) {
		const tabId = stateRef.current.activeTabId;
		if (!tabId) return;
		const connName = entry.connName === "(未命名连接)" ? null : entry.connName;
		if (connName) dispatch({ type: "setActiveConnection", name: connName });
		dispatch({ type: "updateTab", id: tabId, patch: { connectionName: connName, sql: entry.sql } });
		setRightView("inspector");
	}

	async function rerunHistoryEntry(entry: QueryHistoryEntry) {
		loadHistoryIntoEditor(entry);
		const tabId = stateRef.current.activeTabId;
		if (tabId && entry.connName !== "(未命名连接)") {
			// 显式传入历史条目的连接与 SQL：dispatch 刚提交、stateRef 尚未刷新，
			// 直接重跑会执行旧值。
			await runTabSql(tabId, entry.sql, entry.connName);
		}
	}

	async function removeHistory(id: string) {
		try { setHistory(await dropHistoryEntry(id, settingsRef.current.historyLimit)); } catch { /* ignore */ }
	}

	async function clearAllHistory() {
		await clearHistory();
		setHistory([]);
	}

	// ─── 清除本地数据 ─────────────────────────────────────
	async function wipeAllData() {
		const conns = [...stateRef.current.connections];
		for (const conn of conns) {
			try { await deleteConfig(conn.id); } catch { /* ignore */ }
		}
		await clearAllHistory();
		setSettings(await resetSettings().catch(() => DEFAULT_SETTINGS));
		try {
			const keys = await getSecrets().keys();
			await Promise.all(
				keys.filter((k: string) => k.startsWith(PASSWORD_PREFIX)).map((k: string) => getSecrets().delete(k)),
			);
		} catch { /* ignore */ }
		dispatch({ type: "setError", message: null });
	}

	const value = useMemo<WorkbenchContextValue>(
		() => ({
			state,
			dispatch,
			refreshConnections,
			loadNodeChildren,
			runTabSql,
			cancelExecution,
			openPreviewTab,
			settings,
			updateSettings,
			history,
			loadHistoryIntoEditor,
			rerunHistoryEntry,
			removeHistory,
			clearAllHistory,
			rightView,
			setRightView,
			wipeAllData,
		}),
		[state, settings, history, rightView],
	);

	return (
		<WorkbenchContext.Provider value={value}>
			{children}
			{pendingWrite && (
				<WriteConfirmDialog
					pending={{ sql: pendingWrite.sql, connectionName: pendingWrite.connectionName }}
					isProduction={
						state.connections.find((c) => c.name === pendingWrite.connectionName)?.is_production ?? false
					}
					onConfirm={() => void confirmPendingWrite()}
					onCancel={cancelPendingWrite}
				/>
			)}
		</WorkbenchContext.Provider>
	);
}

export function useWorkbench(): WorkbenchContextValue {
	const ctx = useContext(WorkbenchContext);
	if (!ctx) throw new Error("useWorkbench 必须在 WorkbenchProvider 内使用");
	return ctx;
}

/** 工具：根据 db 类型推断 catalog family（为连接树渲染 hint） */
export function inferTreeKindFor(_dbType: string): "connection" {
	return "connection";
}

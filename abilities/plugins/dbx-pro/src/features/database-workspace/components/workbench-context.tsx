/**
 * WorkbenchContext — 三栏工作台的集中状态。
 *
 * 涵盖：连接列表、活动连接、连接树展开/懒加载状态、编辑器 tab 集合、
 * 活动 tab、右栏选中表。Action 类型集中声明，reducer 纯函数处理。
 */

import { createContext, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
import type { DbConnection } from "../../../domain/connection-config";
import { readAllConfigs } from "../../../domain/dbx-storage";
import {
	engineListTables,
	engineDescribeByName,
	engineExecuteByName,
	EngineClientError,
	toQueryResult,
} from "../../../shared/services/engine-client";

// ─── 类型 ─────────────────────────────────────────────────

export interface TreeNode {
	/** 唯一 key：`conn:${name}` / `schema:${conn}:${schema}` / `table:${conn}:${schema}:${table}` */
	key: string;
	kind: "connection" | "schema" | "table" | "column";
	label: string;
	/** 原始 db 类型（connection 节点才有） */
	dbType?: string;
	/** 表类型（table 节点才有） */
	tableKind?: string;
	hasChildren?: boolean;
}

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
		sql: "-- ⌘/Ctrl + Enter 执行\nSELECT 1;",
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
			if (nextActive) newExpanded.add(`conn:${nextActive}`);
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
	/** 执行一个 tab 的 SQL */
	runTabSql: (tabId: string) => Promise<void>;
	/** 打开一个新 tab 并执行（常用于预览） */
	openPreviewTab: (connectionName: string, sql: string, label?: string) => Promise<void>;
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

	// 初始加载连接列表
	useEffect(() => {
		void refreshConnections();
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
	 * 懒加载树节点子节点。
	 * - `conn:${name}` → 加载该连接下的表（engineListTables 直接返回表列表，
	 *   不再先列 schema/database 层级，dbx 引擎统一用扁平表清单）。
	 */
	async function loadNodeChildren(nodeKey: string, connectionName?: string, extra?: { schema?: string }) {
		if (state.treeChildren.has(nodeKey)) return; // 已加载

		dispatch({ type: "nodeLoading", key: nodeKey });
		try {
			if (nodeKey.startsWith("conn:")) {
				const name = connectionName ?? nodeKey.slice(5);
				const outcome = await engineListTables(name, extra?.schema ? {} : {});
				const children: TreeNode[] = outcome.tables.map((t) => ({
					key: `table:${name}::${t.name}`,
					kind: "table",
					label: t.name,
					tableKind: t.kind,
					hasChildren: false,
				}));
				dispatch({ type: "nodeLoaded", key: nodeKey, children });
			} else if (nodeKey.startsWith("table:")) {
				// 表节点 — 懒加载列
				const [, conn, , table] = nodeKey.split(":");
				const outcome = await engineDescribeByName(conn, { schema: extra?.schema, table });
				const cols: TreeNode[] = outcome.columns.map((c) => ({
					key: `col:${conn}:${extra?.schema ?? ""}:${table}:${c.name}`,
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

	async function runTabSql(tabId: string) {
		const st = stateRef.current;
		const tab = st.tabs.find((t) => t.id === tabId);
		if (!tab || tab.isRunning || !tab.connectionName) {
			dispatch({ type: "setError", message: tab ? "请选择一个连接后再执行" : "Tab 不存在" });
			return;
		}
		const conn = st.connections.find((c) => c.name === tab.connectionName);
		dispatch({ type: "updateTab", id: tabId, patch: { isRunning: true, result: undefined } });
		dispatch({ type: "setConnectionStatus", name: tab.connectionName, status: "running" });
		const startedAt = Date.now();
		try {
			const outcome = await engineExecuteByName(tab.connectionName, tab.sql, {
				timeoutMs: 120_000,
				// 附带完整连接配置（含密码）—— service 层 SQL_BLOCKED 时走 direct-driver 回退
				connection: conn,
			});
			const qr = toQueryResult(outcome);
			dispatch({
				type: "updateTab",
				id: tabId,
				patch: {
					isRunning: false,
					result: {
						ok: true,
						columns: qr.columns,
						rows: qr.rows,
						rowCount: qr.row_count,
						elapsedMs: Date.now() - startedAt,
						note: qr.note,
					},
				},
			});
			dispatch({ type: "setConnectionStatus", name: tab.connectionName, status: "ok" });
			dispatch({ type: "setError", message: null });
		} catch (e) {
			const msg = e instanceof EngineClientError ? e.message : e instanceof Error ? e.message : String(e);
			dispatch({
				type: "updateTab",
				id: tabId,
				patch: {
					isRunning: false,
					result: {
						ok: false,
						columns: [],
						rows: [],
						rowCount: 0,
						elapsedMs: Date.now() - startedAt,
						error: msg,
					},
				},
			});
			dispatch({ type: "setConnectionStatus", name: tab.connectionName, status: "error" });
			dispatch({ type: "setError", message: msg });
		}
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

	const value = useMemo<WorkbenchContextValue>(
		() => ({ state, dispatch, refreshConnections, loadNodeChildren, runTabSql, openPreviewTab }),
		[state],
	);

	return <WorkbenchContext.Provider value={value}>{children}</WorkbenchContext.Provider>;
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

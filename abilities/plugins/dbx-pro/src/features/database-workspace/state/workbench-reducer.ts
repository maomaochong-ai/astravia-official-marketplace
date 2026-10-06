/**
 * 工作台 Reducer — 从 use-workbench 抽出的纯状态转移函数。
 *
 * 纯函数：(state, action) → state，不跑副作用；与初始状态一起构成状态机核心。
 * Provider 只负责发 action 与异步流程，可独立单测。
 */

import { connectionFromNodeKey, connectionNodeKey } from "../../../domain/tree-node-key";
import type { WorkbenchAction } from "./workbench-actions";
import type { EditorTab, WorkbenchState } from "./workbench-types";
import { GALLERY_TAB_ID } from "./tab-ids";

const INITIAL_TABS: EditorTab[] = [
	{
		id: "tab-1",
		label: "查询 1",
		connectionName: null,
		sql: "SELECT 1;",
		isRunning: false,
	},
];

export function createInitialState(): WorkbenchState {
	return {
		connections: [],
		activeConnectionName: null,
		expandedNodes: new Set(),
		loadingNodes: new Set(),
		treeChildren: new Map(),
		tabColumnsMap: new Map(),
		tabs: INITIAL_TABS,
		activeTabId: "tab-1",
		connectionStatuses: {},
		errorBanner: null,
		selectionMode: false,
		selectedNodes: new Map(),
	};
}

export function reducer(state: WorkbenchState, action: WorkbenchAction): WorkbenchState {
	switch (action.type) {
		case "setConnections":
			return { ...state, connections: action.connections };

		case "connectionsLoaded": {
			// invalidateTree=true 时清除整棵树缓存（刷新按钮触发），
			// 否则只更新连接列表（初始加载）。
			if (action.invalidateTree) {
				return {
					...state,
					connections: action.connections,
					treeChildren: new Map(),
					expandedNodes: new Set(),
					loadingNodes: new Set(),
				};
			}
			return { ...state, connections: action.connections };
		}

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

		case "setTabColumns": {
			const key = `${action.connectionName}::${action.tableName}`;
			const next = new Map(state.tabColumnsMap);
			next.set(key, action.columns);
			return { ...state, tabColumnsMap: next };
		}

		case "addTab": {
			// 单例 tab（画廊）用固定 id：重复派发只激活，不追加，防止同 tick 双击产生重复 key。
			// 其余 tab 一律追加 —— id 由 nextTabId() 保证唯一，按 id 去重会在撞 id 时
			// 静默吞掉新标签页（用户点了「新建查询」却没有反应）。
			const isSingleton = action.tab.gallery === true || action.tab.id === GALLERY_TAB_ID;
			if (isSingleton) {
				const existing = state.tabs.find((t) => t.id === action.tab.id || t.gallery === true);
				if (existing) {
					return { ...state, activeTabId: existing.id };
				}
			}
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

		case "setTabTotalCount":
			// COUNT 是异步的第二趟请求：只在同一个结果集仍在展示时回填，避免竞态写脏。
			return {
				...state,
				tabs: state.tabs.map((t) =>
					t.id === action.id && t.result && t.result.ranSql === action.ranSql
						? { ...t, result: { ...t.result, totalCount: action.totalCount } }
						: t,
				),
			};

		case "setConnectionStatus":
			return {
				...state,
				connectionStatuses: { ...state.connectionStatuses, [action.name]: action.status },
			};

		case "toggleSelectionMode": {
			const enabled = action.enabled ?? !state.selectionMode;
			// 关闭多选时清空选中集合，避免下次开启残留。
			return {
				...state,
				selectionMode: enabled,
				selectedNodes: enabled ? state.selectedNodes : new Map(),
			};
		}

		case "toggleNodeSelection": {
			const selected = new Map(state.selectedNodes);
			if (selected.has(action.key)) selected.delete(action.key);
			else selected.set(action.key, action.info);
			return { ...state, selectedNodes: selected };
		}

		case "clearNodeSelection":
			return { ...state, selectedNodes: new Map() };

		case "restoreSession": {
			const s = action.session;
			// 只恢复可持久化字段：结果/运行态一律清空，避免展示过期结果。
			// 可视化标签页保留 visualization 数据（HTML 是静态的，可安全持久化）。
			const tabs = s.tabs.map((t) => ({
				id: t.id, label: t.label, connectionName: t.connectionName, sql: t.sql, isRunning: false,
				...(t.visualization ? { visualization: t.visualization } : {}),
			}));
			const activeTabId =
				tabs.some((t) => t.id === s.activeTabId) ? s.activeTabId : tabs[0]?.id ?? state.activeTabId;
			return {
				...state,
				activeConnectionName: s.activeConnectionName ?? state.activeConnectionName,
				tabs: tabs.length > 0 ? tabs : state.tabs,
				activeTabId,
				expandedNodes: new Set(s.expandedNodes),
			};
		}

		case "invalidateConnectionTree": {
			// 清除该连接整棵子树缓存，下次展开按最新 schemas 选择重算。
			const belongs = (k: string) => connectionFromNodeKey(k) === action.name;
			const treeChildren = new Map(
				[...state.treeChildren].filter(([k]) => k !== connectionNodeKey(action.name) && !belongs(k)),
			);
			const expandedNodes = new Set(
				[...state.expandedNodes].filter((k) => k !== connectionNodeKey(action.name) && !belongs(k)),
			);
			const loadingNodes = new Set(
				[...state.loadingNodes].filter((k) => k !== connectionNodeKey(action.name) && !belongs(k)),
			);
			return { ...state, treeChildren, expandedNodes, loadingNodes };
		}

		default:
			return state;
	}
}

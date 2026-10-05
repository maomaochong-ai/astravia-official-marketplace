/**
 * WorkbenchProvider — 三栏工作台的 Provider 组件。
 *
 * 组合多个专注 hooks：
 * - useWorkbenchTree: 树节点懒加载
 * - useWorkbenchExecution: SQL 执行、翻页、取消
 * - useWorkbenchHistory: 历史管理
 * - useWorkbenchSession: 会话恢复/自动保存
 *
 * 原文件 751 行，拆分后约 200 行。
 */

import { useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { deleteConfig, PASSWORD_PREFIX, readAllConfigs } from "../../../domain/dbx-storage";
import {
	DEFAULT_SETTINGS,
	ENGINE_ROW_CAP,
	resolvePageSize,
	type WorkbenchSettings,
} from "../../../domain/workbench-settings";
import { readSettings, resetSettings, writeSettings } from "../../../domain/workbench-settings-store";
import { readHistory, pruneHistoryStore } from "../../../domain/query-history-store";
import { getSecrets } from "../../../runtime-contract";
import {
	engineExecuteByName,
	toQueryResult,
} from "../../../shared/services/engine-client";
import { WriteConfirmDialog, type PendingWrite } from "../components/write-confirm-dialog";
import type { SelectedNodeInfo } from "../../../shared/ai/send-context";
import type { EditorTab, EngineColumn } from "../state/workbench-types";
import type { WorkbenchAction } from "../state/workbench-actions";
import { createInitialState, reducer } from "../state/workbench-reducer";
import { WorkbenchContext, type WorkbenchContextValue, useWorkbench } from "./workbench-context";
import { useWorkbenchTree } from "./use-workbench-tree";
import { useWorkbenchExecution } from "./use-workbench-execution";
import { useWorkbenchHistory } from "./use-workbench-history";
import { useWorkbenchSession } from "./use-workbench-session";

// 重新导出，保持向后兼容
export { useWorkbench };
export type { EngineColumn };

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

	const runningStartedAtRef = useRef<Record<string, number>>({});
	const [pendingWrite, setPendingWrite] = useState<(PendingWrite & { tabId: string }) | null>(null);

	// 拆分出的 hooks
	const { loadNodeChildren } = useWorkbenchTree({ stateRef, dispatch });
	const { runTabSql, goToResultPage, cancelExecution, applySuccess } = useWorkbenchExecution({
		stateRef,
		settingsRef,
		runningStartedAtRef,
		dispatch,
		recordHistory: async (params) => {
			// 由 history hook 处理
		},
	});
	const {
		history,
		setHistory,
		recordHistory,
		loadHistoryIntoEditor,
		rerunHistoryEntry,
		removeHistory,
		clearAllHistory,
		loadInitialHistory,
	} = useWorkbenchHistory({ stateRef, dispatch });
	const { restoreSession } = useWorkbenchSession({ state, dispatch });

	// 初始加载：连接 + 设置 + 历史 + 恢复上次会话
	useEffect(() => {
		async function bootstrap() {
			await refreshConnections();
			const [loadedSettings, loadedHistory] = await Promise.all([
				readSettings().catch(() => DEFAULT_SETTINGS),
				readHistory().catch(() => []),
			]);
			setSettings(loadedSettings);
			setHistory(loadedHistory);
			await restoreSession();
		}
		void bootstrap();
	}, []);

	async function refreshConnections() {
		try {
			const cfgs = await readAllConfigs();
			dispatch({ type: "connectionsLoaded", connections: cfgs, invalidateTree: true });
		} catch (e) {
			dispatch({ type: "setError", message: e instanceof Error ? e.message : String(e) });
			dispatch({ type: "connectionsLoaded", connections: [], invalidateTree: true });
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
		setTimeout(() => { void runTabSql(id, undefined, undefined, { mode: "server" }); }, 0);
	}

	async function updateSettings(next: WorkbenchSettings) {
		const saved = await writeSettings(next);
		setSettings(saved);
		if (saved.historyEnabled) {
			try { setHistory(await pruneHistoryStore(saved.historyLimit)); } catch { /* ignore */ }
		}
	}

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
			invalidateConnection: (name: string) => dispatch({ type: "invalidateConnectionTree", name }),
			runTabSql,
			goToResultPage,
			cancelExecution,
			openPreviewTab,
			settings,
			updateSettings,
			history,
			loadHistoryIntoEditor,
			rerunHistoryEntry,
			removeHistory,
			clearAllHistory,
			wipeAllData,
			selectionMode: state.selectionMode,
			selectedNodes: state.selectedNodes,
			toggleSelectionMode: (enabled?: boolean) =>
				dispatch({ type: "toggleSelectionMode", enabled }),
			toggleNodeSelection: (key: string, info: SelectedNodeInfo) =>
				dispatch({ type: "toggleNodeSelection", key, info }),
			clearNodeSelection: () => dispatch({ type: "clearNodeSelection" }),
		}),
		[state, settings, history],
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
					onConfirm={() => void handleConfirmPendingWrite()}
					onCancel={handleCancelPendingWrite}
				/>
			)}
		</WorkbenchContext.Provider>
	);

	async function handleConfirmPendingWrite() {
		const pending = pendingWrite;
		setPendingWrite(null);
		if (!pending) return;
		const st = stateRef.current;
		const conn = st.connections.find((c) => c.name === pending.connectionName);
		dispatch({ type: "updateTab", id: pending.tabId, patch: { isRunning: true } });
		dispatch({ type: "setConnectionStatus", name: pending.connectionName, status: "running" });
		const startedAt = Date.now();
		try {
			const current = settingsRef.current;
			const outcome = toQueryResult(
				await engineExecuteByName(pending.connectionName, pending.sql, {
					timeoutMs: current.queryTimeoutSecs * 1000,
					rowLimit: ENGINE_ROW_CAP,
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
			applySuccess(pending.tabId, startedAt, outcome, {
				pageIndex: 0,
				pageSize: resolvePageSize(current.rowLimit),
				isServerMode: false,
				ranSql: pending.sql,
				keepTotal: false,
			});
			dispatch({ type: "setConnectionStatus", name: pending.connectionName, status: "ok" });
			await recordHistory({
				connName: pending.connectionName,
				sql: pending.sql,
				status: "ok",
				rowCount: outcome.row_count,
				durationMs: Date.now() - startedAt,
			});
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
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

	function handleCancelPendingWrite() {
		const pending = pendingWrite;
		setPendingWrite(null);
		if (pending) dispatch({ type: "setError", message: "已取消写操作" });
	}
}

/**
 * useWorkbenchHistory — 查询历史管理逻辑。
 *
 * 历史条目在执行完成（成功 / 失败 / 取消）时落盘到宿主存储，重新打开插件后
 * 从 loadInitialHistory 恢复。受设置项 historyEnabled / historyLimit 控制。
 */

import { useCallback, useState, type MutableRefObject } from "react";
import type { QueryHistoryEntry } from "../../../domain/query-history";
import { newHistoryId } from "../../../domain/query-history";
import {
	appendHistoryEntry,
	clearHistory,
	dropHistoryEntry,
	readHistory,
} from "../../../domain/query-history-store";
import type { WorkbenchSettings } from "../../../domain/workbench-settings";
import type { EditorTab, WorkbenchState } from "../state/workbench-types";
import type { WorkbenchAction } from "../state/workbench-actions";
import { nextQueryLabel, nextTabId } from "../state/tab-ids";

interface HistoryDeps {
	stateRef: MutableRefObject<WorkbenchState>;
	dispatch: React.Dispatch<WorkbenchAction>;
	settingsRef: MutableRefObject<WorkbenchSettings>;
	/** 执行器回引：重跑历史时把 SQL 载入编辑器后立即执行。 */
	runTabSqlRef: MutableRefObject<((tabId: string, sql: string) => Promise<void>) | null>;
}

export function useWorkbenchHistory(deps: HistoryDeps) {
	const { stateRef, dispatch, settingsRef, runTabSqlRef } = deps;
	const [history, setHistory] = useState<QueryHistoryEntry[]>([]);

	/** 按当前设置追加一条查询历史并落盘。 */
	const recordHistory = useCallback(
		async (params: {
			connName: string;
			sql: string;
			status: "ok" | "error";
			rowCount: number;
			durationMs: number;
			error?: string;
		}) => {
			if (!settingsRef.current.historyEnabled) return;
			const entry: QueryHistoryEntry = {
				id: newHistoryId(),
				connName: params.connName,
				dbType: "",
				sql: params.sql,
				status: params.status,
				path: "engine",
				rowCount: params.rowCount,
				durationMs: params.durationMs,
				...(params.error ? { error: params.error } : {}),
				createdAt: new Date().toISOString(),
			};
			try {
				setHistory(await appendHistoryEntry(entry, settingsRef.current.historyLimit));
			} catch { /* 历史落盘失败不影响主流程 */ }
		},
		[settingsRef],
	);

	/**
	 * 历史条目 → 工作台：新建一个标签页放这条 SQL，不覆盖当前编辑内容
	 * （设计稿：「载入会在工作台新建标签页，不覆盖当前查询」）。
	 */
	const loadHistoryIntoEditor = useCallback(
		(entry: QueryHistoryEntry) => {
			const connName = entry.connName === "(未命名连接)" ? null : entry.connName;
			if (connName) dispatch({ type: "setActiveConnection", name: connName });
			const tab: EditorTab = {
				id: nextTabId(),
				label: nextQueryLabel(stateRef.current.tabs),
				connectionName: connName,
				sql: entry.sql,
				isRunning: false,
			};
			dispatch({ type: "addTab", tab });
			return tab.id;
		},
		[dispatch, stateRef],
	);

	/** 载入历史 SQL 并立即重跑（新标签页）。 */
	const rerunHistoryEntry = useCallback(
		async (entry: QueryHistoryEntry) => {
			const tabId = loadHistoryIntoEditor(entry);
			// addTab 的状态要等下一次重渲染才同步进 stateRef，立即执行会跑到旧 state 上。
			setTimeout(() => {
				void runTabSqlRef.current?.(tabId, entry.sql);
			}, 0);
		},
		[loadHistoryIntoEditor, runTabSqlRef],
	);

	const removeHistory = useCallback(async (id: string) => {
		try {
			setHistory(await dropHistoryEntry(id, settingsRef.current.historyLimit));
		} catch { /* ignore */ }
	}, [settingsRef]);

	const clearAllHistory = useCallback(async () => {
		await clearHistory();
		setHistory([]);
	}, []);

	const loadInitialHistory = useCallback(async () => {
		try {
			setHistory(await readHistory().catch(() => [] as QueryHistoryEntry[]));
		} catch { /* ignore */ }
	}, []);

	return {
		history,
		setHistory,
		recordHistory,
		loadHistoryIntoEditor,
		rerunHistoryEntry,
		removeHistory,
		clearAllHistory,
		loadInitialHistory,
	};
}

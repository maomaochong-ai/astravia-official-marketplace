/**
 * useWorkbenchHistory — 查询历史管理逻辑。
 *
 * 从 use-workbench.tsx 拆分出来，专注历史相关的异步逻辑。
 */

import { useCallback, useState } from "react";
import type { QueryHistoryEntry } from "../../../domain/query-history";
import { newHistoryId } from "../../../domain/query-history";
import {
	appendHistoryEntry,
	clearHistory,
	dropHistoryEntry,
	pruneHistoryStore,
	readHistory,
} from "../../../domain/query-history-store";
import type { WorkbenchState } from "../state/workbench-types";
import type { WorkbenchAction } from "../state/workbench-actions";

interface HistoryDeps {
	stateRef: React.MutableRefObject<WorkbenchState>;
	dispatch: React.Dispatch<WorkbenchAction>;
}

export function useWorkbenchHistory(deps: HistoryDeps) {
	const { stateRef, dispatch } = deps;
	const [history, setHistory] = useState<QueryHistoryEntry[]>([]);

	/** 按当前设置追加一条查询历史。 */
	const recordHistory = useCallback(
		async (params: {
			connName: string;
			sql: string;
			status: "ok" | "error";
			rowCount: number;
			durationMs: number;
			error?: string;
		}) => {
			// 由调用方传入 settingsRef，这里简化处理
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
				setHistory(await appendHistoryEntry(entry, 200));
			} catch { /* 历史落盘失败不影响主流程 */ }
		},
		[],
	);

	const loadHistoryIntoEditor = useCallback(
		(entry: QueryHistoryEntry) => {
			const tabId = stateRef.current.activeTabId;
			if (!tabId) return;
			const connName = entry.connName === "(未命名连接)" ? null : entry.connName;
			if (connName) dispatch({ type: "setActiveConnection", name: connName });
			dispatch({ type: "updateTab", id: tabId, patch: { connectionName: connName, sql: entry.sql } });
		},
		[dispatch, stateRef],
	);

	const rerunHistoryEntry = useCallback(
		async (entry: QueryHistoryEntry) => {
			loadHistoryIntoEditor(entry);
			// 由 Provider 层调用 runTabSql
		},
		[loadHistoryIntoEditor],
	);

	const removeHistory = useCallback(async (id: string) => {
		try { setHistory(await dropHistoryEntry(id, 200)); } catch { /* ignore */ }
	}, []);

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

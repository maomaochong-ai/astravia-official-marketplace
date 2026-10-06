/**
 * useWorkbenchExecution — SQL 执行、翻页、取消、写确认流程。
 *
 * 从 use-workbench.tsx 拆分出来，专注查询执行相关的异步逻辑。
 */

import { useCallback, useRef } from "react";
import {
	ENGINE_ROW_CAP,
	resolvePageSize,
	type WorkbenchSettings,
} from "../../../domain/workbench-settings";
import {
	engineExecuteByName,
	EngineClientError,
	toQueryResult,
	type EngineQueryOutcome,
} from "../../../shared/services/engine-client";
import type { EditorTab, WorkbenchState } from "../state/workbench-types";
import type { WorkbenchAction } from "../state/workbench-actions";

/**
 * 服务端分页取一整页。
 *
 * 引擎单次结果硬上限为 ENGINE_ROW_CAP；用户页大小（如 2000 / 5000）大于它时，
 * 按 cap 分块发起多次 LIMIT/OFFSET 请求并在前端拼接，保证网格一页真的有 N 行，
 * 而不是静默只回 1000 行。不可分页 SQL（引擎忽略 page）只取一次。
 */
async function executeServerPage(
	connectionName: string,
	sql: string,
	params: {
		pageIndex: number;
		pageSize: number;
		timeoutMs: number;
		dbType?: string;
	},
): Promise<EngineQueryOutcome> {
	const { pageIndex, pageSize, timeoutMs, dbType } = params;
	const baseOffset = pageIndex * pageSize;
	const chunkCount = Math.max(1, Math.ceil(pageSize / ENGINE_ROW_CAP));

	let first: EngineQueryOutcome | null = null;
	const mergedRows: Record<string, unknown>[] = [];
	let lastRows = 0;

	for (let chunk = 0; chunk < chunkCount; chunk += 1) {
		const raw = await engineExecuteByName(connectionName, sql, {
			timeoutMs,
			rowLimit: ENGINE_ROW_CAP,
			dbType,
			page: { offset: baseOffset + chunk * ENGINE_ROW_CAP, limit: ENGINE_ROW_CAP },
		});
		if (!first) first = raw;
		mergedRows.push(...raw.rows);
		lastRows = raw.rows.length;
		// 非可分页 SQL：引擎忽略 page，多次请求只会重复同一结果集，取一次即止。
		if (!raw.paged) break;
		// 末页（不足一块）或已凑满本页，无需继续。
		if (raw.rows.length < ENGINE_ROW_CAP) break;
		if (mergedRows.length >= pageSize) break;
	}

	const head = first as EngineQueryOutcome;
	return {
		...head,
		rows: mergedRows.slice(0, pageSize),
		row_count: Math.min(mergedRows.length, pageSize),
		// 非分页 SQL 保留引擎截断标记（toQueryResult 据此提示 1000 行上限）；
		// 分页拼页不标截断：没取满是因为到底了，取满了下一页继续取。
		truncated: head.paged === true ? false : head.truncated,
		paged: head.paged === true ? true : undefined,
		engine_row_count: head.paged === true ? mergedRows.length : lastRows,
	};
}

interface ExecutionDeps {
	stateRef: React.MutableRefObject<WorkbenchState>;
	settingsRef: React.MutableRefObject<WorkbenchSettings>;
	runningStartedAtRef: React.MutableRefObject<Record<string, number>>;
	dispatch: React.Dispatch<WorkbenchAction>;
	recordHistory: (params: {
		connName: string;
		sql: string;
		status: "ok" | "error";
		rowCount: number;
		durationMs: number;
		error?: string;
	}) => Promise<void>;
	/**
	 * 引擎识别为写 / DDL（SQL_BLOCKED）且连接非只读时回调；
	 * 由 Provider 挂起执行并弹出写确认框，确认后带 allowWrite 重跑。
	 */
	requestWriteConfirm: (params: { tabId: string; connectionName: string; sql: string }) => void;
}

export function useWorkbenchExecution(deps: ExecutionDeps) {
	const { stateRef, settingsRef, runningStartedAtRef, dispatch, recordHistory, requestWriteConfirm } = deps;

	/** 写入成功/读取成功后的结果派发。 */
	const applySuccess = useCallback(
		(
			tabId: string,
			startedAt: number,
			outcome: ReturnType<typeof toQueryResult>,
			ctx: {
				pageIndex: number;
				pageSize: number;
				isServerMode: boolean;
				ranSql: string;
				keepTotal: boolean;
			},
		) => {
			const prevTotal = stateRef.current.tabs.find((t) => t.id === tabId)?.result?.totalCount;
			dispatch({
				type: "updateTab",
				id: tabId,
				patch: {
					isRunning: false,
					pageSize: ctx.pageSize,
					result: {
						ok: true,
						columns: outcome.columns,
						rows: outcome.rows,
						rowCount: outcome.row_count,
						affectedRows: outcome.affected_rows ?? null,
						elapsedMs: Date.now() - startedAt,
						note: outcome.note,
						paged: ctx.isServerMode,
						serverPage: ctx.isServerMode ? ctx.pageIndex : 0,
						ranSql: ctx.ranSql,
						...(ctx.keepTotal && prevTotal !== undefined ? { totalCount: prevTotal } : {}),
					},
				},
			});
		},
		[dispatch, stateRef],
	);

	/** 统计总行数：把原 SQL 包成 COUNT 派生表再走引擎。开启 queryResultMaxRows 时夹逼总数。 */
	const fetchTotalCount = useCallback(
		async (tabId: string, connectionName: string, sql: string, timeoutSecs: number, dbType?: string) => {
			try {
				const raw = await engineExecuteByName(connectionName, sql, {
					countOnly: true,
					timeoutMs: timeoutSecs * 1000,
					dbType,
				});
				let total = Number((raw as { total_count?: unknown }).total_count);
				if (!Number.isFinite(total) || total < 0) return;
				const current = settingsRef.current;
				if (current.queryResultMaxRowsEnabled) {
					total = Math.min(total, current.queryResultMaxRows);
				}
				dispatch({ type: "setTabTotalCount", id: tabId, totalCount: total, ranSql: sql });
			} catch {
				// 统计失败不影响已展示的这一页
			}
		},
		[dispatch, settingsRef],
	);

	/** 执行一个 tab 的 SQL。 */
	const runTabSql = useCallback(
		async (
			tabId: string,
			overrideSql?: string,
			overrideConn?: string,
			options?: { pageIndex?: number; pageSize?: number; mode?: "server" | "client" },
		) => {
			const st = stateRef.current;
			const tab = st.tabs.find((t) => t.id === tabId);
			const connectionName = overrideConn ?? tab?.connectionName ?? null;
			if (!tab || !connectionName) {
				dispatch({ type: "setError", message: tab ? "请选择一个连接后再执行" : "Tab 不存在" });
				return;
			}
			const isServerMode = options?.mode === "server";
			const isPageTurn = options?.pageIndex !== undefined;
			if (tab.isRunning) {
				if (!isPageTurn) dispatch({ type: "setError", message: "查询正在执行，请稍候" });
				return;
			}
			const sqlToRun = overrideSql && overrideSql.trim() ? overrideSql : tab.sql;
			const current = settingsRef.current;
			const pageIndex = options?.pageIndex ?? 0;
			const pageSize = resolvePageSize(options?.pageSize ?? tab.pageSize ?? current.rowLimit);
			const priorResult = tab.result;
			const knownTotal =
				priorResult?.ok && priorResult.ranSql === sqlToRun ? priorResult.totalCount : undefined;

			if (isPageTurn) {
				dispatch({ type: "updateTab", id: tabId, patch: { isRunning: true } });
			} else {
				dispatch({ type: "updateTab", id: tabId, patch: { isRunning: true, result: undefined } });
			}
			dispatch({ type: "setConnectionStatus", name: connectionName, status: "running" });
			const startedAt = Date.now();
			runningStartedAtRef.current[tabId] = startedAt;

			try {
				const targetConn = stateRef.current.connections.find((c) => c.name === connectionName);
				const rawOutcome = isServerMode
					? // 页大小超过引擎单次上限时由 executeServerPage 分块拼页。
						await executeServerPage(connectionName, sqlToRun, {
							pageIndex,
							pageSize,
							timeoutMs: current.queryTimeoutSecs * 1000,
							dbType: targetConn?.db_type,
						})
					: await engineExecuteByName(connectionName, sqlToRun, {
							timeoutMs: current.queryTimeoutSecs * 1000,
							rowLimit: ENGINE_ROW_CAP,
							dbType: targetConn?.db_type,
						});
				const outcome = toQueryResult(rawOutcome);
				// 开启 queryResultMaxRows 时，检查是否已达到上限并追加提示。
				if (current.queryResultMaxRowsEnabled && isServerMode) {
					const offset = pageIndex * pageSize;
					if (offset + outcome.row_count >= current.queryResultMaxRows) {
						const maxNote = `结果已达到查询总量上限 ${current.queryResultMaxRows.toLocaleString()} 行，可在设置中调整或关闭上限`;
						outcome.note = outcome.note ? `${outcome.note}；${maxNote}` : maxNote;
					}
				}
				applySuccess(tabId, startedAt, outcome, {
					pageIndex,
					pageSize,
					isServerMode,
					ranSql: sqlToRun,
					keepTotal: knownTotal !== undefined,
				});
				dispatch({ type: "setConnectionStatus", name: connectionName, status: "ok" });
				dispatch({ type: "setError", message: null });
				await recordHistory({
					connName: connectionName,
					sql: sqlToRun,
					status: "ok",
					rowCount: outcome.row_count,
					durationMs: Date.now() - startedAt,
				});
				if (isServerMode && rawOutcome.paged && knownTotal === undefined) {
					void fetchTotalCount(tabId, connectionName, sqlToRun, current.queryTimeoutSecs, targetConn?.db_type);
				}
			} catch (e) {
				const isBlocked = e instanceof EngineClientError && e.code === "SQL_BLOCKED";
				if (isBlocked) {
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
					dispatch({ type: "updateTab", id: tabId, patch: { isRunning: false } });
					dispatch({ type: "setConnectionStatus", name: connectionName, status: "idle" });
					// 挂起执行，交给 Provider 弹写确认框；确认后带 allowWrite 重跑同一条 SQL。
					requestWriteConfirm({ tabId, connectionName, sql: sqlToRun });
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
		},
		[dispatch, stateRef, settingsRef, runningStartedAtRef, applySuccess, fetchTotalCount, recordHistory],
	);

	/** 翻到服务端分页的第 pageIndex 页。开启 queryResultMaxRows 时禁止翻越上限。 */
	const goToResultPage = useCallback(
		async (tabId: string, pageIndex: number, pageSize?: number) => {
			const tab = stateRef.current.tabs.find((t) => t.id === tabId);
			const sql = tab?.result?.ranSql ?? tab?.sql;
			if (!tab || !sql) return;
			const current = settingsRef.current;
			if (current.queryResultMaxRowsEnabled) {
				const effectivePageSize = resolvePageSize(pageSize ?? tab.pageSize ?? current.rowLimit);
				const maxPage = Math.floor(current.queryResultMaxRows / effectivePageSize);
				if (pageIndex > maxPage) {
					dispatch({
						type: "setError",
						message: `已达到查询结果总量上限（${current.queryResultMaxRows.toLocaleString()} 行），无法翻到更后的页`,
					});
					return;
				}
			}
			await runTabSql(tabId, sql, undefined, { pageIndex, pageSize, mode: "server" });
		},
		[stateRef, settingsRef, runTabSql, dispatch],
	);

	/** 停止当前 tab 的执行。 */
	const cancelExecution = useCallback(
		(tabId: string) => {
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
		},
		[dispatch, stateRef, runningStartedAtRef, recordHistory],
	);

	return { runTabSql, goToResultPage, cancelExecution, applySuccess, fetchTotalCount };
}

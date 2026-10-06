/**
 * 结果区 — 查询返回的表格、加载状态与错误视图。
 *
 * 加载状态仅在此处展示：加载环 + 已耗时 + 停止执行按钮。
 * 结果网格自带工具栏（顶）与分页栏（底），此处不再重复展示状态条。
 */

import { useEffect, useRef, useState, type JSX } from "react";
import { ResultGrid } from "./result-grid";
import { useWorkbench } from "../hooks/use-workbench";

export function ResultPanel(): JSX.Element {
	const { state, cancelExecution, goToResultPage, settings, updateSettings, refreshTotalCount, runTabSql } = useWorkbench();
	const activeTab = state.tabs.find((t) => t.id === state.activeTabId) ?? state.tabs[0];
	const result = activeTab?.result;
	const [elapsed, setElapsed] = useState(0);
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

	useEffect(() => {
		if (activeTab?.isRunning) {
			setElapsed(0);
			timerRef.current = setInterval(() => setElapsed((e) => e + 100), 100);
		} else {
			if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
		}
		return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
	}, [activeTab?.isRunning]);

	return (
		<div className="relative flex min-h-0 flex-1 flex-col bg-background overflow-hidden">
			{/* 结果 / 加载 / 错误视图 */}
			<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
				{/* 翻页时保留网格：只把分页栏置为「取数中」，不整屏回加载环 */}
				{activeTab?.isRunning && !result ? (
					<div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
						<span className="icon-[lucide--loader] h-8 w-8 animate-spin text-warning" />
						<p className="text-[12px]">
							执行中 <span className="font-mono text-foreground/80">{elapsed} ms</span>
						</p>
						{activeTab && (
							<button
								type="button"
								onClick={() => cancelExecution(activeTab.id)}
								className="rounded-md bg-destructive/90 px-3 py-1 text-[11px] font-medium text-destructive-foreground hover:bg-destructive"
							>
								停止执行
							</button>
						)}
					</div>
				) : result ? (
					result.ok ? (
						<ResultGrid
							columns={result.columns}
							rows={result.rows}
							totalRows={result.rowCount}
							connectionName={activeTab?.connectionName ?? undefined}
							sql={result.ranSql ?? activeTab?.sql}
							serverPaged={result.paged === true}
						serverPage={result.serverPage}
						serverPageSize={activeTab?.pageSize ?? settings.rowLimit}
						defaultPageSize={settings.rowLimit}
						serverTotalCount={result.totalCount}
						serverTotalStatus={result.totalCountStatus}
						pageLoading={activeTab?.isRunning === true}
						elapsedMs={result.elapsedMs}
						affectedRows={result.affectedRows}
						onRefresh={() => {
							const tabId = activeTab?.id;
							const base = result.ranSql ?? activeTab?.sql;
							if (tabId && base) void runTabSql(tabId, base, undefined, { mode: "server" });
						}}
						onLoadAll={async () => {
							const tabId = activeTab?.id;
							const tab = tabId ? state.tabs.find((t) => t.id === tabId) : null;
							if (!tabId || !tab?.result?.paged) return;
							try {
								let pageIndex = (tab.result.serverPage ?? 0) + 1;
								const pageSize = tab.pageSize ?? settings.rowLimit;
								// 先取当前页的行数作为参考
								let prevRows = tab.result.rows.length;
								while (prevRows >= pageSize) {
									await goToResultPage(tabId, pageIndex);
									// 等 state 更新后再检查（微任务队列）
									await new Promise((r) => setTimeout(r, 50));
									const freshTab = state.tabs.find((t) => t.id === tabId);
									prevRows = freshTab?.result?.rows.length ?? 0;
									pageIndex += 1;
								}
							} catch { /* 用户停止或引擎错误 */ }
						}}
						note={result.note}
						onCancelLoading={() => {
							if (activeTab) cancelExecution(activeTab.id);
						}}
							onPageChange={(pageIndex) => {
								if (activeTab) void goToResultPage(activeTab.id, pageIndex);
							}}
							onPageSizeChange={(pageSize) => {
								if (activeTab) void goToResultPage(activeTab.id, 0, pageSize);
							}}
							onSetDefaultPageSize={(pageSize) => {
								void updateSettings({ ...settings, rowLimit: pageSize });
								if (activeTab) void goToResultPage(activeTab.id, 0, pageSize);
							}}
							onRefreshTotalCount={() => {
								if (activeTab && result.ranSql) {
									void refreshTotalCount(activeTab.id, activeTab.connectionName ?? "", result.ranSql);
								}
							}}
						/>
					) : (
						<div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
							<span className="icon-[lucide--alert-octagon] h-8 w-8" style={{ color: "var(--destructive)" }} />
							<p className="text-[12px] font-medium" style={{ color: "var(--destructive)" }}>执行失败</p>
							<pre
								className="max-h-[200px] max-w-full overflow-auto rounded-md px-3 py-2 font-mono text-[11px] whitespace-pre-wrap"
								style={{
									color: "var(--destructive)",
									backgroundColor: "color-mix(in srgb, var(--destructive) 10%, transparent)",
								}}
							>
								{result.error ?? "未知错误"}
							</pre>
						</div>
					)
				) : (
					<div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground/70">
						<span className="icon-[lucide--table] h-8 w-8 opacity-30" />
						<p className="text-[12px]">执行查询后显示结果</p>
					</div>
				)}
			</div>
		</div>
	);
}

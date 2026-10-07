/**
 * 结果区 — 查询返回的表格、加载状态与错误视图。
 *
 * 加载状态仅在此处展示：加载环 + 已耗时 + 停止执行按钮。
 * 结果网格自带工具栏（顶）与分页栏（底），此处不再重复展示状态条。
 */

import { useEffect, useRef, useState, type JSX } from "react";
import { ResultGrid } from "./result-grid";
import { useWorkbench } from "../hooks/use-workbench";
import { showVisualizationPreview } from "../../visualization/visualization-bridge";
import type { Visualization } from "../../../domain/visualization";

export function ResultPanel(): JSX.Element {
	const { state, cancelExecution, goToResultPage, settings, updateSettings, refreshTotalCount, runTabSql } = useWorkbench();
	const activeTab = state.tabs.find((t) => t.id === state.activeTabId) ?? state.tabs[0];
	const result = activeTab?.result;
	const [elapsed, setElapsed] = useState(0);
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

	/** Canvas 入口 — ADR-0005 §5.1：从当前 SQL 结果集生成看板/大屏 */
	function openCanvas(intent: "dashboard" | "screen"): void {
		if (!result?.ok || !activeTab?.connectionName) return;
		const viz: Visualization = {
			title: intent === "dashboard" ? "AI 看板" : "AI 大屏",
			type: intent,
			connection: activeTab.connectionName,
			table: "",
			html: `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${intent === "dashboard" ? "AI 看板" : "AI 大屏"}</title></head><body style="display:flex;align-items:center;justify-content:center;font-family:-apple-system,sans-serif;color:#64748b;height:100vh"><div style="text-align:center"><p>请使用 AI 生成完整 ${intent === "dashboard" ? "看板" : "大屏"}</p><p style="font-size:12px;color:#94a3b8;margin-top:8px">数据查询已就绪，选中表/视图后点击"生成看板"即可</p></div></body></html>`,
			chartItems: [],
		};
		showVisualizationPreview(viz);
	}

	useEffect(() => {
		if (activeTab?.isRunning) {
			setElapsed(0);
			// 1s tick 足够展示耗时变化，避免 100ms 高频触发整块 ResultPanel re-render 导致卡顿
			timerRef.current = setInterval(() => setElapsed((e) => e + 1000), 1000);
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
						<>
							{/* Canvas 入口 — ADR-0005 §5.1：从 SQL 结果集直接生成可视化 */}
							{result.rows.length > 0 && activeTab?.connectionName && (
								<div className="flex items-center gap-2 border-b border-[var(--dbx-surface-2)] bg-background/50 px-3 py-1.5">
									<span className="text-[11px] text-muted-foreground/60">AI 可视化：</span>
									<button
										type="button"
										onClick={() => openCanvas("dashboard")}
										className="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-violet-600 hover:bg-violet-500/10"
										title="用 QuickBI 浅色调生成看板"
									>
										<span className="icon-[lucide--layout-dashboard] h-3 w-3" /> 看板
									</button>
									<button
										type="button"
										onClick={() => openCanvas("screen")}
										className="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-cyan-600 hover:bg-cyan-500/10 dark:text-cyan-400 dark:hover:bg-cyan-500/15"
										title="用 DataV 深色调生成大屏"
									>
										<span className="icon-[lucide--monitor] h-3 w-3" /> 大屏
									</button>
								</div>
							)}
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
								let prevRows = tab.result.rows.length;
								while (prevRows >= pageSize) {
									// 用户可能点击停止按钮：cancelExecution 会把 isRunning 置为 false
									const still = state.tabs.find((t) => t.id === tabId);
									if (!still?.isRunning) break;
									await goToResultPage(tabId, pageIndex);
									// await 后再检查一次（cancelExecution 可能在这期间被调用）
									const still2 = state.tabs.find((t) => t.id === tabId);
									if (!still2?.isRunning) break;
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
						</>
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

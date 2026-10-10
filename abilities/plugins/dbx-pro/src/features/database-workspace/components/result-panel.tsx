/**
 * 结果区 — 查询返回的表格、加载状态与错误视图。
 *
 * 加载状态仅在此处展示：加载环 + 已耗时 + 停止执行按钮。
 * 结果网格自带工具栏（顶）与分页栏（底），此处不再重复展示状态条。
 */

import { useEffect, useRef, useState, type JSX } from "react";
import { ResultGrid } from "./result-grid";
import { SendToAiDialog } from "./send-to-ai-dialog";
import { useWorkbench } from "../hooks/use-workbench";
import { buildResultVizPrompt, buildResultAnalysisPrompt } from "../../../shared/ai/send-context";

export function ResultPanel(): JSX.Element {
	const { state, cancelExecution, goToResultPage, settings, updateSettings, refreshTotalCount, runTabSql } = useWorkbench();
	const activeTab = state.tabs.find((t) => t.id === state.activeTabId) ?? state.tabs[0];
	const result = activeTab?.result;
	const [elapsed, setElapsed] = useState(0);
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const [vizDialog, setVizDialog] = useState<{ open: boolean; prompt: string }>({ open: false, prompt: "" });
	const [analysisDialog, setAnalysisDialog] = useState<{ open: boolean; prompt: string }>({ open: false, prompt: "" });
	const [aiMenuOpen, setAiMenuOpen] = useState(false);

	/** 完整结果行数：优先 rowCount（完整查询返回），次选 totalCount（数据库统计），最后退回当前页行数。
	 *  —— 不要传 result.rows.length（只是分页当前页，默认 50 行）。 */
	const fullRowCount = result?.rowCount
		?? (result?.totalCount ?? 0)
		?? result?.rows.length
		?? 0;

	/** "AI 可视化：看板/大屏" —— 构造 prompt 调宿主 AI。 */
	function openVizDialog(intent: "dashboard" | "screen"): void {
		if (!result?.ok || !activeTab?.connectionName) return;
		const prompt = buildResultVizPrompt(
			activeTab.connectionName,
			activeTab.sql ?? "",
			intent,
			result.columns,
			fullRowCount,
		);
		setVizDialog({ open: true, prompt });
		setAiMenuOpen(false);
	}

	/** "AI 分析结果" —— 通用数据分析 prompt。 */
	function openAnalysisDialog(): void {
		if (!result?.ok || !activeTab?.connectionName) return;
		const prompt = buildResultAnalysisPrompt(
			activeTab.connectionName,
			activeTab.sql ?? "",
			result.columns,
			fullRowCount,
			result.rows.length,
		);
		setAnalysisDialog({ open: true, prompt });
		setAiMenuOpen(false);
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
							{/* AI 分析 dropdown —— 收敛看板/大屏/通用分析到一个菜单 */}
							{result.rows.length > 0 && activeTab?.connectionName && (
								<div className="relative border-b border-[var(--dbx-surface-2)] bg-background/50 px-3 py-1.5">
									<button
										type="button"
										onClick={() => setAiMenuOpen((v) => !v)}
										className="flex items-center gap-1 rounded-control px-2 py-0.5 text-[12px] text-ai hover:bg-ai-soft"
										title="AI 分析当前 SQL 结果集"
									>
										<span className="icon-[lucide--sparkles] h-3 w-3" />
										AI 分析
										<span className={`icon-[lucide--chevron-down] h-3 w-3 transition-transform ${aiMenuOpen ? "rotate-180" : ""}`} />
									</button>
									{aiMenuOpen && (
										<>
											{/* 点击外部关闭 */}
											<div className="fixed inset-0 z-40" onClick={() => setAiMenuOpen(false)} />
											<div
												className="absolute left-3 top-full z-50 mt-1 w-48 rounded-control border border-border bg-popover p-1 shadow-[var(--dbx-shadow-popover)]"
											>
											<button
												type="button"
												onClick={openAnalysisDialog}
												className="flex w-full items-center gap-2 rounded-control px-2 py-1.5 text-left text-[12px] hover:bg-ai-soft"
											>
												<span className="icon-[lucide--sparkles] h-3.5 w-3.5 text-ai" />
												<span className="flex-1">通用分析</span>
												<span className="text-[9px] text-muted-foreground">{fullRowCount.toLocaleString()} 行</span>
											</button>
											<div className="my-1 h-px bg-border/60" />
											<button
												type="button"
												onClick={() => openVizDialog("dashboard")}
												className="flex w-full items-center gap-2 rounded-control px-2 py-1.5 text-left text-[12px] hover:bg-ai-soft"
											>
												<span className="icon-[lucide--layout-dashboard] h-3.5 w-3.5 text-ai" />
												<span className="flex-1">生成看板</span>
												<span className="text-[9px] text-muted-foreground">浅色 QuickBI</span>
											</button>
											<button
												type="button"
												onClick={() => openVizDialog("screen")}
												className="flex w-full items-center gap-2 rounded-control px-2 py-1.5 text-left text-[12px] hover:bg-link-soft"
											>
												<span className="icon-[lucide--monitor] h-3.5 w-3.5 text-link" />
												<span className="flex-1">生成大屏</span>
												<span className="text-[9px] text-muted-foreground">深色 DataV</span>
											</button>
											</div>
										</>
									)}
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
			{/* "AI 可视化" prompt 发送对话框 */}
			<SendToAiDialog
				open={vizDialog.open}
				prompt={vizDialog.prompt}
				onClose={() => setVizDialog((v) => ({ ...v, open: false }))}
			/>
			{/* "AI 分析结果" prompt 发送对话框 */}
			<SendToAiDialog
				open={analysisDialog.open}
				prompt={analysisDialog.prompt}
				onClose={() => setAnalysisDialog((v) => ({ ...v, open: false }))}
			/>
		</div>
	);
}

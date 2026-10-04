/**
 * 结果区 — 查询返回的表格、加载状态与错误视图。
 *
 * 加载状态仅在此处展示（对标 dbx 桌面壳）：加载环 + 已耗时 + 停止执行按钮。
 * 结果网格自带工具栏（顶）与分页栏（底），此处不再重复展示状态条。
 */

import { useEffect, useRef, useState, type JSX } from "react";
import { ResultGrid } from "./result-grid";
import { useWorkbench } from "../hooks/use-workbench";

export function ResultPanel(): JSX.Element {
	const { state, cancelExecution } = useWorkbench();
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
		<div className="flex min-h-0 flex-1 flex-col bg-background">
			{/* 结果 / 加载 / 错误视图 */}
			<div className="min-h-0 flex-1 overflow-hidden">
				{activeTab?.isRunning ? (
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
							sql={activeTab?.sql}
						/>
					) : (
						<div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
							<span className="icon-[lucide--alert-octagon] h-8 w-8 text-red-400" />
							<p className="text-[12px] font-medium text-red-400">执行失败</p>
							<pre className="max-h-[200px] max-w-full overflow-auto rounded-md bg-red-900/20 px-3 py-2 font-mono text-[11px] text-red-300 whitespace-pre-wrap">
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

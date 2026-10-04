/**
 * 结果区 — 查询返回的表格、加载状态与错误视图。
 *
 * 加载状态仅在此处展示（对标 dbx 桌面壳）：加载环 + 已耗时 + 停止执行按钮。
 * 顶部状态栏 / 编辑器工具栏 / Tab 图标不再冗余展示「执行中」。
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

			{/* 精简状态栏：仅展示连接名 + 行数/耗时/错误 */}
			{result && (
				<div className="flex h-6 shrink-0 items-center gap-2 px-3 text-[10.5px] text-muted-foreground" style={{ backgroundColor: "var(--dbx-surface)", borderTop: "1px solid var(--dbx-line-soft)" }}>
					{activeTab?.connectionName ? (
						<span className="flex min-w-0 items-center gap-1">
							<span className="icon-[lucide--database] h-3 w-3 shrink-0" />
							<span className="truncate">{activeTab.connectionName}</span>
						</span>
					) : (
						<span className="shrink-0">未绑定连接</span>
					)}
					<span className="text-muted-foreground/40">·</span>
					{result.ok && (
						<>
							<span className="shrink-0">
								<span className="font-medium text-foreground">{result.rowCount}</span>{" "}
								{result.affectedRows != null ? "行受影响" : "行"}
							</span>
							<span className="text-muted-foreground/40">·</span>
							<span className="shrink-0">
								<span className="font-medium text-foreground">{result.elapsedMs}</span> ms
							</span>
							{result.note && (
								<>
									<span className="text-muted-foreground/40">·</span>
									<span className="truncate text-warning">{result.note}</span>
								</>
							)}
						</>
					)}
					{!result.ok && (
						<span className="shrink-0 text-destructive">
							<span className="icon-[lucide--alert-circle] h-3 w-3" />{" "}
							<span className="truncate">{result.error?.slice(0, 120)}</span>
						</span>
					)}

					<span className="ml-auto flex min-w-0 items-center gap-2">
						{state.rightPanelTable && (
							<span className="flex min-w-0 items-center gap-1">
								<span className="icon-[lucide--table-2] h-2.5 w-2.5 shrink-0 text-success" />
								<span className="truncate">{state.rightPanelTable.tableName}</span>
							</span>
						)}
						{state.errorBanner && (
							<span className="flex min-w-0 items-center gap-1 text-destructive">
								<span className="icon-[lucide--alert-circle] h-3 w-3 shrink-0" />
								<span className="truncate">{state.errorBanner}</span>
							</span>
						)}
					</span>
				</div>
			)}
		</div>
	);
}

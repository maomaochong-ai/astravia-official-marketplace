/**
 * 结果区 + 状态栏 — 查询返回的表格、行数截断说明与执行统计。
 *
 * 截断提示区分两层含义：用户自己设的行数上限 vs 宿主引擎制品的硬上限，
 * 后者不可调，必须如实告知，避免用户以为是 bug。
 */

import type { JSX } from "react";
import { ResultGrid } from "./result-grid";
import { useWorkbench } from "../hooks/use-workbench";

export function ResultPanel(): JSX.Element {
	const { state } = useWorkbench();
	const activeTab = state.tabs.find((t) => t.id === state.activeTabId) ?? state.tabs[0];
	const result = activeTab?.result;

	return (
		<div className="flex min-h-0 flex-1 flex-col bg-background">
			{/* 结果 / 错误视图 */}
			<div className="min-h-0 flex-1 overflow-hidden">
				{activeTab?.isRunning ? (
					<div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
						<span className="icon-[lucide--loader] h-6 w-6 animate-spin text-muted-foreground" />
						<p className="text-[12px]">执行中…</p>
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

			{/* 状态栏 */}
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
				{activeTab?.isRunning && <span className="shrink-0 text-warning">执行中…</span>}
				{result?.ok && (
					<>
						<span className="shrink-0">
							<span className="font-medium text-foreground">{result.rowCount}</span> 行
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
				{result && !result.ok && <span className="shrink-0 text-destructive">错误</span>}

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
		</div>
	);
}

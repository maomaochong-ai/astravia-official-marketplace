/**
 * G1 查询历史面板 — 右栏「历史」页签。
 *
 * 只渲染 `query-history.ts` 的纯数据（最新的在最前），不自己维护任何状态：
 * 增删都通过 props 回调交给主面板（主面板再走 `query-history-store.ts` 落盘）。
 * 历史记录里**没有结果行**，所以这里只用一行摘要 + 时间/耗时/行数展示。
 */

import type { JSX } from "react";
import { formatHistoryTime, summarizeSql, type QueryHistoryEntry } from "../../../domain/query-history";

interface Props {
	entries: QueryHistoryEntry[];
	/** 当前上限（设置里的 historyLimit），用于「已满」提示。 */
	limit: number;
	onLoad: (entry: QueryHistoryEntry) => void;
	onRerun: (entry: QueryHistoryEntry) => void;
	onDelete: (id: string) => void;
	onClear: () => void;
}

function PathBadge({ path, fallback }: { path: string; fallback?: boolean }): JSX.Element {
	const label = path === "engine" ? "引擎" : fallback ? "CLI·降级" : "CLI";
	const cls = path === "engine" ? "text-primary" : fallback ? "text-amber-600" : "text-muted-foreground";
	return <span className={`shrink-0 text-[10px] ${cls}`}>{label}</span>;
}

export function HistoryPanel({ entries, limit, onLoad, onRerun, onDelete, onClear }: Props): JSX.Element {
	const full = entries.length >= limit;
	return (
		<div className="flex h-full flex-col">
			<div className="flex shrink-0 items-center gap-1 border-b px-3 py-2">
				<span className="text-[11px] font-medium text-foreground">查询历史</span>
				<span className="text-[10px] text-muted-foreground">
					{entries.length}/{limit}
				</span>
				<span className="flex-1" />
				{entries.length > 0 ? (
					<button type="button" onClick={onClear} title="清空全部历史（不可撤销）" className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted/60 hover:text-destructive">
						清空
					</button>
				) : null}
			</div>
			{full ? (
				<div className="shrink-0 bg-muted/30 px-3 py-1 text-[10px] text-muted-foreground">已到上限：新查询会挤掉最旧的一条</div>
			) : null}
			<div className="min-h-0 flex-1 overflow-y-auto p-1">
				{entries.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-8 text-center">
						<span className="icon-[lucide--history] h-6 w-6 text-muted-foreground/30" />
						<p className="mt-2 text-[11px] text-muted-foreground">暂无历史</p>
						<p className="mt-1 px-4 text-[10px] text-muted-foreground/70">执行一次查询后，这里会记录 SQL、耗时与取数路径（不保存结果行）</p>
					</div>
				) : entries.map((entry) => (
					<div key={entry.id} className="group rounded-lg px-1.5 py-1.5 hover:bg-muted/40">
						<div className="flex items-center gap-1">
							{entry.status === "ok" ? (
								<span className="icon-[lucide--check] h-3 w-3 shrink-0 text-emerald-500" />
							) : (
								<span className="icon-[lucide--x] h-3 w-3 shrink-0 text-destructive" />
							)}
							<span className="min-w-0 flex-1 truncate text-[11px] text-foreground/80" title={entry.sql}>{summarizeSql(entry.sql, 60)}</span>
							<PathBadge path={entry.path} fallback={Boolean(entry.error && entry.path === "cli")} />
						</div>
						<div className="mt-0.5 flex items-center gap-2 pl-4 text-[10px] text-muted-foreground">
							<span className="truncate">{entry.connName}</span>
							<span>{formatHistoryTime(entry.createdAt)}</span>
							{entry.status === "ok" ? <span>{entry.rowCount} 行 · {entry.durationMs} ms</span> : null}
						</div>
						{entry.status === "error" && entry.error ? (
							<p className="mt-0.5 pl-4 text-[10px] text-destructive/90" title={entry.error}>{summarizeSql(entry.error, 60)}</p>
						) : null}
						<div className="mt-1 flex items-center gap-1 pl-4 opacity-0 transition-opacity group-hover:opacity-100">
							<button type="button" onClick={() => onLoad(entry)} className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground">载入编辑器</button>
							<button type="button" onClick={() => onRerun(entry)} className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground">重跑</button>
							<button type="button" onClick={() => onDelete(entry.id)} className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-destructive">删除</button>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

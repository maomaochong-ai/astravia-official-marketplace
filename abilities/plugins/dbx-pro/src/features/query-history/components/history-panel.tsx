/**
 * 查询历史面板 — 右栏。
 *
 * 只渲染 `query-history.ts` 的纯数据（最新的在最前），不自己维护状态：
 * 增删都通过 props 回调交给主面板（主面板再走 `query-history-store.ts` 落盘）。
 * 历史里不保存结果行，因此每张卡片只展示：状态 + SQL 摘要 + 连接 / 时间 / 行数，
 * 操作工具为卡片行内常驻的纯图标按钮（hover 出文字提示）。
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
	/** 发送到 AI 分析 */
	onSendToAi?: (entry: QueryHistoryEntry) => void;
}

function PathBadge({ path, fallback }: { path: string; fallback?: boolean }): JSX.Element {
	const label = path === "engine" ? "引擎" : fallback ? "CLI·降级" : "CLI";
	const cls = path === "engine" ? "text-primary" : fallback ? "text-amber-600 dark:text-amber-500" : "text-muted-foreground";
	return <span className={`shrink-0 rounded px-1 py-px text-[9.5px] font-medium ${cls}`}>{label}</span>;
}

function ActionButton({
	title,
	danger,
	onClick,
	children,
}: {
	title: string;
	danger?: boolean;
	onClick: () => void;
	children: JSX.Element;
}): JSX.Element {
	return (
		<button
			type="button"
			title={title}
			aria-label={title}
			onClick={onClick}
			className={`dbx-history-action ${danger ? "dbx-history-action-danger" : ""}`}
		>
			{children}
		</button>
	);
}

export function HistoryPanel({ entries, limit, onLoad, onRerun, onDelete, onClear, onSendToAi }: Props): JSX.Element {
	const full = entries.length >= limit;

	return (
		<div className="flex h-full min-h-0 flex-col">
			{/* 头部 */}
			<div className="flex shrink-0 items-center gap-1.5 px-3 py-2.5">
				<span className="text-[11.5px] font-semibold text-foreground">查询历史</span>
				<span className="rounded-full bg-[var(--dbx-surface-2)] px-1.5 py-px text-[10px] tabular-nums text-muted-foreground">
					{entries.length}/{limit}
				</span>
				<span className="flex-1" />
				{entries.length > 0 && (
					<button
						type="button"
						onClick={onClear}
						title="清空全部历史（不可撤销）"
						className="dbx-history-action dbx-history-action-danger"
						aria-label="清空全部历史"
					>
						<span className="icon-[lucide--trash-2] h-3.5 w-3.5" />
					</button>
				)}
			</div>

			{full && (
				<div className="shrink-0 px-3 py-1 text-[10px] text-amber-600 dark:text-amber-500">
					已到上限：新查询会挤掉最旧的一条
				</div>
			)}

			{/* 卡片列表 */}
			<div className="dbx-scroll min-h-0 flex-1 overflow-y-auto p-2">
				{entries.length === 0 ? (
					<div className="flex h-full flex-col items-center justify-center px-6 text-center">
						<span className="icon-[lucide--history] h-7 w-7 text-muted-foreground/30" />
						<p className="mt-2.5 text-[11.5px] font-medium text-muted-foreground">暂无历史</p>
						<p className="mt-1 text-[10.5px] leading-relaxed text-muted-foreground/70">
							执行查询后，这里会记录 SQL、耗时与取数路径（不保存结果行）
						</p>
					</div>
				) : (
					entries.map((entry) => (
						<article key={entry.id} className="dbx-history-card">
							{/* 主行：状态 + SQL 摘要 + 路径徽标 */}
							<div className="flex items-center gap-1.5">
								{entry.status === "ok" ? (
									<span className="icon-[lucide--check-circle-2] h-3.5 w-3.5 shrink-0 text-emerald-500" />
								) : (
									<span className="icon-[lucide--x-circle] h-3.5 w-3.5 shrink-0 text-red-500" />
								)}
								<p className="dbx-history-sql min-w-0 flex-1 truncate font-mono" title={entry.sql}>
									{summarizeSql(entry.sql, 80)}
								</p>
								<PathBadge path={entry.path} fallback={Boolean(entry.error && entry.path === "cli")} />
							</div>

							{/* 元信息行 */}
							<div className="mt-1 flex items-center gap-1.5 pl-5 text-[10px] text-muted-foreground">
								<span className="min-w-0 truncate font-medium" title={entry.connName}>{entry.connName}</span>
								<span className="shrink-0 tabular-nums">{formatHistoryTime(entry.createdAt)}</span>
								{entry.status === "ok" ? (
									<span className="shrink-0 tabular-nums">
										{entry.rowCount} 行 · {entry.durationMs} ms
									</span>
								) : null}
							</div>

							{entry.status === "error" && entry.error ? (
								<p className="mt-1 truncate pl-5 text-[10px] leading-relaxed text-red-500/90" title={entry.error}>
									{summarizeSql(entry.error, 80)}
								</p>
							) : null}

							{/* 操作行：纯图标常驻，hover 出提示 */}
							<div className="mt-1.5 flex items-center justify-end gap-0.5 pl-5">
								<ActionButton title="载入编辑器" onClick={() => onLoad(entry)}>
									<span className="icon-[lucide--corner-down-left] h-3.5 w-3.5" />
								</ActionButton>
								<ActionButton title="重新执行" onClick={() => onRerun(entry)}>
									<span className="icon-[lucide--play] h-3.5 w-3.5" />
								</ActionButton>
								{onSendToAi && (
									<ActionButton title="发送到 AI 分析" onClick={() => onSendToAi(entry)}>
										<span className="icon-[lucide--sparkles] h-3.5 w-3.5" />
									</ActionButton>
								)}
								<ActionButton title="删除该记录" danger onClick={() => onDelete(entry.id)}>
									<span className="icon-[lucide--trash-2] h-3.5 w-3.5" />
								</ActionButton>
							</div>
						</article>
					))
				)}
			</div>
		</div>
	);
}

/**
 * 查询历史面板 — 右栏。
 *
 * 只渲染 `query-history.ts` 的纯数据（最新的在最前），不自己维护状态：
 * 增删都通过 props 回调交给主面板（主面板再走 `query-history-store.ts` 落盘）。
 * 历史里不保存结果行，因此每张卡片只展示：状态 + SQL 摘要 + 连接 / 时间 / 行数，
 * 操作工具为卡片行内常驻的纯图标按钮（hover 出文字提示）。
 *
 * 版式对齐设计稿：PaneHeader（h-9）+ 状态过滤条（h-8）+ 按日期分组的卡片列表。
 */

import { useMemo, useState, type JSX } from "react";
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

type StatusFilter = "all" | "ok" | "error";

function PathBadge({ path, fallback }: { path: string; fallback?: boolean }): JSX.Element {
	const label = path === "engine" ? "引擎" : fallback ? "CLI·降级" : "CLI";
	const cls = path === "engine" ? "dbx-chip--accent" : fallback ? "dbx-chip--warn" : "";
	return <span className={"dbx-chip " + cls}>{label}</span>;
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
			className={"dbx-icon-btn" + (danger ? " dbx-icon-btn--danger" : "")}
		>
			{children}
		</button>
	);
}

/** 按日历日分组（今天 / 昨天 / 更早），与设计稿的分组标题一致。 */
function dayKey(iso: string): "今天" | "昨天" | "更早" {
	const ts = Date.parse(iso);
	if (!Number.isFinite(ts)) return "更早";
	const now = new Date();
	const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
	if (ts >= startOfToday) return "今天";
	if (ts >= startOfToday - 86_400_000) return "昨天";
	return "更早";
}

export function HistoryPanel({ entries, limit, onLoad, onRerun, onDelete, onClear, onSendToAi }: Props): JSX.Element {
	const [filter, setFilter] = useState<StatusFilter>("all");
	const full = entries.length >= limit;

	const okCount = entries.filter((e) => e.status === "ok").length;
	const errorCount = entries.length - okCount;

	const visible = useMemo(
		() => (filter === "all" ? entries : entries.filter((e) => e.status === filter)),
		[entries, filter],
	);

	const groups = useMemo(() => {
		const buckets: { label: string; items: QueryHistoryEntry[] }[] = [];
		for (const entry of visible) {
			const label = dayKey(entry.createdAt);
			const last = buckets[buckets.length - 1];
			if (last && last.label === label) last.items.push(entry);
			else buckets.push({ label, items: [entry] });
		}
		return buckets;
	}, [visible]);

	const chip = (key: StatusFilter, label: string, count: number): JSX.Element => (
		<button
			type="button"
			onClick={() => setFilter(key)}
			className={
				"h-6 shrink-0 rounded-chip px-2 text-[12px] whitespace-nowrap transition-colors " +
				(filter === key ? "bg-neutral-muted text-surface-foreground" : "text-muted hover:bg-neutral-muted")
			}
		>
			{label}
			{count > 0 && <span className="ml-1 tabular-nums text-faint">{count}</span>}
		</button>
	);

	return (
		<div className="flex h-full min-h-0 flex-col bg-surface-raised">
			{/* 面板头（设计稿 PaneHeader） */}
			<div className="flex h-9 shrink-0 items-center gap-2 border-b border-border bg-surface-raised px-3">
				<span className="font-sans text-[14px] font-semibold tracking-tight whitespace-nowrap text-surface-foreground">
					查询历史
				</span>
				<span className="font-mono text-[12px] tabular-nums whitespace-nowrap text-muted">{entries.length}</span>
				<div className="ml-auto flex items-center gap-0.5">
					{entries.length > 0 && (
						<button
							type="button"
							onClick={onClear}
							title="清空全部历史（不可撤销）"
							className="dbx-icon-btn dbx-icon-btn--danger"
							aria-label="清空全部历史"
						>
							<span className="icon-[lucide--trash-2] h-3.5 w-3.5" />
						</button>
					)}
				</div>
			</div>

			{/* 状态过滤条（设计稿 h-8） */}
			<div className="flex h-8 shrink-0 items-center gap-1 border-b border-border px-2.5">
				{chip("all", "全部", entries.length)}
				{chip("ok", "成功", okCount)}
				{chip("error", "失败", errorCount)}
				{full && <span className="ml-auto shrink-0 text-[12px] text-warning">已到上限</span>}
				{!full && <span className="ml-auto shrink-0 text-[12px] text-faint">上限 {limit}</span>}
			</div>

			{/* 卡片列表 */}
			<div className="dbx-scroll min-h-0 flex-1 overflow-y-auto px-2.5 pb-2">
				{visible.length === 0 ? (
					<div className="flex h-full flex-col items-center justify-center px-6 text-center">
						<span className="icon-[lucide--history] h-7 w-7 text-faint" />
						<p className="mt-2.5 text-[12px] font-medium text-muted">
							{entries.length === 0 ? "暂无历史" : "没有匹配的记录"}
						</p>
						<p className="mt-1 text-[12px] leading-4 text-faint">
							{entries.length === 0 ? "执行查询后，这里会记录 SQL、耗时与取数路径（不保存结果行）" : "换一个状态筛选看看"}
						</p>
					</div>
				) : (
					groups.map((group) => (
						<div key={group.label}>
							<div className="pt-2 pb-1 text-[12px] tracking-[0.06em] text-muted">{group.label}</div>
							<div className="space-y-1.5">
								{group.items.map((entry) => {
									const ok = entry.status === "ok";
									return (
										<article key={entry.id} className="dbx-history-card">
											<div className="flex items-center gap-1.5">
												<span
													className={"size-1.5 shrink-0 rounded-full " + (ok ? "bg-success" : "bg-danger")}
												/>
												<span className="font-mono text-[12px] tabular-nums whitespace-nowrap text-surface-foreground">
													{formatHistoryTime(entry.createdAt)}
												</span>
												{ok ? (
													<>
														<span className="font-mono text-[12px] whitespace-nowrap text-muted">
															{entry.durationMs} ms
														</span>
														<span className="text-[12px] tabular-nums whitespace-nowrap text-muted">
															{entry.rowCount} 行
														</span>
													</>
												) : null}
												<span className="min-w-0 truncate text-[12px] text-muted" title={entry.connName}>
													{entry.connName}
												</span>
												<PathBadge path={entry.path} fallback={Boolean(entry.error && entry.path === "cli")} />
												<span
													className={
														"ml-auto shrink-0 rounded-full border px-2 py-px text-[12px] whitespace-nowrap " +
														(ok
															? "border-success/40 bg-success-soft text-success"
															: "border-danger/40 bg-danger-soft text-danger")
													}
												>
													{ok ? "成功" : "失败"}
												</span>
											</div>

											<p
												className="mt-1.5 line-clamp-2 font-mono text-[12px] leading-4 text-muted"
												title={entry.sql}
											>
												{summarizeSql(entry.sql, 80)}
											</p>

											{!ok && entry.error ? (
												<p
													className="mt-1 truncate text-[12px] leading-4 text-danger"
													title={entry.error}
												>
													{summarizeSql(entry.error, 80)}
												</p>
											) : null}

											<div className="mt-1.5 flex items-center gap-0.5 border-t border-border pt-1.5">
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
												<button
													type="button"
													title="删除该记录"
													aria-label="删除该记录"
													onClick={() => onDelete(entry.id)}
													className="dbx-icon-btn dbx-icon-btn--danger ml-auto"
												>
													<span className="icon-[lucide--trash-2] h-3.5 w-3.5" />
												</button>
											</div>
										</article>
									);
								})}
							</div>
						</div>
					))
				)}
			</div>
		</div>
	);
}

import { useTranslation } from "@astravia-org/plugin-sdk";
import { useEffect, useMemo, useState } from "react";
import type { WorkbenchModel } from "../../hooks/use-workbench";
import { buildTimeline, formatDuration, mergeActivity, type ActivityRow, type TurnSummary } from "../../timeline";
import { Card } from "../shell/card";
import { FilterChips } from "../shell/filter-chips";
import { Icon } from "../shell/icon";
import { PageHeader } from "../shell/page-header";
import { StatTile } from "../shell/stat-tile";

export interface ActivityPageProps {
	model: WorkbenchModel;
}

type Filter = "all" | "call" | "result";

/** 载荷字段的译名。没列到的字段显示原名 —— 比译错一个专业术语好。 */
const HINT_LABEL_KEYS = new Set([
	"entries",
	"sections",
	"findings",
	"rules",
	"symbols",
	"matches",
	"items",
	"total",
	"lines",
	"functions",
	"files",
	"docs",
	"cases",
	"signals",
	"tools",
	"rows",
	"score",
	"grade",
	"format",
	"size",
	"bytes",
	"count",
	"hits",
	"ports",
	"endpoints",
	"mode",
	"level",
]);

/** 时刻。跨天了就带日期 —— 否则两天的调用在列表里分不出来。 */
function clock(at: string, withDate: boolean): string {
	const date = new Date(at);
	if (Number.isNaN(date.getTime())) return "--:--:--";
	const time = date.toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
	if (!withDate) return time;
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${month}-${day} ${time}`;
}

function localDay(at: string): string {
	const date = new Date(at);
	return Number.isNaN(date.getTime()) ? "" : date.toDateString();
}

const MARK: Record<string, string> = { error: "✗", running: "▸", ok: "✓" };

/**
 * 活动页：终端日志风格的调用链，**两行一条**、**按轮分组**。
 *
 * 这里有三条被上一版打出来的约束：
 *
 *   1. 一行只能占两行：第一行时间 + 状态 + 工具名 + 耗时（都是短标量），第二行摘要。
 *      上一版的三列 grid（`62px 14px 1fr`）在改成两行结构后没同步，head 被塞进 62px、
 *      body 塞进 14px —— 这就是「文字被圆角容器遮住」的真正原因。
 *   2. 一次调用只出现一次：宿主推 `tool-start/tool-end`（有时长有成败），工具推
 *      `tool-result`（有摘要有载荷）。它们在 `mergeActivity` 里配成一条；配不上才分开。
 *   3. 轮次用分组标题表达，不用每行重复「前 3 轮」—— 20 行重复同一个属性是噪音。
 */
export function ActivityPage({ model }: ActivityPageProps) {
	const { t } = useTranslation();
	const [filter, setFilter] = useState<Filter>("all");
	// 清空是破坏性动作：点一次变「确认清空 N 条」，5 秒后自动收回。
	const [armed, setArmed] = useState(false);
	const [openRow, setOpenRow] = useState<ActivityRow | null>(null);

	const timeline = useMemo(() => buildTimeline(model.stream.entries), [model.stream.entries]);
	const all = useMemo(
		() => mergeActivity(timeline.spans, model.activity.entries, timeline.turns),
		[timeline, model.activity.entries],
	);
	const rows = useMemo(() => (filter === "all" ? all : all.filter(row => row.kind === filter)), [all, filter]);

	const total = all.length;
	const withDate = useMemo(() => new Set(all.map(row => localDay(row.at))).size > 1, [all]);

	useEffect(() => {
		if (!armed) return;
		const timer = window.setTimeout(() => setArmed(false), 5_000);
		return () => window.clearTimeout(timer);
	}, [armed]);

	// 按轮次分组：rows 已按时间倒序，所以轮次天然从新到旧。
	const groups = useMemo(() => {
		const out: { turn: number; rows: ActivityRow[] }[] = [];
		for (const row of rows) {
			const last = out[out.length - 1];
			if (last && last.turn === row.turn) last.rows.push(row);
			else out.push({ turn: row.turn, rows: [row] });
		}
		return out;
	}, [rows]);

	const clearAll = () => {
		model.activity.clear();
		model.stream.clear();
		setArmed(false);
	};

	return (
		<>
			<PageHeader
				title={t("page.activity.title")}
				description={t("page.activity.lead")}
				actions={
					total > 0 ? (
						<button
							type="button"
							aria-pressed={armed}
							onClick={() => (armed ? clearAll() : setArmed(true))}
							className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10.5px] transition-colors ${
								armed
									? "bg-risk-high/12 text-risk-high ring-1 ring-risk-high/40"
									: "text-text-3 hover:bg-surface-hover hover:text-text"
							}`}
						>
							<Icon name={armed ? "alert" : "close"} className="size-3" />
							{armed ? t("activity.clear.armed", { count: total }) : t("page.activity.clear")}
						</button>
					) : null
				}
			/>

			<div className="fb-page">
				<div className="grid shrink-0 grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2">
					<StatTile label={t("activity.stat.turn")} value={timeline.current.tools} />
					<StatTile
						label={t("activity.stat.failed")}
						value={timeline.current.failures}
						tone={timeline.current.failures > 0 ? "high" : "default"}
					/>
					<StatTile
						label={t("activity.stat.elapsed")}
						value={formatDuration(timeline.current.ms)}
						hint={timeline.current.open ? t("activity.stat.open") : undefined}
					/>
					<StatTile label={t("activity.stat.results")} value={model.activity.entries.length} />
				</div>

				<div className="flex shrink-0 flex-wrap items-center gap-2">
					<FilterChips<Filter>
						value={filter}
						onChange={setFilter}
						items={[
							{ id: "all", label: t("activity.filter.all"), count: all.length },
							{ id: "call", label: t("activity.filter.spans"), count: all.filter(row => row.kind === "call").length },
							{ id: "result", label: t("activity.filter.results"), count: all.filter(row => row.kind === "result").length },
						]}
					/>
					{model.stream.active ? (
						<span className="flex items-center gap-1.5 text-[10.5px] text-risk-medium">
							<span className="size-1.5 rounded-full bg-risk-medium fb-pulse" />
							{t("page.activity.active")}
						</span>
					) : null}
				</div>

				<Card bodyClassName="p-0" fill>
					{total === 0 ? (
						// 从未有过活动：给引导。
						<div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
							<Icon name="nav-activity" className="size-5 text-text-4" />
							<p className="text-[11.5px] font-medium text-text-2">{t("page.activity.empty.title")}</p>
							<p className="max-w-sm whitespace-pre-line text-[10.5px] leading-relaxed text-text-4">
								{t("page.activity.empty.steps")}
							</p>
						</div>
					) : rows.length === 0 ? (
						// 有活动但当前筛选为空：与「还没开始」是两件事，不能复用引导语。
						<div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
							<Icon name="filter" className="size-5 text-text-4" />
							<p className="text-[11.5px] text-text-2">
								{t("activity.filter.empty", {
									name:
										filter === "call"
											? t("activity.filter.spans")
											: filter === "result"
												? t("activity.filter.results")
												: t("activity.filter.all"),
								})}
							</p>
							<button
								type="button"
								onClick={() => setFilter("all")}
								className="rounded-md border border-line-subtle px-2 py-1 text-[10.5px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text"
							>
								{t("activity.filter.reset")}
							</button>
						</div>
					) : (
						// role="log" + aria-live：这是直播列表，读屏用户需要被告知有新条目。
						<div
							role="log"
							aria-live="polite"
							aria-relevant="additions"
							data-testid="activity-log"
							className="fb-terminal fb-scroll fb-fill-scroll overflow-y-auto p-1.5"
						>
							{groups.map(group => (
								<section key={group.turn} data-turn={group.turn}>
									<div className="fb-turn">{turnLabel(group.turn, group.rows, timeline.turns, t)}</div>
									{group.rows.map(row => (
										<LogRow key={row.key} row={row} withDate={withDate} onOpen={() => setOpenRow(row)} t={t} />
									))}
								</section>
							))}
						</div>
					)}
				</Card>
			</div>

			<PayloadDialog row={openRow} onClose={() => setOpenRow(null)} t={t} />
		</>
	);
}

type Translate = ReturnType<typeof useTranslation>["t"];

/** 轮标题：第 N 轮 · M 次调用 · K 失败 · 时长。数据全部来自 timeline，不另算一份。 */
function turnLabel(turn: number, rows: ActivityRow[], turns: readonly TurnSummary[], t: Translate): string {
	if (turn < 0) return `${t("activity.turn.unknown")} · ${t("activity.turn.stats", { tools: rows.length })}`;
	const summary = turns.find(item => item.index === turn);
	const failed = summary ? summary.failures : rows.filter(row => row.isError).length;
	const parts = [t("activity.turn.header", { turn: turn + 1 }), t("activity.turn.stats", { tools: summary?.tools ?? rows.length })];
	if (failed > 0) parts.push(t("activity.turn.failures", { count: failed }));
	parts.push(summary?.ms != null ? formatDuration(summary.ms) : t("activity.turn.open"));
	return parts.join(" · ");
}

function LogRow({
	row,
	withDate,
	onOpen,
	t,
}: {
	row: ActivityRow;
	withDate: boolean;
	onOpen(): void;
	t: Translate;
}) {
	const tone = row.isError ? "err" : row.status === "running" ? "run" : row.status === "ok" ? "ok" : "idle";
	const body = row.summary ?? (row.status === "running" ? t("status.span.running") : row.status === "error" ? t("status.span.error") : t("status.span.ok"));
	const openable = row.payload !== undefined;

	return (
		<div className="fb-log" data-tone={tone} data-span-status={row.status ?? undefined} data-kind={row.kind}>
			<div className="fb-log-head">
				<span className="shrink-0 tabular-nums text-text-4">{clock(row.at, withDate)}</span>
				<span className="fb-log-mark shrink-0">{MARK[row.status ?? ""] ?? "·"}</span>
				<span className="fb-log-name fb-wrap font-medium">{row.toolId}</span>
				{row.ms !== null ? <span className="shrink-0 tabular-nums text-text-4">{formatDuration(row.ms)}</span> : null}
				{row.kind === "result" ? <span className="shrink-0 text-text-4">{t("activity.row.result")}</span> : null}
			</div>
			<div className="fb-log-body">
				{openable ? (
					<button
						type="button"
						onClick={onOpen}
						title={t("activity.row.open")}
						className="fb-wrap text-left underline decoration-line-strong decoration-dotted underline-offset-2 hover:text-text-2"
					>
						{body}
					</button>
				) : (
					body
				)}
			</div>
			{row.hints.length > 0 ? (
				<div className="fb-log-body">
					{row.hints
						.map(hint => `${HINT_LABEL_KEYS.has(hint.key) ? t(`activity.hint.${hint.key}`) : hint.key} ${hint.value}`)
						.join(" · ")}
				</div>
			) : null}
		</div>
	);
}

/** 载荷弹窗：一次调用的结构化结果。Esc 关闭，点击遮罩关闭。 */
function PayloadDialog({ row, onClose, t }: { row: ActivityRow | null; onClose(): void; t: Translate }) {
	useEffect(() => {
		if (!row) return;
		const onKey = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			event.stopPropagation();
			onClose();
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [row, onClose]);

	if (!row) return null;
	const text = row.payload === undefined ? "" : JSON.stringify(row.payload, null, 2);

	return (
		<div className="fb-overlay" onClick={onClose}>
			<div
				role="dialog"
				aria-modal="true"
				aria-label={row.toolId}
				onClick={event => event.stopPropagation()}
				className="flex max-h-[88%] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-surface-2 ring-1 ring-line-strong"
				data-testid="activity-detail"
			>
				<div className="flex shrink-0 items-start gap-2 border-b border-line-subtle px-3.5 py-2">
					<div className="min-w-0 flex-1">
						<div className="fb-wrap text-[12px] font-semibold text-text">{row.toolId}</div>
						<div className="fb-wrap font-mono text-[10.5px] text-text-4">
							{clock(row.at, true)}
							{row.ms !== null ? ` · ${formatDuration(row.ms)}` : ""}
						</div>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="inline-flex shrink-0 items-center gap-1 rounded-md border border-line-subtle px-1.5 py-0.5 text-[10.5px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text"
					>
						{t("docs.preview.back")}
					</button>
				</div>
				<div className="fb-scroll min-h-0 flex-1 overflow-auto px-3.5 py-3">
					{text ? (
						<>
							<div className="mb-1 text-[10.5px] font-medium uppercase tracking-wider text-text-4">{t("activity.detail.payload")}</div>
							<pre className="fb-wrap whitespace-pre-wrap break-words font-mono text-[10.5px] leading-relaxed text-text-2">{text}</pre>
						</>
					) : (
						<p className="text-[11.5px] text-text-4">{t("activity.detail.empty")}</p>
					)}
				</div>
			</div>
		</div>
	);
}

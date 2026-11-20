import { useTranslation } from "@astravia-org/plugin-sdk";
import { useState } from "react";
import type { WorkbenchModel } from "../../hooks/use-workbench";
import type { ActivityEntry } from "../../state";
import { buildTimeline, formatDuration, payloadHints, type ToolSpan } from "../../timeline";
import { Card } from "../shell/card";
import { FilterChips } from "../shell/filter-chips";
import { Icon } from "../shell/icon";
import { PageHeader } from "../shell/page-header";
import { StatTile } from "../shell/stat-tile";

export interface ActivityPageProps {
	model: WorkbenchModel;
}

function timeLabel(at: string): string {
	const date = new Date(at);
	if (Number.isNaN(date.getTime())) return at;
	return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function atValue(at: string): number {
	const parsed = Date.parse(at);
	return Number.isNaN(parsed) ? 0 : parsed;
}

/** 每种结果一个图标 + 配色；未知种类回落到 info。 */
function iconFor(kind: ActivityEntry["kind"]): { icon: string; tone: string } {
	switch (kind) {
		case "report":
			return { icon: "nav-reports", tone: "text-purple" };
		case "strings":
			return { icon: "nav-strings", tone: "text-text-3" };
		case "symbols":
			return { icon: "layout", tone: "text-text-3" };
		case "disasm":
			return { icon: "nav-disasm", tone: "text-blue" };
		case "decompile":
			return { icon: "code", tone: "text-blue" };
		case "diff":
			return { icon: "nav-compare", tone: "text-amber" };
		case "signature":
			return { icon: "nav-signature", tone: "text-green" };
		case "checklist":
			return { icon: "clipboard", tone: "text-purple" };
		case "probe":
			return { icon: "chip", tone: "text-text-3" };
		case "docs":
			return { icon: "nav-docs", tone: "text-text-3" };
		case "hook":
			return { icon: "sparkle", tone: "text-amber" };
		case "protocol":
			return { icon: "message", tone: "text-blue" };
		default:
			return { icon: "info", tone: "text-text-4" };
	}
}

const SPAN_META: Record<ToolSpan["status"], { icon: string; tone: string; pulse: boolean }> = {
	running: { icon: "play", tone: "text-risk-medium", pulse: true },
	ok: { icon: "check", tone: "text-risk-low", pulse: false },
	error: { icon: "error", tone: "text-risk-high", pulse: false },
};

type Filter = "all" | "span" | "result";

type Row =
	| { key: string; sort: number; kind: "span"; span: ToolSpan }
	| { key: string; sort: number; kind: "result"; entry: ActivityEntry };

/**
 * 活动页：一条时间线同时装两种来源。
 *
 * - 工具调用（`stream`）：开始 / 结束配对成一段，带耗时与成败——这是「信息链」的主干；
 * - 工具结果（`activity`）：Agent 跑完一个工具后同步过来的可扫读条目，带规模量。
 *
 * 两者本来就是同一条主线的两面。以前只按时间平铺，看不出「这一轮花了多久、谁失败了」；
 * 现在顶端给出本轮汇总，每段调用标出轮次与耗时，结果行把载荷里的规模量摊成一排。
 */
export function ActivityPage({ model }: ActivityPageProps) {
	const { t } = useTranslation();
	const [filter, setFilter] = useState<Filter>("all");

	// 事件流已经是内存里的环形缓冲，这里再推一次纯函数比在渲染里手算更可靠。
	const timeline = buildTimeline(model.stream.entries);

	const rows: Row[] = [
		...timeline.spans.map(span => ({ key: `span-${span.id}`, sort: atValue(span.startedAt), kind: "span" as const, span })),
		...model.activity.entries.map(entry => ({ key: `result-${entry.id}`, sort: atValue(entry.at), kind: "result" as const, entry })),
	]
		.filter(row => filter === "all" || row.kind === filter)
		.sort((left, right) => right.sort - left.sort);

	const total = timeline.spans.length + model.activity.entries.length;

	const clearAll = () => {
		model.activity.clear();
		model.stream.clear();
	};

	return (
		<>
			<PageHeader
				title={t("page.activity.title")}
				description={t("page.activity.lead")}
				actions={
					rows.length > 0 ? (
						<button
							type="button"
							onClick={clearAll}
							className="flex items-center gap-1 rounded-md px-2 py-1 text-[10.5px] text-text-3 hover:bg-surface-hover hover:text-text"
						>
							<Icon name="close" className="size-3" />
							{t("page.activity.clear")}
						</button>
					) : null
				}
			/>

			<div className="fb-page">
				<div className="grid shrink-0 grid-cols-2 gap-2 @min-[560px]:grid-cols-4">
					<StatTile label={t("activity.stat.turn")} value={timeline.current.tools} />
					<StatTile
						label={t("activity.stat.failed")}
						value={timeline.current.failures}
						tone={timeline.current.failures > 0 ? "high" : "default"}
					/>
					<StatTile label={t("activity.stat.elapsed")} value={formatDuration(timeline.current.ms)} hint={timeline.current.open ? t("activity.stat.open") : undefined} />
					<StatTile label={t("activity.stat.results")} value={model.activity.entries.length} />
				</div>

				<div className="flex shrink-0 items-center min-w-0">
					<FilterChips<Filter>
						value={filter}
						onChange={setFilter}
						items={[
							{ id: "all", label: t("activity.filter.all"), count: total },
							{ id: "span", label: t("activity.filter.spans"), count: timeline.spans.length },
							{ id: "result", label: t("activity.filter.results"), count: model.activity.entries.length },
						]}
					/>
				</div>

				{model.stream.active ? (
					<div data-testid="activity-active" className="flex items-center gap-1.5 text-[10.5px] text-text-3">
						<span className="size-2 fb-pulse rounded-full bg-risk-medium" />
						{t("page.activity.active")}
					</div>
				) : null}

				{rows.length === 0 ? (
					<Card title={t("page.activity.empty.title")} bodyClassName="p-3.5">
						<ol className="space-y-2">
							{(t("page.activity.empty.steps").split("\n") as string[]).map((step, index) => (
								<li key={index} className="flex items-start gap-2.5">
									<span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-4 font-mono text-[10px] text-text-2">
										{index + 1}
									</span>
									<div className="min-w-0 text-[10.5px] leading-relaxed text-text-4">{step}</div>
								</li>
							))}
						</ol>
					</Card>
				) : (
					<Card bodyClassName="p-0" fill>
						<div className="fb-scroll fb-fill-scroll divide-y divide-line-subtle overflow-y-auto">
							{rows.map(row => {
								if (row.kind === "span") {
									const meta = SPAN_META[row.span.status];
									return (
										<div key={row.key} className="flex items-start gap-2.5 px-3.5 py-2" data-span-status={row.span.status}>
											<span
												className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-surface-3 ${meta.tone} ${
													meta.pulse ? "motion-safe:animate-pulse" : ""
												}`}
											>
												<Icon name={meta.icon} className="size-3.5" />
											</span>
											<div className="min-w-0 flex-1">
												<div className="flex flex-wrap items-baseline gap-2">
													<span className="min-w-0 truncate font-mono text-[11px] text-text">{row.span.toolName}</span>
													<span className="shrink-0 font-mono text-[10px] text-text-3">{formatDuration(row.span.ms)}</span>
													{row.span.turn > 0 ? (
														<span className="shrink-0 rounded bg-surface-3 px-1.5 py-0.5 text-[9px] text-text-3">
															{t("activity.turnBehind", { count: row.span.turn })}
														</span>
													) : (
														<span className="shrink-0 rounded bg-purple/12 px-1.5 py-0.5 text-[9px] text-purple">{t("activity.turnNow")}</span>
													)}
													<span className="shrink-0 text-[9.5px] uppercase tracking-wide text-text-4">{timeLabel(row.span.startedAt)}</span>
												</div>
											</div>
										</div>
									);
								}

								const entry = row.entry;
								const meta = iconFor(entry.kind);
								const hints = payloadHints(entry.payload);
								return (
									<div key={row.key} className="flex items-start gap-2.5 px-3.5 py-2.5">
										<span className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-surface-3 ${meta.tone}`}>
											<Icon name={meta.icon} className="size-3.5" />
										</span>
										<div className="min-w-0 flex-1">
											<div className="flex flex-wrap items-baseline gap-2">
												<span className="font-mono text-[11px] font-medium text-text">{entry.toolId}</span>
												<span className="shrink-0 text-[9.5px] uppercase tracking-wide text-text-4">{timeLabel(entry.at)}</span>
												{entry.kind !== "other" ? (
													<span className="shrink-0 rounded bg-surface-3 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-text-3">{entry.kind}</span>
												) : null}
											</div>
											<div className="mt-0.5 text-[11px] leading-snug text-text-2">{entry.summary}</div>
											{entry.target ? <div className="mt-0.5 truncate font-mono text-[10px] text-text-4">{entry.target}</div> : null}
											{hints.length > 0 ? (
												<div className="mt-1 flex flex-wrap gap-1">
													{hints.map(hint => (
														<span key={hint} className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[9.5px] text-text-3">
															{hint}
														</span>
													))}
												</div>
											) : null}
										</div>
									</div>
								);
							})}
						</div>
					</Card>
				)}
			</div>
		</>
	);
}

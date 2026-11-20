import { useTranslation } from "@astravia-org/plugin-sdk";
import { useState } from "react";
import type { WorkbenchModel } from "../../hooks/use-workbench";
import { buildTimeline, formatDuration, payloadHints } from "../../timeline";
import { Card } from "../shell/card";
import { FilterChips } from "../shell/filter-chips";
import { Icon } from "../shell/icon";
import { PageHeader } from "../shell/page-header";
import { StatTile } from "../shell/stat-tile";

export interface ActivityPageProps {
	model: WorkbenchModel;
}

type Filter = "all" | "span" | "result";

function clock(at: string): string {
	const date = new Date(at);
	if (Number.isNaN(date.getTime())) return "--:--:--";
	return date.toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function atValue(at: string): number {
	const parsed = Date.parse(at);
	return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * 活动页：**终端日志**风格的调用链。
 *
 * 这一页回答的是「插件在跟宿主对话时，过程中发生了什么」——工具何时开始、跑了多久、
 * 谁报错、结果多大。这类信息本来就是流式日志，用卡片逐条排版反而把时间轴拆散了。
 * 所以改成等宽、单行、带时间戳的日志流：一屏能看到更多行，失败行自带颜色。
 *
 * 配色不另起一套：运行中 = risk-medium，成功 = risk-low，失败 = risk-high，工具名 = 前景色。
 */
export function ActivityPage({ model }: ActivityPageProps) {
	const { t } = useTranslation();
	const [filter, setFilter] = useState<Filter>("all");

	const timeline = buildTimeline(model.stream.entries);

	type Row = { key: string; sort: number; kind: "span" | "result"; payload: unknown };
	const rows: Row[] = [
		...timeline.spans.map(span => ({ key: `span-${span.id}`, sort: atValue(span.startedAt), kind: "span" as const, payload: span })),
		...model.activity.entries.map(entry => ({ key: `result-${entry.id}`, sort: atValue(entry.at), kind: "result" as const, payload: entry })),
	]
		.filter(row => filter === "all" || row.kind === filter)
		.sort((left, right) => right.sort - left.sort);

	const total = timeline.spans.length + model.activity.entries.length;

	return (
		<>
			<PageHeader
				title={t("page.activity.title")}
				description={t("page.activity.lead")}
				actions={
					rows.length > 0 ? (
						<button
							type="button"
							onClick={() => {
								model.activity.clear();
								model.stream.clear();
							}}
							className="flex items-center gap-1 rounded-md px-2 py-1 text-[10.5px] text-text-3 transition-colors hover:bg-surface-hover hover:text-text"
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
					<StatTile label={t("activity.stat.failed")} value={timeline.current.failures} tone={timeline.current.failures > 0 ? "high" : "default"} />
					<StatTile label={t("activity.stat.elapsed")} value={formatDuration(timeline.current.ms)} hint={timeline.current.open ? t("activity.stat.open") : undefined} />
					<StatTile label={t("activity.stat.results")} value={model.activity.entries.length} />
				</div>

				<div className="flex shrink-0 flex-wrap items-center gap-2">
					<FilterChips<Filter>
						value={filter}
						onChange={setFilter}
						items={[
							{ id: "all", label: t("activity.filter.all"), count: total },
							{ id: "span", label: t("activity.filter.spans"), count: timeline.spans.length },
							{ id: "result", label: t("activity.filter.results"), count: model.activity.entries.length },
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
					{rows.length === 0 ? (
						<div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
							<Icon name="nav-activity" className="size-5 text-text-4" />
							<p className="text-[11.5px] font-medium text-text-2">{t("page.activity.empty.title")}</p>
							<p className="max-w-sm whitespace-pre-line text-[10.5px] leading-relaxed text-text-4">{t("page.activity.empty.steps")}</p>
						</div>
					) : (
						<div className="fb-terminal fb-scroll fb-fill-scroll overflow-y-auto py-1.5">
							{rows.map(row => {
								if (row.kind === "span") {
									const span = row.payload as (typeof timeline.spans)[number];
									const tone = span.status === "error" ? "err" : span.status === "running" ? "run" : "ok";
									return (
										<div key={row.key} className="fb-log" data-tone={tone} data-span-status={span.status}>
											<span className="fb-log-time tabular-nums text-text-4">{clock(span.startedAt)}</span>
											<span className="fb-log-mark">
												{span.status === "error" ? "✗" : span.status === "running" ? "▸" : "✓"}
											</span>
											<span className="min-w-0 truncate">
												<span className="fb-log-name">{span.toolName}</span>
												<span className="ms-2 text-text-4 tabular-nums">{formatDuration(span.ms)}</span>
												<span className="ms-2 text-text-4">{span.turn > 0 ? t("activity.turnBehind", { count: span.turn }) : t("activity.turnNow")}</span>
											</span>
										</div>
									);
								}
								const entry = row.payload as (typeof model.activity.entries)[number];
								const hints = payloadHints(entry.payload);
								return (
									<div key={row.key} className="fb-log" data-tone="ok">
										<span className="fb-log-time tabular-nums text-text-4">{clock(entry.at)}</span>
										<span className="fb-log-mark text-text-4">·</span>
										<span className="min-w-0">
											<span className="fb-log-name">{entry.toolId}</span>
											<span className="ms-2 text-text-3">{entry.summary}</span>
											{hints.length > 0 ? <span className="ms-2 text-text-4">[{hints.join(" · ")}]</span> : null}
										</span>
									</div>
								);
							})}
						</div>
					)}
				</Card>
			</div>
		</>
	);
}

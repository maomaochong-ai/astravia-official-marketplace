/**
 * 面板「发现」页：两条信息流放在一屏 —— 上半是**对话观测**（宿主那边正在发生什么），
 * 下半是**规则命中**（这份报告的结论）。
 *
 * 为什么合成一页：用户的真实问题是「现在该做什么」。规则命中回答「哪里有问题」，
 * 观测回答「刚刚发生了什么、哪一步没跑通」—— 分两页看，就得自己在脑中拼。
 * 上一版这一页在没报告时只有一个「去载入样本」的按钮，把对话里已经拿到的结论整块丢掉了。
 *
 * 两条硬约束：
 *   1. 观测行不自己造事实：每一条都来自 report / activity / stream / timeline / probe 的现有字段；
 *      没有数据就没有那一行，不写「一切正常」。
 *   2. 排序在 `observations.ts` 里定（被拦 → 探测 → 风险 → 本轮 → 最近 → 无样本），
 *      页面只按顺序画 —— 一个页面两套排序，读者会以为顺序有意义却对不上。
 */

import { useTranslation } from "@astravia-org/plugin-sdk";
import { useMemo, useState } from "react";
import { SEVERITY_ORDER, severityRank, type Severity } from "../../../../domain/audit/rules";
import { deriveObservations, type Observation } from "../../observations";
import type { LiveTone } from "../../live-status";
import { AiButton } from "../shell/ai-button";
import { Card } from "../shell/card";
import { EmptyState } from "../shell/empty-state";
import { FilterChips } from "../shell/filter-chips";
import { Icon } from "../shell/icon";
import { PageHeader } from "../shell/page-header";
import { StatTile } from "../shell/stat-tile";
import { Tag } from "../shell/tag";
import { FindingList } from "../workbench/finding-list";
import type { PageProps } from "./overview";

type Filter = Severity | "all";

const TONE_DOT: Record<LiveTone, string> = {
	alert: "bg-risk-high",
	live: "bg-risk-low",
	idle: "bg-line-strong",
};

/** 发现页：对话观测 + 规则命中，数据全部来自已有来源，不重新分析。 */
export function FindingsPage({ model }: PageProps) {
	const { t } = useTranslation();
	const [filter, setFilter] = useState<Filter>("all");
	const report = model.report;
	const busy = model.chat.sending;

	const findings = useMemo(
		() => (report ? [...report.findings].sort((left, right) => severityRank(left.severity) - severityRank(right.severity)) : []),
		[report],
	);

	// 观测行的输入全部来自 model；`t` 也在依赖里，切语言时标题跟着变。
	const observations = useMemo(
		() =>
			deriveObservations(
				{
					report,
					activity: model.activity.entries,
					stream: { entries: model.stream.entries, active: model.stream.active },
					timeline: model.timeline,
					probe: model.probe.record,
					selectedPath: model.selectedPath,
					phase: model.phase,
				},
				t,
			),
		[report, model.activity.entries, model.stream.entries, model.stream.active, model.timeline, model.probe.record, model.selectedPath, model.phase, t],
	);

	const visible = filter === "all" ? findings : findings.filter(finding => finding.severity === filter);
	// 一次分桶：统计卡与筛选 chips 都从这里取数，避免同一份数据算两遍、更避免两处不一致。
	const bySeverity = useMemo(() => {
		const map = new Map<string, number>();
		for (const finding of findings) map.set(finding.severity, (map.get(finding.severity) ?? 0) + 1);
		return map;
	}, [findings]);
	const countOf = (severity: Severity) => bySeverity.get(severity) ?? 0;

	const chips = useMemo(
		() => [
			{ id: "all" as Filter, label: t("findings.filter.all"), count: findings.length },
			...SEVERITY_ORDER.map(severity => ({
				id: severity as Filter,
				label: t(`severity.${severity}`),
				count: bySeverity.get(severity) ?? 0,
			})),
		],
		[findings, bySeverity, t],
	);

	const act = (row: Observation) => {
		const action = row.action;
		if (!action) return;
		if (action.prompt) {
			model.askText(action.prompt);
			return;
		}
		if (action.page) model.go(action.page);
	};

	return (
		<>
			<PageHeader
				title={t("page.findings.title")}
				description={t("page.findings.lead")}
				actions={<AiButton label={t("ai.explainAll")} onClick={() => model.ask("findings-summary")} busy={busy} />}
			/>
			<div className="fb-page">
				{/* 对话观测：这一块是「宿主对话过程」在面板里的落地位置。 */}
				<Card
					testId="observation-board"
					title={t("page.findings.observe")}
					actions={
						<span className="font-mono text-[9.5px] tabular-nums text-text-4">
							{t("page.findings.observeCount", { count: observations.length })}
						</span>
					}
					bodyClassName="p-0"
				>
					<ul data-testid="observation-list" className="fb-scroll max-h-[var(--fb-h-md)] divide-y divide-line-subtle overflow-y-auto">
						{observations.map(row => (
							<li key={row.id} data-kind={row.kind} data-tone={row.tone} className="flex items-start gap-2 px-3 py-2">
								<span aria-hidden className={`mt-1.5 size-1.5 shrink-0 rounded-full ${TONE_DOT[row.tone]}`} />
								<div className="min-w-0 flex-1">
									<div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
										<span className="shrink-0 text-[9.5px] uppercase tracking-wider text-text-4">{t(`obs.kind.${row.kind}`)}</span>
										<span className="min-w-0 fb-wrap text-[11.5px] font-medium text-text">{row.title}</span>
									</div>
									{row.detail ? (
										<p className="fb-wrap font-mono text-[10.5px] text-text-3" title={row.detail}>
											{row.detail}
										</p>
									) : null}
									{row.hint ? <p className="fb-wrap text-[10.5px] leading-relaxed text-text-4">{row.hint}</p> : null}
								</div>
								{row.action ? (
									<button
										type="button"
										onClick={() => act(row)}
										disabled={busy && row.action.prompt !== undefined}
										className="inline-flex shrink-0 items-center gap-1 rounded-md border border-line-subtle px-1.5 py-0.5 text-[10.5px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text disabled:opacity-40"
									>
										<span className="fb-wrap">{t(row.action.labelKey)}</span>
										<Icon name={row.action.prompt ? "send" : "arrow"} className="size-3 shrink-0 text-text-4" />
									</button>
								) : null}
							</li>
						))}
					</ul>
				</Card>

				{report ? (
					<>
						{/*
						 * 统计卡与筛选 chips 用同一组档位：卡片三格、chips 五档时，用户读到的两个数对不上。
						 * 零值不上色 —— 0 条高危把格子染红，等于把「没有」画成「有事」。
						 */}
						<div className="grid shrink-0 grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2">
							<StatTile label={t("findings.stat.total")} value={findings.length} />
							{SEVERITY_ORDER.map(severity => {
								const count = countOf(severity);
								return (
									<StatTile
										key={severity}
										label={t(`severity.${severity}`)}
										value={count}
										tone={count === 0 ? "default" : severity === "critical" || severity === "high" ? "high" : severity === "medium" ? "medium" : "low"}
									/>
								);
							})}
						</div>

						<Card
							title={t("page.findings.list")}
							actions={
								<>
									{/* 全清（零发现）是一个结论，用标签说，不用一格 0/1 的统计卡。 */}
									{findings.length === 0 ? <Tag tone="low">{t("findings.stat.clean")}</Tag> : null}
									<FilterChips items={chips} value={filter} onChange={value => setFilter(value as Filter)} />
								</>
							}
							bodyClassName="p-0"
						>
							<FindingList findings={visible} busy={busy} onAsk={finding => model.ask("finding", { ruleId: finding.ruleId })} />
						</Card>
					</>
				) : (
					// 没有报告时不再只给一个「去载入样本」：另一条路是让对话先扫一个样本，结果会同步回来。
					<EmptyState
						icon="scan"
						title={t("empty.noReport.title")}
						body={t("empty.noReport.body")}
						action={
							<div className="flex flex-wrap items-center justify-center gap-1.5">
								<button
									type="button"
									onClick={() => model.go("samples")}
									className="rounded-md border border-line-subtle px-2.5 py-1 text-[11.5px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text"
								>
									{t("findings.empty.action")}
								</button>
								<button
									type="button"
									onClick={() => model.askText("先看看这个工作区里有什么可分析的样本：用 triage_directory 列一遍，告诉我哪几个最值得先看，为什么。")}
									disabled={busy}
									className="rounded-md border border-line-subtle px-2.5 py-1 text-[11.5px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text disabled:opacity-40"
								>
									{t("findings.empty.askAction")}
								</button>
							</div>
						}
					/>
				)}
			</div>
		</>
	);
}

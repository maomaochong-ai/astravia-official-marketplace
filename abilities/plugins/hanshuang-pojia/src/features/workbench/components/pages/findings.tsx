/**
 * 面板「发现」页：按规则与严重级别筛选体检结论。
 *
 * 排序键来自 `domain/audit/rules`（`SEVERITY_ORDER` / `severityRank`），
 * 页面不得自排一套顺序，否则与报告里的次序对不上。
 */

import { useTranslation } from "@astravia-org/plugin-sdk";
import { useState } from "react";
import { SEVERITY_ORDER, severityRank, type Severity } from "../../../../domain/audit/rules";
import { AiButton } from "../shell/ai-button";
import { Card } from "../shell/card";
import { EmptyState } from "../shell/empty-state";
import { FilterChips } from "../shell/filter-chips";
import { PageHeader } from "../shell/page-header";
import { StatTile } from "../shell/stat-tile";
import { Tag } from "../shell/tag";
import { FindingList } from "../workbench/finding-list";
import type { PageProps } from "./overview";

type Filter = Severity | "all";

/** 发现页：按严重度筛选，全部来自本次报告，不重新分析。 */
export function FindingsPage({ model }: PageProps) {
	const { t } = useTranslation();
	const [filter, setFilter] = useState<Filter>("all");
	const report = model.report;
	const busy = model.chat.sending;

	if (!report) {
		return (
			<>
				<PageHeader title={t("page.findings.title")} description={t("page.findings.lead")} />
				{/* 空态必须给出下一步：这一页没有入口，用户只能自己回去找样本页。 */}
				<div className="fb-page">
					<EmptyState
						icon="scan"
						title={t("empty.noReport.title")}
						body={t("empty.noReport.body")}
						action={
							<button
								type="button"
								onClick={() => model.go("samples")}
								className="rounded-md border border-line-subtle px-2.5 py-1 text-[11.5px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text"
							>
								{t("findings.empty.action")}
							</button>
						}
					/>
				</div>
			</>
		);
	}

	const findings = [...report.findings].sort((left, right) => severityRank(left.severity) - severityRank(right.severity));
	const visible = filter === "all" ? findings : findings.filter(finding => finding.severity === filter);
	// 一次分桶：统计卡与筛选 chips 都从这里取数，避免同一份数据算两遍、更避免两处不一致。
	const bySeverity = new Map<string, number>();
	for (const finding of findings) bySeverity.set(finding.severity, (bySeverity.get(finding.severity) ?? 0) + 1);
	const countOf = (severity: Severity) => bySeverity.get(severity) ?? 0;

	const chips = [
		{ id: "all" as Filter, label: t("findings.filter.all"), count: findings.length },
		...SEVERITY_ORDER.map(severity => ({
			id: severity as Filter,
			label: t(`severity.${severity}`),
			count: countOf(severity),
		})),
	];

	return (
		<>
			<PageHeader
				title={t("page.findings.title")}
				description={t("page.findings.lead")}
				actions={<AiButton label={t("ai.explainAll")} onClick={() => model.ask("findings-summary")} busy={busy} />}
			/>
			<div className="fb-page">
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
			</div>
		</>
	);
}

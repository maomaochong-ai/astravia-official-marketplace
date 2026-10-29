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
				<EmptyState icon="scan" title={t("empty.noReport.title")} body={t("empty.noReport.body")} />
			</>
		);
	}

	const findings = [...report.findings].sort((left, right) => severityRank(left.severity) - severityRank(right.severity));
	const visible = filter === "all" ? findings : findings.filter(finding => finding.severity === filter);
	const chips = [
		{ id: "all" as Filter, label: t("findings.filter.all"), count: findings.length },
		...SEVERITY_ORDER.map(severity => ({
			id: severity as Filter,
			label: t(`severity.${severity}`),
			count: findings.filter(finding => finding.severity === severity).length,
		})),
	];

	return (
		<>
			<PageHeader
				title={t("page.findings.title")}
				description={t("page.findings.lead")}
				actions={<AiButton label={t("ai.explainAll")} onClick={() => model.ask("findings-summary")} busy={busy} />}
			/>
			<div className="space-y-3 p-4">
				<div className="grid grid-cols-2 gap-2 @min-[620px]:grid-cols-4">
					<StatTile label={t("findings.stat.total")} value={findings.length} />
					<StatTile
						label={t("severity.high")}
						value={findings.filter(finding => finding.severity === "critical" || finding.severity === "high").length}
						tone="high"
					/>
					<StatTile label={t("severity.medium")} value={findings.filter(finding => finding.severity === "medium").length} tone="medium" />
					<StatTile label={t("findings.stat.clean")} value={findings.length === 0 ? 1 : 0} tone={findings.length === 0 ? "low" : "default"} hint={t("findings.stat.cleanHint")} />
				</div>

				<Card title={t("page.findings.list")} actions={<FilterChips items={chips} value={filter} onChange={value => setFilter(value as Filter)} />} bodyClassName="pt-1">
					<FindingList findings={visible} busy={busy} onAsk={finding => model.ask("finding", { ruleId: finding.ruleId })} />
				</Card>
			</div>
		</>
	);
}

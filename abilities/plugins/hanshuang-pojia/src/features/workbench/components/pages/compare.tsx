import { useTranslation } from "@astravia-org/plugin-sdk";
import { useMemo } from "react";
import { formatBytes } from "../../../../domain/report/report";
import { compareReports } from "../../report-compare";
import { SEVERITY_TEXT } from "../../severity";
import { AiButton } from "../shell/ai-button";
import { Card } from "../shell/card";
import { DataTable, type DataTableRow } from "../shell/data-table";
import { EmptyState } from "../shell/empty-state";
import { PageHeader } from "../shell/page-header";
import { StatTile } from "../shell/stat-tile";
import type { PageProps } from "./overview";

/** 对比页：两份都必须是本次会话里分析过的报告，因为面板只保留摘要到存储。 */
export function ComparePage({ model }: PageProps) {
	const { t } = useTranslation();
	const busy = model.chat.sending;
	const available = model.entries.filter(entry => model.reports[entry.id]);
	const left = model.compareA ? model.reports[model.compareA] : null;
	const right = model.compareB ? model.reports[model.compareB] : null;

	const diff = useMemo(() => (left && right ? compareReports(left, right) : null), [left, right]);

	if (available.length < 2) {
		return (
			<>
				<PageHeader title={t("page.compare.title")} description={t("page.compare.lead")} />
				<EmptyState icon="compare" title={t("compare.needTwo.title")} body={t("compare.needTwo.body")} />
			</>
		);
	}

	const factRows: DataTableRow[] = (diff?.facts ?? [])
		.filter(fact => fact.changed)
		.slice(0, 40)
		.map(fact => ({ key: fact.label, cells: [fact.label, fact.left, fact.right] }));

	return (
		<>
			<PageHeader
				title={t("page.compare.title")}
				description={t("page.compare.lead")}
				actions={<AiButton label={t("ai.compare")} onClick={() => model.ask("compare", { other: right?.target.name })} busy={busy} disabled={!diff} />}
			/>
			<div className="space-y-3 p-4">
				<Card title={t("compare.pick")} bodyClassName="grid gap-2 px-3.5 py-3 @min-[720px]:grid-cols-2">
					<label className="block min-w-0">
						<span className="mb-1 block text-[10.5px] text-text-4">{t("compare.left")}</span>
						<select
							value={model.compareA ?? ""}
							onChange={event => model.setCompare("a", event.target.value || null)}
							className="w-full rounded border border-line bg-surface px-2 py-1 text-[11.5px] text-text outline-none focus:border-line-strong"
						>
							<option value="">{t("compare.placeholder")}</option>
							{available.map(entry => (
								<option key={entry.id} value={entry.id}>
									{entry.name}
								</option>
							))}
						</select>
					</label>
					<label className="block min-w-0">
						<span className="mb-1 block text-[10.5px] text-text-4">{t("compare.right")}</span>
						<select
							value={model.compareB ?? ""}
							onChange={event => model.setCompare("b", event.target.value || null)}
							className="w-full rounded border border-line bg-surface px-2 py-1 text-[11.5px] text-text outline-none focus:border-line-strong"
						>
							<option value="">{t("compare.placeholder")}</option>
							{available.map(entry => (
								<option key={entry.id} value={entry.id}>
									{entry.name}
								</option>
							))}
						</select>
					</label>
				</Card>

				{diff && left && right ? (
					<>
						<div className="grid grid-cols-2 gap-2 @min-[720px]:grid-cols-4">
							<StatTile
								label={t("compare.score")}
								value={`${diff.score.left} → ${diff.score.right}`}
								tone={diff.score.delta > 0 ? "high" : diff.score.delta < 0 ? "low" : "default"}
								hint={t("compare.delta", { delta: diff.score.delta > 0 ? `+${diff.score.delta}` : String(diff.score.delta) })}
							/>
							<StatTile label={t("compare.size")} value={`${formatBytes(diff.size.left)} → ${formatBytes(diff.size.right)}`} />
							<StatTile label={t("compare.permissionsAdded")} value={diff.permissions.added.length} tone={diff.permissions.added.length > 0 ? "medium" : "low"} hint={t("compare.kept", { count: diff.permissions.kept })} />
							<StatTile label={t("compare.findingsAdded")} value={diff.findings.added.length} tone={diff.findings.added.length > 0 ? "high" : "low"} hint={t("compare.resolved", { count: diff.findings.resolved.length })} />
						</div>

						<Card title={t("compare.permissions")} bodyClassName="px-3.5 py-2.5">
							<DiffLines added={diff.permissions.added} removed={diff.permissions.removed} empty={t("compare.noChange")} addedLabel={t("compare.added")} removedLabel={t("compare.removed")} />
						</Card>

						<Card title={t("compare.components")} bodyClassName="px-3.5 py-2.5">
							<DiffLines added={diff.components.added} removed={diff.components.removed} empty={t("compare.noChange")} addedLabel={t("compare.added")} removedLabel={t("compare.removed")} />
						</Card>

						<Card title={t("compare.findings")} bodyClassName="divide-y divide-line-subtle">
							{diff.findings.added.length === 0 && diff.findings.resolved.length === 0 ? (
								<p className="px-3.5 py-2.5 text-[11px] text-text-4">{t("compare.sameFindings", { count: diff.findings.kept })}</p>
							) : (
								<>
									{diff.findings.added.map(finding => (
										<div key={`add-${finding.ruleId}`} className="flex items-center gap-2 px-3.5 py-1.5">
											<span className="font-mono text-[10px] text-risk-high">+</span>
											<span className={`font-mono text-[10px] ${SEVERITY_TEXT[finding.severity]}`}>{finding.severity}</span>
											<span className="min-w-0 flex-1 truncate text-[11.5px] text-text">{finding.title}</span>
										</div>
									))}
									{diff.findings.resolved.map(finding => (
										<div key={`res-${finding.ruleId}`} className="flex items-center gap-2 px-3.5 py-1.5">
											<span className="font-mono text-[10px] text-risk-low">−</span>
											<span className={`font-mono text-[10px] ${SEVERITY_TEXT[finding.severity]}`}>{finding.severity}</span>
											<span className="min-w-0 flex-1 truncate text-[11.5px] text-text-3 line-through">{finding.title}</span>
										</div>
									))}
								</>
							)}
						</Card>

						<Card title={t("compare.facts")} bodyClassName="px-1 py-1">
							<DataTable
								columns={[t("compare.col.field"), left.target.name, right.target.name]}
								rows={factRows}
								mono={[false, true, true]}
								empty={t("compare.sameFacts")}
							/>
						</Card>
					</>
				) : (
					<EmptyState icon="compare" title={t("compare.pickTwo.title")} body={t("compare.pickTwo.body")} />
				)}
			</div>
		</>
	);
}

interface DiffLinesProps {
	added: readonly string[];
	removed: readonly string[];
	empty: string;
	addedLabel: string;
	removedLabel: string;
}

function DiffLines({ added, removed, empty, addedLabel, removedLabel }: DiffLinesProps) {
	if (added.length === 0 && removed.length === 0) {
		return <p className="text-[11px] text-text-4">{empty}</p>;
	}
	return (
		<div className="space-y-1">
			{added.map(item => (
				<div key={`a-${item}`} className="flex min-w-0 items-baseline gap-1.5">
					<span className="shrink-0 font-mono text-[10px] text-risk-medium">+</span>
					<span className="sr-only shrink-0 text-[9.5px] text-text-4">{addedLabel}</span>
					<span className="min-w-0 truncate font-mono text-[10.5px] text-text-2">{item}</span>
				</div>
			))}
			{removed.map(item => (
				<div key={`r-${item}`} className="flex min-w-0 items-baseline gap-1.5">
					<span className="shrink-0 font-mono text-[10px] text-text-4">−</span>
					<span className="sr-only shrink-0 text-[9.5px] text-text-4">{removedLabel}</span>
					<span className="min-w-0 truncate font-mono text-[10.5px] text-text-4 line-through">{item}</span>
				</div>
			))}
		</div>
	);
}

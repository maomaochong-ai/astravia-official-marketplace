import { useTranslation } from "@astravia-org/plugin-sdk";
import type { Finding } from "../../../domain/audit/findings";
import { SeverityChip } from "../../../shared/components/severity-chip";

export function FindingCard({ finding }: { finding: Finding }) {
	const { t } = useTranslation();
	const titleKey = `rule.${finding.ruleId}.title`;
	const title = t(titleKey);
	return (
		<li className="rounded-md border border-black/[0.07] bg-background p-2.5 dark:border-white/10">
			<div className="flex items-start gap-2">
				<SeverityChip severity={finding.severity} />
				<div className="min-w-0 flex-1">
					<p className="text-[12.5px] font-medium leading-snug text-foreground">{title === titleKey ? finding.title : title}</p>
					<p className="mt-1 text-[11.5px] leading-relaxed text-foreground/60">{finding.detail}</p>
					{finding.evidence.length > 0 ? (
						<ul className="mt-1.5 space-y-0.5">
							{finding.evidence.map(item => (
								<li key={item} className="truncate font-mono text-[10.5px] text-foreground/45" title={item}>
									{item}
								</li>
							))}
						</ul>
					) : null}
				</div>
			</div>
		</li>
	);
}

export function FindingList({ findings }: { findings: readonly Finding[] }) {
	const { t } = useTranslation();
	if (findings.length === 0) {
		return <p className="rounded-md border border-dashed border-black/10 p-3 text-center text-[11.5px] text-foreground/45 dark:border-white/10">{t("panel.findings.empty")}</p>;
	}
	return (
		<ul className="space-y-1.5">
			{findings.map(finding => (
				<FindingCard key={finding.ruleId} finding={finding} />
			))}
		</ul>
	);
}

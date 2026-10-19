import { useTranslation } from "@astravia-org/plugin-sdk";
import type { ReportRow } from "../../../domain/report/report";

export function ReportFacts({ facts }: { facts: readonly ReportRow[] }) {
	const { t } = useTranslation();
	if (facts.length === 0) return null;
	return (
		<section className="space-y-1.5">
			<h3 className="text-[11px] font-semibold uppercase tracking-wide text-foreground/50">{t("panel.facts.title")}</h3>
			<dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-md border border-black/[0.07] p-2.5 dark:border-white/10">
				{facts.map(row => (
					<div key={`${row.label}:${row.value}`} className="min-w-0">
						<dt className="truncate text-[10.5px] uppercase tracking-wide text-foreground/40">{row.label}</dt>
						<dd className="break-words text-[11.5px] text-foreground/80" title={row.value}>
							{row.value}
						</dd>
					</div>
				))}
			</dl>
		</section>
	);
}

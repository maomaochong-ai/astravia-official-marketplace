import { useTranslation } from "@astravia-org/plugin-sdk";
import type { ReportSection } from "../../../domain/report/report";

export function ReportSections({ sections }: { sections: readonly ReportSection[] }) {
	const { t } = useTranslation();
	if (sections.length === 0) return null;
	return (
		<section className="space-y-1.5">
			<h3 className="text-[11px] font-semibold uppercase tracking-wide text-foreground/50">{t("panel.sections.title")}</h3>
			<div className="space-y-1">
				{sections.map(section => (
					<details key={section.id} className="group rounded-md border border-black/[0.07] dark:border-white/10" open={section.rows.length <= 6}>
						<summary className="cursor-pointer list-none px-2.5 py-1.5 text-[11.5px] font-medium text-foreground/75 hover:text-foreground">
							{section.title}
							<span className="ml-1.5 text-foreground/35">({section.rows.length})</span>
						</summary>
						<table className="w-full table-fixed border-collapse text-[11px]">
							<thead>
								<tr className="border-y border-black/[0.07] bg-foreground/[0.02] text-foreground/45 dark:border-white/10">
									<th className="w-2/5 px-2.5 py-1 text-left font-medium">{section.columns[0]}</th>
									<th className="px-2.5 py-1 text-left font-medium">{section.columns[1]}</th>
								</tr>
							</thead>
							<tbody>
								{section.rows.map((row, index) => (
									<tr key={`${section.id}:${index}:${row.label}`} className="border-b border-black/[0.04] last:border-0 dark:border-white/[0.06]">
										<td className="truncate px-2.5 py-1 align-top font-mono text-[10.5px] text-foreground/60" title={row.label}>
											{row.label}
										</td>
										<td className="break-words px-2.5 py-1 align-top text-foreground/80">{row.value}</td>
									</tr>
								))}
							</tbody>
						</table>
					</details>
				))}
			</div>
		</section>
	);
}

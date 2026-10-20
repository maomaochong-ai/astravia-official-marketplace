import { useTranslation } from "@astravia-org/plugin-sdk";
import { formatBytes, type TriageReport } from "../../../../domain/report/report";

export interface SampleMetaProps {
	report: TriageReport;
}

/** 面板能确定的事实行；取不到的字段直接不显示，不用「未知」占位。 */
const FACT_LABELS: Record<string, string> = {
	"Package name": "meta.package",
	"Version name": "meta.version",
	"Version code": "meta.versionCode",
	"Minimum SDK": "meta.minSdk",
	"Target SDK": "meta.targetSdk",
	Architecture: "meta.arch",
	"Main binary architecture": "meta.arch",
	"File size": "meta.size",
	Format: "meta.format",
	"Entry point": "meta.entry",
	"Launchable activity": "meta.entry",
	Frameworks: "meta.frameworks",
	Compiler: "meta.compiler",
};

export function SampleMeta({ report }: SampleMetaProps) {
	const { t } = useTranslation();
	const rows = report.facts.filter(fact => fact.value.length > 0);

	return (
		<dl className="divide-y divide-line-subtle">
			{rows.map(fact => {
				const key = FACT_LABELS[fact.label];
				const label = key ? t(key) : fact.label;
				const value = fact.label === "File size" ? formatBytes(report.target.size) : fact.value;
				return (
					<div key={fact.label} className="flex gap-3 px-3.5 py-1.5">
						<dt className="w-[38%] shrink-0 truncate text-[11px] text-text-4">{label}</dt>
						<dd className="min-w-0 flex-1 break-words font-mono text-[11.5px] text-text-2">{value}</dd>
					</div>
				);
			})}
			<div className="flex gap-3 px-3.5 py-1.5">
				<dt className="w-[38%] shrink-0 truncate text-[11px] text-text-4">{t("meta.sha256")}</dt>
				<dd className="min-w-0 flex-1 break-all font-mono text-[11.5px] text-text-2">{report.target.sha256}</dd>
			</div>
		</dl>
	);
}

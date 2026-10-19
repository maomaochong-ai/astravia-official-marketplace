import { useTranslation } from "@astravia-org/plugin-sdk";
import type { Severity } from "../../../domain/audit/rules";
import type { RiskSummary } from "../../../domain/report/report";

const GRADE_TONE: Record<string, string> = {
	A: "text-emerald-600 dark:text-emerald-400",
	B: "text-emerald-600 dark:text-emerald-400",
	C: "text-amber-600 dark:text-amber-400",
	D: "text-orange-600 dark:text-orange-400",
	E: "text-red-600 dark:text-red-400",
};
const DOT_TONE: Record<Severity, string> = {
	critical: "bg-red-500",
	high: "bg-orange-500",
	medium: "bg-amber-500",
	low: "bg-sky-500",
	info: "bg-foreground/40",
};

const GRADE_FILL: Record<string, string> = {
	A: "bg-emerald-500",
	B: "bg-emerald-500",
	C: "bg-amber-500",
	D: "bg-orange-500",
	E: "bg-red-500",
};

export interface RiskMeterProps {
	risk: RiskSummary;
	findingCount: number;
}

export function RiskMeter({ risk, findingCount }: RiskMeterProps) {
	const { t } = useTranslation();
	const percent = Math.max(0, Math.min(100, risk.score));
	return (
		<section className="rounded-lg border border-black/10 bg-foreground/[0.02] p-3 dark:border-white/10">
			<div className="flex items-start gap-3">
				<div className="min-w-0">
					<p className="text-[11px] font-medium uppercase tracking-wide text-foreground/50">{t("panel.risk.title")}</p>
					<div className="mt-1 flex items-baseline gap-1.5">
						<span className={`text-3xl font-semibold leading-none ${GRADE_TONE[risk.grade] ?? ""}`}>{risk.score}</span>
						<span className="text-[11px] text-foreground/45">/ 100</span>
						<span className={`ml-1 rounded border border-current px-1.5 py-0.5 text-[11px] font-semibold ${GRADE_TONE[risk.grade] ?? ""}`}>
							{t("panel.risk.grade", { grade: risk.grade })}
						</span>
					</div>
					<p className="mt-1 text-[11px] text-foreground/50">{t("panel.risk.findings", { count: findingCount })}</p>
				</div>
				<div className="ml-auto flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-black/10 dark:border-white/10">
					<span className={`text-xl font-semibold ${GRADE_TONE[risk.grade] ?? ""}`}>{risk.grade}</span>
				</div>
			</div>
			<div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
				<div className={`h-full rounded-full ${GRADE_FILL[risk.grade] ?? "bg-foreground/40"}`} style={{ width: `${percent}%` }} />
			</div>
			{risk.drivers.length > 0 ? (
				<ul className="mt-2.5 space-y-1">
					{risk.drivers.map(driver => {
						const key = `rule.${driver.ruleId}.title`;
						const label = t(key);
						return (
							<li key={driver.ruleId} className="flex items-start gap-1.5 text-[11px] leading-relaxed text-foreground/70">
								<span className={`mt-1.5 h-1 w-1 shrink-0 rounded-full ${DOT_TONE[driver.severity]}`} />
								<span className="min-w-0">{label === key ? driver.title : label}</span>
							</li>
						);
					})}
				</ul>
			) : (
				<p className="mt-2 text-[11px] text-foreground/45">{t("panel.risk.noDrivers")}</p>
			)}
		</section>
	);
}

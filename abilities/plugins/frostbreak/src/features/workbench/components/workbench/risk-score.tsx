import { useTranslation } from "@astravia-org/plugin-sdk";
import type { Severity } from "../../../../domain/audit/rules";
import type { TriageReport } from "../../../../domain/report/report";
import { SEVERITY_TEXT } from "../../severity";
import { AiButton } from "../shell/ai-button";
import { Tag } from "../shell/tag";

export interface RiskScoreProps {
	report: TriageReport;
	busy: boolean;
	onAsk(): void;
}

const ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];

const GRADE_TONE = {
	A: "low",
	B: "low",
	C: "medium",
	D: "high",
	E: "high",
} as const;

const GRADE_COLOR: Record<TriageReport["risk"]["grade"], string> = {
	A: "text-risk-low",
	B: "text-risk-low",
	C: "text-risk-medium",
	D: "text-risk-high",
	E: "text-risk-high",
};

const GRADE_STROKE: Record<TriageReport["risk"]["grade"], string> = {
	A: "stroke-risk-low",
	B: "stroke-risk-low",
	C: "stroke-risk-medium",
	D: "stroke-risk-high",
	E: "stroke-risk-high",
};

const BAR: Record<Severity, string> = {
	critical: "bg-risk-high",
	high: "bg-risk-high/70",
	medium: "bg-risk-medium",
	low: "bg-risk-low",
	info: "bg-surface-4",
};

/**
 * 风险环 + 等级 + 严重度分布 + 处置建议。
 *
 * 环上的数字是规则加权分，不是「置信度」——页脚写明这一点，
 * 免得用户把它当成模型判断的概率。
 */
export function RiskScore({ report, busy, onAsk }: RiskScoreProps) {
	const { t } = useTranslation();
	const counts = ORDER.map(severity => ({ severity, count: report.findings.filter(finding => finding.severity === severity).length })).filter(item => item.count > 0);
	const total = counts.reduce((sum, item) => sum + item.count, 0);
	const pct = Math.max(0, Math.min(100, report.risk.score));

	return (
		<div className="px-3.5 py-3">
			<div className="flex items-center gap-4">
				<div className="relative size-[76px] shrink-0">
					<svg viewBox="0 0 60 60" className="size-full -rotate-90">
						<circle cx="30" cy="30" r="25" fill="none" strokeWidth="4" className="stroke-surface-4" />
						<circle
							cx="30"
							cy="30"
							r="25"
							fill="none"
							strokeWidth="4"
							strokeLinecap="round"
							strokeDasharray={`${(pct / 100) * 157} 157`}
							className={GRADE_STROKE[report.risk.grade]}
						/>
					</svg>
					<div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
						<span className={`font-mono text-[19px] font-semibold ${GRADE_COLOR[report.risk.grade]}`}>{report.risk.score}</span>
						<span className="mt-0.5 text-[9.5px] text-text-4">{t("risk.score")}</span>
					</div>
				</div>

				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<span className={`text-[15px] font-semibold ${GRADE_COLOR[report.risk.grade]}`}>{t(`risk.grade.${report.risk.grade}`)}</span>
						<Tag tone={GRADE_TONE[report.risk.grade]}>{t("risk.level")}</Tag>
						<span className="ml-auto font-mono text-[10.5px] text-text-4">
							{t("risk.findings", { count: report.findings.length })}
						</span>
					</div>
					<div className="mt-2 flex h-1.5 gap-px overflow-hidden rounded-full bg-surface-4">
						{counts.map(item => (
							<div key={item.severity} className={BAR[item.severity]} style={{ width: `${(item.count / total) * 100}%` }} title={`${item.severity}: ${item.count}`} />
						))}
					</div>
					<div className="mt-1.5 flex flex-wrap gap-x-2.5 gap-y-0.5">
						{counts.map(item => (
							<span key={item.severity} className={`text-[10px] ${SEVERITY_TEXT[item.severity]}`}>
								{t(`severity.${item.severity}`)} {item.count}
							</span>
						))}
					</div>
				</div>
			</div>

			<p className="mt-3 text-[11px] leading-relaxed text-text-2">{t(`risk.advice.${report.risk.grade}`)}</p>

			{report.risk.drivers.length > 0 ? (
				<div className="mt-2 space-y-1">
					{report.risk.drivers.slice(0, 3).map(driver => (
						<div key={driver.ruleId} className="truncate text-[10.5px] text-text-4">
							<span className={`mr-1.5 font-mono ${SEVERITY_TEXT[driver.severity]}`}>{driver.severity}</span>
							{driver.title}
						</div>
					))}
				</div>
			) : null}

			<div className="mt-2.5 flex items-center justify-between gap-2 border-t border-line-subtle pt-2.5">
				<span className="text-[10px] leading-tight text-text-4">{t("risk.note")}</span>
				<AiButton label={t("risk.askAi")} onClick={onAsk} busy={busy} />
			</div>
		</div>
	);
}

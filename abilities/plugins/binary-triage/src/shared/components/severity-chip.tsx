import { useTranslation } from "@astravia-org/plugin-sdk";
import type { Severity } from "../../domain/audit/rules";

const SEVERITY_STYLES: Record<Severity, string> = {
	critical: "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400",
	high: "border-orange-500/40 bg-orange-500/10 text-orange-600 dark:text-orange-400",
	medium: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
	low: "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400",
	info: "border-foreground/15 bg-foreground/5 text-foreground/60",
};

export function SeverityChip({ severity }: { severity: Severity }) {
	const { t } = useTranslation();
	return (
		<span
			className={`inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${SEVERITY_STYLES[severity]}`}
		>
			{t(`severity.${severity}`)}
		</span>
	);
}

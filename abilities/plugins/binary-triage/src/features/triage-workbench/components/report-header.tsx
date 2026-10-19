import { useTranslation } from "@astravia-org/plugin-sdk";
import type { ReportMode, TriageReport } from "../../../domain/report/report";
import { formatBytes } from "../../../domain/report/report";

const ACTION_BUTTON =
	"rounded-md border border-black/10 px-2 py-1 text-[11px] font-medium text-foreground/70 transition-colors hover:bg-foreground/[0.06] hover:text-foreground dark:border-white/10";

const MODE_BUTTON = "rounded px-2 py-0.5 text-[11px] font-medium transition-colors";

export interface ReportHeaderProps {
	report: TriageReport;
	mode: ReportMode;
	onModeChange: (mode: ReportMode) => void;
	onCopy: () => void;
	onExport: (format: "markdown" | "json") => void;
	onReset: () => void;
}

export function ReportHeader({ report, mode, onModeChange, onCopy, onExport, onReset }: ReportHeaderProps) {
	const { t } = useTranslation();
	const { target } = report;
	return (
		<header className="space-y-2 border-b border-black/[0.07] pb-2.5 dark:border-white/10">
			<div className="flex items-start gap-2">
				<div className="min-w-0 flex-1">
					<h2 className="truncate text-[13px] font-semibold text-foreground" title={target.path}>
						{target.name}
					</h2>
					<p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10.5px] text-foreground/45">
						<span className="rounded border border-black/10 px-1 py-px font-medium text-foreground/70 dark:border-white/15">
							{target.formatLabel}
						</span>
						<span>{formatBytes(target.size)}</span>
						<code className="truncate font-mono" title={target.sha256}>
							sha256 {target.sha256.slice(0, 16)}…
						</code>
					</p>
				</div>
				<div className="flex shrink-0 items-center rounded-md border border-black/10 p-0.5 dark:border-white/10">
					{(["summary", "full"] as const).map(value => (
						<button
							key={value}
							type="button"
							onClick={() => onModeChange(value)}
							className={`${MODE_BUTTON} ${mode === value ? "bg-foreground/10 text-foreground" : "text-foreground/50 hover:text-foreground"}`}
						>
							{t(`panel.mode.${value}`)}
						</button>
					))}
				</div>
			</div>
			<div className="flex flex-wrap items-center gap-1.5">
				<button type="button" onClick={onCopy} className={ACTION_BUTTON}>
					{t("panel.action.copy")}
				</button>
				<button type="button" onClick={() => onExport("markdown")} className={ACTION_BUTTON}>
					{t("panel.action.exportMarkdown")}
				</button>
				<button type="button" onClick={() => onExport("json")} className={ACTION_BUTTON}>
					{t("panel.action.exportJson")}
				</button>
				<button type="button" onClick={onReset} className={`${ACTION_BUTTON} ml-auto`}>
					{t("panel.action.reset")}
				</button>
			</div>
		</header>
	);
}

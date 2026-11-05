import type { AutomationRun, AutomationStep, StepStatus } from "../../../domain/boardmix-run";

export interface AutomationTimelineProps {
	run: AutomationRun;
	translate(key: string): string;
	className?: string;
}

const MARK: Record<StepStatus, string> = {
	pending: "·",
	running: "▸",
	done: "✓",
	failed: "✕",
	skipped: "–",
};

const TONE: Record<StepStatus, string> = {
	pending: "text-muted-foreground/60",
	running: "text-sky-500",
	done: "text-emerald-500",
	failed: "text-rose-500",
	skipped: "text-muted-foreground/60",
};

/** 落点那一行的 detail 是完整地址，行内只展示路径，免得把卡片撑开。 */
function detailLabel(step: AutomationStep): string {
	const detail = step.detail;
	if (!detail) return "";
	if (/^https?:\/\//i.test(detail)) {
		try {
			return new URL(detail).pathname;
		} catch {
			return detail;
		}
	}
	return detail;
}

export function AutomationTimeline(props: AutomationTimelineProps) {
	const { run, translate } = props;
	const title = translate(`run.recipe.${run.recipe}`);
	const statusLabel = translate(`run.status.${run.status}`);

	return (
		<div className={`flex flex-col gap-1.5 ${props.className ?? ""}`}>
			<div className="flex items-center justify-between gap-2">
				<p className="truncate text-xs font-medium text-foreground">
					{translate("run.title")}
					{title === `run.recipe.${run.recipe}` ? "" : ` · ${title}`}
				</p>
				<span
					className={`shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] ${
						run.status === "failed" ? "text-rose-500" : "text-muted-foreground"
					}`}
				>
					{statusLabel}
				</span>
			</div>
			<ol className="flex flex-col gap-0.5">
				{run.steps.map(step => {
					const detail = detailLabel(step);
					return (
						<li key={step.key} className="flex items-baseline gap-2 text-[11px] leading-4">
							<span className={`w-3 shrink-0 ${TONE[step.status]}`}>{MARK[step.status]}</span>
							<span className={step.status === "pending" ? "text-muted-foreground/60" : "text-foreground"}>
								{translate(`run.step.${step.key}`)}
							</span>
							{detail ? <span className="truncate font-mono text-[10px] text-muted-foreground">{detail}</span> : null}
						</li>
					);
				})}
			</ol>
			{run.landing ? (
				<p className="truncate font-mono text-[10px] text-muted-foreground">
					{run.landing.url} · {run.landing.phase}
				</p>
			) : null}
		</div>
	);
}

/**
 * 窄面板用的横向阶段条：六个编号 + 一条分段进度轨。
 *
 * 宽面板会在左栏用竖向编号轨道（ReaStageRail）表达同一件事，
 * 这个条只在 <880px 出现，避免窄面板里同时看到两套导航。
 *
 * 进度轨是一条整体：六段首尾相接、内部不留缝（留缝时相邻两段颜色不同，
 * 交界会显出一道豁口），圆角只给外层容器。
 *
 * 段色全部来自语义 token：active→primary、done→sage-dark、
 * bypassed→honey（越过，不是完成）、todo→mist。
 */

import type { JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { STAGES } from "../data/stages";

interface StripProps {
	readonly currentStage: number;
	readonly onSelect: (stage: number) => void;
	/** 会话里实际跑过的阶段（1-based）；有真实活动时比“已翻到第几页”更可信。 */
	readonly completedStages?: readonly number[];
	/** 会话当前正在做那个阶段（1-based）；与手动翻页分开，避免互相覆盖。 */
	readonly liveStage?: number | null;
	/** 被流程越过、本次没有独立调用的阶段（1-based）。 */
	readonly bypassedStages?: readonly number[];
}

type StripStatus = "done" | "active" | "bypassed" | "todo";

const SEGMENT_CLASS: Record<StripStatus, string> = {
	active: "bg-primary",
	done: "bg-sage-dark",
	bypassed: "bg-honey/60",
	todo: "bg-mist",
};

export function ReaWorkflowStageStrip({ currentStage, onSelect, completedStages, liveStage, bypassedStages }: StripProps): JSX.Element {
	const { t } = useTranslation();

	const statuses = STAGES.map((stage): StripStatus => {
		const visited = completedStages?.includes(stage.index) ?? false;
		const passed = bypassedStages?.includes(stage.index) ?? false;
		if (currentStage === stage.index) return "active";
		if (visited) return "done";
		if (passed) return "bypassed";
		return "todo";
	});

	return (
		<div className="shrink-0 border-b border-border px-4 py-2.5">
			<ol className="flex items-stretch gap-1" aria-label={t("tab.strip.aria")}>
				{STAGES.map((stage, idx) => {
					const status = statuses[idx];
					const live = liveStage === stage.index;
					const bypassedHint = status === "bypassed" ? t("tab.strip.bypassedHint") : undefined;
					const label = t(stage.labelKey);
					return (
						<li key={stage.index} className="flex min-w-0 flex-1 flex-col gap-1.5">
							<button
								type="button"
								className="group flex min-w-0 flex-col gap-1 rounded-control px-0.5 pb-0.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
								aria-current={status === "active" ? "step" : undefined}
								aria-label={bypassedHint ? `${label} — ${bypassedHint}` : label}
								title={bypassedHint ?? label}
								onClick={() => onSelect(stage.index)}
							>
								<span className="flex min-w-0 items-center gap-1">
									{live ? <span aria-hidden className="size-1.5 shrink-0 rounded-pill bg-agent motion-safe:animate-pulse" /> : null}
									<span
										className={`font-mono text-micro-up tabular-nums ${
											status === "active" ? "text-primary" : status === "todo" ? "text-faint" : "text-foreground/60"
										}`}
									>
										{String(stage.index).padStart(2, "0")}
									</span>
									<span
										className={`truncate text-micro-up ${
											status === "active"
												? "font-semibold text-foreground"
												: status === "todo"
													? "text-faint"
													: "font-medium text-foreground/75"
										}`}
									>
										{label}
									</span>
								</span>
							</button>
						</li>
					);
				})}
			</ol>
			<div aria-hidden className="mt-1.5 flex h-1 overflow-hidden rounded-pill">
				{statuses.map((status, idx) => (
					<span key={STAGES[idx].index} className={`h-full flex-1 ${SEGMENT_CLASS[status]}`} />
				))}
			</div>
		</div>
	);
}

/**
 * 六阶段横向进度条：紫色实心 = 已走过，紫色描边 = 当前，灰描边 = 未开始。
 *
 * 与旧版阶段条的区别：不再渲染「跳过」与「计数」两套标注，因为同一份事实
 * 已经在「实时调用」和阶段详情里各说了一遍；这里只回答一个问题 —— 走到第几阶段。
 * 被越过的阶段仍然用虚线描边保留痕迹（真实信息，不能因为简化而丢）。
 *
 * 窄面板下隐藏文字只留圆点与连线，并用横向滚动兜底 320px 宽度。
 */

import type { JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { STAGES } from "../data/stages";

interface ReaStageTrackProps {
	readonly currentStage: number;
	readonly onSelect: (stage: number) => void;
	readonly completedStages: readonly number[];
	readonly liveStage: number | null;
	readonly bypassedStages: readonly number[];
}

export function ReaStageTrack({
	currentStage,
	onSelect,
	completedStages,
	liveStage,
	bypassedStages,
}: ReaStageTrackProps): JSX.Element {
	const { t } = useTranslation();
	const done = new Set(completedStages);
	const bypassed = new Set(bypassedStages);

	return (
		<div
			role="group"
			aria-label={t("tab.strip.aria")}
			className="flex items-center gap-1 overflow-x-auto rounded-lg border border-border bg-surface-2 px-4 py-2.5"
		>
			{STAGES.map((stage, index) => {
				const isCurrent = stage.index === currentStage;
				const isDone = done.has(stage.index) && !isCurrent;
				const isBypassed = bypassed.has(stage.index) && !isDone && !isCurrent;
				const isLive = liveStage === stage.index;

				const dot = isDone
					? "border border-purple bg-purple text-accent-foreground"
					: isCurrent
						? "border border-purple bg-purple/10 text-purple-ink"
						: isBypassed
							? "border border-dashed border-border text-text-4"
							: "border border-border-subtle text-text-4";

				return (
					<div key={stage.index} className="flex min-w-0 shrink-0 items-center gap-1">
						{index === 0 ? null : (
							<span
								aria-hidden
								className={`h-px w-4 shrink-0 @min-[720px]:w-6 ${isDone || isCurrent ? "bg-purple/60" : "bg-border-subtle"}`}
							/>
						)}
						<button
							type="button"
							onClick={() => onSelect(stage.index)}
							aria-current={isCurrent ? "step" : undefined}
							title={`${stage.index}. ${t(stage.labelKey)}`}
							className="flex min-w-0 items-center gap-2 rounded-md px-1 py-0.5 transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
						>
							<span
								aria-hidden
								className={`flex size-4 shrink-0 items-center justify-center rounded-full text-micro-up font-medium ${dot} ${
									isLive ? "motion-safe:animate-pulse" : ""
								}`}
							>
								{isDone ? "✓" : stage.index}
							</span>
							<span
								className={`whitespace-nowrap text-caption @max-[720px]:hidden ${
									isCurrent ? "font-medium text-text" : isDone ? "text-text-2" : "text-text-3"
								}`}
							>
								{t(stage.labelKey)}
							</span>
						</button>
					</div>
				);
			})}
		</div>
	);
}

/**
 * 执行环面板：标题 + 覆盖度计量 + 环节轨道 + 当前步骤。
 *
 * 三条信息各回答一个问题：
 *   1. 走到哪了 —— 六个环节里哪些被真实调用观测到（覆盖度，不是耗时估算）；
 *   2. 现在在做什么 —— 正在跑或最后跑完的那次调用；
 *   3. 顺不顺 —— 环节计数与失败高亮。
 *
 * 未观测的环节保持压暗，不给它编造进度。整块是只读的。
 */

import type { JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import type { ReaLiveState } from "../live/session-store";
import { buildLoopLive, type LoopPhaseLive } from "../live/loop-phases";
import { ReaLoopRail } from "./rea-loop-rail";
import { ReaLoopStepLine } from "./rea-loop-step-line";
import { Eyebrow } from "../../../shared/components/eyebrow";

interface LoopConsoleProps {
	readonly snapshot: ReaLiveState;
}

function segmentClass(phase: LoopPhaseLive, active: boolean): string {
	if (active) return "bg-primary motion-safe:animate-pulse";
	if (phase.observed) return "bg-primary/60";
	return "bg-stone";
}

export function ReaLoopConsole({ snapshot }: LoopConsoleProps): JSX.Element {
	const { t } = useTranslation();
	const loop = buildLoopLive(snapshot.calls, snapshot.callCount);

	return (
		<div className="flex flex-col gap-1 rounded-tile border border-border bg-card/60 px-2.5 py-2">
			<div className="flex min-w-0 items-center gap-2">
				<Eyebrow tone="strong" className="min-w-0 truncate">
					{t("live.loop.title")}
				</Eyebrow>
				<span className="ml-auto flex shrink-0 items-center gap-1.5">
					<span className="flex items-center gap-[2px]" aria-hidden>
						{loop.progressPhases.map((phase) => (
							<span
								key={phase.id}
								className={`size-2 rounded-[2px] transition-colors duration-300 ${segmentClass(
									phase,
									phase.id === loop.activePhase,
								)}`}
							/>
						))}
					</span>
					<span
						className="font-mono text-micro tabular-nums text-foreground/80"
						title={t("live.loop.passHint", {
							observed: loop.observedPhases,
							total: loop.progressPhases.length,
						})}
					>
						{t("live.loop.pass", { percent: loop.passPercent })}
					</span>
				</span>
			</div>

			<ReaLoopRail phases={loop.phases} activePhase={loop.activePhase} />
			<ReaLoopStepLine step={loop.step} />
		</div>
	);
}

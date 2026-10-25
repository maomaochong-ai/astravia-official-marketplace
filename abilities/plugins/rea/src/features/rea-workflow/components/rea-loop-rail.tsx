/**
 * 执行环轨道：六个环节排成一行，当前环节高亮、已观测环节常规色、未观测环节压低。
 *
 * 轨道只读不点：每个环节没有独立详情页，做成按钮会给假的交互预期。
 * 环节计数在窄宽度隐藏（面板可拖到 280px），文字本身用 flex-wrap 兜底换行。
 */

import type { JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import type { LoopPhaseLive, ReaLoopPhaseId } from "../live/loop-phases";

interface LoopRailProps {
	readonly phases: readonly LoopPhaseLive[];
	readonly activePhase: ReaLoopPhaseId | null;
}

function tokenClass(phase: LoopPhaseLive, active: boolean): string {
	// retry 的红色优先于当前环节高亮：失败时不能只看成「正在跑」。
	const retryFailed = phase.id === "retry" && phase.errors > 0;
	if (active) {
		return retryFailed ? "border-primary text-danger" : "border-primary text-primary";
	}
	if (retryFailed) return "border-transparent text-danger";
	if (phase.observed) return "border-transparent text-foreground/75";
	return "border-transparent text-muted-foreground/45";
}

export function ReaLoopRail({ phases, activePhase }: LoopRailProps): JSX.Element {
	const { t } = useTranslation();
	return (
		<div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 font-mono text-[9.5px] uppercase leading-none tracking-[0.06em]">
			{phases.map((phase, index) => {
				const active = phase.id === activePhase;
				const title =
					phase.id === "retry"
						? t("live.loop.retryHint", { count: phase.errors })
						: phase.observed
							? t("live.loop.phaseHint", {
									count: phase.calls,
									tool: phase.lastTool ?? "—",
									args: phase.lastArgs,
								})
							: t("live.loop.phaseIdle");
				return (
					<span key={phase.id} className="inline-flex min-w-0 items-baseline gap-1">
						{index > 0 ? (
							<span aria-hidden className="text-muted-foreground/30 @max-[360px]:hidden">
								·
							</span>
						) : null}
						<span
							className={`border-b pb-0.5 transition-colors duration-300 ${tokenClass(phase, active)}`}
							title={title}
						>
							{t(`live.loop.phase.${phase.id}`)}
						</span>
						{phase.calls > 0 ? (
							<span
								className={`tabular-nums text-muted-foreground/70 ${active ? "inline" : "hidden @min-[420px]:inline"}`}
								title={t("live.loop.phaseCalls", { count: phase.calls })}
							>
								{phase.calls}
							</span>
						) : null}
						{active ? (
							<span aria-hidden className="text-primary motion-safe:animate-rea-blink">
								▌
							</span>
						) : null}
					</span>
				);
			})}
		</div>
	);
}

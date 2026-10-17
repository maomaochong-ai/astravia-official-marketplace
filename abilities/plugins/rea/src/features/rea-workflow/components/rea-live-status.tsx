/**
 * 实时总览条：引擎状态 + 已识别目标 + 计数 + 正在跑的工具。
 *
 * 目标类型不是用户选的，是从真实工具调用里推断出来的，所以这里显示"检测到"，
 * 点击可跳到对应阶段（route 阶段说明怎么改目标）。
 */

import type { JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { StatusChip, type StatusTone } from "../../../shared/components/status-chip";
import { TOTAL_STAGES } from "../data/stages";
import type { TargetKind } from "../data/targets";
import type { ReaLiveState } from "../live/session-store";
import { STAGE_INDEX, STAGE_ORDER, type ReaStageId } from "../live/tool-taxonomy";

interface LiveStatusProps {
	readonly snapshot: ReaLiveState;
	readonly onSelectStage: (stage: number) => void;
	/** 把会话里发现的路径直接填进工作台目标输入框。 */
	readonly onUseTarget: (path: string) => void;
}

function phaseTone(phase: ReaLiveState["providerPhase"]): StatusTone {
	switch (phase) {
		case "ready":
			return "success";
		case "failed":
			return "danger";
		case "disabled":
			return "neutral";
		case "checking":
		case "installing":
		case "verifying":
			return "progress";
		default:
			return "neutral";
	}
}

export function ReaLiveStatus({ snapshot, onSelectStage, onUseTarget }: LiveStatusProps): JSX.Element {
	const { t } = useTranslation();
	const phase = snapshot.providerPhase ?? "checking";
	const running = snapshot.runningToolNames;
	const lastCall = snapshot.calls.length > 0 ? snapshot.calls[snapshot.calls.length - 1] : null;

	return (
		<div className="flex flex-col gap-2 border-b border-border bg-card/20 px-3 py-2">
			<div className="flex flex-wrap items-center gap-1.5">
				<StatusChip tone={phaseTone(phase)} title={snapshot.providerMessage ?? undefined}>
					<span
						className={`size-1.5 rounded-full bg-current ${phase === "ready" ? "" : "motion-safe:animate-pulse"}`}
						aria-hidden
					/>
					{t(`live.engine.phase.${phase}`)}
				</StatusChip>
				{snapshot.detectedTarget ? (
					<button
						type="button"
						className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-full"
						onClick={() => onSelectStage(2)}
						title={t("live.target.detectedHint")}
					>
						<StatusChip tone="progress" className="cursor-pointer">
							{t("live.target.detected", {
								target: t(`tab.target.${snapshot.detectedTarget as TargetKind}.label`),
							})}
						</StatusChip>
					</button>
				) : (
					<StatusChip tone="neutral">{t("live.target.unknown")}</StatusChip>
				)}
				<StatusChip tone={snapshot.errorCount > 0 ? "warning" : "neutral"}>
					{t("live.counts.calls", { calls: snapshot.callCount, errors: snapshot.errorCount })}
				</StatusChip>
				<StatusChip tone="neutral">{t("live.counts.turns", { turns: snapshot.turns })}</StatusChip>
			</div>

			<div className="flex flex-wrap items-center gap-1">
				{STAGE_ORDER.map((stage: ReaStageId) => {
					const index = STAGE_INDEX[stage];
					const count = snapshot.stageCallCounts[stage] ?? 0;
					const active = snapshot.activeStage === stage;
					const visited = snapshot.visitedStages.includes(stage);
					return (
						<button
							key={stage}
							type="button"
							onClick={() => onSelectStage(index)}
							className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-md"
							aria-current={active ? "step" : undefined}
							title={t("live.stage.toolCount", { count })}
						>
							<StatusChip
								tone={active ? "progress" : visited ? "success" : "neutral"}
								className={active ? "motion-safe:animate-pulse" : undefined}
							>
								{t(`tab.stage.${stage}.label`)}
								<span className="tabular-nums opacity-70">{count}</span>
							</StatusChip>
						</button>
					);
				})}
				<span className="ml-auto text-[10px] text-muted-foreground">
					{t("live.stage.ofTotal", { total: TOTAL_STAGES })}
				</span>
			</div>

			{running.length > 0 ? (
				<div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
					<span className="size-1.5 rounded-full bg-primary motion-safe:animate-pulse" aria-hidden />
					{t("live.running", { tools: running.join(", ") })}
				</div>
			) : null}

			{snapshot.lastTargetPath ? (
				<div className="flex min-w-0 items-center gap-1.5 text-[10.5px]">
					<span className="shrink-0 text-muted-foreground">{t("live.target.last")}</span>
					<code
						className="min-w-0 flex-1 truncate font-mono text-foreground/85"
						title={snapshot.lastTargetPath}
					>
						{snapshot.lastTargetPath}
					</code>
					<button
						type="button"
						onClick={() => onUseTarget(snapshot.lastTargetPath ?? "")}
						className="inline-flex shrink-0 items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px] font-medium text-foreground/85 transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
					>
						<span aria-hidden className="icon-[lucide--corner-down-left] size-3" />
						{t("live.target.use")}
					</button>
				</div>
			) : null}

			{lastCall ? (
				<div className="flex min-w-0 items-center gap-1.5 text-[10.5px] text-muted-foreground">
					<span
						aria-hidden
						className={`size-1.5 shrink-0 rounded-full ${
							lastCall.isError
								? "bg-red-500"
								: lastCall.endedAt === null
									? "bg-primary motion-safe:animate-pulse"
									: "bg-emerald-500"
						}`}
					/>
					<span className="shrink-0">{t("live.last.tool", { tool: lastCall.toolName })}</span>
					{lastCall.argsPreview ? (
						<span className="min-w-0 flex-1 truncate font-mono opacity-80">{lastCall.argsPreview}</span>
					) : null}
				</div>
			) : null}
		</div>
	);
}

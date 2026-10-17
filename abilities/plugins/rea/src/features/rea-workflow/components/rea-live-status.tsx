/**
 * 实时总览条：引擎状态 + 目标 + 阶段计数 + 当前动作 + 最近目标。
 *
 * 布局必须稳定：内容随会话增长时不能把下面的工作台和阶段区顶来顶去。
 * 所以四块都是「固定行数 + 单行截断」，不再用「有数据才渲染」的条件行：
 *   - 阶段条用 grid，窄宽度换 3 列 × 2 行，行数恒定；
 *   - 当前动作与最近目标各占一行固定高度，没内容时渲染占位。
 *
 * 目标类型不是用户选的，是从真实工具调用里推断出来的，这里显示「识别到」并允许
 * 一键填进宿主对话（同时填进工作台），避免用户复制粘贴。
 */

import type { JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { StatusChip, type StatusTone } from "../../../shared/components/status-chip";
import type { TargetKind } from "../data/targets";
import type { ReaLiveState } from "../live/session-store";
import { ReaActivityMatrix } from "./rea-activity-matrix";
import { STAGE_INDEX, STAGE_ORDER, type ReaStageId } from "../live/tool-taxonomy";

interface LiveStatusProps {
	readonly snapshot: ReaLiveState;
	readonly onSelectStage: (stage: number) => void;
	/** 把会话里发现的路径填进宿主对话输入框（并同步到工作台）。 */
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

/** 阶段格子的配色。不用 StatusChip：它自带 whitespace-nowrap + px-2，在 6 列网格里会溢出。 */
function stageTone(active: boolean, visited: boolean): string {
	if (active) return "bg-primary/15 text-primary";
	if (visited) return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
	return "bg-muted text-muted-foreground";
}

export function ReaLiveStatus({ snapshot, onSelectStage, onUseTarget }: LiveStatusProps): JSX.Element {
	const { t } = useTranslation();
	const phase = snapshot.providerPhase ?? "checking";
	const running = snapshot.runningToolNames;
	const lastCall = snapshot.calls.length > 0 ? snapshot.calls[snapshot.calls.length - 1] : null;

	// 当前动作：优先「正在跑什么」，其次「最近跑完什么」，都没有就说明还没开始。
	const activity =
		running.length > 0
			? { tone: "progress" as const, text: t("live.running", { tools: running.join(", ") }), title: running.join(", ") }
			: lastCall
				? {
						tone: lastCall.isError ? ("danger" as const) : ("neutral" as const),
						text: t("live.last.tool", { tool: lastCall.toolName }),
						title: lastCall.argsPreview || lastCall.toolName,
					}
				: { tone: "neutral" as const, text: t("live.idle"), title: t("live.idle") };

	return (
		<div className="flex flex-col gap-1.5 border-b border-border bg-card/20 px-3 py-2">
			<div className="flex min-h-[20px] flex-wrap items-center gap-1.5">
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
						className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
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
				<StatusChip
					tone={snapshot.errorCount > 0 ? "warning" : "neutral"}
					title={t("live.counts.calls", { calls: snapshot.callCount, errors: snapshot.errorCount })}
				>
					{t("live.counts.calls", { calls: snapshot.callCount, errors: snapshot.errorCount })}
				</StatusChip>
				<StatusChip tone="neutral" title={t("live.counts.turns", { turns: snapshot.turns })}>
					{t("live.counts.turns", { turns: snapshot.turns })}
				</StatusChip>
			</div>

			<div className="grid grid-cols-6 gap-1 @max-[380px]:grid-cols-3">
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
							className="min-w-0 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
							aria-current={active ? "step" : undefined}
							title={t("live.stage.toolCount", { count })}
						>
							<span
								className={`flex min-w-0 items-center justify-center gap-0.5 overflow-hidden rounded-full px-1 py-0.5 text-[10.5px] font-medium leading-tight ${stageTone(active, visited)} ${active ? "motion-safe:animate-pulse" : ""}`}
							>
								<span className="min-w-0 truncate">{t(`tab.stage.${stage}.label`)}</span>
								{count > 0 ? <span className="shrink-0 tabular-nums opacity-70">{count}</span> : null}
							</span>
						</button>
					);
				})}
			</div>

			<ReaActivityMatrix calls={snapshot.calls} />

			<div className="flex h-4 min-w-0 items-center gap-1.5">
				<span
					aria-hidden
					className={`size-1.5 shrink-0 rounded-full ${
						activity.tone === "progress"
							? "bg-primary motion-safe:animate-pulse"
							: activity.tone === "danger"
								? "bg-red-500"
								: "bg-muted-foreground/50"
					}`}
				/>
				<span className="min-w-0 flex-1 truncate text-[10.5px] leading-none text-muted-foreground" title={activity.title}>
					{activity.text}
				</span>
			</div>

			<div className="flex h-5 min-w-0 items-center gap-1.5 text-[10.5px]">
				<span className="shrink-0 text-muted-foreground">{t("live.target.last")}</span>
				{snapshot.lastTargetPath ? (
					<>
						<code className="min-w-0 flex-1 truncate font-mono text-foreground/85" title={snapshot.lastTargetPath}>
							{snapshot.lastTargetPath}
						</code>
						<button
							type="button"
							onClick={() => onUseTarget(snapshot.lastTargetPath ?? "")}
							title={t("live.target.useHint")}
							className="inline-flex shrink-0 items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px] font-medium text-foreground/85 transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
						>
							<span aria-hidden className="icon-[lucide--corner-down-left] size-3" />
							{t("live.target.use")}
						</button>
					</>
				) : (
					<span className="min-w-0 flex-1 truncate text-muted-foreground/70">{t("live.target.none")}</span>
				)}
			</div>
		</div>
	);
}

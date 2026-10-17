/**
 * 实时总览条：引擎状态 + 目标 + 执行环（覆盖度 / 当前步骤）+ 最近目标。
 *
 * 布局必须稳定：内容随会话增长时不能把下面的工作台和阶段区顶来顶去，
 * 所以每块都是「固定行数 + 单行截断」：执行环的轨道与步骤行高度恒定，
 * 最近目标没内容时渲染占位而不是消失。
 *
 * 目标类型不是用户选的，是从真实工具调用里推断出来的，这里显示「识别到」并允许
 * 一键填进宿主对话（同时填进工作台），避免用户复制粘贴。
 */

import type { JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { StatusChip, type StatusTone } from "../../../shared/components/status-chip";
import type { TargetKind } from "../data/targets";
import type { ReaLiveState } from "../live/session-store";
import { ReaLoopConsole } from "./rea-loop-console";

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

export function ReaLiveStatus({ snapshot, onSelectStage, onUseTarget }: LiveStatusProps): JSX.Element {
	const { t } = useTranslation();
	const phase = snapshot.providerPhase ?? "checking";

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
			<ReaLoopConsole snapshot={snapshot} />

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

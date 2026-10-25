/**
 * 实时摘要条：这一轮跑成什么样。
 *
 * 只放四个「会变但很短」的事实：识别到的目标类型、调用/报错计数、对话轮次、
 * 最近一次的目标路径。高度固定（单行 + 省略），内容增长不会把下面的阶段区顶动。
 *
 * 目标类型不是用户选的，是从真实工具调用里推断出来的，所以显示「识别到」并且
 * 可以一键填进宿主对话输入框，省掉复制粘贴。
 *
 * 引擎 phase 与执行环不在这里：phase 归顶部 ReaProviderStatusBar，
 * 执行环归右栏 ReaLoopConsole，避免同一个事实在面板里出现两遍。
 */

import type { JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { StatusChip } from "../../../shared/components/status-chip";
import { Eyebrow } from "../../../shared/components/eyebrow";
import type { TargetKind } from "../data/targets";
import type { ReaLiveState } from "../live/session-store";

interface LiveStatusProps {
	readonly snapshot: ReaLiveState;
	readonly onSelectStage: (stage: number) => void;
	/** 把会话里发现的路径填进宿主对话输入框（并同步到工作台）。 */
	readonly onUseTarget: (path: string) => void;
}

export function ReaLiveStatus({ snapshot, onSelectStage, onUseTarget }: LiveStatusProps): JSX.Element {
	const { t } = useTranslation();

	return (
		<div className="flex shrink-0 flex-col gap-1 border-b border-border px-4 py-1.5">
			<div className="flex min-h-[20px] min-w-0 flex-wrap items-center gap-1.5">
				<Eyebrow className="shrink-0" title={t("live.console.labelHint")}>
					{t("live.console.label")}
				</Eyebrow>
				<span aria-hidden className="h-3 w-px shrink-0 bg-border" />
				{snapshot.detectedTarget ? (
					<button
						type="button"
						className="rounded-pill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
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

			<div className="flex h-5 min-w-0 items-center gap-1.5 text-micro">
				<span className="shrink-0 text-faint">{t("live.target.last")}</span>
				{snapshot.lastTargetPath ? (
					<>
						<code className="min-w-0 flex-1 truncate font-mono text-foreground/85" title={snapshot.lastTargetPath}>
							{snapshot.lastTargetPath}
						</code>
						<button
							type="button"
							onClick={() => onUseTarget(snapshot.lastTargetPath ?? "")}
							title={t("live.target.useHint")}
							className="inline-flex h-5 shrink-0 items-center gap-1 rounded-pill border border-border px-1.5 text-micro-up font-medium text-foreground/80 transition-colors hover:border-border-strong hover:bg-mist hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
						>
							<span aria-hidden className="icon-[lucide--corner-down-left] size-3" />
							{t("live.target.use")}
						</button>
					</>
				) : (
					<span className="min-w-0 flex-1 truncate text-faint">{t("live.target.none")}</span>
				)}
			</div>
		</div>
	);
}

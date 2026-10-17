/**
 * 调用日志：最近失败的调用置顶，然后是时间倒序的调用流水。
 *
 * 每条包含：阶段徽章（可点，跳到该阶段说明）+ 工具名 + 目标徽章 + 参数预览 + 耗时。
 * 数据来自宿主会话事件，只读。
 */

import type { JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { StatusChip } from "../../../shared/components/status-chip";
import type { TargetKind } from "../data/targets";
import type { ReaLiveCall, ReaLiveError } from "../live/session-store";
import { STAGE_INDEX } from "../live/tool-taxonomy";

interface LiveCallLogProps {
	readonly calls: readonly ReaLiveCall[];
	readonly errors: readonly ReaLiveError[];
	readonly onSelectStage: (stage: number) => void;
}

function durationLabel(call: ReaLiveCall): string {
	if (call.endedAt === null) return "…";
	const ms = Math.max(0, call.endedAt - call.startedAt);
	return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function timeLabel(at: number): string {
	const date = new Date(at);
	return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
}

export function ReaLiveCallLog({ calls, errors, onSelectStage }: LiveCallLogProps): JSX.Element {
	const { t } = useTranslation();
	const visible = calls.slice(-24).reverse();

	return (
		<div className="flex flex-col">
			{errors.length > 0 ? (
				<div className="flex flex-col gap-1 border-b border-border bg-red-500/5 px-3 py-2">
					<span className="text-[10px] font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">
						{t("live.errors.title")}
					</span>
					{errors.slice(0, 3).map((error) => (
						<div key={`${error.toolName}-${error.at}`} className="flex items-start gap-1.5 text-[11px]">
							<span className="tabular-nums text-muted-foreground">{timeLabel(error.at)}</span>
							<span className="font-medium text-red-600 dark:text-red-400">{error.toolName}</span>
							<span className="min-w-0 line-clamp-2 text-muted-foreground">{error.message}</span>
						</div>
					))}
				</div>
			) : null}

			{visible.length === 0 ? (
				<p className="px-3 py-4 text-[11px] text-muted-foreground">{t("live.calls.empty")}</p>
			) : (
				<ul className="divide-y divide-border/60">
					{visible.map((call) => {
						const stageIndex = call.stage ? STAGE_INDEX[call.stage] : null;
						return (
							<li key={call.id} className="flex items-start gap-2 px-3 py-1.5">
								{stageIndex !== null ? (
									<button
										type="button"
										className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-full"
										onClick={() => onSelectStage(stageIndex)}
									>
										<StatusChip tone={call.isError ? "danger" : "neutral"} className="cursor-pointer">
											{t(`tab.stage.${call.stage}.label`)}
										</StatusChip>
									</button>
								) : (
									<StatusChip tone="neutral">{t("live.calls.noStage")}</StatusChip>
								)}
								<div className="flex min-w-0 flex-1 flex-col">
									<div className="flex flex-wrap items-center gap-1.5">
										<span
											className={`truncate text-[11px] font-medium ${call.isError ? "text-red-600 dark:text-red-400" : "text-foreground"}`}
											title={call.rawToolName}
										>
											{call.toolName}
										</span>
										{call.targets.map((target: TargetKind) => (
											<StatusChip key={target} tone="progress">
												{t(`tab.target.${target}.label`)}
											</StatusChip>
										))}
										<span className="tabular-nums text-[10px] text-muted-foreground">{durationLabel(call)}</span>
									</div>
									{call.argsPreview ? (
										<span className="line-clamp-1 font-mono text-[10px] text-muted-foreground">
											{call.argsPreview}
										</span>
									) : null}
								</div>
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}

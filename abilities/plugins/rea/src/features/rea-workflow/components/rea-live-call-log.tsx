/**
 * 调用日志：最近失败的调用置顶，然后是时间倒序的调用流水。
 *
 * 每条折叠时只显示一行（阶段徽章 + 工具名 + 目标 + 耗时 + 参数首行）。点这一行展开，
 * 完整参数用 `break-all` 换行显示并可复制 —— 面板窄的时候，单行截断 + 原生 tooltip
 * 根本读不到关键参数，这是用户实际反馈过的问题。
 *
 * 数据来自宿主会话事件，只读。
 */

import { useState } from "react";
import type { JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { StatusChip } from "../../../shared/components/status-chip";
import { copyText } from "../../../shared/services/clipboard";
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
	const [expandedId, setExpandedId] = useState<string | null>(null);
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
							<span className="shrink-0 tabular-nums text-muted-foreground">{timeLabel(error.at)}</span>
							<span className="shrink-0 font-medium text-red-600 dark:text-red-400">{error.toolName}</span>
							<span className="min-w-0 line-clamp-2 break-all text-muted-foreground" title={error.message}>
								{error.message}
							</span>
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
						const expanded = expandedId === call.id;
						return (
							<li key={call.id} className="flex flex-col">
								<div className="flex items-start gap-2 px-3 py-1.5">
									{stageIndex !== null ? (
										<button
											type="button"
											className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
											onClick={() => onSelectStage(stageIndex)}
											title={t(`tab.stage.${call.stage}.label`)}
										>
											<StatusChip tone={call.isError ? "danger" : "neutral"} className="cursor-pointer">
												{t(`tab.stage.${call.stage}.label`)}
											</StatusChip>
										</button>
									) : (
										<StatusChip tone="neutral" title={call.rawToolName}>
											{t("live.calls.noStage")}
										</StatusChip>
									)}
									<button
										type="button"
										aria-expanded={expanded}
										onClick={() => setExpandedId(expanded ? null : call.id)}
										title={t(expanded ? "live.calls.collapse" : "live.calls.expand")}
										className="flex min-w-0 flex-1 flex-col rounded text-left transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
									>
										<div className="flex min-w-0 items-center gap-1.5">
											<span
												aria-hidden
												className={`shrink-0 text-muted-foreground ${expanded ? "icon-[lucide--chevron-down]" : "icon-[lucide--chevron-right]"} size-3`}
											/>
											<span
												className={`min-w-0 truncate text-[11px] font-medium ${call.isError ? "text-red-600 dark:text-red-400" : "text-foreground"}`}
												title={call.rawToolName}
											>
												{call.toolName}
											</span>
											{call.targets.map((target: TargetKind) => (
												<StatusChip key={target} tone="progress" title={t(`tab.target.${target}.hint`)}>
													{t(`tab.target.${target}.label`)}
												</StatusChip>
											))}
											<span className="ml-auto shrink-0 tabular-nums text-[10px] text-muted-foreground">
												{durationLabel(call)}
											</span>
										</div>
										{call.argsPreview && !expanded ? (
											<span className="mt-0.5 truncate pl-4 font-mono text-[10px] text-muted-foreground" title={call.argsPreview}>
												{call.argsPreview}
											</span>
										) : null}
									</button>
								</div>
								{expanded ? (
									<div className="flex flex-col gap-1 px-3 pb-2 pl-8">
										<dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[10px]">
											<dt className="text-muted-foreground">tool</dt>
											<dd className="min-w-0 break-all font-mono text-foreground/85">{call.rawToolName}</dd>
											{call.targetPath !== null ? (
												<>
													<dt className="text-muted-foreground">target</dt>
													<dd className="min-w-0 break-all font-mono text-foreground/85">{call.targetPath}</dd>
												</>
											) : null}
											{call.cwd !== null ? (
												<>
													<dt className="text-muted-foreground">cwd</dt>
													<dd className="min-w-0 break-all font-mono text-foreground/85">{call.cwd}</dd>
												</>
											) : null}
										</dl>
										{call.argsPreview ? (
											<div className="flex flex-col gap-0.5">
												<span className="text-[10px] text-muted-foreground">args</span>
												<pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded border border-border/70 bg-background/60 px-1.5 py-1 font-mono text-[10px] leading-relaxed text-foreground/85">
													{call.argsPreview}
												</pre>
											</div>
										) : null}
										<button
											type="button"
											onClick={() => void copyText(call.argsPreview || call.rawToolName)}
											className="inline-flex h-5 w-fit items-center gap-1 rounded border border-border px-1.5 text-[10px] text-foreground/80 transition-colors hover:border-primary/40 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
										>
											<span aria-hidden className="icon-[lucide--copy] size-2.5" />
											{t("live.calls.copy")}
										</button>
									</div>
								) : null}
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}

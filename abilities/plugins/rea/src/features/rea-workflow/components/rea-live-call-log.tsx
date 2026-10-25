/**
 * 实时调用流水：最新的在最上面，自带滚动区与「回到底部」提示。
 *
 * 三个体验点来自实际反馈：
 *   1. 默认就是展开的 —— 想看的时候不用先点一次「展开」；
 *   2. 只要用户没有手动往上翻，新调用会平滑滚到顶部（自动跟随）；
 *   3. 单行会被面板宽度截断，所以整行可点开展示完整参数，并提供复制。
 *
 * 「运行中」不靠推断：`endedAt === null` 就是宿主还没回这次调用。
 * 数据来自宿主会话事件，只读。
 */

import { useEffect, useRef, useState } from "react";
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

function prefersReducedMotion(): boolean {
	if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
	const [pinned, setPinned] = useState(true);
	const [pending, setPending] = useState(0);
	const listRef = useRef<HTMLDivElement | null>(null);
	const pinnedRef = useRef(true);
	const countRef = useRef(calls.length);
	const visible = calls.slice(-24).reverse();
	const running = calls.filter((call) => call.endedAt === null).length;

	// 跟随规则：用户停在最新位置时自动滚到顶部；翻过之后只累加「新调用」计数，
	// 不抢用户的滚动位置。依赖 calls.length 变化，而不是每次渲染都滚。
	useEffect(() => {
		const grew = calls.length > countRef.current;
		countRef.current = calls.length;
		if (!grew) return;
		const list = listRef.current;
		if (pinnedRef.current) {
			list?.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
			setPending(0);
			return;
		}
		setPending((value) => value + 1);
	}, [calls.length]);

	const handleScroll = (): void => {
		const list = listRef.current;
		if (list === null) return;
		const atTop = list.scrollTop <= 4;
		pinnedRef.current = atTop;
		setPinned(atTop);
		if (atTop) setPending(0);
	};

	const jumpToLatest = (): void => {
		pinnedRef.current = true;
		setPinned(true);
		setPending(0);
		listRef.current?.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
	};

	return (
		<div className="flex flex-col">
			{errors.length > 0 ? (
				<div className="flex flex-col gap-1 border-b border-border bg-danger/5 px-3 py-2">
					<span className="text-[10px] font-semibold uppercase tracking-wide text-danger">
						{t("live.errors.title")}
					</span>
					{errors.slice(0, 3).map((error) => (
						<div key={`${error.toolName}-${error.at}`} className="flex items-start gap-1.5 text-[11px]">
							<span className="shrink-0 tabular-nums text-muted-foreground">{timeLabel(error.at)}</span>
							<span className="shrink-0 font-medium text-danger">{error.toolName}</span>
							<span className="min-w-0 line-clamp-2 break-all text-muted-foreground" title={error.message}>
								{error.message}
							</span>
						</div>
					))}
				</div>
			) : null}

			<div className="flex min-w-0 items-center gap-1.5 border-b border-border bg-card/60 px-3 py-1">
				<span
					aria-hidden
					className={`size-1.5 shrink-0 rounded-full ${running > 0 ? "bg-primary motion-safe:animate-pulse" : "bg-stone"}`}
				/>
				<span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t("live.calls.title")}</span>
				<span
					className="min-w-0 truncate text-[10px] tabular-nums text-muted-foreground"
					title={t("live.counts.calls", { calls: calls.length, errors: errors.length })}
				>
					{t("live.calls.total", { count: calls.length })}
				</span>
				<button
					type="button"
					onClick={jumpToLatest}
					title={t("live.calls.jumpTop")}
					className="ml-auto shrink-0 rounded px-1 text-[10px] font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
				>
					{pinned ? t("live.calls.live") : t("live.calls.jumpTop")}
				</button>
			</div>

			<div ref={listRef} onScroll={handleScroll} className="relative max-h-[42vh] overflow-y-auto overscroll-contain">
				{!pinned && pending > 0 ? (
					<div className="sticky top-1 z-10 flex justify-center">
						<button
							type="button"
							onClick={jumpToLatest}
							className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-card px-2 py-0.5 text-[10px] font-medium text-primary shadow-sm motion-safe:animate-rea-rise focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
						>
							<span aria-hidden className="icon-[lucide--arrow-up] size-2.5" />
							{t("live.calls.newItems", { count: pending })}
						</button>
					</div>
				) : null}

				{visible.length === 0 ? (
					<p className="px-3 py-4 text-[11px] text-muted-foreground">{t("live.calls.empty")}</p>
				) : (
					<ul className="divide-y divide-border/60">
						{visible.map((call) => {
							const stageIndex = call.stage ? STAGE_INDEX[call.stage] : null;
							const expanded = expandedId === call.id;
							const isRunning = call.endedAt === null;
							return (
								<li key={call.id} className="flex flex-col motion-safe:animate-rea-row-in">
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
											title={`${call.rawToolName} — ${t(expanded ? "live.calls.collapse" : "live.calls.expand")}`}
											className="flex min-w-0 flex-1 flex-col rounded text-left transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
										>
											<div className="flex min-w-0 items-center gap-1.5">
												<span
													aria-hidden
													className={`shrink-0 text-muted-foreground ${expanded ? "icon-[lucide--chevron-down]" : "icon-[lucide--chevron-right]"} size-3`}
												/>
												<span
													className={`min-w-0 truncate text-[11px] font-medium ${call.isError ? "text-danger" : "text-foreground"}`}
													title={call.rawToolName}
												>
													{call.toolName}
												</span>
												{call.targets.map((target: TargetKind) => (
													<StatusChip key={target} tone="progress" title={t(`tab.target.${target}.hint`)}>
														{t(`tab.target.${target}.label`)}
													</StatusChip>
												))}
												<span
													className={`ml-auto shrink-0 text-[10px] tabular-nums ${isRunning ? "text-primary" : "text-muted-foreground"}`}
													title={new Date(call.startedAt).toISOString()}
												>
													{isRunning ? t("live.calls.running") : durationLabel(call)}
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
												<dt className="text-muted-foreground">time</dt>
												<dd className="min-w-0 break-all font-mono tabular-nums text-foreground/85">
													{new Date(call.startedAt).toLocaleString()}
												</dd>
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
		</div>
	);
}

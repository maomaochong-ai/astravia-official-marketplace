/**
 * 6 节点水平流程图：每个 stage 一个圆点 + label，连接线为进度光带。
 *
 * 主题跟随：
 *   - 当前/已通过节点 stroke + text 用 var(--primary)
 *   - 被越过的节点用虚线边（没有独立调用，但流程确实已经往后走了）
 *   - 未来节点 stroke + text 用 var(--muted-foreground)
 *   - 进度光带用 var(--primary)/10 半透明底 + var(--primary) 高亮
 *   - 当前节点用 motion-safe:animate-pulse，真实调用在跑时改用扩散环
 */

import type { JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { STAGES, TOTAL_STAGES } from "../data/stages";

interface StripProps {
	readonly currentStage: number;
	readonly onSelect: (stage: number) => void;
	/** 会话里实际跑过的阶段（1-based）；有真实活动时比“已翻到第几页”更可信。 */
	readonly completedStages?: readonly number[];
	/** 会话当前正在做那个阶段（1-based）；与手动翻页分开，避免互相覆盖。 */
	readonly liveStage?: number | null;
	/** 被流程越过、本次没有独立调用的阶段（1-based）。 */
	readonly bypassedStages?: readonly number[];
}

type StripStatus = "done" | "active" | "bypassed" | "todo";

export function ReaWorkflowStageStrip({ currentStage, onSelect, completedStages, liveStage, bypassedStages }: StripProps): JSX.Element {
	const { t } = useTranslation();
	return (
		<div className="border-b border-border bg-card/30 px-2 py-2.5 @min-[400px]:px-3">
			<ol
				className="flex items-center gap-1 @min-[420px]:gap-1.5 @max-[419px]:grid @max-[419px]:grid-cols-3 @max-[419px]:gap-1"
				aria-label={t("tab.strip.aria")}
			>
				{STAGES.map((stage, idx) => {
					const visited = completedStages?.includes(stage.index) ?? false;
					const live = liveStage === stage.index;
					const passed = bypassedStages?.includes(stage.index) ?? false;
					const status: StripStatus =
						currentStage === stage.index ? "active" : visited ? "done" : passed ? "bypassed" : "todo";
					const dotFill =
						status === "active" ? "rgb(from var(--primary) r g b / 0.18)" : status === "done" ? "rgb(from var(--primary) r g b / 0.10)" : "var(--muted)";
					const dotStroke = status === "todo" || status === "bypassed" ? "var(--border)" : "var(--primary)";
					const textCls =
						status === "active"
							? "font-semibold text-foreground"
							: status === "done"
								? "font-medium text-foreground/80"
								: "text-muted-foreground";
					const bypassedHint = status === "bypassed" ? t("tab.strip.bypassedHint") : undefined;
					return (
						<li
							key={stage.index}
							className="flex min-w-0 flex-1 items-center gap-1 last:flex-none @min-[420px]:gap-1.5 @max-[419px]:justify-center"
						>
							<button
								type="button"
								className="group flex min-w-0 w-full flex-col items-center gap-1 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-md px-1 py-1"
								aria-current={status === "active" ? "step" : undefined}
								aria-label={bypassedHint ? `${t(stage.labelKey)} — ${bypassedHint}` : t(stage.labelKey)}
								title={bypassedHint ?? t(stage.labelKey)}
								onClick={() => onSelect(stage.index)}
							>
								<span
									className={`grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${
										status === "active" ? (live ? "motion-safe:animate-rea-ring" : "motion-safe:animate-pulse") : ""
									}`}
									style={{
										backgroundColor: dotFill,
										color: status === "todo" || status === "bypassed" ? "var(--muted-foreground)" : "var(--primary)",
										border: status === "bypassed" ? `1px dashed ${dotStroke}` : `1px solid ${dotStroke}`,
									}}
								>
									{String(stage.index).padStart(2, "0")}
								</span>
								<span className={`block w-full truncate text-[10px] leading-tight ${textCls}`} title={bypassedHint ?? t(stage.labelKey)}>
									{t(stage.labelKey)}
								</span>
								{live ? (
									<span
										className="size-1 rounded-full bg-primary motion-safe:animate-ping"
										title={t("tab.live.diagram.live")}
										aria-hidden
									/>
								) : null}
							</button>
							{idx < TOTAL_STAGES - 1 ? (
								<span
									className="h-px w-2 shrink-0 @min-[520px]:w-5 @max-[419px]:hidden"
									style={{
										backgroundColor: status === "done" ? "var(--primary)" : "var(--border)",
										opacity: status === "done" ? 0.55 : 1,
									}}
									aria-hidden
								/>
							) : null}
						</li>
					);
				})}
			</ol>
		</div>
	);
}

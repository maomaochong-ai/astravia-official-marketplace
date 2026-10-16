/**
 * 6 节点水平流程图：每个 stage 一个圆点 + label，连接线为进度光带。
 *
 * 主题跟随：
 *   - 当前/已通过节点 stroke + text 用 var(--primary)
 *   - 未来节点 stroke + text 用 var(--muted-foreground)
 *   - 进度光带用 var(--primary)/10 半透明底 + var(--primary) 高亮
 *   - 当前节点用 motion-safe:animate-pulse
 */

import type { JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { STAGES, TOTAL_STAGES } from "../data/stages";

interface StripProps {
	readonly currentStage: number;
	readonly onSelect: (stage: number) => void;
	/** 会话里实际跑过的阶段（1-based）；有真实活动时比“已翻到第几页”更可信。 */
	readonly completedStages?: readonly number[];
}

export function ReaWorkflowStageStrip({ currentStage, onSelect, completedStages }: StripProps): JSX.Element {
	const { t } = useTranslation();
	return (
		<div className="border-b border-border bg-card/30 px-3 py-2.5">
			<ol className="flex items-center gap-1.5" aria-label={t("tab.strip.aria")}>
				{STAGES.map((stage, idx) => {
					const visited = completedStages?.includes(stage.index) ?? false;
					const status: "done" | "active" | "todo" = currentStage === stage.index ? "active" : currentStage > stage.index || visited ? "done" : "todo";
					const dotFill =
						status === "active" ? "rgb(from var(--primary) r g b / 0.18)" : status === "done" ? "rgb(from var(--primary) r g b / 0.10)" : "var(--muted)";
					const dotStroke = status === "todo" ? "var(--border)" : "var(--primary)";
					const textCls =
						status === "active"
							? "font-semibold text-foreground"
							: status === "done"
								? "font-medium text-foreground/80"
								: "text-muted-foreground";
					return (
						<li key={stage.index} className="flex flex-1 items-center gap-1.5 last:flex-none">
							<button
								type="button"
								className="group flex min-w-0 flex-1 flex-col items-center gap-1 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-md px-1 py-1"
								aria-current={status === "active" ? "step" : undefined}
								aria-label={t(stage.labelKey)}
								onClick={() => onSelect(stage.index)}
							>
								<span
									className={`grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${status === "active" ? "motion-safe:animate-pulse" : ""}`}
									style={{ backgroundColor: dotFill, color: status === "todo" ? "var(--muted-foreground)" : "var(--primary)", border: `1px solid ${dotStroke}` }}
								>
									{stage.index}
								</span>
								<span className={`line-clamp-1 text-[10px] leading-tight ${textCls}`}>{t(stage.labelKey)}</span>
							</button>
							{idx < TOTAL_STAGES - 1 ? (
								<span
									className="h-px w-3 shrink-0 sm:w-5"
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

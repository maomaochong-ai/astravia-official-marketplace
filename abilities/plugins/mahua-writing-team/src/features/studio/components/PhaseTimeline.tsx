import { useTranslation } from "@astravia-org/plugin-sdk";
import type { NovelPhase } from "../../../domain/novel-types.js";

const ORDER: NovelPhase[] = ["briefing", "planning", "drafting", "revising", "arc_close", "completed"];

/**
 * 阶段时间线。`revising` 与 `arc_close` 是写作期的分支状态，不是串行格子，
 * 因此它们标在 drafting 之后而不是各占一格进度。
 *
 * 取色对齐设计稿的「墨 / 朱砂 / 线」三层：当前格是墨底反白（可读性最高、一眼看到现在），
 * 已过的格是浅纸色，未到的是弱化文字——不用彩色填充，因为宿主没有 success 令牌（ADR 0026 §7）。
 */
export function PhaseTimeline({ phase }: { phase: NovelPhase }) {
	const { t } = useTranslation();
	const activeIndex = ORDER.indexOf(phase);

	return (
		<ol className="flex flex-wrap items-center gap-1">
			{ORDER.map((item, index) => {
				const state = item === phase ? "current" : index < activeIndex ? "done" : "pending";
				const tone =
					state === "current"
						? "bg-foreground font-medium text-background"
						: state === "done"
							? "bg-muted text-muted-foreground"
							: "text-muted-foreground/60";
				return (
					<li key={item} className={`flex h-5 items-center rounded-[6px] px-1.5 text-[10px] ${tone}`}>
						{t(`phase.${item}`)}
					</li>
				);
			})}
		</ol>
	);
}

import { useTranslation } from "@astravia-org/plugin-sdk";
import type { NovelPhase } from "../../../domain/novel-types.js";

const ORDER: NovelPhase[] = ["briefing", "planning", "drafting", "revising", "arc_close", "completed"];

/**
 * 阶段时间线。`revising` 与 `arc_close` 是写作期的分支状态，不是串行格子，
 * 因此它们标在 drafting 之后而不是各占一格进度。
 */
export function PhaseTimeline({ phase }: { phase: NovelPhase }) {
	const { t } = useTranslation();
	const activeIndex = ORDER.indexOf(phase);

	return (
		<ol className="flex flex-wrap items-center gap-1.5 text-xs">
			{ORDER.map((item, index) => {
				const state =
					item === phase ? "current" : index < activeIndex ? "done" : "pending";
				const tone =
					state === "current"
						? "bg-primary text-primary-foreground"
						: state === "done"
							? "bg-primary/15 text-primary"
							: "bg-muted/60 text-muted-foreground";
				return (
					<li key={item} className={`rounded-md px-2 py-1 font-medium ${tone}`}>
						{t(`phase.${item}`)}
					</li>
				);
			})}
		</ol>
	);
}

import { useTranslation } from "@astravia-org/plugin-sdk";
import type { NovelPhase } from "../../../domain/novel-types.js";

/**
 * 六个阶段各自的底色。宿主只有一套语义令牌（没有 success / warning），
 * 所以这里只用四档：中性底、强调淡底、强调实底、描边强调——
 * 「修订」靠一道描边跟「写作中」区分，而不是靠一个不存在的琥珀色（ADR 0026 §3）。
 */
const TONE: Record<NovelPhase, string> = {
	briefing: "bg-muted text-muted-foreground",
	planning: "bg-muted text-foreground",
	drafting: "bg-primary/15 text-primary",
	revising: "bg-secondary text-secondary-foreground ring-1 ring-inset ring-primary/40",
	arc_close: "bg-muted text-muted-foreground",
	completed: "bg-primary text-primary-foreground",
};

/** 作品阶段的徽章：书名旁边那一枚，不参与标题的字号阶梯。 */
export function PhaseBadge({ phase }: { phase: NovelPhase }) {
	const { t } = useTranslation();
	return (
		<span
			className={`inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-xs font-medium ${TONE[phase]}`}
		>
			{t(`phase.${phase}`)}
		</span>
	);
}

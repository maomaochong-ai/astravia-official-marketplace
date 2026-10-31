import type { ChapterState } from "../../workbench-model";
import { useTranslator } from "../../hooks/use-translator";

/** 阶段徽章的六种底色：立项/规划/收弧用纸槽，写作中朱砂，修订赭黄，完本墨绿。 */
const PHASE_TONES: Record<string, string> = {
	briefing: "bg-inset text-ink-soft",
	planning: "bg-inset text-ink-soft",
	drafting: "bg-cinnabar-soft text-cinnabar-ink",
	revising: "bg-wait-soft text-wait",
	arc_close: "bg-inset text-ink-soft",
	completed: "bg-pass-soft text-pass",
};

const CHAPTER_DOTS: Record<ChapterState, string> = {
	committed: "bg-pass",
	reviewed: "border border-pass bg-pass-soft",
	drafting: "bg-ink/45",
	planned: "border border-line-strong",
	blocked: "bg-fail",
};

export function PhaseBadge({ phase }: { phase: string }) {
	const t = useTranslator();
	const tone = PHASE_TONES[phase] ?? PHASE_TONES["planning"];
	return (
		<span className={`inline-flex h-[19px] items-center rounded-tile px-1.5 text-micro font-medium ${tone}`}>
			{t(`phase.${phase}`)}
		</span>
	);
}

export function ChapterMark({ state, showLabel = true }: { state: ChapterState; showLabel?: boolean }) {
	const t = useTranslator();
	return (
		<span className="inline-flex items-center gap-1.5 text-micro text-ink-soft">
			<span className={`size-1.5 rounded-pill ${CHAPTER_DOTS[state]}`} />
			{showLabel && t(`status.${state}`)}
		</span>
	);
}

/** 五态图例：目录页脚用它，顺序与 `ChapterState` 一致。 */
export const CHAPTER_STATES: readonly ChapterState[] = ["committed", "reviewed", "drafting", "planned", "blocked"];

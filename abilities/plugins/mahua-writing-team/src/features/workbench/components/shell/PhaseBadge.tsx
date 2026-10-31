import type { ChapterState } from "../../workbench-model";
import { useTranslator } from "../../hooks/use-translator";

/** 阶段徽章的六种底色：立项/规划/收弧用半透明墨，写作中朱砂，修订赭黄，完本墨绿。
 *
 * 中性三态从前是 `bg-inset`（实色凹槽）。实色一旦落在 well 里就比容器更深一层，
 * 一枚小胶囊看着像贴上去的补丁；半透明的 wash 会跟当前所在的那层纸一起明暗，
 * 在 raised、well、hover 三种底上都只「压暗一点」，不会出现第二种灰。 */
const PHASE_TONES: Record<string, string> = {
	briefing: "bg-wash text-ink-soft",
	planning: "bg-wash text-ink-soft",
	drafting: "bg-cinnabar-soft text-cinnabar-ink",
	revising: "bg-wait-soft text-wait",
	arc_close: "bg-wash text-ink-soft",
	completed: "bg-pass-soft text-pass",
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

/** 五态图例：目录页脚用它，顺序与 `ChapterState` 一致。 */
export const CHAPTER_STATES: readonly ChapterState[] = ["committed", "reviewed", "drafting", "planned", "blocked"];

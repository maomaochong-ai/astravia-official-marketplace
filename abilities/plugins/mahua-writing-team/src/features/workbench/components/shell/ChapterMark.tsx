import type { ChapterState } from "../../workbench-model";
import { useTranslator } from "../../hooks/use-translator";

/** 章状态的点与标签：目录、弧带图例与书架共用同一套配色。 */
const CHAPTER_DOTS: Record<ChapterState, string> = {
	committed: "bg-pass",
	reviewed: "border border-pass bg-pass-soft",
	drafting: "bg-ink/45",
	planned: "border border-line-strong",
	blocked: "bg-fail",
};

export function ChapterMark({ state, showLabel = true }: { state: ChapterState; showLabel?: boolean }) {
	const t = useTranslator();
	return (
		<span className="inline-flex items-center gap-1.5 text-micro text-ink-soft">
			<span className={`size-1.5 rounded-pill ${CHAPTER_DOTS[state]}`} />
			{showLabel && t(`status.${state}`)}
		</span>
	);
}

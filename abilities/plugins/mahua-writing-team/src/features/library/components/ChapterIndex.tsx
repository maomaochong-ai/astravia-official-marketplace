import { useTranslation } from "@astravia-org/plugin-sdk";
import type { Chapter } from "../../../domain/novel-types.js";
import { StatusPill } from "../../shared/components/StatusPill.js";

interface ChapterIndexProps {
	chapters: Chapter[];
	currentChapter: number;
	selectedChapter: number | null;
	onOpen: (n: number) => void;
}

/**
 * 目录（ADR 0013 §2.3）：一行一章，对应番茄书页的 `chapter-item` 列表。
 * 番茄在 VIP 章上挂锁；我们挂的是状态药丸——它决定这章能不能读、要不要改。
 */
export function ChapterIndex({ chapters, currentChapter, selectedChapter, onOpen }: ChapterIndexProps) {
	const { t } = useTranslation();

	if (chapters.length === 0) {
		return <p className="text-sm text-muted-foreground">{t("board.empty")}</p>;
	}

	return (
		<section className="flex flex-col gap-2">
			<div className="flex items-baseline justify-between gap-2">
				<h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
					{t("book.index")}
				</h2>
				<span className="text-xs tabular-nums text-muted-foreground">
					{t("book.indexCount", { count: chapters.length })}
				</span>
			</div>
			<ul className="flex flex-col divide-y divide-border/60 rounded-lg border border-border/60">
				{chapters.map((chapter) => {
					const active = chapter.n === selectedChapter;
					const isCurrent = chapter.n === currentChapter;
					return (
						<li key={chapter.n}>
							<button
								type="button"
								onClick={() => onOpen(chapter.n)}
								aria-current={active ? "true" : undefined}
								className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors ${
									active ? "bg-accent text-accent-foreground" : "hover:bg-muted/40"
								}`}
							>
								<span className="w-12 shrink-0 text-xs tabular-nums text-muted-foreground">
									{t("board.chapterLabel", { chapter: chapter.n })}
									{isCurrent ? " •" : ""}
								</span>
								<span className="min-w-0 flex-1 truncate text-sm">
									{chapter.title || t("board.untitled")}
								</span>
								<span className="shrink-0 text-xs tabular-nums text-muted-foreground">
									{chapter.words > 0 ? t("board.words", { count: chapter.words }) : ""}
								</span>
								<StatusPill status={chapter.status} />
							</button>
						</li>
					);
				})}
			</ul>
		</section>
	);
}

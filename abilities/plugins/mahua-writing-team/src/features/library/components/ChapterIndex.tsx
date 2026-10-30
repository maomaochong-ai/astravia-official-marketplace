import { useTranslation } from "@astravia-org/plugin-sdk";
import type { Chapter, Volume } from "../../../domain/novel-types.js";
import { ChapterDot } from "../../shared/components/ChapterDot.js";

interface ChapterIndexProps {
	chapters: Chapter[];
	/** 有卷/弧就按卷→弧分组（设计稿 `book` 帧右栏），没有就平铺。 */
	volumes?: Volume[];
	currentChapter: number;
	selectedChapter: number | null;
	onOpen: (n: number) => void;
}

const ROW =
	"flex w-full items-center gap-2 rounded-[3px] px-1.5 py-1.5 text-left transition-colors";

/**
 * 目录（ADR 0013 §2.3 / 0027 §6）。
 *
 * 设计稿的目录不是平铺的章列表：它先按卷分段，再给每条弧一行小标题（弧名 + 章范围），
 * 章行压在里面，当前章整行抬高成一张纸（`bg-card shadow`），右侧一枚状态点与评分。
 * 弧块与章行之间没有分隔线——分组靠留白与字重，不靠横线堆叠。
 *
 * 番茄在 VIP 章上挂锁；我们挂的是状态点：它决定这章能不能读、要不要改。
 */
export function ChapterIndex({ chapters, volumes, currentChapter, selectedChapter, onOpen }: ChapterIndexProps) {
	const { t } = useTranslation();

	if (chapters.length === 0) {
		return <p className="px-2 py-1.5 text-[11px] text-muted-foreground">{t("board.empty")}</p>;
	}

	const groups = (volumes ?? [])
		.map((volume, index) => ({
			volume,
			label: `${t("book.volume", { index: index + 1 })} · ${volume.title}`,
			arcs: volume.arcs.map((arc) => ({
				arc,
				chapters: chapters.filter((chapter) => chapter.n >= arc.from && chapter.n <= arc.to),
			})),
		}))
		.filter((group) => group.arcs.some((entry) => entry.chapters.length > 0));

	const renderRow = (chapter: Chapter) => {
		const active = chapter.n === selectedChapter;
		const isCurrent = chapter.n === currentChapter;
		return (
			<li key={chapter.n}>
				<button
					type="button"
					onClick={() => onOpen(chapter.n)}
					aria-current={active ? "true" : undefined}
					className={`${ROW} ${
						active
							? "bg-card shadow-sm"
							: isCurrent
								? "bg-muted/60"
								: "hover:bg-muted/40"
					}`}
				>
					<ChapterDot status={chapter.status} />
					<span className="min-w-0 flex-1 truncate text-[11.5px] text-foreground">
						<span className="mr-1.5 font-mono text-[9px] tabular-nums text-muted-foreground">
							{chapter.n}
						</span>
						{chapter.title || t("board.untitled")}
						{isCurrent ? <span className="ml-1 text-primary">•</span> : null}
					</span>
					<span className="w-8 shrink-0 text-right font-mono text-[9px] tabular-nums text-muted-foreground">
						{chapter.words > 0 ? chapter.words : ""}
					</span>
					<span className="w-5 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
						{(chapter.reviewScore ?? 0) > 0 ? chapter.reviewScore : ""}
					</span>
				</button>
			</li>
		);
	};

	return (
		<section className="flex flex-col gap-1.5">
			<header className="flex items-baseline justify-between gap-2 px-2 pb-0.5 pt-1">
				<h2 className="font-serif text-[15px] font-semibold text-foreground">{t("book.index")}</h2>
				<span className="font-mono text-[10px] tabular-nums text-muted-foreground">
					{t("book.indexCount", { count: chapters.length })}
				</span>
			</header>

			{groups.length === 0 ? (
				<ul className="flex flex-col">{chapters.map(renderRow)}</ul>
			) : (
				groups.map((group) => (
					<div key={group.volume.id} className="flex flex-col">
						<p className="px-2 pb-1 pt-2 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground/70">
							{group.label}
						</p>
						{group.arcs.map((entry) => (
							<div key={entry.arc.id} className="flex flex-col">
								<div className="mx-1 mb-0.5 flex items-baseline gap-1.5 rounded-[3px] bg-muted/60 px-1.5 py-1">
									<span className="min-w-0 flex-1 truncate text-[10px] font-medium text-foreground">
										{entry.arc.title}
									</span>
									<span className="shrink-0 font-mono text-[9px] tabular-nums text-muted-foreground">
										{entry.arc.from}–{entry.arc.to}
									</span>
								</div>
								<ul className="flex flex-col">{entry.chapters.map(renderRow)}</ul>
							</div>
						))}
					</div>
				))
			)}
		</section>
	);
}

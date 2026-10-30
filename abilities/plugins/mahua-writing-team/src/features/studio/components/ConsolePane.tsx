import { useTranslation } from "@astravia-org/plugin-sdk";
import type { NovelBook, ReviewReport } from "../../../domain/novel-types.js";
import { STUDIO_MEMBERS } from "../../../studio-members.js";
import { ChapterDot } from "../../shared/components/ChapterDot.js";
import { MeterBar } from "../../shared/components/MeterBar.js";
import { PageBar, PAGE_META, PAGE_TITLE } from "../../shared/components/PageBar.js";
import { PhaseBadge } from "../../shared/components/PhaseBadge.js";
import { ScoreBar } from "../../shared/components/ScoreBar.js";
import { dateOf, progressPercent } from "../../library/bookshelf-model.js";

interface ConsolePaneProps {
	book: NovelBook;
	/** 当前章的评审：没有评审就整块留空，不编分数。 */
	review: ReviewReport | null;
	onBack: () => void;
	onOpenChapter: (n: number) => void;
}

const CARD = "rounded-[13px] border border-border/60 bg-card shadow-sm";

const PANEL_HEAD = "flex shrink-0 items-baseline justify-between gap-2 border-b border-border/50 px-3 pb-2 pt-2.5";

/**
 * 运行台（ADR 0027 §1）。
 *
 * 设计稿的 `console` 帧是一条实时事件流：工具调用、上下文占用百分比、模型名、队列深度。
 * 插件这一层拿不到其中任何一项——宿主不向标签页暴露 agent 运行时，模型名与
 * 「上下文 67%」只存在于会话里。照着画就是伪造监控数据，所以这一页**只用落盘事实**：
 *
 * - 左：章节脊柱 —— `book.chapters` 的逐章状态，点一章就读那一章；
 * - 中：落盘时间线 —— `book.checkpoints` 的追加记录（时间、事件、章号）；
 * - 右：概览 / 团队 / 最近评审 —— 进度、四位成员的职责、`reviews/<n>.json` 的七维分数。
 *
 * 想说话的时候这一页开口是没有用的：这一页没有任何写操作，也没有输入框（ADR 0011 §2.4）。
 */
export function ConsolePane({ book, review, onBack, onOpenChapter }: ConsolePaneProps) {
	const { t } = useTranslation();
	const current = book.progress.currentChapter;
	const percent = progressPercent({
		committedCount: book.progress.committedCount,
		targetChapters: book.targetChapters,
	});
	const totalWords = book.chapters.reduce((sum, chapter) => sum + chapter.words, 0);
	const checkpoints = [...book.checkpoints].reverse();

	return (
		<div className="flex h-full min-h-0 flex-col">
			<PageBar back={{ label: t("reader.book"), onClick: onBack }}>
				<h1 className={PAGE_TITLE}>{t("console.title")}</h1>
				<p className={PAGE_META}>
					<span className="truncate">{book.title}</span>
					<span aria-hidden="true">·</span>
					<span className="tabular-nums">{t("board.chapterLabel", { chapter: current })}</span>
					<span aria-hidden="true">·</span>
					<span className="tabular-nums">{t("studio.header.progress", { progress: `${book.progress.committedCount}/${book.targetChapters}` })}</span>
				</p>
			</PageBar>

			<div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4 sm:px-6 xl:flex-row xl:items-stretch xl:overflow-hidden">
				<section className={`${CARD} flex min-h-0 w-full flex-col xl:w-[196px] xl:shrink-0`}>
					<header className={PANEL_HEAD}>
						<h2 className="font-serif text-[13px] font-semibold text-foreground">{t("console.spine")}</h2>
						<span className="font-mono text-[9px] tabular-nums text-muted-foreground">{book.chapters.length}</span>
					</header>
					<ul className="flex min-h-0 flex-1 flex-col overflow-y-auto p-1">
						{book.chapters.length === 0 ? (
							<li className="px-2 py-1.5 text-[10px] text-muted-foreground">{t("board.empty")}</li>
						) : (
							book.chapters.map((chapter) => (
								<li key={chapter.n}>
									<button
										type="button"
										onClick={() => onOpenChapter(chapter.n)}
										aria-current={chapter.n === current ? "true" : undefined}
										className={`flex w-full items-center gap-1.5 rounded-[5px] px-1.5 py-1 text-left transition-colors ${
											chapter.n === current ? "bg-muted" : "hover:bg-muted/50"
										}`}
									>
										<ChapterDot status={chapter.status} />
										<span className="w-5 shrink-0 font-mono text-[9px] tabular-nums text-muted-foreground">
											{chapter.n}
										</span>
										<span className="min-w-0 flex-1 truncate text-[10.5px] text-foreground">
											{chapter.title || t("board.untitled")}
										</span>
										<span className="shrink-0 font-mono text-[9px] tabular-nums text-muted-foreground">
											{chapter.words > 0 ? chapter.words : ""}
										</span>
									</button>
								</li>
							))
						)}
					</ul>
				</section>

				<section className={`${CARD} flex min-h-0 min-w-0 flex-1 flex-col`}>
					<header className={PANEL_HEAD}>
						<h2 className="font-serif text-[13px] font-semibold text-foreground">{t("console.checkpoints")}</h2>
						<span className="font-mono text-[9px] tabular-nums text-muted-foreground">{checkpoints.length}</span>
					</header>
					{checkpoints.length === 0 ? (
						<p className="px-3 py-3 text-[10.5px] text-muted-foreground">{t("console.checkpointsEmpty")}</p>
					) : (
						<ol className="flex min-h-0 flex-1 flex-col overflow-y-auto">
							{checkpoints.map((checkpoint, index) => (
								<li
									key={`${checkpoint.at}-${index}`}
									className="flex min-w-0 items-baseline gap-2 border-b border-border/30 px-3 py-1.5 last:border-b-0"
								>
									<span className="w-[74px] shrink-0 font-mono text-[9px] tabular-nums text-muted-foreground/70">
										{dateOf(checkpoint.at)}
									</span>
									<span className="w-8 shrink-0 font-mono text-[9px] tabular-nums text-muted-foreground">
										{checkpoint.chapter}
									</span>
									<span className="min-w-0 flex-1 text-[10.5px] text-foreground [overflow-wrap:anywhere]">
										{t(checkpoint.noteKey, checkpoint.noteParams)}
									</span>
									<span className="shrink-0 font-mono text-[9px] text-muted-foreground/60">
										{t(`phase.${checkpoint.phase}`)}
									</span>
								</li>
							))}
						</ol>
					)}
				</section>

				<div className="flex w-full shrink-0 flex-col gap-3 xl:w-[264px] xl:overflow-y-auto">
					<section className={`${CARD} flex flex-col gap-2 p-3`}>
						<header className="flex items-baseline justify-between gap-2">
							<h2 className="font-serif text-[13px] font-semibold text-foreground">{t("console.overview")}</h2>
							<PhaseBadge phase={book.phase} />
						</header>
						<div className="flex items-baseline justify-between gap-2">
							<span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground/70">
								{t("console.progress")}
							</span>
							<span className="font-mono text-[11px] tabular-nums text-foreground">{Math.round(percent)}%</span>
						</div>
						<MeterBar value={percent} className="h-[3px]" />
						<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-[9px] tabular-nums text-muted-foreground">
							<span>{t("shelf.progress", { done: book.progress.committedCount, total: book.targetChapters })}</span>
							<span>{t("board.words", { count: totalWords })}</span>
						</div>
					</section>

					<section className={`${CARD} flex flex-col p-3`}>
						<header className="flex items-baseline justify-between gap-2 pb-1.5">
							<h2 className="font-serif text-[13px] font-semibold text-foreground">{t("console.team")}</h2>
							<span className="font-mono text-[9px] tabular-nums text-muted-foreground">{STUDIO_MEMBERS.length}</span>
						</header>
						<ul className="flex flex-col">
							{STUDIO_MEMBERS.map((member) => (
								<li key={member.agentId} className="flex min-w-0 items-baseline gap-2 py-1">
									<span className="min-w-0 flex-1 truncate text-[10.5px] text-foreground">{t(member.nameKey)}</span>
									<span className="shrink-0 font-mono text-[9px] text-muted-foreground">{t(member.dutyKey)}</span>
								</li>
							))}
						</ul>
					</section>

					<section className={`${CARD} flex flex-col gap-1.5 p-3`}>
						<header className="flex items-baseline justify-between gap-2">
							<h2 className="font-serif text-[13px] font-semibold text-foreground">{t("console.review")}</h2>
							{review ? (
								<span className="font-mono text-[11px] tabular-nums text-foreground">{review.score}</span>
							) : null}
						</header>
						{review ? (
							<>
								<p className="font-mono text-[9px] tabular-nums text-muted-foreground/70">
									{t("board.chapterLabel", { chapter: review.chapter })} · {dateOf(review.reviewedAt)}
								</p>
								<div className="flex flex-col gap-1">
									{review.dimensions.map((dimension) => (
										<ScoreBar key={dimension.key} label={t(`dimension.${dimension.key}`)} value={dimension.score} />
									))}
								</div>
							</>
						) : (
							<p className="text-[10.5px] text-muted-foreground">{t("console.reviewEmpty")}</p>
						)}
					</section>
				</div>
			</div>
		</div>
	);
}

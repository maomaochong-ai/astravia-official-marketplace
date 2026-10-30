import { useTranslation } from "@astravia-org/plugin-sdk";
import type { NovelBook, ReviewReport } from "../../../domain/novel-types.js";
import { STUDIO_MEMBERS } from "../../../studio-members.js";
import { ChapterDot } from "../../shared/components/ChapterDot.js";
import { MeterBar } from "../../shared/components/MeterBar.js";
import { PageBar, PAGE_META, PAGE_TITLE } from "../../shared/components/PageBar.js";
import { PhaseBadge } from "../../shared/components/PhaseBadge.js";
import { ScoreBar } from "../../shared/components/ScoreBar.js";
import { dateOf, progressPercent } from "../../library/bookshelf-model.js";
import { feedStore } from "../live-feed/feed-store.js";
import { useLiveFeed } from "../live-feed/use-live-feed.js";
import { FeedStream } from "./FeedStream.js";

interface ConsolePaneProps {
	book: NovelBook;
	/** 当前章的评审：没有评审就整块留空，不编分数。 */
	review: ReviewReport | null;
	onBack: () => void;
	onOpenChapter: (n: number) => void;
}

const CARD = "rounded-[18px] bg-card shadow-xs";

/** 设计稿里运行台四栏的标题都是微标签，不是衬线标题——这一页的标题只有页头那一个。 */
const MICRO = "text-[10px] tracking-[0.08em] text-muted-foreground/70";

/** 左右两栏是凹槽：没有阴影，靠内联的浅底把自己压到纸面下方。 */
const TROUGH = "flex flex-col overflow-hidden rounded-[18px] bg-muted/40";

/**
 * 运行台（ADR 0027 §1，含 2026-10 修订）。
 *
 * 设计稿的 `console` 帧是一条实时事件流：工具调用、上下文占用百分比、模型名、队列深度。
 * 其中**上下文占用与模型名**插件这一层仍然拿不到：那两个值在会话运行时里，标签页 API
 * 不暴露。照着画就是伪造监控数据，所以这两项永远不做。
 *
 * 但「工具调用」拿得到。SDK 0.3.11 的 `ctx.agent.registerHook` 会把每一次工具调用
 * （`PreToolUse` / `PostToolUse` / `PostToolUseFailure`）与子代理起停送到插件，所以
 * 中栏上半就是**真事件流**：谁在什么时候把哪一章写进账本、派了哪位成员、哪一个工具失败了。
 * 事件只描述宿主真的交过来的字段，不推断「是谁在调」。
 *
 * - 左：章节脊柱 —— `book.chapters` 的逐章状态，点一章就读那一章；
 * - 中上：实时活动流 —— 本会话的工具事件，内存总线 + 落盘副本；
 * - 中下：落盘时间线 —— `book.checkpoints` 的追加记录（时间、事件、章号）；
 * - 右：概览 / 团队 / 最近评审 —— 进度、四位成员的职责、`reviews/<n>.json` 的七维分数。
 *
 * 想说话的时候这一页开口是没有用的：这一页没有任何写操作，也没有输入框（ADR 0011 §2.4）。
 * 唯一可点的动作是清空活动流——它只动观感层，不动账本。
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
	const events = useLiveFeed();

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
				<aside className={`${TROUGH} min-h-0 w-full xl:w-[196px] xl:shrink-0`}>
					<header className="flex shrink-0 items-baseline justify-between gap-2 px-3.5 pb-1.5 pt-2.5">
						<h2 className={MICRO}>{t("console.spine")}</h2>
						<span className="font-mono text-[9px] tabular-nums text-muted-foreground/70">
							{book.chapters.length}
						</span>
					</header>
					<ul className="flex min-h-0 flex-1 flex-col overflow-y-auto px-1.5">
						{book.chapters.length === 0 ? (
							<li className="px-2 py-1.5 text-[10px] text-muted-foreground">{t("board.empty")}</li>
						) : (
							book.chapters.map((chapter) => (
								<li key={chapter.n}>
									<button
										type="button"
										onClick={() => onOpenChapter(chapter.n)}
										aria-current={chapter.n === current ? "true" : undefined}
										className={`flex w-full items-center gap-1.5 rounded-[6px] px-1.5 py-1.5 text-left transition-colors ${
											chapter.n === current
												? "bg-card font-medium shadow-xs"
												: "hover:bg-card/60"
										}`}
									>
										<ChapterDot status={chapter.status} />
										<span
											className={`w-5 shrink-0 font-mono text-[10px] tabular-nums ${
												chapter.n === current ? "text-primary" : "text-muted-foreground/70"
											}`}
										>
											{chapter.n}
										</span>
										<span className="min-w-0 flex-1 truncate text-[11px] text-foreground">
											{chapter.title || t("board.untitled")}
										</span>
										<span className="shrink-0 font-mono text-[9px] tabular-nums text-muted-foreground/70">
											{chapter.words > 0 ? chapter.words : ""}
										</span>
									</button>
								</li>
							))
						)}
					</ul>
					<div className="shrink-0 border-t border-border/50 px-3.5 pb-3 pt-2.5">
						<div className="flex items-baseline justify-between gap-2">
							<span className="text-[10px] text-muted-foreground/70">{t("console.progress")}</span>
							<span className="font-mono text-[10px] tabular-nums text-muted-foreground">
								{Math.round(percent)}%
							</span>
						</div>
						<MeterBar value={percent} className="mt-1.5 h-[3px]" />
						<p className="mt-2 text-[9px] leading-[14px] text-muted-foreground/60">{t("console.spineNote")}</p>
					</div>
				</aside>

				<section className={`${CARD} flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden`}>
					{/* 上半：实时活动流。内容全部来自宿主 hook 交过来的工具事件。 */}
					<div className="flex min-h-0 flex-1 flex-col">
						<header className="flex shrink-0 items-baseline justify-between gap-2 border-b border-border/50 px-4 pb-2 pt-2.5">
							<h2 className={MICRO}>
								{t("console.feed")}
								<span className="ml-1.5 inline-flex items-center gap-1 font-mono text-[9px] normal-case tracking-normal text-muted-foreground/70">
									<span aria-hidden="true" className="size-1.5 animate-pulse rounded-full bg-primary" />
									{t("console.feedLive")}
								</span>
							</h2>
							<span className="flex items-center gap-2">
								<span className="font-mono text-[9px] tabular-nums text-muted-foreground/70">
									{events.length}
								</span>
								{events.length === 0 ? null : (
									<button
										type="button"
										onClick={() => feedStore.clear()}
										className="rounded-[6px] px-1 font-mono text-[9px] text-muted-foreground/70 transition-colors hover:text-foreground"
									>
										{t("console.feedClear")}
									</button>
								)}
							</span>
						</header>
						{events.length === 0 ? (
							<p className="px-4 py-3 text-[10.5px] leading-[16px] text-muted-foreground">
								{t("console.feedEmpty")}
							</p>
						) : (
							<FeedStream events={events} />
						)}
						<div className="flex h-8 shrink-0 items-center gap-2 border-t border-border/40 px-4 font-mono text-[9.5px] text-muted-foreground/70">
							<span aria-hidden="true" className="icon-[solar--bolt-circle-linear] size-3 shrink-0" />
							<span className="truncate">{t("console.feedNote")}</span>
						</div>
					</div>

					{/* 下半：落盘时间线。它不会因为页面开着而变，所以只占一段固定高度。 */}
					<div className="flex max-h-[42%] min-h-0 shrink-0 flex-col border-t border-border/50">
						<header className="flex shrink-0 items-baseline justify-between gap-2 px-4 pb-1.5 pt-2.5">
							<h2 className={MICRO}>{t("console.checkpoints")}</h2>
							<span className="font-mono text-[9px] tabular-nums text-muted-foreground/70">
								{checkpoints.length}
							</span>
						</header>
						{checkpoints.length === 0 ? (
							<p className="px-4 py-2 text-[10px] text-muted-foreground">{t("console.checkpointsEmpty")}</p>
						) : (
							<ol className="flex min-h-0 flex-1 flex-col overflow-y-auto">
								{checkpoints.map((checkpoint, index) => (
									<li
										key={`${checkpoint.at}-${index}`}
										className="flex min-w-0 items-baseline gap-2 border-b border-border/30 px-4 py-1.5 last:border-b-0"
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
						<div className="flex h-7 shrink-0 items-center gap-2 border-t border-border/40 px-4 font-mono text-[9.5px] text-muted-foreground/60">
							<span aria-hidden="true" className="icon-[solar--info-circle-linear] size-3 shrink-0" />
							<span className="truncate">{t("console.readOnly")}</span>
						</div>
					</div>
				</section>

				<aside className="flex w-full shrink-0 flex-col rounded-[18px] bg-muted/40 px-4 py-4 xl:w-[264px] xl:overflow-y-auto">
					<section className="flex flex-col gap-2">
						<header className="flex items-baseline justify-between gap-2">
							<h2 className={MICRO}>{t("console.overview")}</h2>
							<PhaseBadge phase={book.phase} />
						</header>
						<div className="flex items-baseline justify-between gap-2">
							<span className="text-[10px] text-muted-foreground/70">{t("console.progress")}</span>
							<span className="font-mono text-[11px] tabular-nums text-foreground">{Math.round(percent)}%</span>
						</div>
						<MeterBar value={percent} className="h-[3px]" />
						<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-[9px] tabular-nums text-muted-foreground">
							<span>{t("shelf.progress", { done: book.progress.committedCount, total: book.targetChapters })}</span>
							<span>{t("board.words", { count: totalWords })}</span>
						</div>
					</section>

					<section className="mt-3 flex flex-col border-t border-border/50 pt-3">
						<header className="flex items-baseline justify-between gap-2 pb-1">
							<h2 className={MICRO}>{t("console.team")}</h2>
							<span className="font-mono text-[9px] tabular-nums text-muted-foreground/70">
								{STUDIO_MEMBERS.length}
							</span>
						</header>
						<ul className="flex flex-col">
							{STUDIO_MEMBERS.map((member) => (
								<li key={member.agentId} className="flex min-w-0 items-baseline gap-2 py-1">
									<span className="min-w-0 flex-1 truncate text-[11px] text-foreground">{t(member.nameKey)}</span>
									<span className="shrink-0 font-mono text-[9px] text-muted-foreground/70">{t(member.dutyKey)}</span>
								</li>
							))}
						</ul>
					</section>

					<section className="mt-3 flex flex-col gap-1.5 border-t border-border/50 pt-3">
						<header className="flex items-baseline justify-between gap-2">
							<h2 className={MICRO}>{t("console.review")}</h2>
							{review ? (
								<span className="font-serif text-[19px] font-semibold leading-none tabular-nums text-foreground">
									{review.score}
								</span>
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
				</aside>
			</div>
		</div>
	);
}

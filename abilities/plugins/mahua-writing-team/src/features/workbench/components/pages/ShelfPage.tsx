import type { StudioState } from "../../hooks/use-studio-state";
import { useTranslator } from "../../hooks/use-translator";
import { useConsoleTimeline } from "../../console-timeline/use-console-timeline.js";
import type { WorkbenchPage } from "../../workbench-pages";
import { arcOf, chapterStateOf, committedCount, committedWords, coverSeed, elapsedSince, percent, wanWords } from "../../workbench-model";
import { clockOf, elapsedText, isWriting, lastLandedStudioEvent, newestFirst } from "../../workbench-feed";
import { Cover } from "../shell/Cover";
import { EmptySheet } from "../shell/EmptySheet";
import { PageHeader } from "../shell/PageHeader";
import { PhaseBadge } from "../shell/PhaseBadge";

/**
 * 书架：一张正在写的纸，旁边一列待写的书。
 *
 * 这一页回答两件事——「侧栏里的团队刚落下什么」和「其余几本停在哪」。
 * 没有任何派活按钮；下半那张纸的四行只读流水，换行不等谁点刷新。
 */
export function ShelfPage({
	data,
	onNavigate,
	onRevealTeam,
}: {
	data: StudioState;
	onNavigate: (page: WorkbenchPage, chapter?: number) => void;
	onRevealTeam: () => void;
}) {
	const t = useTranslator();
	const events = useConsoleTimeline();
	const now = Date.now();
	const book = data.book;
	const landed = lastLandedStudioEvent(events);
	const writing = isWriting(events, now);

	if (!book) {
		return (
			<div className="flex min-h-0 flex-1 flex-col px-7 pb-6 pt-6">
				<PageHeader title={t("page.shelf.title")} />
				<EmptySheet
					icon="icon-[lucide--library-big]"
					title={t("shelf.emptyTitle")}
					note={t("shelf.emptyBody")}
					action={
						<button
							type="button"
							onClick={onRevealTeam}
							className="mt-1 flex h-8 items-center gap-1.5 rounded-control border border-line-strong px-3 text-micro font-medium text-ink transition-colors hover:bg-raised"
						>
							<span className="icon-[lucide--panel-right-open] size-3" />
							{t("rail.revealTeam")}
						</button>
					}
				/>
			</div>
		);
	}

	const total = data.books.length;
	const writingCount = data.books.filter((entry) => entry.phase === "drafting" || entry.phase === "revising").length;
	const chapter = book.progress.currentChapter;
	const plan = book.plans.find((item) => item.n === chapter);
	const chapterRecord = book.chapters.find((item) => item.n === chapter);
	const arc = arcOf(book, chapter);
	const volume = book.volumes.find((item) => item.arcs.some((entry) => entry.id === arc?.id)) ?? null;
	const arcCommitted = arc
		? book.chapters.filter((item) => item.n >= arc.from && item.n <= arc.to && item.status === "committed").length
		: 0;
	const arcLength = arc ? arc.to - arc.from + 1 : 0;
	const others = data.books.filter((entry) => entry.id !== book.id).slice(0, 5);
	const rows = newestFirst(
		events.filter((event) => event.origin === "studio" && event.status !== "start"),
		4,
	);

	return (
		<div className="flex min-h-0 flex-1 flex-col px-7 pb-5 pt-6 @max-[720px]:px-4">
			<PageHeader
				title={t("page.shelf.title")}
				meta={
					<span className="text-body-sm text-ink-soft">
						{t("shelf.meta", { active: writingCount, total })}
					</span>
				}
			/>

			<div className="mt-4 flex min-h-0 flex-1 gap-4 @max-[880px]:flex-col @max-[880px]:overflow-y-auto">
				<section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-sheet bg-raised p-5 shadow-raise @max-[880px]:shrink-0">
					<div className="flex gap-5 @max-[700px]:gap-3">
						<button type="button" onClick={() => onNavigate("book")} className="relative shrink-0 text-left">
							<Cover {...coverSeed(book.title)} size="shelf" />
							<span className="absolute left-2 top-2 rounded-pill bg-cinnabar px-1.5 py-0.5 text-[9px] font-medium leading-[13px] text-cinnabar-foreground">
								{t("shelf.reading")}
							</span>
						</button>

						<div className="flex min-w-0 flex-1 flex-col">
							<div className="flex items-center gap-2">
								<button
									type="button"
									onClick={() => onNavigate("book")}
									className="truncate font-display text-display font-semibold text-ink"
								>
									{book.title}
								</button>
								<PhaseBadge phase={book.phase} />
							</div>
							<div className="mt-1 truncate text-body-sm text-ink-soft">
								{book.genre}
								{volume ? ` · ${volume.title}` : ""}
								{arc ? ` · ${t("shelf.arcCount", { count: arc.to - arc.from + 1 })}` : ""}
							</div>

							<div className="mt-4 rounded-panel bg-canvas p-3">
								<div className="flex items-baseline gap-2">
									<span className="text-micro-up font-semibold uppercase text-ink-faint">
										{t("shelf.nowWriting")}
									</span>
									<span className="min-w-0 truncate text-body-sm font-medium text-ink">
										{t("shelf.chapterLine", { chapter, title: chapterRecord?.title ?? t("board.untitled") })}
									</span>
									<span className="ml-auto flex shrink-0 items-center gap-1.5 text-[10px] text-cinnabar-ink">
										<span
											className={`size-1.5 rounded-pill ${writing ? "bg-cinnabar" : "border border-line-strong"}`}
										/>
										{writing
											? t("shelf.writingNow", {
													ago: t("time.seconds", {
														count: Math.max(0, Math.round((now - Date.parse(landed?.at ?? "")) / 1000)),
													}),
												})
											: t("brief.idle")}
									</span>
								</div>
								<p className="mt-1.5 line-clamp-2 text-micro leading-5 text-ink-soft">
									{plan?.goal ?? t("brief.empty")}
								</p>
								<div className="mt-2 flex items-center gap-2">
									<div className="h-[5px] flex-1 overflow-hidden rounded-pill bg-inset">
										<div
											className="h-full rounded-pill bg-cinnabar/70"
											style={{ width: `${percent(arcCommitted, arcLength)}%` }}
										/>
									</div>
									<span className="font-mono text-[10px] text-ink-faint">
										{t("shelf.arcProgress", { done: arcCommitted, total: arcLength })}
									</span>
								</div>
							</div>

							<div className="mt-auto flex flex-wrap items-end gap-x-6 gap-y-3 pt-4">
								<div>
									<div className="font-mono text-title tabular-nums leading-none text-ink">
										{committedCount(book)}
										<span className="text-body-sm text-ink-faint">
											{" "}
											/ {book.targetChapters}
										</span>
									</div>
									<div className="mt-1.5 text-[10px] text-ink-faint">
										{t("shelf.wordsLine", { words: wanWords(committedWords(book)) })}
									</div>
								</div>
								<div className="flex-1">
									<div className="h-[3px] overflow-hidden rounded-pill bg-inset">
										<div
											className="h-full rounded-pill bg-ink/70"
											style={{ width: `${percent(committedCount(book), book.targetChapters)}%` }}
										/>
									</div>
								</div>
								<div className="flex flex-wrap items-center gap-1.5">
									<button
										type="button"
										onClick={() => onNavigate("reader", chapter)}
										className="flex h-8 items-center gap-1.5 rounded-control border border-line px-3 text-micro text-ink transition-colors hover:bg-canvas"
									>
										<span className="icon-[lucide--book-open] size-3" />
										{t("shelf.continueAt", { chapter })}
									</button>
									<button
										type="button"
										onClick={() => onNavigate("ledger")}
										className="flex h-8 items-center gap-1.5 rounded-control border border-line px-3 text-micro text-ink transition-colors hover:bg-canvas"
									>
										<span className="icon-[lucide--git-branch] size-3" />
										{t("shelf.openLedger")}
									</button>
									<button
										type="button"
										onClick={() => onNavigate("console")}
										className="flex h-8 items-center gap-1.5 rounded-control bg-ink px-3 text-micro font-medium text-surface"
									>
										<span className="icon-[lucide--activity] size-3" />
										{t("shelf.openConsole")}
									</button>
								</div>
							</div>
						</div>
					</div>

					<div className="mt-5 flex min-h-0 flex-1 flex-col rounded-panel bg-inset/70 p-3">
						<div className="flex items-baseline gap-2">
							<span className="text-micro-up font-semibold uppercase text-ink-faint">
								{t("shelf.recent")}
							</span>
							<span className="text-[10px] text-ink-faint">{t("shelf.recentNote")}</span>
							<button
								type="button"
								onClick={onRevealTeam}
								className="ml-auto flex items-center gap-1 text-[10px] font-medium text-ink"
							>
								{t("rail.revealTeam")}
								<span className="icon-[lucide--arrow-up-right] size-3" />
							</button>
						</div>
						{rows.length === 0 ? (
							<p className="mt-3 text-[11px] leading-5 text-ink-soft">{t("shelf.liveEmpty")}</p>
						) : (
							<ul className="mt-2 min-h-0 flex-1 space-y-px overflow-y-auto">
								{rows.map((event) => (
									<li
										key={event.id}
										className="flex items-center gap-3 rounded-tile px-1.5 py-[7px] text-[11px]"
									>
										<span className="font-mono text-[10px] text-ink-faint">{clockOf(event.at)}</span>
										<span className="w-[132px] shrink-0 truncate font-mono text-[10px] text-ink-soft">
											{event.tool ?? event.origin}
										</span>
										<span className="truncate text-ink">{t(event.textKey, event.textParams)}</span>
									</li>
								))}
							</ul>
						)}
					</div>
				</section>

				<section className="flex min-h-0 w-[430px] shrink-0 flex-col overflow-hidden rounded-sheet bg-raised p-2 shadow-raise @max-[1100px]:w-[300px] @max-[880px]:w-full">
					<div className="flex items-baseline justify-between px-2 pb-2 pt-1.5">
						<span className="text-micro-up font-semibold uppercase text-ink-faint">
							{t("shelf.others", { count: others.length })}
						</span>
						<button
							type="button"
							onClick={() => onNavigate("library")}
							className="flex items-center gap-1 text-[10px] text-ink-soft transition-colors hover:text-ink"
						>
							{t("shelf.openCatalog")}
							<span className="icon-[lucide--arrow-right] size-3" />
						</button>
					</div>
					{others.length === 0 ? (
						<p className="px-2 py-3 text-[11px] text-ink-soft">{t("shelf.othersEmpty")}</p>
					) : (
						<ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
							{others.map((entry) => {
								const ago = elapsedSince(entry.updatedAt, now);
								return (
									<li key={entry.id} className="shrink-0">
										<button
											type="button"
											onClick={() => {
												data.selectBook(entry.id);
												onNavigate("book");
											}}
											className="flex min-h-[54px] w-full items-center gap-3 rounded-panel px-2 text-left transition-colors hover:bg-canvas"
										>
											<Cover {...coverSeed(entry.title)} size="mini" />
											<div className="min-w-0 flex-1">
												<div className="flex items-baseline gap-1.5">
													<span className="truncate font-display text-body-sm font-semibold text-ink">
														{entry.title}
													</span>
													<PhaseBadge phase={entry.phase} />
												</div>
												<div className="truncate text-[10px] text-ink-soft">
													{ago ? elapsedText(ago, t) : (entry.genre ?? t("board.untitled"))}
												</div>
												<div className="mt-1 flex items-center gap-2">
													<div className="h-[2px] flex-1 overflow-hidden rounded-pill bg-inset">
														<div
															className="h-full rounded-pill bg-ink/60"
															style={{ width: `${percent(entry.committedCount, entry.targetChapters)}%` }}
														/>
													</div>
													<span className="font-mono text-[9.5px] tabular-nums text-ink-faint">
														{entry.committedCount}/{entry.targetChapters}
													</span>
												</div>
											</div>
										</button>
									</li>
								);
							})}
						</ul>
					)}
					<div className="flex items-center gap-2 px-2 pb-1 pt-2 text-[10px] text-ink-faint">
						<span className={`size-1.5 rounded-pill ${chapterStateOf(chapterRecord?.status) === "committed" ? "bg-pass" : "bg-cinnabar"}`} />
						{t("shelf.footer", { chapter })}
					</div>
				</section>
			</div>
		</div>
	);
}

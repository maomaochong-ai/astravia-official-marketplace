import { useState } from "react";
import type { StudioState } from "../../hooks/use-studio-state";
import { useTranslator } from "../../hooks/use-translator";
import { useConsoleTimeline } from "../../console-timeline/use-console-timeline.js";
import type { WorkbenchPage } from "../../workbench-pages";
import {
	arcOf,
	chapterStateOf,
	committedFrontier,
	committedWords,
	elapsedSince,
	openThreadCount,
	percent,
	scoreOf,
	soonestOpenThread,
	wanWords,
} from "../../workbench-model";
import { isWriting } from "../../workbench-feed";
import { ChapterBrief } from "../shell/ChapterBrief";
import { ChapterMark } from "../shell/ChapterMark";
import { CHAPTER_STATES, PhaseBadge } from "../shell/PhaseBadge";
import { EmptySheet } from "../shell/EmptySheet";
import { PageHeader } from "../shell/PageHeader";

/** 弧刻度上每一格的颜色：与章节五态同一套。 */
const TICK_TONE: Record<string, string> = {
	committed: "bg-pass",
	reviewed: "bg-pass/40",
	drafting: "bg-cinnabar",
	planned: "bg-wash-strong",
	blocked: "bg-fail",
};

/**
 * 书页：当前章、弧进度、目录，一屏里全在。
 *
 * 左半边是「这一章要干什么」，右半边是「这本书写到哪」。中间那张章简报由章纲渲染，
 * 章纲由架构师在侧栏里落盘，这里只读；要动就去侧栏，页面不给按钮。
 *
 * **唯一的例外是删除。** 它只能放在这里：书库每一行整体是一个 `<button>`（点行就进书），
 * 行里再塞一枚删除键既不合语义也点不着；给书库加第七列又会把六列的预算挤爆。
 * 而删除必须能看得见——写坏的书也得有地方送走，所以进书页，报头右上二次确认。
 */
export function BookPage({
	data,
	onNavigate,
}: {
	data: StudioState;
	onNavigate: (page: WorkbenchPage, chapter?: number) => void;
}) {
	const t = useTranslator();
	const events = useConsoleTimeline();
	const now = Date.now();
	const [confirming, setConfirming] = useState(false);
	const [removing, setRemoving] = useState(false);
	const [removeError, setRemoveError] = useState<string | null>(null);

	const remove = async (bookId: string) => {
		setRemoving(true);
		setRemoveError(null);
		const result = await data.deleteBook(bookId);
		setRemoving(false);
		if (result.ok) {
			onNavigate("shelf");
			return;
		}
		setConfirming(false);
		setRemoveError(result.detail ?? result.error);
	};
	const book = data.book;

	if (!book) {
		return (
			<div className="mahua-page flex min-h-0 flex-1 flex-col">
				<PageHeader title={t("page.book.title")} back={{ label: t("book.back"), onBack: () => onNavigate("shelf") }} />
				<EmptySheet icon="icon-[solar--notebook-bold]" title={t("library.empty")} />
			</div>
		);
	}

	const chapter = book.progress.currentChapter;
	const plan = book.plans.find((item) => item.n === chapter);
	const record = book.chapters.find((item) => item.n === chapter);
	const arc = arcOf(book, chapter);
	const volume = book.volumes.find((item) => item.arcs.some((entry) => entry.id === arc?.id)) ?? null;
	const arcChapters = arc
		? Array.from({ length: arc.to - arc.from + 1 }, (_, index) => arc.from + index)
		: [];
	const arcCommitted = arcChapters.filter(
		(n) => book.chapters.find((item) => item.n === n)?.status === "committed",
	).length;
	const committedMax = committedFrontier(book);
	const threads = data.threads;
	const soonest = soonestOpenThread(threads, committedMax);
	const openCount = openThreadCount(threads);
	const writing = isWriting(events, now);
	const recent = [...book.checkpoints].slice(-5).reverse();

	return (
		<div className="mahua-page flex min-h-0 flex-1 flex-col">
			<PageHeader
					back={{ label: t("book.back"), onBack: () => onNavigate("shelf") }}
					title={book.title}
					meta={
						<span className="flex min-w-0 items-center gap-2 text-body-sm text-ink-soft">
							<PhaseBadge phase={book.phase} />
							<span className="min-w-0 truncate">
								{book.genre}
								{volume ? ` · ${volume.title}` : ""} · {t("book.indexCount", { count: book.chapters.length })} ·{" "}
								{t("book.wordsWan", { words: wanWords(committedWords(book)) })}
							</span>
						</span>
					}
					right={
						confirming ? (
							<div className="flex shrink-0 items-center gap-1.5">
								<span className="hidden min-w-0 truncate text-[10px] text-ink-faint @min-[760px]:inline">
									{t("book.deleteConfirm")}
								</span>
								<button
									type="button"
									onClick={() => setConfirming(false)}
									className="flex h-7 items-center rounded-control px-2.5 text-micro text-ink-soft transition-colors hover:bg-wash hover:text-ink"
								>
									{t("shelf.cancelNew")}
								</button>
								<button
									type="button"
									disabled={removing}
									onClick={() => void remove(book.id)}
									className="flex h-7 items-center rounded-control bg-fail-soft px-2.5 text-micro font-semibold text-fail transition-colors hover:bg-fail/12 disabled:opacity-60"
								>
									{removing ? t("book.deleting") : t("book.deleteRun")}
								</button>
							</div>
						) : (
							<button
								type="button"
								onClick={() => setConfirming(true)}
								title={t("book.deleteConfirm")}
								className="flex h-7 items-center gap-1.5 rounded-control bg-wash px-2.5 text-micro text-ink-soft transition-colors hover:bg-fail-soft hover:text-fail"
							>
								<span className="icon-[solar--trash-bin-trash-linear] size-3.5 shrink-0" />
								<span className="hidden whitespace-nowrap @min-[760px]:inline">{t("book.delete")}</span>
							</button>
						)
					}
				/>

			{removeError !== null && (
				<p className="mt-2 rounded-control bg-fail-soft px-3 py-2 text-[10px] leading-4 text-fail">
					{t("book.deleteFailed")} · {removeError}
				</p>
			)}

			<div className="mt-3 flex min-h-0 flex-1 gap-3 @max-[980px]:flex-col @max-[980px]:overflow-y-auto">
				<div className="flex min-h-0 min-w-0 flex-1 flex-col">

				<section className="mahua-card p-4">
					<div className="flex items-center gap-2">
						<span className="text-micro-up font-semibold uppercase text-ink-faint">
							{t("book.arcProgress")}
						</span>
						<span className="min-w-0 truncate text-micro text-ink">
							{arc ? `${arc.title} · ${arcCommitted} / ${arcChapters.length}` : t("book.arcGoalNone")}
						</span>
						<span className="ml-auto font-mono text-[10px] text-ink-faint">
							{arc ? t("book.arcRemain", { count: Math.max(0, arc.to - committedMax) }) : ""}
						</span>
					</div>

					<div className="mt-3 flex items-end gap-[3px]">
						{arcChapters.map((n) => {
							const state = chapterStateOf(book.chapters.find((item) => item.n === n)?.status);
							return (
								<button
									key={n}
									type="button"
									onClick={() => onNavigate("reader", n)}
									title={`${n}`}
									className={`h-6 flex-1 rounded-tile ${TICK_TONE[state] ?? "bg-wash-strong"}`}
								/>
							);
						})}
					</div>

					<div className="mt-2.5 flex items-center gap-3 text-[10px] text-ink-faint">
						{CHAPTER_STATES.map((state) => (
							<ChapterMark key={state} state={state} />
						))}
					</div>

					<p className="mt-3 rounded-control bg-well px-3 py-2 text-micro leading-5 text-ink-soft">
						{arc?.goal ?? t("book.arcGoalNone")}
					</p>
				</section>

				<div className="mt-3 min-h-0 flex-1 overflow-y-auto">
					<ChapterBrief
						number={chapter}
						arc={arc ? arc.title : t("book.arcGoalNone")}
						title={record?.title ?? t("book.briefNoTitle")}
						state={t(`status.${chapterStateOf(record?.status)}`)}
						goal={plan?.goal ?? ""}
						conflict={plan?.conflict ?? ""}
						hook={plan?.hook ?? ""}
						writing={writing}
						elapsed={record ? t("book.wordCount", { words: record.words }) : ""}
					/>

					<div className="mt-3 rounded-panel bg-well p-3">
						<div className="flex items-baseline gap-2">
							<span className="text-micro-up font-semibold uppercase text-ink-faint">
								{t("book.activity")}
							</span>
							<span className="text-[10px] text-ink-faint">
								{t("book.activityMeta", { count: recent.length })}
							</span>
						</div>
						{recent.length === 0 ? (
							<p className="mt-2 text-[11px] text-ink-soft">{t("book.activityEmpty")}</p>
						) : (
							<ul className="mt-2 space-y-px">
								{recent.map((checkpoint) => {
									const ago = elapsedSince(checkpoint.at, now);
									return (
										<li
											key={`${checkpoint.at}-${checkpoint.noteKey}`}
											className="flex items-center gap-3 text-[11px]"
										>
											<span className="w-[52px] shrink-0 font-mono text-[10px] text-ink-faint">
												{checkpoint.chapter}
											</span>
											<span className="min-w-0 flex-1 truncate text-ink">
												{t(checkpoint.noteKey, checkpoint.noteParams)}
											</span>
											<span className="ml-auto shrink-0 text-[10px] text-ink-faint">
												{ago ? t(ago.key, { count: ago.count }) : ""}
											</span>
										</li>
									);
								})}
							</ul>
						)}
					</div>
				</div>
			</div>
			<aside className="flex min-h-0 w-[366px] shrink-0 flex-col gap-3 @max-[1180px]:w-[300px] @max-[980px]:w-full @max-[980px]:shrink">
				<section className="mahua-card flex min-h-0 flex-1 flex-col overflow-hidden">
					<div className="flex items-baseline gap-2 px-4 pb-2 pt-3">
						<span className="text-micro-up font-semibold uppercase text-ink-faint">
							{t("book.index")}
						</span>
						<span className="ml-auto font-mono text-[10px] text-ink-faint">
							{percent(book.progress.committedCount, book.targetChapters)}%
						</span>
					</div>
					<div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
						{book.volumes.length === 0 ? (
							<p className="px-2 py-3 text-[11px] text-ink-soft">{t("book.noPlan")}</p>
						) : (
							book.volumes.map((entry, index) => (
								<div key={entry.id} className="mb-2">
									<div className="truncate px-2 py-1 text-[10px] font-semibold tracking-wide text-ink-soft">
										{t("book.volume", { index: index + 1 })} · {entry.title}
									</div>
									{entry.arcs.map((item) => {
										const chapters = Array.from(
											{ length: item.to - item.from + 1 },
											(_, offset) => item.from + offset,
										);
										return (
											<div key={item.id} className="mb-1">
												<div className="flex items-center gap-2 px-2 py-1">
													<span className="min-w-0 flex-1 truncate text-micro text-ink">{item.title}</span>
													<span className="ml-auto font-mono text-[9.5px] text-ink-faint">
														{item.from}–{item.to}
													</span>
												</div>
												<ul>
													{chapters.map((n) => {
														const chapterRecord = book.chapters.find((row) => row.n === n);
														const state = chapterStateOf(chapterRecord?.status);
														const score = scoreOf(chapterRecord);
														return (
															<li key={n}>
																<button
																	type="button"
																	onClick={() => onNavigate("reader", n)}
																className={`flex h-7 w-full items-center gap-2 rounded-control px-2 text-left text-[11px] transition-colors hover:bg-wash ${
																	n === chapter ? "bg-cinnabar-soft text-cinnabar-ink" : "text-ink"
																}`}
																>
																	<span className="w-5 shrink-0 font-mono text-[10px] text-ink-faint">{n}</span>
																	<span className="min-w-0 flex-1 truncate">
																		{chapterRecord?.title ?? t("book.briefNoTitle")}
																	</span>
																	{score !== null && (
																		<span className="shrink-0 font-mono text-[10px] text-ink-soft">
																			{score}
																		</span>
																	)}
																	<span
																		className={`size-1.5 shrink-0 rounded-pill ${
																			state === "committed"
																				? "bg-pass"
																				: state === "reviewed"
																					? "border border-pass bg-pass-soft"
																					: state === "drafting"
																						? "bg-cinnabar"
																						: state === "blocked"
																							? "bg-fail"
																							: "border border-line-strong"
																		}`}
																	/>
																</button>
															</li>
														);
													})}
												</ul>
											</div>
										);
									})}
								</div>
							))
						)}
					</div>
				</section>

				<button
					type="button"
					onClick={() => onNavigate("ledger")}
					className="flex items-start gap-2 rounded-panel bg-well px-3 py-2.5 text-left transition-colors hover:bg-wash-strong"
				>
					<span className="icon-[solar--branching-paths-up-linear] mt-0.5 size-3 shrink-0 text-ink-faint" />
					<span className="min-w-0 flex-1 text-[11px] leading-5 text-ink-soft">
						{openCount === 0
							? t("book.threadsNone")
							: t("book.threadsOpen", {
									count: openCount,
									...(soonest ? { chapter: soonest.dueIn } : {}),
								})}
					</span>
					<span className="icon-[solar--alt-arrow-right-bold] mt-1 size-3 shrink-0 text-ink-faint" />
				</button>
				</aside>
			</div>
		</div>
	);
}

import { useState } from "react";
import type { StudioState } from "../../hooks/use-studio-state";
import { useTranslator } from "../../hooks/use-translator";
import { clearConsoleTimeline, useConsoleTimeline } from "../../console-timeline/use-console-timeline.js";
import { STUDIO_MEMBERS } from "../../../../studio-members.js";
import type { WorkbenchPage } from "../../workbench-pages";
import { chapterStateOf, committedCount, committedWords, formatCount, percent, wanWords } from "../../workbench-model";
import { clockOf, lastEvent, modelOf, newestFirst } from "../../workbench-feed";
import { EmptySheet } from "../shell/EmptySheet";
import { PageHeader } from "../shell/PageHeader";
import { PhaseBadge } from "../shell/PhaseBadge";

type FeedFilter = "all" | "tool" | "review";

/** 章节五态在脊柱上的颜色：与书架、目录同一套。 */
const SPINE_TONE: Record<string, string> = {
	committed: "bg-pass",
	reviewed: "bg-pass/40",
	drafting: "bg-cinnabar",
	planned: "bg-line",
	blocked: "bg-fail",
};

const STATUS_TONE: Record<string, string> = {
	start: "text-ink-faint",
	done: "text-pass",
	failed: "text-fail",
};

/**
 * 运行台：团队在侧栏里写，这里只读。
 *
 * 中栏是**宿主真的发过来的**工具事件：哪个工具、跑没跑通、用了多久、用的哪个模型。
 * 上下文占用与 token 用量不在这里——插件层拿不到，宁可不显示也不编。
 * 左栏的章序和右栏的概览都来自落盘的书，不来自事件流。
 */
export function ConsolePage({
	data,
	onNavigate,
}: {
	data: StudioState;
	onNavigate: (page: WorkbenchPage, chapter?: number) => void;
}) {
	const t = useTranslator();
	const events = useConsoleTimeline();
	const [filter, setFilter] = useState<FeedFilter>("all");
	const book = data.book;
	const latest = lastEvent(events);
	const model = modelOf(events);

	const visible = newestFirst(
		events.filter((event) => {
			if (filter === "all") return true;
			if (filter === "review") return event.origin === "studio" && event.textKey === "feed.tool.saveReview";
			return event.origin !== "agent";
		}),
	);

	const chapter = book?.progress.currentChapter ?? 0;
	const record = book?.chapters.find((item) => item.n === chapter);
	const arc = book?.volumes.flatMap((volume) => volume.arcs).find((item) => chapter >= item.from && chapter <= item.to);

	return (
		<div className="mahua-page flex min-h-0 flex-1 flex-col">
			<PageHeader
				title={t("page.console.title")}
				meta={
					<span className="min-w-0 truncate text-body-sm text-ink-soft">
						{book ? `${book.title} · ${book.genre}` : t("console.noBook")}
					</span>
				}
				right={
					<div className="flex items-center gap-2">
						{model && (
							<span className="flex h-6 items-center gap-1.5 rounded-pill bg-well px-2 font-mono text-[10px] text-ink-soft">
								<span className="icon-[solar--cpu-bolt-linear] size-3" />
								{model}
							</span>
						)}
						<span className="flex h-6 items-center gap-1.5 rounded-pill bg-raised px-2 text-[10px] text-ink-soft shadow-raise">
							<span className={`size-1.5 rounded-pill ${events.length > 0 ? "bg-pass" : "bg-ink-faint"}`} />
							{t("console.live", { count: events.length })}
						</span>
					</div>
				}
			/>

			<div className="mt-3 flex min-h-0 flex-1 gap-3">
				<aside className="flex min-h-0 w-[236px] shrink-0 flex-col overflow-hidden rounded-sheet bg-well @max-[1100px]:w-[188px] @max-[900px]:hidden">
					<div className="px-3 pb-1 pt-2.5">
						<div className="text-micro-up font-semibold uppercase text-ink-faint">
							{t("console.spine")}
						</div>
					</div>
					<div className="min-h-0 flex-1 overflow-y-auto px-2 py-1.5">
						{!book || book.chapters.length === 0 ? (
							<p className="px-1 py-2 text-[11px] leading-5 text-ink-soft">{t("console.spineEmpty")}</p>
						) : (
							book.volumes.map((volume, index) => (
								<div key={volume.id} className="mb-1.5">
									<div className="truncate px-1 py-1 text-[10px] font-semibold tracking-wide text-ink-soft">
										{t("book.volume", { index: index + 1 })} · {volume.title}
									</div>
									{volume.arcs.map((item) => (
										<div key={item.id} className="mb-1">
											<div className="truncate px-1 text-[9.5px] text-ink-faint">
												{item.title} · {item.from}–{item.to}
											</div>
											<ul className="mt-0.5">
												{Array.from({ length: item.to - item.from + 1 }, (_, offset) => item.from + offset).map(
													(n) => {
														const row = book.chapters.find((entry) => entry.n === n);
														const state = chapterStateOf(row?.status);
														return (
															<li key={n}>
																<button
																	type="button"
																	onClick={() => onNavigate("reader", n)}
																	className={`flex h-5 w-full items-center gap-1.5 rounded-tile px-1 text-left text-[10px] ${
																n === chapter ? "bg-cinnabar-soft text-cinnabar-ink" : "text-ink-soft hover:bg-wash"
																	}`}
																>
																	<span className={`size-1 shrink-0 rounded-pill ${SPINE_TONE[state]}`} />
																	<span className="w-4 shrink-0 text-right font-mono">{n}</span>
																	<span className="min-w-0 flex-1 truncate">
																		{row?.title ?? t("board.untitled")}
																	</span>
																	{row?.words ? (
																		<span className="shrink-0 font-mono text-[9px] text-ink-faint">
																			{formatCount(row.words)}
																		</span>
																	) : null}
																</button>
															</li>
														);
													},
												)}
											</ul>
										</div>
									))}
								</div>
							))
						)}
					</div>
					<p className="px-3 py-2 text-[10px] leading-4 text-ink-faint">
						{t("console.spineNote")}
					</p>
				</aside>

				<section className="mahua-card flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
					<div className="flex items-center gap-1 px-3 pb-2 pt-2.5">
						<span className="text-micro-up font-semibold uppercase text-ink-faint">
							{t("console.feed")}
						</span>
						<div className="ml-3 flex items-center gap-0.5">
							{(["all", "tool", "review"] as const).map((key) => (
								<button
									key={key}
									type="button"
									onClick={() => setFilter(key)}
									className={`h-6 rounded-control px-2 text-[10px] ${
										filter === key ? "bg-raised font-semibold text-ink shadow-raise" : "text-ink-soft hover:bg-wash"
									}`}
								>
									{t(`console.filter.${key}`)}
								</button>
							))}
						</div>
						<span className="ml-auto flex items-center gap-1.5 font-mono text-[10px] text-ink-faint">
							<span
								className={`size-1.5 rounded-pill ${latest && latest.status !== "failed" ? "bg-cinnabar" : "bg-line-strong"}`}
							/>
							{latest ? clockOf(latest.at) : "--:--:--"}
						</span>
						<button
							type="button"
							onClick={clearConsoleTimeline}
							className="ml-2 h-6 rounded-control bg-well px-2 text-[10px] text-ink-soft transition-colors hover:bg-wash-strong"
						>
							{t("console.feedClear")}
						</button>
					</div>

					{visible.length === 0 ? (
						<div className="flex min-h-0 flex-1 p-4">
							<EmptySheet icon="icon-[solar--pulse-bold]" title={t("console.feedEmpty")} />
						</div>
					) : (
						<ul className="mahua-scroll min-h-0 flex-1 space-y-px overflow-y-auto px-2 pb-2">
							{visible.map((event) => (
								<li
									key={event.id}
									className="flex items-start gap-2.5 rounded-tile px-1 py-[7px] text-[11px]"
								>
									<span className="w-[54px] shrink-0 font-mono text-[10px] text-ink-faint">
										{clockOf(event.at)}
									</span>
									<span
										className={`mt-0.5 size-1.5 shrink-0 rounded-pill ${
											event.status === "failed" ? "bg-fail" : event.status === "start" ? "bg-ink-faint" : "bg-pass"
										}`}
									/>
									<span className="w-[150px] shrink-0 truncate font-mono text-[10px] text-ink-soft">
										{event.tool ?? t(`console.origin.${event.origin}`)}
									</span>
									<span className="min-w-0 flex-1">
										<span className="text-ink">{t(event.textKey, event.textParams)}</span>
										{event.detail && (
											<span className="mt-0.5 block truncate font-mono text-[10px] text-fail">
												{event.detail}
											</span>
										)}
									</span>
									<span className={`shrink-0 font-mono text-[10px] ${STATUS_TONE[event.status]}`}>
										{event.ms === undefined ? t(`feed.status.${event.status}`) : `${event.ms}ms`}
									</span>
								</li>
							))}
						</ul>
					)}

					<div className="mx-2 mb-2 rounded-control bg-well px-3 py-2 text-[10px] leading-4 text-ink-soft">
						{t("console.readOnly")} {t("console.feedNote")}
					</div>
				</section>

				<aside className="flex min-h-0 w-[288px] shrink-0 flex-col gap-3 overflow-y-auto rounded-sheet bg-well p-3 @max-[1180px]:hidden">
					<section className="rounded-panel bg-raised p-3 shadow-raise">
						<div className="text-micro-up font-semibold uppercase text-ink-faint">
							{t("console.overview")}
						</div>
						<dl className="mt-2 grid grid-cols-[64px_1fr] gap-y-1 text-[11px]">
							<dt className="text-ink-faint">{t("console.field.phase")}</dt>
							<dd>{book ? <PhaseBadge phase={book.phase} /> : "—"}</dd>
							<dt className="text-ink-faint">{t("console.field.chapter")}</dt>
							<dd className="truncate text-ink">
								{chapter > 0 ? `${chapter} · ${record?.title ?? t("board.untitled")}` : "—"}
							</dd>
							<dt className="text-ink-faint">{t("console.field.arc")}</dt>
							<dd className="truncate text-ink">{arc?.title ?? t("book.arcGoalNone")}</dd>
							<dt className="text-ink-faint">{t("console.field.committed")}</dt>
							<dd className="font-mono text-ink">
								{book ? `${committedCount(book)} / ${book.targetChapters}` : "—"}
							</dd>
							<dt className="text-ink-faint">{t("console.field.words")}</dt>
							<dd className="font-mono text-ink">{book ? wanWords(committedWords(book)) : "—"}</dd>
							<dt className="text-ink-faint">{t("console.field.progress")}</dt>
							<dd className="flex items-center gap-2">
								<span className="h-[3px] flex-1 overflow-hidden rounded-pill bg-wash-strong">
									<span
										className="block h-full rounded-pill bg-ink/60"
										style={{
											width: `${book ? percent(book.progress.committedCount, book.targetChapters) : 0}%`,
										}}
									/>
								</span>
								<span className="w-7 shrink-0 text-right font-mono text-[10px] text-ink-faint">
									{book ? percent(book.progress.committedCount, book.targetChapters) : 0}%
								</span>
							</dd>
						</dl>
					</section>

					<section className="rounded-panel bg-raised p-3 shadow-raise">
						<div className="text-micro-up font-semibold uppercase text-ink-faint">
							{t("console.team")}
						</div>
						<ul className="mt-2 space-y-1.5">
							{STUDIO_MEMBERS.map((member) => (
								<li key={member.agentId} className="flex items-center gap-2">
									<span className="flex size-5 shrink-0 items-center justify-center rounded-tile bg-well font-mono text-[9px] text-ink-soft">
										{member.lead ? t("console.lead") : ""}
									</span>
									<span className="min-w-0 flex-1">
										<span className="block truncate text-[11px] text-ink">{t(member.nameKey)}</span>
										<span className="block truncate text-[10px] text-ink-faint">{t(member.dutyKey)}</span>
									</span>
								</li>
							))}
						</ul>
					</section>

					<section className="rounded-panel bg-raised p-3 shadow-raise">
						<div className="text-micro-up font-semibold uppercase text-ink-faint">
							{t("console.review")}
						</div>
						{data.review ? (
							<div className="mt-1.5">
								<div className="flex items-baseline gap-2">
									<span className="font-mono text-heading tabular-nums text-ink">{data.review.score}</span>
									<span className="text-[10px] text-ink-faint">
										{t("console.reviewMeta", {
											chapter: data.review.chapter,
											mustFix: data.review.mustFix.length,
										})}
									</span>
								</div>
								<p className="mt-1 text-[10px] leading-4 text-ink-soft">
									{t("reader.mustFix")}: {data.review.mustFix.length}
								</p>
							</div>
						) : (
							<p className="mt-1.5 text-[11px] text-ink-soft">{t("console.reviewEmpty")}</p>
						)}
					</section>

					<section className="rounded-panel bg-raised p-3 shadow-raise">
						<div className="text-micro-up font-semibold uppercase text-ink-faint">
							{t("console.checkpoints")}
						</div>
						{book && book.checkpoints.length > 0 ? (
							<ul className="mt-1.5 space-y-1">
								{[...book.checkpoints].slice(-3).reverse().map((checkpoint) => (
									<li
										key={`${checkpoint.at}-${checkpoint.noteKey}`}
										className="flex items-center gap-2 text-[10px]"
									>
										<span className="font-mono text-ink-faint">{clockOf(checkpoint.at)}</span>
										<span className="min-w-0 flex-1 truncate text-ink-soft">
											{t(checkpoint.noteKey, checkpoint.noteParams)}
										</span>
									</li>
								))}
							</ul>
						) : (
							<p className="mt-1.5 text-[11px] text-ink-soft">{t("console.checkpointsEmpty")}</p>
						)}
						<p className="mt-2 truncate pt-1.5 font-mono text-[9.5px] text-ink-faint">
							{t("console.storePath")}
						</p>
					</section>
				</aside>
			</div>
		</div>
	);
}

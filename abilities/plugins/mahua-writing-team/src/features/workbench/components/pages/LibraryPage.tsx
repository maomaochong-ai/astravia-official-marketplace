import { useMemo, useState } from "react";
import type { StudioState } from "../../hooks/use-studio-state";
import { useTranslator } from "../../hooks/use-translator";
import type { WorkbenchPage } from "../../workbench-pages";
import { useConsoleTimeline } from "../../console-timeline/use-console-timeline";
import { isWriting, lastLandedStudioEvent } from "../../workbench-feed";
import { coverSeed, elapsedSince, formatCount, percent, wanWords } from "../../workbench-model";
import { Cover } from "../shell/Cover";
import { EmptySheet } from "../shell/EmptySheet";
import { PageHeader } from "../shell/PageHeader";
import { PhaseBadge } from "../shell/PhaseBadge";

const PAGE_SIZE = 9;

/** 六列表头：书名 / 题材·篇幅 / 阶段 / 章·进度 / 字数 / 更新。 */
const COLUMNS = "grid-cols-[1fr_150px_74px_196px_78px_88px]";

// 与 `NovelPhase` 同序：落库的阶段一个都不能漏，否则筛选带会对某些书静默失灵
// （`arc_close` 曾经漏在这里）。
const PHASES = ["briefing", "planning", "drafting", "revising", "arc_close", "completed"] as const;

type SizeKey = "long" | "medium" | "short";
type SortKey = "recent" | "chapters" | "title";

/**
 * 篇幅按**计划章数**分档，不按已写字数：一本 40 章的新书刚立项时字数是 0，
 * 按字数会被算成短篇。计划章数是它立项时定下的承诺，也是用户心里的那件事。
 */
function sizeOf(targetChapters: number): SizeKey {
	if (targetChapters >= 50) return "long";
	if (targetChapters >= 20) return "medium";
	return "short";
}

const SIZES: readonly SizeKey[] = ["long", "medium", "short"];

/**
 * 书库：一条筛选带，一张满宽台账。
 *
 * 曾经的版本把题材与状态摆成左侧一栏，结果书的列只剩 700px，标题与简介挤成两行。
 * 这里照设计稿换过来：三个维度横着排进一条 40px 的带子，台账吃满整个宽度，
 * 一本书一行 56px，扫一眼就能比出「哪本快收尾、哪本刚起步」。
 *
 * 筛选与排序都是本页的瞬时状态——工作台不改任何书的事实，只改「现在看哪几本」。
 * 因此这里没有成书、也没有编辑入口：一行只是一个通往书页的门。
 */
export function LibraryPage({
	data,
	onNavigate,
}: {
	data: StudioState;
	onNavigate: (page: WorkbenchPage, chapter?: number) => void;
}) {
	const t = useTranslator();
	const now = Date.now();
	const events = useConsoleTimeline();
	const [genre, setGenre] = useState<string | null>(null);
	const [phase, setPhase] = useState<string | null>(null);
	const [size, setSize] = useState<SizeKey | null>(null);
	const [sort, setSort] = useState<SortKey>("recent");
	const [page, setPage] = useState(0);

	const landed = lastLandedStudioEvent(events);
	const writing = landed && isWriting(events, now) ? landed : null;

	const genres = useMemo(() => {
		const seen = new Map<string, number>();
		for (const entry of data.books) {
			const key = (entry.genre ?? "").trim();
			if (key.length > 0) seen.set(key, (seen.get(key) ?? 0) + 1);
		}
		return [...seen.entries()].sort((a, b) => b[1] - a[1]);
	}, [data.books]);

	const sizeCounts = useMemo(() => {
		const counts: Record<SizeKey, number> = { long: 0, medium: 0, short: 0 };
		for (const entry of data.books) counts[sizeOf(entry.targetChapters)] += 1;
		return counts;
	}, [data.books]);

	const filtered = useMemo(() => {
		const rows = data.books.filter((entry) => {
			if (genre !== null && (entry.genre ?? "").trim() !== genre) return false;
			if (phase !== null && entry.phase !== phase) return false;
			if (size !== null && sizeOf(entry.targetChapters) !== size) return false;
			return true;
		});
		return [...rows].sort((a, b) => {
			if (sort === "title") return a.title.localeCompare(b.title);
			if (sort === "chapters") return b.committedCount - a.committedCount;
			return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
		});
	}, [data.books, genre, phase, size, sort]);

	const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
	const current = Math.min(page, pages - 1);
	const rows = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);
	const words = filtered.reduce((sum, entry) => sum + (entry.words ?? 0), 0);

	const pick = (next: () => void) => {
		setPage(0);
		next();
	};

	const chip = (active: boolean, variant: "ink" | "inset" = "inset") =>
		`flex h-6 shrink-0 items-center gap-1 rounded-pill px-2 text-[10px] transition-colors ${
			active
				? variant === "ink"
					? "bg-ink font-medium text-surface"
					: "bg-inset font-medium text-ink"
				: "text-ink-soft hover:bg-inset/70"
		}`;

	return (
		<div className="flex min-h-0 flex-1 flex-col px-7 pb-5 pt-6 @max-[720px]:px-4">
			<PageHeader
				back={{ label: t("library.back"), onBack: () => onNavigate("shelf") }}
				title={t("page.library.title")}
				meta={
					<span className="text-body-sm text-ink-soft">
						{t("library.meta", { count: filtered.length, words: wanWords(words) })}
					</span>
				}
			/>

			{/* 一条筛选带：题材 / 状态 / 篇幅 横着排，排序钉在右端；不占地，不另开一栏 */}
			<div className="mt-4 flex h-10 shrink-0 items-center gap-2 overflow-hidden rounded-control border border-line bg-raised px-3">
				<span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
					{t("library.filter.genre")}
				</span>
				<button type="button" onClick={() => pick(() => setGenre(null))} className={chip(genre === null, "ink")}>
					{t("library.all")}
					<span className={`font-mono ${genre === null ? "text-surface/60" : "text-ink-faint"}`}>
						{data.books.length}
					</span>
				</button>
				{genres.map(([name, count]) => (
					<button
						key={name}
						type="button"
						onClick={() => pick(() => setGenre(genre === name ? null : name))}
						className={chip(genre === name, "ink")}
					>
						<span className="max-w-[96px] truncate">{name}</span>
						<span className={`font-mono ${genre === name ? "text-surface/60" : "text-ink-faint"}`}>{count}</span>
					</button>
				))}

				<span className="h-3.5 w-px shrink-0 bg-line" />
				<span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
					{t("library.filter.status")}
				</span>
				{PHASES.map((name) => (
					<button
						key={name}
						type="button"
						onClick={() => pick(() => setPhase(phase === name ? null : name))}
						className={chip(phase === name)}
					>
						{t(`phase.${name}`)}
						<span className="font-mono text-ink-faint">
							{data.books.filter((entry) => entry.phase === name).length}
						</span>
					</button>
				))}

				<span className="h-3.5 w-px shrink-0 bg-line" />
				<span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
					{t("library.filter.length")}
				</span>
				{SIZES.map((key) => (
					<button
						key={key}
						type="button"
						onClick={() => pick(() => setSize(size === key ? null : key))}
						className={chip(size === key)}
					>
						{t(`library.size.${key}`)}
						<span className="font-mono text-ink-faint">{sizeCounts[key]}</span>
					</button>
				))}

				<label className="ml-auto flex h-6 shrink-0 items-center gap-1.5 rounded-control bg-inset px-2 text-[10px] text-ink">
					<span className="icon-[lucide--arrow-down-up] size-3" />
					<select
						value={sort}
						onChange={(event) => pick(() => setSort(event.target.value as SortKey))}
						aria-label={t("library.filter.sort")}
						className="cursor-pointer appearance-none bg-transparent pr-3 outline-none"
					>
						<option value="recent">{t("library.sort.recent")}</option>
						<option value="chapters">{t("library.sort.chapters")}</option>
						<option value="title">{t("library.sort.title")}</option>
					</select>
					<span className="icon-[lucide--chevron-down] size-3 text-ink-faint" />
				</label>
			</div>

			{/* 满宽台账：卡头只读提示，表头钉住，行内部滚，卡尾页码 */}
			<section className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-control border border-line bg-raised">
				<div className="flex shrink-0 items-center gap-2 border-b border-line-soft px-3.5 py-2">
					{writing ? (
						<>
							<span className="size-1.5 shrink-0 rounded-pill bg-cinnabar" />
							<span className="truncate text-micro text-ink">
								{t("library.ledgerWriting", { chapter: writing.chapter ?? 0 })}
							</span>
						</>
					) : (
						<span className="truncate text-micro text-ink-faint">{t("library.ledgerIdle")}</span>
					)}
					<span className="ml-auto shrink-0 text-[10px] text-ink-faint">{t("library.ledgerNote")}</span>
				</div>

				<div className="min-h-0 flex-1 overflow-x-auto">
					<div className="flex h-full min-w-[820px] flex-col">
						<div
							className={`grid ${COLUMNS} shrink-0 items-center gap-3 border-b border-line-soft px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-faint`}
						>
							<span>{t("library.column.book")}</span>
							<span>{t("library.column.genreLength")}</span>
							<span>{t("library.column.stage")}</span>
							<span>{t("library.column.chapters")}</span>
							<span className="text-right">{t("library.column.words")}</span>
							<span className="text-right">{t("library.column.updated")}</span>
						</div>

						{rows.length === 0 ? (
							<div className="flex min-h-0 flex-1 items-start pt-4">
								<EmptySheet icon="icon-[lucide--layers]" title={t("library.empty")} />
							</div>
						) : (
							<ul className="mahua-scroll min-h-0 flex-1 divide-y divide-line-soft overflow-y-auto px-2">
								{rows.map((entry) => {
									const ago = elapsedSince(entry.updatedAt, now);
									const done = percent(entry.committedCount, entry.targetChapters);
									return (
										<li key={entry.id} className="h-14">
											<button
												type="button"
												onClick={() => {
													data.selectBook(entry.id);
													onNavigate("book");
												}}
												className={`group grid h-full w-full ${COLUMNS} items-center gap-3 rounded-control px-2 text-left transition-colors hover:bg-inset/60`}
											>
												<span className="flex min-w-0 items-center gap-2.5">
													<Cover {...coverSeed(entry.title)} size="thumb" />
													<span className="min-w-0">
														<span className="block truncate font-display text-body-sm font-semibold text-ink">
															{entry.title}
														</span>
														<span className="flex items-center gap-1 truncate text-[10px] text-ink-faint">
															<span className="icon-[lucide--arrow-up-right] size-2.5" />
															{t("library.open")}
														</span>
													</span>
												</span>
												<span className="truncate text-micro text-ink-soft">
													{entry.genre ?? t("library.card.noGenre")}
													<span className="text-line-strong"> · </span>
													{t(`library.size.${sizeOf(entry.targetChapters)}`)}
												</span>
												<span>
													<PhaseBadge phase={entry.phase} />
												</span>
												<span className="flex items-center gap-2.5">
													<span className="w-[46px] shrink-0 font-mono text-[11px] tabular-nums text-ink">
														{entry.committedCount}
														<span className="text-ink-faint">/{entry.targetChapters}</span>
													</span>
													<span className="h-[3px] min-w-0 flex-1 overflow-hidden rounded-pill bg-inset">
														<span className="block h-full rounded-pill bg-ink/60" style={{ width: `${done}%` }} />
													</span>
													<span className="w-[30px] shrink-0 text-right font-mono text-[10px] tabular-nums text-ink-faint">
														{done}%
													</span>
												</span>
												<span className="text-right font-mono text-[11px] tabular-nums text-ink-soft">
													{entry.words ? formatCount(entry.words) : "—"}
												</span>
												<span className="text-right text-[10px] text-ink-faint">
													{ago ? t(ago.key, { count: ago.count }) : "—"}
												</span>
											</button>
										</li>
									);
								})}
							</ul>
						)}
					</div>
				</div>

				<div className="flex shrink-0 items-center gap-3 border-t border-line px-4 py-2.5 text-micro text-ink-soft">
					<div className="flex items-center gap-1">
						<button
							type="button"
							onClick={() => setPage(Math.max(0, current - 1))}
							disabled={current === 0}
							aria-label={t("library.prev")}
							className="flex size-6 items-center justify-center rounded-control text-ink-faint hover:bg-inset hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent"
						>
							<span className="icon-[lucide--chevron-left] size-3.5" />
						</button>
						<span className="font-mono tabular-nums">{t("library.page", { page: current + 1, pages })}</span>
						<button
							type="button"
							onClick={() => setPage(Math.min(pages - 1, current + 1))}
							disabled={current >= pages - 1}
							aria-label={t("library.next")}
							className="flex size-6 items-center justify-center rounded-control text-ink-faint hover:bg-inset hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent"
						>
							<span className="icon-[lucide--chevron-right] size-3.5" />
						</button>
					</div>
					<span className="ml-auto text-[10px] text-ink-faint">{t("library.footer", { size: PAGE_SIZE })}</span>
				</div>
			</section>
		</div>
	);
}

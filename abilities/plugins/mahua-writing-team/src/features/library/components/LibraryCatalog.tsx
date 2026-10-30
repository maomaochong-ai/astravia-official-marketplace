import { useTranslation } from "@astravia-org/plugin-sdk";
import { useMemo, useState } from "react";

import type { BookIndexEntry } from "../../../repository/manuscript-repository.js";
import { MeterBar } from "../../shared/components/MeterBar.js";
import { PageBar, PAGE_META, PAGE_TITLE } from "../../shared/components/PageBar.js";
import { PhaseBadge } from "../../shared/components/PhaseBadge.js";
import { dateOf, progressPercent } from "../bookshelf-model.js";
import {
	DEFAULT_QUERY,
	LIBRARY_PAGE_SIZE,
	genreOptions,
	paginate,
	selectBooks,
	type LengthBucket,
	type LibraryQuery,
	type LibrarySort,
	type LibraryStatus,
} from "../library-model.js";
import { BookCover } from "./BookCover.js";
import { LibraryFilterRow } from "./LibraryFilterRow.js";

interface LibraryCatalogProps {
	books: BookIndexEntry[];
	onOpen: (bookId: string) => void;
	onBack: () => void;
}

const STATUSES: { value: LibraryStatus; key: string }[] = [
	{ value: "active", key: "library.status.active" },
	{ value: "completed", key: "library.status.completed" },
];

const LENGTHS: { value: LengthBucket; key: string }[] = [
	{ value: "under10k", key: "library.length.under10k" },
	{ value: "10kTo50k", key: "library.length.10kTo50k" },
	{ value: "50kTo200k", key: "library.length.50kTo200k" },
	{ value: "over200k", key: "library.length.over200k" },
];

const SORTS: { value: LibrarySort; key: string }[] = [
	{ value: "recent", key: "library.sort.recent" },
	{ value: "chapters", key: "library.sort.chapters" },
	{ value: "title", key: "library.sort.title" },
];

/**
 * 台账的列网格（设计稿 `library` 帧的 `grid-cols-[1fr_86px_68px_88px_104px_108px]`）。
 *
 * 标签页可能只有 400px：六列硬塞进来每列只剩三十几像素，书名会被截成三个字。
 * 所以列随宽度增开——两列（书名 + 进度）→ 四列（+ 章数、更新）→ 六列（+ 阶段、字数）。
 * 收起的是**列**，书名与「进得去」这件事永远在。
 */
const GRID =
	"grid items-center gap-x-3 grid-cols-[1fr_64px] min-[620px]:grid-cols-[1fr_60px_76px_88px] min-[880px]:grid-cols-[1fr_64px_56px_72px_80px_88px]";
const COL_STAGE = "hidden min-[880px]:block";
const COL_CHAPTERS = "hidden min-[620px]:block text-right";
const COL_WORDS = "hidden min-[880px]:block text-right";
const COL_UPDATED = "hidden min-[620px]:block text-right";


const CARD = "rounded-[18px] bg-card shadow-xs";

/**
 * 书库页（ADR 0020 §1 / 0026 §2 / 0027 §7）。
 *
 * 设计稿是「左 188px 条件栏 + 六列台账 + 一条页脚」：条件选中是深底白字，
 * 台账行是 64px 高的纸行、书名带微缩封面，页脚把「第几页 / 共几页」与每页容量一起写清。
 *
 * 条件栏在 `min-[880px]` 才独立成栏，其余宽度落到列表上方；页内仍然没有搜索框——
 * 宿主的对话就是搜索入口（ADR 0011 §2.4）。筛选、排序、分页都在 `library-model.ts` 里，
 * 本组件只持有当前查询与页码。
 */
export function LibraryCatalog({ books, onOpen, onBack }: LibraryCatalogProps) {
	const { t } = useTranslation();
	const [query, setQuery] = useState<LibraryQuery>(DEFAULT_QUERY);

	const genres = useMemo(() => genreOptions(books), [books]);
	const page = useMemo(() => paginate(selectBooks(books, query), query.page), [books, query]);

	// 改条件就回到第一页：否则「筛完只剩 2 页却停在第 5 页」会让空结果看起来像 bug。
	// 翻页走 goPage——它不能顺手把 page 重置成 1，否则按钮点了等于没点。
	const update = (patch: Partial<LibraryQuery>) => setQuery((current) => ({ ...current, ...patch, page: 1 }));
	const goPage = (next: number) => setQuery((current) => ({ ...current, page: next }));

	return (
		<div className="flex h-full min-h-0 flex-col">
			<PageBar back={{ label: t("library.back"), onClick: onBack }}>
				<h1 className={PAGE_TITLE}>{t("library.title")}</h1>
				<p className={PAGE_META}>
					<span className="tabular-nums">{t("library.count", { count: page.total })}</span>
					<span aria-hidden="true">·</span>
					<span className="tabular-nums">{t("library.page", { page: page.page, pages: page.pages })}</span>
				</p>
			</PageBar>

			<div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
				<div className="flex flex-col gap-3 min-[880px]:flex-row min-[880px]:items-start">
					<aside className="flex w-full shrink-0 flex-col gap-2.5 min-[880px]:w-[176px]">
						<section className={`${CARD} flex flex-col gap-2.5 p-2.5`}>
							<LibraryFilterRow
								label={t("library.filter.genre")}
								value={query.genre}
								onSelect={(genre) => update({ genre })}
								options={[
									{ value: "all", label: "" },
									...genres.map((genre) => ({ value: genre, label: genre })),
								]}
							/>
							<LibraryFilterRow
								label={t("library.filter.status")}
								value={query.status}
								onSelect={(status) => update({ status: status as LibraryStatus })}
								options={[
									{ value: "all", label: "" },
									...STATUSES.map((status) => ({ value: status.value, label: t(status.key) })),
								]}
							/>
							<LibraryFilterRow
								label={t("library.filter.length")}
								value={query.length}
								onSelect={(length) => update({ length: length as LengthBucket })}
								options={[
									{ value: "all", label: "" },
									...LENGTHS.map((length) => ({ value: length.value, label: t(length.key) })),
								]}
							/>
							<LibraryFilterRow
								label={t("library.filter.sort")}
								value={query.sort}
								onSelect={(sort) => update({ sort: sort as LibrarySort })}
								options={SORTS.map((sort) => ({ value: sort.value, label: t(sort.key) }))}
							/>
						</section>
						<p className="mt-auto rounded-[13px] bg-muted/70 px-2.5 py-2 text-[10px] leading-relaxed text-primary">
							{t("library.hint")}
						</p>
					</aside>

					<section className={`${CARD} flex min-w-0 flex-1 flex-col`}>
						<div className={`${GRID} px-4 pb-2 pt-3 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70`}>
							<span className="min-w-0">{t("library.column.book")}</span>
							<span className={COL_STAGE}>{t("library.column.stage")}</span>
							<span className={COL_CHAPTERS}>{t("library.column.chapters")}</span>
							<span className={COL_WORDS}>{t("library.column.words")}</span>
							<span className={COL_UPDATED}>{t("library.column.updated")}</span>
							<span className="text-right">{t("library.column.progress")}</span>
						</div>

						{page.items.length === 0 ? (
							<p className="px-4 py-8 text-center text-[12px] text-muted-foreground">{t("library.empty")}</p>
						) : (
							<ul className="flex min-h-0 flex-1 flex-col divide-y divide-border/40 overflow-y-auto px-2 pb-2">
								{page.items.map((entry) => {
									const percent = progressPercent(entry);
									return (
										<li key={entry.id}>
											<button
												type="button"
												onClick={() => onOpen(entry.id)}
											className={`${GRID} w-full rounded-[9px] px-2 py-2.5 text-left transition-colors hover:bg-muted/40 min-[880px]:h-16`}
											>
												<span className="flex min-w-0 items-center gap-2.5">
													<BookCover seed={entry.id} title={entry.title} size="thumb" />
													<span className="flex min-w-0 flex-col gap-0.5">
														<span className="min-w-0 truncate font-serif text-[13px] font-semibold text-foreground">
															{entry.title}
														</span>
														<span className="line-clamp-1 text-[10px] text-muted-foreground">
															{entry.genre?.trim() || t("library.card.noGenre")}
															{entry.premise?.trim() ? ` · ${entry.premise.trim()}` : ""}
														</span>
													</span>
												</span>
												<span className={COL_STAGE}>
													<PhaseBadge phase={entry.phase} />
												</span>
												<span className={`${COL_CHAPTERS} font-mono text-[10px] tabular-nums text-muted-foreground`}>
													{entry.committedCount}/{entry.targetChapters}
												</span>
												<span className={`${COL_WORDS} font-mono text-[10px] tabular-nums text-muted-foreground`}>
													{entry.words ?? 0}
												</span>
												<span className={`${COL_UPDATED} font-mono text-[10px] tabular-nums text-muted-foreground`}>
													{dateOf(entry.updatedAt)}
												</span>
												<span className="flex items-center gap-2">
													<MeterBar value={percent} className="h-[3px] flex-1" />
													<span className="w-6 shrink-0 text-right font-mono text-[9px] tabular-nums text-muted-foreground">
														{Math.round(percent)}%
													</span>
												</span>
											</button>
										</li>
									);
								})}
							</ul>
						)}

						<div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/40 px-4 py-2">
							<span className="font-mono text-[10px] tabular-nums text-muted-foreground">
								{page.page} / {page.pages}
							</span>
							<span className="hidden flex-1 text-[10px] text-muted-foreground/70 sm:block">
								{t("library.footer", { size: LIBRARY_PAGE_SIZE })}
							</span>
							<span className="ml-auto flex items-center gap-1.5">
								<button
									type="button"
									disabled={page.page <= 1}
									onClick={() => goPage(page.page - 1)}
									aria-label={t("library.prev")}
									className="flex size-6 items-center justify-center rounded-[6px] text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:opacity-25"
								>
									<span aria-hidden="true" className="icon-[solar--alt-arrow-left-linear] size-3" />
								</button>
								<button
									type="button"
									disabled={page.page >= page.pages}
									onClick={() => goPage(page.page + 1)}
									aria-label={t("library.next")}
									className="flex size-6 items-center justify-center rounded-[6px] text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:opacity-25"
								>
									<span aria-hidden="true" className="icon-[solar--alt-arrow-right-linear] size-3" />
								</button>
							</span>
						</div>
					</section>
				</div>
			</div>
		</div>
	);
}

import { useTranslation } from "@astravia-org/plugin-sdk";
import { useMemo, useState } from "react";

import type { BookIndexEntry } from "../../../repository/manuscript-repository.js";
import { MeterBar } from "../../shared/components/MeterBar.js";
import { PageBar } from "../../shared/components/PageBar.js";
import { Panel } from "../../shared/components/Panel.js";
import { PhaseBadge } from "../../shared/components/PhaseBadge.js";
import { dateOf, progressPercent } from "../bookshelf-model.js";
import {
	DEFAULT_QUERY,
	genreOptions,
	paginate,
	selectBooks,
	type LengthBucket,
	type LibraryQuery,
	type LibrarySort,
	type LibraryStatus,
} from "../library-model.js";
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

/** 台账六列的宽度约定：书名吃掉剩余宽度，其余按数字长度定宽，窄面板下逐个隐藏而不是挤压。 */
const COL_CHAPTERS = "hidden w-12 shrink-0 text-right tabular-nums sm:block";
const COL_WORDS = "hidden w-16 shrink-0 text-right tabular-nums md:block";
const COL_UPDATED = "hidden w-20 shrink-0 text-right tabular-nums sm:block";
const COL_PROGRESS = "w-20 shrink-0";

const QUIET_BUTTON =
	"rounded-lg border border-border/60 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent";

/**
 * 书库页（ADR 0020 §1，版面见 ADR 0026 §2）：左侧条件列 + 右侧台账。
 *
 * 设计稿是「左 188px 筛选栏 + 六列台账」。标签页可能只有 400px 宽，所以条件列在
 * `min-[880px]` 才独立成栏，其余宽度下变成列表上方的一组横条；台账的六个列也按可用宽度
 * 逐个收起（章数 → 更新时间 → 字数 → 进度），收起的只是「列」，书名与操作永远在。
 *
 * 页内仍然没有搜索框——宿主的对话就是搜索入口（ADR 0011 §2.4）。
 * 筛选、排序、分页都在 `library-model.ts` 里，本组件只持有当前查询与页码。
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
				<h1 className="text-lg font-medium text-foreground">{t("library.title")}</h1>
				<p className="text-xs tabular-nums text-muted-foreground">
					{t("library.count", { count: page.total })}
				</p>
			</PageBar>

			<div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
				<div className="flex flex-col gap-4 min-[880px]:flex-row min-[880px]:items-start">
					<aside className="flex w-full shrink-0 flex-col gap-2.5 min-[880px]:w-[188px]">
						<Panel bodyClassName="flex flex-col gap-2.5 px-3 py-3">
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
						</Panel>
					</aside>

					<div className="flex min-w-0 flex-1 flex-col">
						<div className="flex items-center gap-3 border-b border-border/40 px-3 pb-1.5 text-xs text-muted-foreground">
							<span className="min-w-0 flex-1">{t("library.column.book")}</span>
							<span className={COL_CHAPTERS}>{t("library.column.chapters")}</span>
							<span className={COL_WORDS}>{t("library.column.words")}</span>
							<span className={COL_UPDATED}>{t("library.column.updated")}</span>
							<span className={`hidden text-right min-[520px]:block ${COL_PROGRESS}`}>
								{t("library.column.progress")}
							</span>
						</div>

						{page.items.length === 0 ? (
							<p className="px-3 py-6 text-sm text-muted-foreground">{t("library.empty")}</p>
						) : (
							<ul className="flex flex-col divide-y divide-border/40">
								{page.items.map((entry) => (
									<li key={entry.id}>
										<button
											type="button"
											onClick={() => onOpen(entry.id)}
											className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/60"
										>
											<span className="flex min-w-0 flex-1 flex-col gap-1">
												<span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
													<span className="min-w-0 max-w-full truncate text-sm text-foreground">
														{entry.title}
													</span>
													<PhaseBadge phase={entry.phase} />
												</span>
												<span className="line-clamp-1 text-xs text-muted-foreground">
													{entry.genre?.trim() || t("library.card.noGenre")}
													{entry.premise?.trim() ? ` · ${entry.premise.trim()}` : ""}
												</span>
											</span>
											<span className={`${COL_CHAPTERS} text-xs text-muted-foreground`}>
												{entry.committedCount}/{entry.targetChapters}
											</span>
											<span className={`${COL_WORDS} text-xs text-muted-foreground`}>
												{entry.words ?? 0}
											</span>
											<span className={`${COL_UPDATED} text-xs text-muted-foreground`}>
												{dateOf(entry.updatedAt)}
											</span>
											<span className={`hidden min-[520px]:flex min-[520px]:flex-col gap-1 ${COL_PROGRESS}`}>
												<MeterBar value={progressPercent(entry)} className="h-0.5" />
												<span className="text-right text-[11px] tabular-nums text-muted-foreground">
													{Math.round(progressPercent(entry))}%
												</span>
											</span>
										</button>
									</li>
								))}
							</ul>
						)}

						{page.pages > 1 ? (
							<div className="mt-2 flex items-center justify-center gap-3 border-t border-border/40 px-3 py-2 text-xs text-muted-foreground">
								<button
									type="button"
									disabled={page.page <= 1}
									onClick={() => goPage(page.page - 1)}
									className={QUIET_BUTTON}
								>
									{t("library.prev")}
								</button>
								<span className="tabular-nums">{t("library.page", { page: page.page, pages: page.pages })}</span>
								<button
									type="button"
									disabled={page.page >= page.pages}
									onClick={() => goPage(page.page + 1)}
									className={QUIET_BUTTON}
								>
									{t("library.next")}
								</button>
							</div>
						) : null}
					</div>
				</div>
			</div>
		</div>
	);
}

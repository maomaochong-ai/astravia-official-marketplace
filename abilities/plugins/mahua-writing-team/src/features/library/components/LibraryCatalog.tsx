import { useTranslation } from "@astravia-org/plugin-sdk";
import { useMemo, useState } from "react";

import type { BookIndexEntry } from "../../../repository/manuscript-repository.js";
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
import { LibraryCard } from "./LibraryCard.js";
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
 * 书库页（ADR 0020）：复刻番茄 `/library` 的横版长条卡列表 + 顶部筛选排序。
 *
 * 页内没有搜索框——宿主的对话就是搜索入口（ADR 0011 §2.4 与 ADR 0020 §5）。
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
		<div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
			<div className="flex flex-col gap-2 border-b border-border/60 px-4 py-2.5">
				<div className="flex items-center justify-between gap-2">
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={onBack}
							className="rounded-md border border-border/60 px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
						>
							{t("library.back")}
						</button>
						<h1 className="text-sm font-medium">{t("library.title")}</h1>
					</div>
					<span className="text-xs tabular-nums text-muted-foreground">
						{t("library.count", { count: page.total })}
					</span>
				</div>

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
			</div>

			{page.items.length === 0 ? (
				<p className="p-6 text-sm text-muted-foreground">{t("library.empty")}</p>
			) : (
				<ul className="grid grid-cols-1 gap-2.5 p-4 md:grid-cols-2 lg:grid-cols-3">
					{page.items.map((entry) => (
						<li key={entry.id}>
							<LibraryCard book={entry} onOpen={onOpen} />
						</li>
					))}
				</ul>
			)}

			{page.pages > 1 ? (
				<div className="mt-auto flex items-center justify-center gap-3 border-t border-border/60 px-4 py-2 text-xs text-muted-foreground">
					<button
						type="button"
						disabled={page.page <= 1}
						onClick={() => goPage(page.page - 1)}
						className="rounded-md border border-border/60 px-2 py-0.5 transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-40 disabled:hover:bg-transparent"
					>
						{t("library.prev")}
					</button>
					<span className="tabular-nums">{t("library.page", { page: page.page, pages: page.pages })}</span>
					<button
						type="button"
						disabled={page.page >= page.pages}
						onClick={() => goPage(page.page + 1)}
						className="rounded-md border border-border/60 px-2 py-0.5 transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-40 disabled:hover:bg-transparent"
					>
						{t("library.next")}
					</button>
				</div>
			) : null}
		</div>
	);
}

/**
 * 书库页的纯计算部分（ADR 0020）。
 *
 * 与 `bookshelf-model.ts` 分开：书架是「最近在读」，书库是「按条件过一遍」，
 * 两页的规则混在一处只会让改动互相牵制。
 * 这里不产生任何文案，也不读存储——筛选、分页、封面貌都是可单测的函数。
 */

import type { BookIndexEntry } from "../../repository/manuscript-repository.js";
import { COVER_PLATES } from "./covers.generated.js";

export const LIBRARY_PAGE_SIZE = 9;
/** 题材选项上限：上限之外不列，但多出来的题材仍会被「全部」筛到。 */
export const GENRE_LIMIT = 6;

export type LibraryStatus = "all" | "active" | "completed";
export type LengthBucket = "all" | "under10k" | "10kTo50k" | "50kTo200k" | "over200k";
export type LibrarySort = "recent" | "chapters" | "title";

export interface LibraryQuery {
	/** `all` 或某个具体题材。 */
	genre: string;
	status: LibraryStatus;
	length: LengthBucket;
	sort: LibrarySort;
	/** 1-based，越界会被夹回范围内。 */
	page: number;
}

export const DEFAULT_QUERY: LibraryQuery = {
	genre: "all",
	status: "all",
	length: "all",
	sort: "recent",
	page: 1,
};

/** 旧索引没有 `words`：按 0 读，落进「1 万以下」是可解释的偏差，不猜（ADR 0020 §2）。 */
export function wordsOf(entry: Pick<BookIndexEntry, "words">): number {
	return typeof entry.words === "number" && Number.isFinite(entry.words) && entry.words > 0
		? Math.floor(entry.words)
		: 0;
}

export function bucketOf(words: number): Exclude<LengthBucket, "all"> {
	if (words < 10_000) return "under10k";
	if (words < 50_000) return "10kTo50k";
	if (words < 200_000) return "50kTo200k";
	return "over200k";
}

/** 出现过的题材，按「本数多的在前、同名按字典序」排；上限之外的不列出。 */
export function genreOptions(
	books: readonly BookIndexEntry[],
	limit: number = GENRE_LIMIT,
): string[] {
	const counts = new Map<string, number>();
	for (const book of books) {
		const genre = book.genre?.trim();
		if (!genre) continue;
		counts.set(genre, (counts.get(genre) ?? 0) + 1);
	}
	return [...counts.entries()]
		.sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
		.slice(0, Math.max(0, limit))
		.map(([genre]) => genre);
}

export function isCompleted(entry: Pick<BookIndexEntry, "phase">): boolean {
	return entry.phase === "completed";
}

export function matchesQuery(entry: BookIndexEntry, query: LibraryQuery): boolean {
	if (query.genre !== "all" && (entry.genre?.trim() ?? "") !== query.genre) return false;
	if (query.status === "active" && isCompleted(entry)) return false;
	if (query.status === "completed" && !isCompleted(entry)) return false;
	if (query.length !== "all" && bucketOf(wordsOf(entry)) !== query.length) return false;
	return true;
}

export function sortBooks(books: readonly BookIndexEntry[], sort: LibrarySort): BookIndexEntry[] {
	const sorted = [...books];
	if (sort === "chapters") {
		return sorted.sort(
			(left, right) =>
				right.committedCount - left.committedCount || right.updatedAt.localeCompare(left.updatedAt),
		);
	}
	if (sort === "title") return sorted.sort((left, right) => left.title.localeCompare(right.title));
	return sorted.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function selectBooks(books: readonly BookIndexEntry[], query: LibraryQuery): BookIndexEntry[] {
	return sortBooks(
		books.filter((entry) => matchesQuery(entry, query)),
		query.sort,
	);
}

export function pageCount(total: number, size: number = LIBRARY_PAGE_SIZE): number {
	if (size <= 0) return 1;
	return Math.max(1, Math.ceil(total / size));
}

export interface LibraryPage {
	items: BookIndexEntry[];
	/** 夹紧后的页码：请求第 99 页时给最后一页，而不是空屏。 */
	page: number;
	pages: number;
	total: number;
}

export function paginate(
	books: readonly BookIndexEntry[],
	page: number,
	size: number = LIBRARY_PAGE_SIZE,
): LibraryPage {
	const pages = pageCount(books.length, size);
	const current = Math.min(pages, Math.max(1, Math.trunc(page) || 1));
	const start = (current - 1) * size;
	return { items: books.slice(start, start + size), page: current, pages, total: books.length };
}

export interface CoverVariant {
	/** 底版索引，落围 `0..COVER_PLATES.length - 1`。 */
	plate: number;
	/** 墨迹浓淡档，0 最淡。 */
	layer: 0 | 1 | 2;
}

/** 稳定哈希：同一本书每次看到的封面一样，不同的书看起来不一样（ADR 0020 §4）。 */
export function coverVariant(id: string): CoverVariant {
	let hash = 0;
	for (const char of id) hash = (hash * 31 + char.codePointAt(0)!) % 1_000_000;
	return {
		plate: hash % COVER_PLATES.length,
		layer: (Math.floor(hash / COVER_PLATES.length) % 3) as 0 | 1 | 2,
	};
}

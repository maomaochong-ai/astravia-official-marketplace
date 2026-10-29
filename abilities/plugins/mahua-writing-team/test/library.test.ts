import { describe, expect, it } from "vitest";

import type { BookIndexEntry } from "../src/repository/manuscript-repository.js";
import {
	coverVariant,
	genreOptions,
	paginate,
	pageCount,
	selectBooks,
	bucketOf,
	wordsOf,
	DEFAULT_QUERY,
	LIBRARY_PAGE_SIZE,
} from "../src/features/library/library-model.js";

function entry(over: Partial<BookIndexEntry> = {}): BookIndexEntry {
	return {
		id: "salt",
		title: "Salt",
		phase: "drafting",
		currentChapter: 4,
		committedCount: 3,
		targetChapters: 40,
		updatedAt: "2026-02-01T00:00:00.000Z",
		words: 30_000,
		genre: "科幻",
		premise: "一座会忘记自己的城市",
		...over,
	};
}

describe("word buckets", () => {
	it("treats a missing or non-positive count as zero", () => {
		expect(wordsOf({ words: undefined })).toBe(0);
		expect(wordsOf({ words: -5 })).toBe(0);
		expect(wordsOf({ words: 12.9 })).toBe(12);
	});

	it("puts each boundary in the upper bucket", () => {
		expect(bucketOf(0)).toBe("under10k");
		expect(bucketOf(9_999)).toBe("under10k");
		expect(bucketOf(10_000)).toBe("10kTo50k");
		expect(bucketOf(49_999)).toBe("10kTo50k");
		expect(bucketOf(50_000)).toBe("50kTo200k");
		expect(bucketOf(199_999)).toBe("50kTo200k");
		expect(bucketOf(200_000)).toBe("over200k");
	});
});

describe("genre options", () => {
	it("dedupes, ranks by count and drops blanks", () => {
		const books = [
			entry({ id: "a", genre: "科幻" }),
			entry({ id: "b", genre: "科幻" }),
			entry({ id: "c", genre: "悬疑" }),
			entry({ id: "d", genre: "  " }),
			entry({ id: "e", genre: undefined }),
		];
		expect(genreOptions(books)).toEqual(["科幻", "悬疑"]);
	});

	it("caps the list so one row of chips stays a row", () => {
		const books = Array.from({ length: 9 }, (_, index) => entry({ id: `b${index}`, genre: `g${index}` }));
		expect(genreOptions(books)).toHaveLength(6);
	});
});

describe("selection", () => {
	const books = [
		entry({ id: "a", genre: "科幻", phase: "completed", words: 120_000, committedCount: 30 }),
		entry({ id: "b", genre: "科幻", phase: "drafting", words: 8_000, committedCount: 2 }),
		entry({ id: "c", genre: "悬疑", phase: "planning", words: 0, committedCount: 0 }),
	];

	it("filters by genre, status and length together", () => {
		const picked = selectBooks(books, {
			...DEFAULT_QUERY,
			genre: "科幻",
			status: "active",
			length: "under10k",
		});
		expect(picked.map((book) => book.id)).toEqual(["b"]);
	});

	it("maps completed phase to the completed filter and everything else to in-progress", () => {
		expect(selectBooks(books, { ...DEFAULT_QUERY, status: "completed" }).map((b) => b.id)).toEqual(["a"]);
		expect(selectBooks(books, { ...DEFAULT_QUERY, status: "active" }).map((b) => b.id)).toEqual(["b", "c"]);
	});

	it("sorts by recency, chapter count and title", () => {
		expect(selectBooks(books, { ...DEFAULT_QUERY, sort: "chapters" }).map((b) => b.id)).toEqual(["a", "b", "c"]);
		expect(selectBooks(books, { ...DEFAULT_QUERY, sort: "title" }).map((b) => b.title)).toEqual([
			"Salt",
			"Salt",
			"Salt",
		]);
	});
});

describe("paging", () => {
	const many = Array.from({ length: 23 }, (_, index) => entry({ id: `b${index}` }));

	it("keeps nine cards per page", () => {
		expect(LIBRARY_PAGE_SIZE).toBe(9);
		expect(pageCount(23)).toBe(3);
		expect(paginate(many, 1).items).toHaveLength(9);
		expect(paginate(many, 3).items).toHaveLength(5);
	});

	it("clamps an out-of-range page instead of showing an empty screen", () => {
		const last = paginate(many, 99);
		expect(last.page).toBe(3);
		expect(last.items).toHaveLength(5);
		expect(paginate(many, 0).page).toBe(1);
		expect(paginate(many, Number.NaN).page).toBe(1);
	});

	it("reports an empty result as page 1 of 1", () => {
		expect(paginate([], 4)).toEqual({ items: [], page: 1, pages: 1, total: 0 });
	});
});

describe("cover variant", () => {
	it("is stable per id and spreads ids across motifs", () => {
		expect(coverVariant("salt")).toEqual(coverVariant("salt"));
		const motifs = new Set(
			Array.from({ length: 30 }, (_, index) => coverVariant(`book-${index}`).motif),
		);
		expect(motifs.size).toBe(3);
	});

	it("keeps both axes inside their ranges", () => {
		for (const seed of ["", "a", "salt-and-ink", "0".repeat(64)]) {
			const variant = coverVariant(seed);
			expect([0, 1, 2]).toContain(variant.motif);
			expect([0, 1, 2]).toContain(variant.layer);
		}
	});
});

import { describe, expect, it } from "vitest";
import {
	DEFAULT_READER_SCALE,
	READER_SCALES,
	coverMark,
	dateOf,
	paragraphsOf,
	progressPercent,
	recentBooks,
	sortedByRecent,
} from "../src/features/library/bookshelf-model.js";
import type { BookIndexEntry } from "../src/repository/manuscript-repository.js";

function entry(id: string, updatedAt: string, committedCount = 1): BookIndexEntry {
	return {
		id,
		title: `Book ${id}`,
		phase: "drafting",
		currentChapter: committedCount + 1,
		committedCount,
		targetChapters: 120,
		updatedAt,
	};
}

describe("bookshelf ordering", () => {
	it("puts the most recently touched book first", () => {
		const sorted = sortedByRecent([
			entry("a", "2026-10-01T00:00:00.000Z"),
			entry("b", "2026-10-20T00:00:00.000Z"),
			entry("c", "2026-10-10T00:00:00.000Z"),
		]);
		expect(sorted.map((book) => book.id)).toEqual(["b", "c", "a"]);
	});

	it("keeps only the five most recent on the update list", () => {
		const books = Array.from({ length: 8 }, (_, index) =>
			entry(String(index), `2026-10-${String(index + 10)}T00:00:00.000Z`),
		);
		const recent = recentBooks(books);
		expect(recent).toHaveLength(5);
		expect(recent[0]?.id).toBe("7");
	});

	it("does not mutate the input", () => {
		const books = [entry("a", "2026-10-01T00:00:00.000Z"), entry("b", "2026-10-02T00:00:00.000Z")];
		sortedByRecent(books);
		expect(books.map((book) => book.id)).toEqual(["a", "b"]);
	});
});

describe("cover mark", () => {
	it("uses the first character of a Chinese title", () => {
		expect(coverMark("盐与墨")).toBe("盐");
	});

	it("upper-cases a Latin initial", () => {
		expect(coverMark("salt and ink")).toBe("S");
	});

	it("never renders an empty cover for a blank title", () => {
		expect(coverMark("   ")).toBe("?");
	});
});

describe("progress", () => {
	it("rounds to whole percent", () => {
		expect(progressPercent({ committedCount: 1, targetChapters: 3 })).toBe(33);
	});

	it("clamps above 100 and below 0", () => {
		expect(progressPercent({ committedCount: 200, targetChapters: 120 })).toBe(100);
		expect(progressPercent({ committedCount: -4, targetChapters: 120 })).toBe(0);
	});

	it("treats a zero target as empty instead of dividing by zero", () => {
		expect(progressPercent({ committedCount: 3, targetChapters: 0 })).toBe(0);
	});
});

describe("paragraph split", () => {
	it("splits Chinese prose on single newlines", () => {
		expect(paragraphsOf("第一段\n第二段\n\n第三段")).toEqual(["第一段", "第二段", "第三段"]);
	});

	it("handles CRLF and trailing blank lines", () => {
		expect(paragraphsOf("一\r\n二\r\n")).toEqual(["一", "二"]);
	});

	it("returns nothing for blank text", () => {
		expect(paragraphsOf("\n\n")).toEqual([]);
	});
});

describe("reader scale", () => {
	it("offers five stops defaulting to the middle one", () => {
		expect(READER_SCALES).toHaveLength(5);
		expect(DEFAULT_READER_SCALE).toBe(2);
	});
});

describe("date stamp", () => {
	it("keeps only the date part", () => {
		expect(dateOf("2026-10-29T08:31:12.000Z")).toBe("2026-10-29");
	});
});

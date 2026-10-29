import { describe, expect, it } from "vitest";

import { PASS_SCORE, routeNovel, type RouteFacts } from "../src/domain/novel-flow.js";
import { createBook, acceptBrief, saveVolumePlan, startDrafting } from "../src/domain/novel-progress.js";
import type { Chapter, NovelBook } from "../src/domain/novel-types.js";

const NOW = "2026-01-01T00:00:00.000Z";

function plannedBook(): NovelBook {
	const fresh = createBook(
		{ id: "b1", title: "Salt", genre: "SF", premise: "A city that forgets", targetChapters: 3 },
		NOW,
	);
	const accepted = acceptBrief(fresh, NOW);
	if (!accepted.ok) throw new Error(accepted.error);
	const planned = saveVolumePlan(
		accepted.book,
		{
			id: "v1",
			title: "Volume one",
			goal: "Reach the archive",
			hook: "The archive answers",
			arcs: [{ id: "a1", title: "First arc", goal: "Get in", from: 1, to: 2 }],
		},
		NOW,
	);
	if (!planned.ok) throw new Error(planned.error);
	return planned.book;
}

function planBook(): NovelBook {
	const planned = plannedBook();
	const drafting = startDrafting(planned, NOW);
	if (!drafting.ok) throw new Error(drafting.error);
	return drafting.book;
}

function facts(book: NovelBook): RouteFacts {
	return book;
}

function chapter(n: number, status: Chapter["status"], score: number | null = null): Chapter {
	return { n, title: `Chapter ${n}`, arcId: "a1", status, words: 1200, reviewScore: score, facts: null, updatedAt: NOW };
}

describe("routeNovel", () => {
	it("asks for the brief while the book is still briefing", () => {
		const book = createBook({ id: "b1", title: "Salt", genre: "SF", premise: "p", targetChapters: 3 }, NOW);
		const instruction = routeNovel(facts(book));
		expect(instruction?.worker).toBe("architect");
		expect(instruction?.task).toBe("brief");
		expect(instruction?.reasonKey).toBe("reason.briefMissing");
	});

	it("asks for the first arc while no arc exists", () => {
		const fresh = createBook({ id: "b1", title: "Salt", genre: "SF", premise: "p", targetChapters: 3 }, NOW);
		const accepted = acceptBrief(fresh, NOW);
		if (!accepted.ok) throw new Error(accepted.error);
		const instruction = routeNovel(facts(accepted.book));
		expect(instruction?.worker).toBe("architect");
		expect(instruction?.task).toBe("plan-arc");
		expect(instruction?.chapter).toBe(1);
		expect(instruction?.reasonKey).toBe("reason.noArcYet");
	});

	it("asks for the chapter outline once the arc exists", () => {
		const instruction = routeNovel(facts(plannedBook()));
		expect(instruction?.task).toBe("outline-chapter");
		expect(instruction?.chapter).toBe(1);
		expect(instruction?.reasonKey).toBe("reason.chapterUnplanned");
	});

	it("sends the writer after an outline exists", () => {
		const book = planBook();
		book.chapters = [chapter(1, "planned")];
		const instruction = routeNovel(facts(book));
		expect(instruction?.worker).toBe("writer");
		expect(instruction?.task).toBe("draft-chapter");
	});

	it("sends the editor after a draft exists", () => {
		const book = planBook();
		book.chapters = [chapter(1, "drafting")];
		expect(routeNovel(facts(book))?.task).toBe("review-chapter");
	});

	it("sends a blocked chapter back to the writer", () => {
		const book = planBook();
		book.chapters = [chapter(1, "blocked", 60)];
		const instruction = routeNovel(facts(book));
		expect(instruction?.task).toBe("revise-chapter");
		expect(instruction?.reasonKey).toBe("reason.chapterBlocked");
	});

	it("only lets the engine commit a reviewed chapter at or above the pass line", () => {
		const book = planBook();
		book.chapters = [chapter(1, "reviewed", PASS_SCORE)];
		const instruction = routeNovel(facts(book));
		expect(instruction?.worker).toBe("engine");
		expect(instruction?.task).toBe("commit-chapter");
		expect(instruction?.reasonParams).toEqual({ chapter: 1, score: PASS_SCORE });
	});

	it("sends a reviewed-but-below-pass chapter back for revision", () => {
		const book = planBook();
		book.chapters = [chapter(1, "reviewed", PASS_SCORE - 1)];
		const instruction = routeNovel(facts(book));
		expect(instruction?.task).toBe("revise-chapter");
		expect(instruction?.reasonKey).toBe("reason.belowPass");
	});

	it("closes the arc when the last chapter of an arc lands", () => {
		const book = planBook();
		book.phase = "arc_close";
		book.progress = { currentChapter: 3, committedCount: 2, pendingRewrite: [] };
		book.chapters = [chapter(1, "committed", 80), chapter(2, "committed", 80)];
		const instruction = routeNovel(facts(book));
		expect(instruction?.task).toBe("close-arc");
		expect(instruction?.chapter).toBe(2);
	});

	it("finalizes once the target is reached, and stops after completion", () => {
		const book = planBook();
		book.progress = { currentChapter: 3, committedCount: 3, pendingRewrite: [] };
		expect(routeNovel(facts(book))?.task).toBe("finalize");

		book.phase = "completed";
		expect(routeNovel(facts(book))).toBeNull();
	});

	it("reports pointer drift instead of silently skipping a committed chapter", () => {
		const book = planBook();
		book.chapters = [chapter(1, "committed", 90)];
		const instruction = routeNovel(facts(book));
		expect(instruction?.reasonKey).toBe("reason.pointerDrift");
	});

	it("is a pure function: the same facts always give the same instruction", () => {
		const book = planBook();
		book.chapters = [chapter(1, "drafting")];
		expect(routeNovel(facts(book))).toEqual(routeNovel(facts(book)));
	});

	it("never names a tool id in its output", () => {
		const book = planBook();
		book.chapters = [chapter(1, "drafting")];
		expect(JSON.stringify(routeNovel(facts(book)))).not.toContain("mahua_");
	});
});

describe("planning transitions", () => {
	it("refuses to start drafting before a volume is planned", () => {
		const fresh = createBook({ id: "b1", title: "Salt", genre: "SF", premise: "p", targetChapters: 3 }, NOW);
		const accepted = acceptBrief(fresh, NOW);
		if (!accepted.ok) throw new Error(accepted.error);
		const started = startDrafting(accepted.book, NOW);
		expect(started.ok).toBe(false);
	});

	it("refuses arcs beyond the target chapter count", () => {
		const fresh = createBook({ id: "b1", title: "Salt", genre: "SF", premise: "p", targetChapters: 3 }, NOW);
		const accepted = acceptBrief(fresh, NOW);
		if (!accepted.ok) throw new Error(accepted.error);
		const planned = saveVolumePlan(
			accepted.book,
			{
				id: "v1",
				title: "V",
				goal: "g",
				hook: "h",
				arcs: [{ id: "a1", title: "A", goal: "g", from: 1, to: 9 }],
			},
			NOW,
		);
		expect(planned.ok).toBe(false);
	});

	it("refuses overlapping arcs across volumes", () => {
		const book = planBook();
		const overlap = saveVolumePlan(
			book,
			{
				id: "v2",
				title: "V2",
				goal: "g",
				hook: "h",
				arcs: [{ id: "a2", title: "A2", goal: "g", from: 2, to: 3 }],
			},
			NOW,
		);
		expect(overlap.ok).toBe(false);
	});

	it("moves to drafting once a volume exists", () => {
		const started = startDrafting(plannedBook(), NOW);
		expect(started.ok).toBe(true);
		if (started.ok) expect(started.book.phase).toBe("drafting");
	});
});

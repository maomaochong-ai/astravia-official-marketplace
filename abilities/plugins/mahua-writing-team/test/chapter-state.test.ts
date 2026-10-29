import { describe, expect, it } from "vitest";

import {
	commitChapter,
	saveChapterDraft,
	saveChapterOutline,
	saveChapterReview,
	closeArc,
	reopenBook,
	finalizeBook,
	acceptBrief,
	createBook,
	saveVolumePlan,
	startDrafting,
} from "../src/domain/novel-progress.js";
import { PASS_SCORE, routeNovel } from "../src/domain/novel-flow.js";
import type { ReviewDimension, NovelBook } from "../src/domain/novel-types.js";

const NOW = "2026-01-01T00:00:00.000Z";

function book(): NovelBook {
	const fresh = createBook(
		{ id: "b1", title: "Salt", genre: "SF", premise: "p", targetChapters: 3 },
		NOW,
	);
	const accepted = acceptBrief(fresh, NOW);
	if (!accepted.ok) throw new Error(accepted.error);
	const planned = saveVolumePlan(
		accepted.book,
		{
			id: "v1",
			title: "V1",
			goal: "g",
			hook: "h",
			arcs: [{ id: "a1", title: "A1", goal: "g", from: 1, to: 2 }],
		},
		NOW,
	);
	if (!planned.ok) throw new Error(planned.error);
	const drafting = startDrafting(planned.book, NOW);
	if (!drafting.ok) throw new Error(drafting.error);
	return drafting.book;
}

function outlined(): NovelBook {
	const result = saveChapterOutline(book(), { n: 1, title: "The gate" }, NOW);
	if (!result.ok) throw new Error(result.error);
	return result.book;
}

function reviewed(before: NovelBook, score: number, mustFix: string[] = []): NovelBook {
	const dimensions: ReviewDimension[] = [
		{ key: "plot", score, note: "n" },
		{ key: "character", score, note: "n" },
		{ key: "pacing", score, note: "n" },
		{ key: "prose", score, note: "n" },
		{ key: "dialogue", score, note: "n" },
		{ key: "continuity", score, note: "n" },
		{ key: "hook", score, note: "n" },
	];
	const result = saveChapterReview(
		before,
		{ chapter: 1, score, dimensions, mustFix, reviewedAt: NOW },
		NOW,
	);
	if (!result.ok) throw new Error(result.error);
	return result.book;
}

describe("chapter state machine", () => {
	it("refuses a draft shorter than 200 words", () => {
		const result = saveChapterDraft(outlined(), { n: 1, words: 40 }, NOW);
		expect(result.ok).toBe(false);
	});

	it("refuses a draft for a chapter without an outline", () => {
		const result = saveChapterDraft(book(), { n: 1, words: 900 }, NOW);
		expect(result.ok).toBe(false);
	});

	it("moves planned → drafting → blocked → drafting → reviewed", () => {
		let current = outlined();
		const drafted = saveChapterDraft(current, { n: 1, words: 1500 }, NOW);
		expect(drafted.ok).toBe(true);
		if (!drafted.ok) return;
		expect(drafted.book.chapters[0].status).toBe("drafting");

		current = reviewed(drafted.book, PASS_SCORE - 5, ["The gate opens twice"]);
		expect(current.chapters[0].status).toBe("blocked");
		expect(current.phase).toBe("revising");
		expect(current.progress.pendingRewrite).toEqual([1]);

		const again = saveChapterDraft(current, { n: 1, words: 1600 }, NOW);
		expect(again.ok).toBe(true);
		if (!again.ok) return;

		current = reviewed(again.book, PASS_SCORE);
		expect(current.chapters[0].status).toBe("reviewed");
		expect(current.phase).toBe("drafting");
		expect(current.progress.pendingRewrite).toEqual([]);
	});

	it("blocks a chapter with a passing score but a non-empty must-fix list", () => {
		const drafted = saveChapterDraft(outlined(), { n: 1, words: 1500 }, NOW);
		if (!drafted.ok) throw new Error(drafted.error);
		const current = reviewed(drafted.book, 95, ["Timeline contradiction on day two"]);
		expect(current.chapters[0].status).toBe("blocked");
	});

	it("refuses a review that does not cover seven dimensions", () => {
		const drafted = saveChapterDraft(outlined(), { n: 1, words: 1500 }, NOW);
		if (!drafted.ok) throw new Error(drafted.error);
		const result = saveChapterReview(
			drafted.book,
			{ chapter: 1, score: 90, dimensions: [{ key: "plot", score: 90, note: "n" }], mustFix: [], reviewedAt: NOW },
			NOW,
		);
		expect(result.ok).toBe(false);
	});

	it("refuses to commit a chapter that was not reviewed", () => {
		const drafted = saveChapterDraft(outlined(), { n: 1, words: 1500 }, NOW);
		if (!drafted.ok) throw new Error(drafted.error);
		expect(commitChapter(drafted.book, 1, NOW).ok).toBe(false);
	});

	it("commits only once and advances the pointer exactly once", () => {
		const drafted = saveChapterDraft(outlined(), { n: 1, words: 1500 }, NOW);
		if (!drafted.ok) throw new Error(drafted.error);
		const passed = reviewed(drafted.book, 88);
		const committed = commitChapter(passed, 1, NOW);
		expect(committed.ok).toBe(true);
		if (!committed.ok) return;
		expect(committed.book.progress.committedCount).toBe(1);
		expect(committed.book.progress.currentChapter).toBe(2);
		expect(commitChapter(committed.book, 1, NOW).ok).toBe(false);
	});

	it("repairs a pointer that fell behind a committed chapter without counting twice", () => {
		const drafted = saveChapterDraft(outlined(), { n: 1, words: 1500 }, NOW);
		if (!drafted.ok) throw new Error(drafted.error);
		const committed = commitChapter(reviewed(drafted.book, 88), 1, NOW);
		if (!committed.ok) throw new Error(committed.error);

		// 指针被人为拉回到已提交章（路由在这种情况下发 reason.pointerDrift）。
		const drifted: NovelBook = { ...committed.book, progress: { ...committed.book.progress, currentChapter: 1 } };
		const repaired = commitChapter(drifted, 1, NOW);
		expect(repaired.ok).toBe(true);
		if (!repaired.ok) return;
		expect(repaired.book.progress.currentChapter).toBe(2);
		expect(repaired.book.progress.committedCount).toBe(1);
	});

	it("reopens a finished book at the first unwritten chapter", () => {
		// 定稿后的真实形态：三章都已提交，指针停在末章（`commitChapter` 的 `hasMore ? n + 1 : n`）。
		const finished: NovelBook = {
			...book(),
			phase: "completed",
			chapters: [1, 2, 3].map((n) => ({
				n,
				title: `Chapter ${n}`,
				arcId: "a1",
				status: "committed" as const,
				words: 1500,
				reviewScore: 88,
				facts: null,
				updatedAt: NOW,
			})),
			progress: { currentChapter: 3, committedCount: 3, pendingRewrite: [] },
		};
		const reopened = reopenBook(finished, 5, NOW);
		expect(reopened.ok).toBe(true);
		if (!reopened.ok) return;
		expect(reopened.book.phase).toBe("drafting");
		const next = routeNovel(reopened.book);
		// 第 4 章落在已规划弧 (1..3) 之外，所以第一步是补弧，而不是去建一张会被拒的章纲。
		expect(next?.task).toBe("plan-arc");
		expect(next?.chapter).toBe(4);
		expect(next?.reasonKey).toBe("reason.arcUncovered");
	});

	it("keeps committed chapters frozen against outline and draft writes", () => {
		const drafted = saveChapterDraft(outlined(), { n: 1, words: 1500 }, NOW);
		if (!drafted.ok) throw new Error(drafted.error);
		const committed = commitChapter(reviewed(drafted.book, 88), 1, NOW);
		if (!committed.ok) throw new Error(committed.error);
		expect(saveChapterOutline(committed.book, { n: 1, title: "Changed" }, NOW).ok).toBe(false);
		expect(saveChapterDraft(committed.book, { n: 1, words: 2000 }, NOW).ok).toBe(false);
	});

	it("keeps a passed review when the architect re-titles a chapter", () => {
		const reviewedOnce = reviewed(outlined(), PASS_SCORE);
		const rewritten = saveChapterOutline(reviewedOnce, { n: 1, title: "The gate, again" }, NOW);
		expect(rewritten.ok).toBe(true);
		if (!rewritten.ok) return;
		const chapter = rewritten.book.chapters[0];
		expect(chapter.title).toBe("The gate, again");
		// 改名不改正文：评审结论与字数必须原样保留，否则重规划一次就白评一章。
		expect(chapter.status).toBe("reviewed");
		expect(chapter.reviewScore).toBe(PASS_SCORE);
	});

	it("enters arc_close on the last chapter of an arc, then returns to drafting", () => {
		const first = saveChapterOutline(book(), { n: 1, title: "One" }, NOW);
		if (!first.ok) throw new Error(first.error);
		const second = saveChapterOutline(first.book, { n: 2, title: "Two" }, NOW);
		if (!second.ok) throw new Error(second.error);

		const draft1 = saveChapterDraft(second.book, { n: 1, words: 1500 }, NOW);
		if (!draft1.ok) throw new Error(draft1.error);
		const commit1 = commitChapter(reviewed(draft1.book, 80), 1, NOW);
		if (!commit1.ok) throw new Error(commit1.error);
		expect(commit1.book.phase).toBe("drafting");

		const draft2 = saveChapterDraft(commit1.book, { n: 2, words: 1500 }, NOW);
		if (!draft2.ok) throw new Error(draft2.error);
		const commit2 = commitChapter(reviewedFor(draft2.book, 2, 80), 2, NOW);
		if (!commit2.ok) throw new Error(commit2.error);
		expect(commit2.book.phase).toBe("arc_close");

		const closed = closeArc(commit2.book, NOW);
		expect(closed.ok).toBe(true);
		// 这一卷只有一个弧：弧用完之后回到 planning 等下一卷，而不是凭空进入写作。
		if (closed.ok) expect(closed.book.phase).toBe("planning");
	});

	it("refuses to close an arc when no arc is ending", () => {
		expect(closeArc(book(), NOW).ok).toBe(false);
	});

	it("refuses to finalize before the target is committed", () => {
		expect(finalizeBook(book(), NOW).ok).toBe(false);
	});
});

function reviewedFor(before: NovelBook, n: number, score: number): NovelBook {
	const dimensions: ReviewDimension[] = (
		["plot", "character", "pacing", "prose", "dialogue", "continuity", "hook"] as const
	).map((key) => ({ key, score, note: "n" }));
	const result = saveChapterReview(before, { chapter: n, score, dimensions, mustFix: [], reviewedAt: NOW }, NOW);
	if (!result.ok) throw new Error(result.error);
	return result.book;
}

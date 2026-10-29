/**
 * 可执行性属性：`routeNovel` 发出的每一条指令，都必须能被对应的领域推进函数真的执行完。
 *
 * 为什么要这一层：路由测试能证明"它发了 pointerDrift"，但证明不了"收到它的人能做成"。
 * 完本 → 重开这条路径上一次就是死在这里——路由一直发 `commit-chapter(末章)`，
 * 而提交守卫一直拒绝，两边都符合各自的测试。这个驱动循环把"指令 → 执行"接成一条链，
 * 任何一步失败或原地打转都会红。
 */

import { describe, expect, it } from "vitest";

import { routeNovel } from "../src/domain/novel-flow.js";
import {
	acceptBrief,
	closeArc,
	commitChapter,
	createBook,
	expandArc,
	finalizeBook,
	reopenBook,
	saveChapterDraft,
	saveChapterOutline,
	saveChapterReview,
	saveVolumePlan,
	startDrafting,
} from "../src/domain/novel-progress.js";
import type { Instruction, NovelBook } from "../src/domain/novel-types.js";
/** 七维齐备的一次评审（`saveChapterReview` 只接受七维齐全的报告）。 */
function reviewedReport(n: number) {
	const dimensions = (["plot", "character", "pacing", "prose", "dialogue", "continuity", "hook"] as const).map(
		(key) => ({ key, score: 88, note: "n" }),
	);
	return { chapter: n, score: 88, dimensions, mustFix: [], reviewedAt: NOW };
}
const NOW = "2026-03-01T00:00:00.000Z";
const MAX_STEPS = 40;

function fresh(): NovelBook {
	return createBook(
		{ id: "b1", title: "Salt", genre: "SF", premise: "p", targetChapters: 2 },
		NOW,
	);
}

/** 按弧长两章规划：路由给 `plan-arc` 时，从它指定的那一章起铺两章。 */
function planArc(book: NovelBook, from: number): { ok: true; book: NovelBook } | { ok: false; error: string } {
	const arc = { id: `a${from}`, title: `Arc ${from}`, goal: "g", from, to: from + 1 };
	if (book.volumes.length === 0) {
		const planned = saveVolumePlan(book, { id: "v1", title: "V1", goal: "g", hook: "h", arcs: [arc] }, NOW);
		return planned.ok ? { ok: true, book: planned.book } : { ok: false, error: planned.error };
	}
	const expanded = expandArc(book, book.volumes[0]!.id, arc, NOW);
	return expanded.ok ? { ok: true, book: expanded.book } : { ok: false, error: expanded.error };
}

/**
 * 执行一条指令。返回新状态；领域层说"不行"就是循环失败，不吞掉、不绕过。
 */
function step(book: NovelBook, instruction: Instruction): { ok: true; book: NovelBook } | { ok: false; error: string } {
	const chapter = instruction.chapter;
	switch (instruction.task) {
		case "brief":
			return acceptBrief(book, NOW);
		case "plan-arc":
			return planArc(book, chapter ?? 1);
		case "outline-chapter": {
			if (chapter === null) return { ok: false, error: "outline-chapter came without a chapter number" };
			const outlined = saveChapterOutline(book, { n: chapter, title: `Chapter ${chapter}` }, NOW);
			return outlined.ok ? { ok: true, book: outlined.book } : { ok: false, error: outlined.error };
		}
		case "draft-chapter":
		case "revise-chapter": {
			// 修订前先补章纲：被驳回的章可能连章纲都还没存。
			const outlined = saveChapterOutline(book, { n: chapter ?? 1, title: `Chapter ${chapter}` }, NOW);
			const base = outlined.ok ? outlined.book : book;
			const drafted = saveChapterDraft(base, { n: chapter ?? 1, words: 1200 }, NOW);
			return drafted.ok ? { ok: true, book: drafted.book } : { ok: false, error: drafted.error };
		}
		case "review-chapter": {
			const reviewed = saveChapterReview(book, reviewedReport(chapter ?? 1), NOW);
			return reviewed.ok ? { ok: true, book: reviewed.book } : { ok: false, error: reviewed.error };
		}
		case "commit-chapter": {
			const committed = commitChapter(book, chapter ?? 1, NOW);
			return committed.ok ? { ok: true, book: committed.book } : { ok: false, error: committed.error };
		}
		case "close-arc":
			return closeArc(book, NOW);
		case "finalize":
			return finalizeBook(book, NOW);
		default: {
			const exhausted: never = instruction.task;
			return { ok: false, error: `no driver for task ${String(exhausted)}` };
		}
	}
}

/** 一路执行到没有下一步为止。任何一步失败、或步数超限，都抛出去让断言看见。 */
function drive(start: NovelBook): NovelBook {
	let book = start;
	let lastKey = "";
	for (let i = 0; i < MAX_STEPS; i += 1) {
		const instruction = routeNovel(book);
		if (!instruction) {
			// 章纲齐了之后路由不再推进：开头是作者的决定（界面上按「开始写作」），不是路由的。
			if (book.phase === "planning") {
				const started = startDrafting(book, NOW);
				if (started.ok) {
					book = started.book;
					continue;
				}
			}
			return book;
		}

		// 同一条指令连着发两次，说明它做不到——这正是 pointerDrift 死循环的形状。
		const key = `${instruction.task}:${instruction.chapter}`;
		expect(key, `route repeated ${key} — the instruction cannot make progress`).not.toBe(lastKey);
		lastKey = key;

		const outcome = step(book, instruction);
		if (!outcome.ok) {
			expect.fail(`${instruction.task}(${String(instruction.chapter)}) failed: ${outcome.error}`);
		}
		book = outcome.book;
	}
	throw new Error(`book did not settle within ${MAX_STEPS} steps`);
}

describe("every routed instruction is executable", () => {
	it("drives a book from briefing to completed without a stuck step", () => {
		const finished = drive(fresh());
		expect(finished.phase).toBe("completed");
		expect(finished.progress.committedCount).toBe(2);
	});

	it("keeps driving after a finished book is reopened", () => {
		const finished = drive(fresh());

		const reopened = reopenBook(finished, 4, NOW);
		if (!reopened.ok) throw new Error(reopened.error);
		// 重开后的第一条指令必须面向没写的章：指针在第 3 章，而弧只盖到第 2 章，先把弧补齐。
		const first = routeNovel(reopened.book);
		expect(first?.task).toBe("plan-arc");
		expect(first?.chapter).toBe(3);
		expect(first?.reasonKey).toBe("reason.arcUncovered");

		const rewritten = drive(reopened.book);
		expect(rewritten.phase).toBe("completed");
		expect(rewritten.progress.committedCount).toBe(4);
	});

	it("does not stall when the outline tail is rewritten mid-drafting", () => {
		let book = fresh();
		book = driveUntil(book, "draft-chapter");

		const revised = saveChapterDraft(book, { n: 1, words: 1200 }, NOW);
		if (!revised.ok) throw new Error(revised.error);
		const settled = drive(revised.book);
		expect(settled.progress.committedCount).toBeGreaterThanOrEqual(1);
	});
});

/** 跑到指定任务出现为止，用来把一个书停在指定阶段上。 */
function driveUntil(start: NovelBook, task: Instruction["task"]): NovelBook {
	let book = start;
	for (let i = 0; i < MAX_STEPS; i += 1) {
		const instruction = routeNovel(book);
		if (!instruction) {
			const started = book.phase === "planning" ? startDrafting(book, NOW) : null;
			if (!started?.ok) return book;
			book = started.book;
			continue;
		}
		if (instruction.task === task) return book;
		const outcome = step(book, instruction);
		if (!outcome.ok) throw new Error(outcome.error);
		book = outcome.book;
	}
	throw new Error(`never reached ${task}`);
}

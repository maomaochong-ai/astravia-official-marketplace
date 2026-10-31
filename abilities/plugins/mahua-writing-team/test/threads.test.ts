import { describe, expect, it } from "vitest";

import { StudioService } from "../src/application/studio-service.js";
import { buildContext } from "../src/domain/context-pack.js";
import { relatedChapters } from "../src/domain/related-chapters.js";
import { addThread, auditThreads, closeThread } from "../src/domain/thread-ledger.js";
import type { NovelBook, StoryThread } from "../src/domain/novel-types.js";
import { EntitlementGate } from "../src/entitlement/entitlement-gate.js";
import { ManuscriptRepository } from "../src/repository/manuscript-repository.js";
import { MemoryManuscriptStorage } from "../src/repository/manuscript-storage.js";

const NOW = () => new Date("2026-02-01T00:00:00.000Z");

function thread(over: Partial<StoryThread> = {}): StoryThread {
	return {
		id: "t1",
		content: "the broken compass",
		plantedIn: 1,
		dueIn: 4,
		weight: "medium",
		status: "open",
		closedIn: null,
		...over,
	};
}

describe("thread ledger", () => {
	it("assigns the next free id instead of reusing one", () => {
		const result = addThread([thread({ id: "t3", dueIn: 6 }), thread({ id: "t1", dueIn: 4 })], {
			content: "a door that breathes",
			plantedIn: 2,
			dueIn: 8,
			weight: "heavy",
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.thread.id).toBe("t4");
		expect(result.threads.map((item) => item.id)).toEqual(["t1", "t3", "t4"]);
	});

	it("refuses a payoff that comes before the plant", () => {
		const result = addThread([], { content: "x", plantedIn: 5, dueIn: 4, weight: "light" });
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toBe("thread.invalid");
	});

	it("refuses an empty content and an unknown weight", () => {
		expect(addThread([], { content: "  ", plantedIn: 1, dueIn: 2, weight: "light" }).ok).toBe(false);
		const bad = addThread([], {
			content: "x",
			plantedIn: 1,
			dueIn: 2,
			weight: "colossal" as StoryThread["weight"],
		});
		expect(bad.ok).toBe(false);
	});

	it("closes once and refuses the second close", () => {
		const first = closeThread([thread()], "t1", 3);
		expect(first.ok).toBe(true);
		if (!first.ok) return;
		expect(first.thread.closedIn).toBe(3);
		const again = closeThread(first.threads, "t1", 5);
		expect(again.ok).toBe(false);
		if (again.ok) return;
		expect(again.error).toBe("thread.already-closed");
	});

	it("reports the id it could not find", () => {
		const result = closeThread([thread()], "t9", 3);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toBe("thread.not-found");
	});
});

describe("thread audit", () => {
	it("flags an overdue plant only while the chapter is already written", () => {
		const late = auditThreads([thread({ dueIn: 2 })], 3);
		expect(late.findings.map((item) => item.code)).toEqual(["thread.overdue"]);
		expect(late.overdue).toBe(1);
		const early = auditThreads([thread({ dueIn: 2 })], 1);
		expect(early.findings).toEqual([]);
	});

	it("flags a plant ahead of the manuscript and a close that never happened", () => {
		const audit = auditThreads(
			[
				thread({ id: "t1", content: "the broken compass", plantedIn: 9, dueIn: 12 }),
				thread({ id: "t2", content: "a door that breathes", dueIn: 3, status: "closed", closedIn: 8 }),
			],
			3,
		);
		expect(audit.findings.map((item) => item.code)).toEqual([
			"thread.plantedInFuture",
			"thread.closedWithoutChapter",
		]);
	});

	it("flags duplicate wording and keeps the first id as the reference", () => {
		const audit = auditThreads([thread({ id: "t1" }), thread({ id: "t2" })], 1);
		const duplicate = audit.findings.find((item) => item.code === "thread.duplicateContent");
		expect(duplicate?.detail).toMatchObject({ threadId: "t2", duplicateOf: "t1" });
	});

	it("computes the unresolved rate and treats an empty ledger as zero", () => {
		expect(auditThreads([], 0)).toEqual({ findings: [], open: 0, overdue: 0, unresolvedRate: 0 });
		const audit = auditThreads([thread({ id: "t1" }), thread({ id: "t2", status: "closed", closedIn: 1 })], 1);
		expect(audit.open).toBe(1);
		expect(audit.unresolvedRate).toBe(0.5);
	});
});

function book(over: Partial<NovelBook> = {}): NovelBook {
	const chapter = (n: number, characters: string[]) => ({
		n,
		title: `Chapter ${n}`,
		arcId: "a1",
		status: "committed" as const,
		words: 100,
		reviewScore: 80,
		facts: { characters, opening: "o", closing: "c" },
		updatedAt: NOW().toISOString(),
	});
	return {
		schemaVersion: 1,
		id: "salt",
		title: "Salt",
		genre: "SF",
		premise: "A city that forgets",
		targetChapters: 40,
		phase: "drafting",
		foundation: { theme: "", conflict: "", protagonist: "", ending: "", taboo: "", hook: "" },
		cast: ["Mei", "Rao", "Ines"],
		styleSample: "",
		rules: {},
		stylePreset: null,
		volumes: [
			{
				id: "v1",
				title: "Volume",
				goal: "g",
				hook: "h",
				arcs: [{ id: "a1", title: "Arc", goal: "g", from: 1, to: 30 }],
			},
		],
		chapters: [
			chapter(1, ["Mei"]),
			chapter(2, ["Rao"]),
			chapter(3, ["Mei", "Ines"]),
			chapter(4, ["Ines"]),
			{
				n: 5,
				title: "Chapter 5",
				arcId: "a1",
				status: "planned",
				words: 0,
				reviewScore: null,
				facts: null,
				updatedAt: NOW().toISOString(),
			},
		],
		plans: [],
		feedback: [],
		summaries: {
			arcs: [{ arcId: "a1", summary: "arc summary", at: NOW().toISOString() }],
			volumes: [{ volumeId: "v1", summary: "volume summary", at: NOW().toISOString() }],
		},
		progress: { currentChapter: 5, committedCount: 4, pendingRewrite: [] },
		checkpoints: [],
		createdAt: NOW().toISOString(),
		updatedAt: NOW().toISOString(),
		...over,
	} as NovelBook;
}

describe("related chapters", () => {
	it("ranks the plant, then the shared cast, then the arc, and never the current chapter", () => {
		const picks = relatedChapters(book(), [thread({ plantedIn: 1, dueIn: 5 })]);
		expect(picks).toEqual([
			{ n: 1, title: "Chapter 1", reason: "thread" },
			{ n: 3, title: "Chapter 3", reason: "character" },
			{ n: 2, title: "Chapter 2", reason: "arc" },
		]);
		// 当前章与上一章都不该出现在推荐里：前者还没写，后者已经在 previous 里。
		expect(picks.some((item) => item.n === 5 || item.n === 4)).toBe(false);
	});

	it("returns nothing when there is no committed chapter to look back at", () => {
		const empty = book({ chapters: [], progress: { currentChapter: 1, committedCount: 0, pendingRewrite: [] } });
		expect(relatedChapters(empty, [])).toEqual([]);
	});

	it("keeps each chapter under one reason, first wins", () => {
		// 第 1 章既与当前阵容有人（Mei），也是伏笔埋点：伏笔优先。
		const picks = relatedChapters(book(), [thread({ plantedIn: 1, dueIn: 4 })]);
		expect(picks.filter((item) => item.n === 1)).toEqual([
			{ n: 1, title: "Chapter 1", reason: "thread" },
		]);
	});
});

describe("context pack", () => {
	it("carries open threads, related chapters and the summaries", () => {
		const pack = buildContext(book(), [
			thread({ id: "t1", dueIn: 3 }),
			thread({ id: "t2", content: "elsewhere", status: "closed", closedIn: 2 }),
		]);
		expect(pack.openThreads.map((item) => item.id)).toEqual(["t1"]);
		expect(pack.relatedChapters.length).toBeGreaterThan(0);
		expect(pack.summaries.arcs[0].summary).toBe("arc summary");
		expect(pack.previous).toEqual({ n: 4, title: "Chapter 4", closing: "c" });
	});
});

describe("thread tools reach storage", () => {
	async function studio() {
		const storage = new MemoryManuscriptStorage();
		const gate = new EntitlementGate(storage, NOW);
		await gate.load();
		const repository = new ManuscriptRepository(storage, () => NOW().toISOString());
		const service = new StudioService(repository, gate, NOW);
		const created = await service.createBook({
			title: "Salt",
			genre: "SF",
			premise: "A city that forgets",
			targetChapters: 3,
		});
		if (!created.ok) throw new Error(created.error);
		return { service, repository, bookId: created.data.id };
	}

	it("persists a flagged thread and reads it back", async () => {
		const { service, repository, bookId } = await studio();
		const flagged = await service.flagThread(
			{ content: "the broken compass", plantedIn: 1, dueIn: 2, weight: "medium" },
			bookId,
		);
		expect(flagged.ok).toBe(true);
		expect(await repository.readThreads(bookId)).toHaveLength(1);
		const audit = await service.checkThreads(bookId);
		expect(audit.ok).toBe(true);
		if (!audit.ok) return;
		expect(audit.data.open).toBe(1);
	});

	it("closes a thread in the same ledger", async () => {
		const { service, repository, bookId } = await studio();
		await service.flagThread({ content: "the broken compass", plantedIn: 1, dueIn: 2, weight: "light" }, bookId);
		const closed = await service.closeThread({ id: "t1", chapter: 1 }, bookId);
		expect(closed.ok).toBe(true);
		const stored = await repository.readThreads(bookId);
		expect(stored[0].status).toBe("closed");
		expect(stored[0].closedIn).toBe(1);
	});

	it("surfaces the domain error instead of writing a bad entry", async () => {
		const { service, repository, bookId } = await studio();
		const bad = await service.flagThread(
			{ content: "x", plantedIn: 3, dueIn: 2, weight: "light" },
			bookId,
		);
		expect(bad.ok).toBe(false);
		expect(await repository.readThreads(bookId)).toEqual([]);
	});
});

import { describe, expect, it } from "vitest";

import { StudioService, countWords } from "../src/application/studio-service.js";
import { EntitlementGate } from "../src/entitlement/entitlement-gate.js";
import { MemoryManuscriptStorage } from "../src/repository/manuscript-storage.js";
import { ManuscriptRepository } from "../src/repository/manuscript-repository.js";

const NOW = () => new Date("2026-02-01T00:00:00.000Z");
const PROSE = "The gate opened twice that night. ".repeat(40);

async function studio() {
	const storage = new MemoryManuscriptStorage();
	const gate = new EntitlementGate(storage, NOW);
	await gate.load();
	const repository = new ManuscriptRepository(storage, () => NOW().toISOString());
	const service = new StudioService(repository, gate, NOW);
	return { storage, gate, repository, service };
}

async function withBook() {
	const context = await studio();
	const created = await context.service.createBook({
		title: "Salt",
		genre: "SF",
		premise: "A city that forgets",
		targetChapters: 3,
	});
	if (!created.ok) throw new Error(created.error);
	return { ...context, bookId: created.data.id };
}

const DIMENSIONS = (["plot", "character", "pacing", "prose", "dialogue", "continuity", "hook"] as const).map(
	(key) => ({ key, score: 84, note: "specific note" }),
);

describe("countWords", () => {
	it("counts CJK by character and latin by word", () => {
		expect(countWords("城市在那天忘记了自己")).toBe(10);
		expect(countWords("The gate opened twice")).toBe(4);
		expect(countWords("第 3 章 the gate")).toBe(5);
		expect(countWords("")).toBe(0);
	});
});

describe("StudioService lifecycle", () => {
	it("creates a book and reports the brief instruction", async () => {
		const { service, bookId } = await withBook();
		const status = await service.status(bookId);
		expect(status.ok).toBe(true);
		if (!status.ok) return;
		expect(status.data.book.phase).toBe("briefing");
		expect(status.data.instruction?.task).toBe("brief");
	});

	it("rejects a duplicate title instead of silently forking the book", async () => {
		const { service } = await withBook();
		const again = await service.createBook({
			title: "Salt",
			genre: "SF",
			premise: "another",
			targetChapters: 5,
		});
		expect(again.ok).toBe(false);
		if (!again.ok) expect(again.error).toBe("duplicate-title");
	});

	it("walks brief → plan → draft → review → commit through one service", async () => {
		const { service, bookId } = await withBook();

		expect((await service.acceptBrief(bookId)).ok).toBe(true);

		const planned = await service.savePlan(
			{
				title: "Volume one",
				goal: "Reach the archive",
				hook: "The archive answers",
				arcs: [{ title: "First arc", goal: "Get in", from: 1, to: 3 }],
			},
			bookId,
		);
		expect(planned.ok).toBe(true);

		const outlined = await service.saveOutlines(
			{ chapters: [{ n: 1, title: "The gate" }] },
			bookId,
		);
		expect(outlined.ok).toBe(true);

		expect((await service.startDrafting(bookId)).ok).toBe(true);

		const drafted = await service.saveChapter({ n: 1, content: PROSE }, bookId);
		expect(drafted.ok).toBe(true);

		const review = await service.saveReview({ n: 1, score: 84, dimensions: DIMENSIONS, mustFix: [] }, bookId);
		expect(review.ok).toBe(true);

		const committed = await service.commitChapter(1, bookId);
		expect(committed.ok).toBe(true);
		if (!committed.ok) return;
		expect(committed.data.progress.committedCount).toBe(1);
		expect(committed.data.chapters[0].status).toBe("committed");

		const text = await service.readChapter(1, bookId);
		expect(text.ok && text.data.text.length).toBeGreaterThan(100);
	});

	it("persists the manuscript across a fresh service over the same storage", async () => {
		const { service, repository, gate, bookId } = await withBook();
		await service.acceptBrief(bookId);
		await service.savePlan(
			{ title: "V", goal: "g", hook: "h", arcs: [{ title: "A", goal: "g", from: 1, to: 3 }] },
			bookId,
		);
		await service.saveOutlines({ chapters: [{ n: 1, title: "The gate" }] }, bookId);
		await service.startDrafting(bookId);
		await service.saveChapter({ n: 1, content: PROSE }, bookId);

		const reopened = new StudioService(repository, gate, NOW);
		const status = await reopened.status(bookId);
		expect(status.ok).toBe(true);
		if (!status.ok) return;
		expect(status.data.book.chapters[0].status).toBe("drafting");
		expect(status.data.currentWords).toBeGreaterThan(200);
	});

	it("surfaces a revision conflict instead of overwriting a concurrent write", async () => {
		const { service, storage, bookId } = await withBook();
		await service.acceptBrief(bookId);
		await service.savePlan(
			{ title: "V", goal: "g", hook: "h", arcs: [{ title: "A", goal: "g", from: 1, to: 3 }] },
			bookId,
		);
		storage.bumpRevision();
		const outlined = await service.saveOutlines({ chapters: [{ n: 1, title: "The gate" }] }, bookId);
		expect(outlined.ok).toBe(false);
		if (!outlined.ok) expect(outlined.error).toBe("revision-conflict");
	});

	it("does not invent a conflict when two books take turns writing", async () => {
		const { service, bookId } = await withBook();
		const second = await service.createBook({
			title: "Second",
			genre: "SF",
			premise: "A second city",
			targetChapters: 3,
		});
		if (!second.ok) throw new Error(second.error);

		await service.acceptBrief(bookId);
		await service.acceptBrief(second.data.id);

		// 写第二本会把存储层的全局 revision 推前进；接着改第一本时，若按书缓存基线就是一次假冲突。
		const again = await service.savePlan(
			{ title: "V", goal: "g", hook: "h", arcs: [{ title: "A", goal: "g", from: 1, to: 3 }] },
			bookId,
		);
		expect(again.ok).toBe(true);
	});

	it("records an arbitration as an append-only decision entry", async () => {
		const { service, repository, bookId } = await withBook();
		const record = await service.arbitrate(
			{
				scenario: "user-intervention",
				question: "Does the protagonist survive the archive?",
				decision: "She survives and loses the memory of her brother.",
				rationale: "The premise needs a cost paid, not a death.",
			},
			bookId,
		);
		expect(record.ok).toBe(true);
		const decisions = await repository.readDecisions(bookId);
		expect(decisions.join("\n")).toContain("Does the protagonist survive the archive");
	});

	it("exports committed prose as one markdown manuscript", async () => {
		const { service, bookId } = await withBook();
		const empty = await service.exportManuscript(bookId);
		expect(empty.ok).toBe(false);
		if (!empty.ok) expect(empty.error).toBe("nothing-to-export");

		await service.acceptBrief(bookId);
		await service.savePlan(
			{ title: "V", goal: "g", hook: "h", arcs: [{ title: "A", goal: "g", from: 1, to: 3 }] },
			bookId,
		);
		await service.saveOutlines({ chapters: [{ n: 1, title: "The gate" }] }, bookId);
		await service.startDrafting(bookId);
		await service.saveChapter({ n: 1, content: PROSE }, bookId);

		const exported = await service.exportManuscript(bookId);
		expect(exported.ok).toBe(true);
		if (!exported.ok) return;
		expect(exported.data.chapters).toBe(1);
		expect(exported.data.text.startsWith("# Salt")).toBe(true);
		expect(exported.data.text).toContain("## 1. The gate");
		expect(exported.data.text).toContain("The gate opened twice that night.");
	});

	it("refuses every write while the gate is inactive", async () => {
		const storage = new MemoryManuscriptStorage();
		const gate = new EntitlementGate(storage, () => new Date("2031-01-01T00:00:00.000Z"));
		await gate.load();
		const repository = new ManuscriptRepository(storage, () => new Date().toISOString());
		const service = new StudioService(repository, gate, () => new Date("2031-01-01T00:00:00.000Z"));
		const created = await service.createBook({ title: "Salt", genre: "SF", premise: "p", targetChapters: 2 });
		expect(created.ok).toBe(false);
		if (!created.ok) expect(created.error).toBe("entitlement-required");
	});
});

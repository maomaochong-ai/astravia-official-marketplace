import { describe, expect, it } from "vitest";

import { StudioService } from "../src/application/studio-service.js";
import { EntitlementGate } from "../src/entitlement/entitlement-gate.js";
import {
	ManuscriptRepository,
	MAX_CHANGES_PER_COMMIT,
} from "../src/repository/manuscript-repository.js";
import {
	MemoryManuscriptStorage,
	type ManuscriptStorage,
	type StorageChange,
} from "../src/repository/manuscript-storage.js";

const NOW = () => new Date("2026-02-01T00:00:00.000Z");
const PROSE = "The gate opened twice that night. ".repeat(40);
const DIMENSIONS = (["plot", "character", "pacing", "prose", "dialogue", "continuity", "hook"] as const).map(
	(key) => ({ key, score: 84, note: "specific note" }),
);

/**
 * 宿主的 commit 有两条硬约束，内存实现不查：1–128 条变更、同一条路径不许出现两次。
 * 删书要一次删几百个文件，所以这里不是「顺便记一下批量大小」，而是把宿主那两道门照搬过来——
 * 否则实现里少一次 `chunk`，测试照样全绿，装进宿主才炸。
 */
class StrictStorage implements ManuscriptStorage {
	readonly batches: number[] = [];
	private readonly inner = new MemoryManuscriptStorage();

	async list(prefix?: string): Promise<string[]> {
		return this.inner.list(prefix);
	}

	async readFile(path: string): Promise<string | null> {
		return this.inner.readFile(path);
	}

	async commit(
		changes: readonly StorageChange[],
		options?: { expectedRevision?: string },
	): Promise<{ revision: string; changedPaths: string[] }> {
		if (changes.length < 1 || changes.length > MAX_CHANGES_PER_COMMIT) {
			throw new Error(
				`Plugin storage commit must contain between 1 and ${MAX_CHANGES_PER_COMMIT} changes`,
			);
		}
		const seen = new Set<string>();
		for (const change of changes) {
			if (seen.has(change.path)) throw new Error("Duplicate plugin storage commit path");
			seen.add(change.path);
		}
		this.batches.push(changes.length);
		return this.inner.commit(changes, options);
	}
}

/** 第二批开始拒收：模拟「删到一半断了」，用来验证删书的顺序不是摆设。 */
class FailingAfterFirstBatch extends StrictStorage {
	private armed = false;
	private allowed = 0;

	arm(): void {
		this.armed = true;
		this.allowed = 1;
	}

	override async commit(
		changes: readonly StorageChange[],
		options?: { expectedRevision?: string },
	): Promise<{ revision: string; changedPaths: string[] }> {
		if (this.armed) {
			if (this.allowed === 0) throw new Error("disk went away");
			this.allowed -= 1;
		}
		return super.commit(changes, options);
	}
}

async function studio(storage: ManuscriptStorage = new StrictStorage()) {
	const gate = new EntitlementGate(storage, NOW);
	await gate.load();
	const repository = new ManuscriptRepository(storage, () => NOW().toISOString());
	const service = new StudioService(repository, gate, NOW);
	return { storage, gate, repository, service };
}

/** 建一本书并推到 drafting：章节日志只有在这一阶段才真的落文件。 */
async function draftedBook(service: StudioService, title = "Salt") {
	const created = await service.createBook({
		title,
		genre: "SF",
		premise: "A city that forgets",
		// 弧的右端不能越过目标章数，而这条用例要铺 300 章正文。
		targetChapters: 300,
	});
	if (!created.ok) throw new Error(created.error);
	const bookId = created.data.id;
	await service.acceptBrief(bookId);
	const planned = await service.savePlan(
		{ title: "V", goal: "g", hook: "h", arcs: [{ title: "A", goal: "g", from: 1, to: 300 }] },
		bookId,
	);
	if (!planned.ok) throw new Error(planned.error);
	const chapters = Array.from({ length: 300 }, (_, index) => ({
		n: index + 1,
		title: `Chapter ${index + 1}`,
	}));
	const outlined = await service.saveOutlines({ chapters }, bookId);
	if (!outlined.ok) throw new Error(outlined.error);
	const drafting = await service.startDrafting(bookId);
	if (!drafting.ok) throw new Error(drafting.error);
	return bookId;
}

describe("deleting a book", () => {
	it("removes the whole book, the index entry, and nothing else", async () => {
		const { repository, service } = await studio();
		const bookId = await draftedBook(service);
		await service.saveChapter({ n: 1, content: PROSE }, bookId);
		await service.saveReview({ n: 1, score: 84, dimensions: DIMENSIONS, mustFix: [] }, bookId);
		await service.flagThread({ content: "the gate", plantedIn: 1, dueIn: 2, weight: "light" }, bookId);
		await service.commitChapter(1, bookId);

		const keep = await service.createBook({
			title: "Keep",
			genre: "SF",
			premise: "stays",
			targetChapters: 2,
		});
		if (!keep.ok) throw new Error(keep.error);
		expect((await repository.listBooks()).length).toBe(2);

		const removed = await service.deleteBook(bookId);
		expect(removed.ok).toBe(true);

		// 索引里那一行没了，别人的书还在。
		expect((await repository.listBooks()).map((entry) => entry.id)).toEqual([keep.data.id]);
		// 目录里一个文件都不能剩：漏一个，下一次 list 会把它捧成一本残缺的书。
		expect(await repository.loadBook(bookId)).toBeNull();
		expect(await repository.readChapter(bookId, 1)).toBe("");
	});

	it("splits the removals into commits the host will accept", async () => {
		const storage = new StrictStorage();
		const { service } = await studio(storage);
		const bookId = await draftedBook(service);
		// 138 章正文 = 138 个文件，超过宿主 128 条的上限，一波删不完。
		for (let n = 1; n <= 138; n += 1) {
		const saved = await service.saveChapter({ n, content: PROSE }, bookId);
		if (!saved.ok) throw new Error(`${n}: ${saved.error}`);
	}
		storage.batches.length = 0;

		const removed = await service.deleteBook(bookId);
		expect(removed.ok).toBe(true);

		expect(storage.batches.length).toBeGreaterThan(1);
		expect(Math.max(...storage.batches)).toBeLessThanOrEqual(MAX_CHANGES_PER_COMMIT);
		expect(Math.min(...storage.batches)).toBeGreaterThan(0);
	});

	it("keeps the book readable when a later batch fails", async () => {
		// `book.json` 是最后一批才删的，所以中途失败时这本书仍然读得出来、也仍然能再删一次。
		// 顺序反过来先删 `book.json`，中途失败就留下「索引里有、打开却什么都没有」的空壳。
		const storage = new FailingAfterFirstBatch();
		const { repository, service } = await studio(storage);
		const bookId = await draftedBook(service);
		for (let n = 1; n <= 138; n += 1) {
		const saved = await service.saveChapter({ n, content: PROSE }, bookId);
		if (!saved.ok) throw new Error(`${n}: ${saved.error}`);
	}

		storage.arm();
		const failed = await service.deleteBook(bookId);
		expect(failed.ok).toBe(false);
		if (!failed.ok) expect(failed.error).toBe("write-failed");

		expect(await repository.loadBook(bookId)).not.toBeNull();
		expect((await repository.listBooks()).map((entry) => entry.id)).toEqual([bookId]);
	});

	it("clears the stale revision so the retry is not the same conflict forever", async () => {
		// 冲突时留着旧基线，用户点「重试」拿到的还是同一个冲突——他们会以为按钮坏了。
		const { storage, service } = await studio();
		const bookId = await draftedBook(service);
		// 绕过服务直接写一次存储：服务手里的 revision 立刻过期。
		await storage.commit([{ type: "write", path: "probe.txt", data: "x", encoding: "utf8" }]);

		const conflict = await service.deleteBook(bookId);
		expect(conflict.ok).toBe(false);
		if (!conflict.ok) expect(conflict.error).toBe("revision-conflict");

		const retry = await service.deleteBook(bookId);
		expect(retry.ok).toBe(true);
	});

	it("reports an unknown id instead of pretending it worked", async () => {
		const { service } = await studio();
		const missing = await service.deleteBook("no-such-book");
		expect(missing.ok).toBe(false);
		if (!missing.ok) expect(missing.error).toBe("book-not-found");
	});
});

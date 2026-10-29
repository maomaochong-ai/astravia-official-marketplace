/**
 * 稿件仓储：一本书 = 一个 `book.json`（事实）+ 每章一个正文文件（ADR 0005）。
 *
 * 所有写入走一次 `commit()`：正文、章节状态、作品索引同批发布，不存在"正文写了但状态没变"。
 */

import type { NovelBook, ReviewReport, StoryThread } from "../domain/novel-types.js";
import type { ManuscriptStorage, StorageChange } from "./manuscript-storage.js";

export const BOOK_INDEX_PATH = "books/index.json";

export function bookMetaPath(bookId: string): string {
	return `books/${bookId}/book.json`;
}

export function chapterPath(bookId: string, n: number): string {
	return `books/${bookId}/chapters/${n}.md`;
}

export function reviewPath(bookId: string, n: number): string {
	return `books/${bookId}/reviews/${n}.json`;
}

export function decisionsPath(bookId: string): string {
	return `decisions/${bookId}.jsonl`;
}

/** 伏笔台账：与 decisions 同级，不进 book.json（ADR 0021 §1）。 */
export function threadsPath(bookId: string): string {
	return `threads/${bookId}.json`;
}

export interface BookIndexEntry {
	id: string;
	title: string;
	phase: NovelBook["phase"];
	currentChapter: number;
	committedCount: number;
	targetChapters: number;
	/** 已提交章的字数合计。旧索引没有这个字段时按 0 读，不迁移（ADR 0020 §2）。 */
	words?: number;
	/** 书库卡片要显示题材与简介；同样只需索引，不必打开每本书（ADR 0020 §2）。 */
	genre?: string;
	premise?: string;
	updatedAt: string;
}

export interface SaveBundle {
	book: NovelBook;
	chapters?: { n: number; text: string }[];
	reviews?: ReviewReport[];
	decisions?: string[];
	/** 台账整份写入（小、且每次变更都全量覆盖，避免追加式合并的竞态）。 */
	threads?: StoryThread[];
	/** 乐观并发：传入上一次读到的 revision，落后即失败（ADR 0005 规则三）。 */
	expectedRevision?: string;
}

export type SaveOutcome =
	| { ok: true; revision: string }
	| { ok: false; error: "revision-conflict" | "write-failed"; detail: string };

function toIndexEntry(book: NovelBook): BookIndexEntry {
	return {
		id: book.id,
		title: book.title,
		phase: book.phase,
		currentChapter: book.progress.currentChapter,
		committedCount: book.progress.committedCount,
		targetChapters: book.targetChapters,
		genre: book.genre,
		premise: book.premise,
		words: book.chapters.reduce((total, chapter) => total + (chapter.status === "committed" ? chapter.words : 0), 0),
		updatedAt: book.updatedAt,
	};
}

function parseJson<T>(raw: string | null): T | null {
	if (!raw) return null;
	try {
		return JSON.parse(raw) as T;
	} catch {
		return null;
	}
}

export class ManuscriptRepository {
	constructor(
		private readonly storage: ManuscriptStorage,
		private readonly now: () => string,
	) {}

	async listBooks(): Promise<BookIndexEntry[]> {
		const raw = await this.storage.readFile(BOOK_INDEX_PATH, "utf8");
		const entries = parseJson<BookIndexEntry[]>(raw) ?? [];
		return [...entries].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
	}

	async loadBook(bookId: string): Promise<NovelBook | null> {
		const raw = await this.storage.readFile(bookMetaPath(bookId), "utf8");
		const book = parseJson<NovelBook>(raw);
		if (!book) return null;
		return book.schemaVersion === 1 ? book : migrate(book);
	}

	async readChapter(bookId: string, n: number): Promise<string> {
		return (await this.storage.readFile(chapterPath(bookId, n), "utf8")) ?? "";
	}

	async readReview(bookId: string, n: number): Promise<ReviewReport | null> {
		const raw = await this.storage.readFile(reviewPath(bookId, n), "utf8");
		return parseJson<ReviewReport>(raw);
	}

	async readThreads(bookId: string): Promise<StoryThread[]> {
		const raw = await this.storage.readFile(threadsPath(bookId), "utf8");
		const parsed = parseJson<StoryThread[]>(raw);
		return Array.isArray(parsed) ? parsed : [];
	}

	async readDecisions(bookId: string): Promise<string[]> {
		const raw = await this.storage.readFile(decisionsPath(bookId), "utf8");
		if (!raw) return [];
		return raw.split("\n").filter((line) => line.trim().length > 0);
	}

	/**
	 * 一次推进 = 一次 commit。索引整表重算后一并写入，避免"作品列表落后于作品本身"。
	 */
	async save(bundle: SaveBundle): Promise<SaveOutcome> {
		const { book } = bundle;
		const index = await this.listBooks();
		const others = index.filter((entry) => entry.id !== book.id);
		const nextIndex = [toIndexEntry(book), ...others].sort((a, b) =>
			b.updatedAt.localeCompare(a.updatedAt),
		);

		const changes: StorageChange[] = [
			{ type: "write", path: bookMetaPath(book.id), data: JSON.stringify(book), encoding: "utf8" },
			{
				type: "write",
				path: BOOK_INDEX_PATH,
				data: JSON.stringify(nextIndex),
				encoding: "utf8",
			},
		];

		for (const chapter of bundle.chapters ?? []) {
			changes.push({
				type: "write",
				path: chapterPath(book.id, chapter.n),
				data: chapter.text,
				encoding: "utf8",
			});
		}
		for (const review of bundle.reviews ?? []) {
			changes.push({
				type: "write",
				path: reviewPath(book.id, review.chapter),
				data: JSON.stringify(review),
				encoding: "utf8",
			});
		}
		if (bundle.threads) {
			changes.push({
				type: "write",
				path: threadsPath(book.id),
				data: JSON.stringify(bundle.threads),
				encoding: "utf8",
			});
		}
		if (bundle.decisions?.length) {
			const previous = await this.readDecisions(book.id);
			const lines = [...previous, ...bundle.decisions].join("\n");
			changes.push({ type: "write", path: decisionsPath(book.id), data: `${lines}\n`, encoding: "utf8" });
		}

		try {
			const result = await this.storage.commit(changes, {
				expectedRevision: bundle.expectedRevision,
			});
			return { ok: true, revision: result.revision };
		} catch (error) {
			const detail = error instanceof Error ? error.message : String(error);
			if (detail.includes("revision-conflict")) {
				return { ok: false, error: "revision-conflict", detail };
			}
			return { ok: false, error: "write-failed", detail };
		}
	}

	nowIso(): string {
		return this.now();
	}
}

/**
 * 迁移入口。当前只有 v1，函数存在的意义是让"读到未来版本"显式失败而不是静默降级。
 */
function migrate(raw: NovelBook & { schemaVersion?: number }): NovelBook {
	if ((raw.schemaVersion ?? 0) > 1) {
		throw new Error(`book ${raw.id} uses schemaVersion ${raw.schemaVersion}, newer than this plugin`);
	}
	return { ...raw, schemaVersion: 1 };
}

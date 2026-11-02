/**
 * 稿件仓储：一本书 = 一个 `book.json`（事实）+ 每章一个正文文件（ADR 0005）。
 *
 * 所有写入走一次 `commit()`：正文、章节状态、作品索引同批发布，不存在"正文写了但状态没变"。
 */

import type { NovelBook, ReviewReport, StoryThread } from "../domain/novel-types.js";
import { storageErrorText, type ManuscriptStorage, type StorageChange } from "./manuscript-storage.js";

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
	// 基线不由调用方传：宿主的 revision 属于整个插件命名空间，任何缓存下来的都会在被
	// 凭证、活动流、另一本书推进后变成假冲突，所以只能由仓储在写前现读。
}

export type SaveOutcome =
	| { ok: true; revision: string }
	| { ok: false; error: "revision-conflict" | "write-failed"; detail: string };

export type DeleteOutcome =
	| { ok: true; revision: string; removedPaths: number }
	| {
			ok: false;
			error: "book-not-found" | "revision-conflict" | "write-failed" | "storage-unavailable";
			detail: string;
	  };

/**
 * 宿主一次 `commit()` 最多接受 128 条变更（`commitPluginStorage` 的硬上限），且同一路径不许出现两次。
 * 一本 120 章的书光正文就是 120 个文件，加上评审与目录，一次 commit 装不下——所以删书必须分批。
 */
export const MAX_CHANGES_PER_COMMIT = 128;

/**
 * 一次保存最多试两遍。第一遍冲突先重读一遍确认：宿主的 revision 覆盖整个命名空间，
 * 凭证、活动流、另一本书都会推进它，而它们跟这本书是否能写毫无关系。
 */
const SAVE_ATTEMPTS = 2;

function chunk<T>(items: readonly T[], size: number): T[][] {
	const out: T[][] = [];
	for (let index = 0; index < items.length; index += size) out.push(items.slice(index, index + size));
	return out;
}

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

function commitFailure(error: unknown): { ok: false; error: "revision-conflict" | "write-failed"; detail: string } {
	const detail = error instanceof Error ? error.message : String(error);
	if (detail.includes("revision-conflict")) return { ok: false, error: "revision-conflict", detail };
	return { ok: false, error: "write-failed", detail };
}

function parseJson<T>(raw: string | null): T | null {
	if (!raw) return null;
	try {
		return JSON.parse(raw) as T;
	} catch {
		return null;
	}
}

/** FNV-1a：只要「这次读到的内容是否还是上次那份」，不需要密码学强度。 */
function fingerprint(paths: readonly string[], files: Record<string, string | null>): string {
	let hash = 0x811c9dc5;
	for (const path of paths) {
		const content = files[path] ?? "";
		for (let index = 0; index < path.length; index += 1) {
			hash = Math.imul(hash ^ path.charCodeAt(index), 0x01000193);
		}
		hash = Math.imul(hash ^ content.length, 0x01000193);
		for (let index = 0; index < content.length; index += 1) {
			hash = Math.imul(hash ^ content.charCodeAt(index), 0x01000193);
		}
	}
	return (hash >>> 0).toString(16).padStart(8, "0");
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
		return this.parseBook(await this.storage.readFile(bookMetaPath(bookId), "utf8"));
	}

	/** 当前已发布的 revision。宿主不支持原子读时是 undefined，等于这次不设基线。 */
	async currentRevision(): Promise<string | undefined> {
		if (!this.storage.readSnapshot) return undefined;
		return (await this.storage.readSnapshot([BOOK_INDEX_PATH], "utf8")).revision;
	}

	/**
	 * 书架与某一本书在盘上的指纹，给界面轮询用。
	 *
	 * 这里刻意不用宿主的 revision：活动流每 1.2 秒写一次 `console/feed.json`，拿它当指纹
	 * 会让界面无休止地重读。只有书自己的文件变了才算变，且一次原子读拿齐。
	 */
	async shelfSignature(bookId?: string): Promise<string> {
		const paths = bookId ? [BOOK_INDEX_PATH, bookMetaPath(bookId)] : [BOOK_INDEX_PATH];
		if (this.storage.readSnapshot) {
			const snapshot = await this.storage.readSnapshot(paths, "utf8");
			return fingerprint(paths, snapshot.files);
		}
		const files: Record<string, string | null> = {};
		for (const path of paths) files[path] = await this.storage.readFile(path, "utf8");
		return fingerprint(paths, files);
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
		let failure: Extract<SaveOutcome, { ok: false }> | null = null;

		for (let attempt = 0; attempt < SAVE_ATTEMPTS; attempt += 1) {
			const observed = await this.observe(book.id);
			const onDisk = observed.book?.rev ?? 0;
			// 只有「这本书自己被改过」才是真冲突：手里的账本是旧的，盖回去会丢别人的改动。
			if (observed.book && (book.rev ?? 0) !== onDisk) {
				return {
					ok: false,
					error: "revision-conflict",
					detail: `book ${book.id} was written by someone else (on disk rev ${onDisk}, in hand ${book.rev ?? 0})`,
				};
			}

			const next: NovelBook = { ...book, rev: onDisk + 1 };
			try {
				const result = await this.storage.commit(await this.buildChanges(next, bundle), {
					expectedRevision: observed.revision,
				});
				// 手里的账本跟着前进：调用方拿着返回值接着写，不该自带一个落后一版的 rev。
				book.rev = next.rev;
				return { ok: true, revision: result.revision };
			} catch (error) {
				failure = commitFailure(error);
				if (failure.error !== "revision-conflict") return failure;
				// 宿主没给基线时重读也拿不到新值，再试一次只会撞同一个冲突。
				if (observed.revision === undefined) break;
			}
		}

		return failure ?? { ok: false, error: "write-failed", detail: "commit was never attempted" };
	}

	/**
	 * 原子读一次「这本书 + 当前 revision」。
	 * 每次写之前都现读：这才是修掉「书库写入一直报版本冲突」的地方——
	 * 之前把一次 commit 的 revision 当会话级账本用，而它 1.2 秒后就会被活动流写旧。
	 */
	private async observe(bookId: string): Promise<{ book: NovelBook | null; revision: string | undefined }> {
		const meta = bookMetaPath(bookId);
		if (!this.storage.readSnapshot) {
			return { book: await this.loadBook(bookId), revision: undefined };
		}
		const snapshot = await this.storage.readSnapshot([meta], "utf8");
		return { book: this.parseBook(snapshot.files[meta] ?? null), revision: snapshot.revision };
	}

	private parseBook(raw: string | null): NovelBook | null {
		const book = parseJson<NovelBook>(raw);
		if (!book) return null;
		return book.schemaVersion === 1 ? book : migrate(book);
	}

	/** 一次推进 = 一次 commit 全部变更：正文、索引、台账同批发布，不存在写了一半的中间态。 */
	private async buildChanges(book: NovelBook, bundle: SaveBundle): Promise<StorageChange[]> {
		const index = await this.listBooks();
		const others = index.filter((entry) => entry.id !== book.id);
		const nextIndex = [toIndexEntry(book), ...others].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

		const changes: StorageChange[] = [
			{ type: "write", path: bookMetaPath(book.id), data: JSON.stringify(book), encoding: "utf8" },
			{ type: "write", path: BOOK_INDEX_PATH, data: JSON.stringify(nextIndex), encoding: "utf8" },
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

		return changes;
	}

	/**
	 * 一本书自己的文件清单。
	 *
	 * **不把前缀交给宿主的 `list(prefix)`。** 宿主会先对前缀跑一遍路径校验，`books/<id>/` 这根
	 * 尾斜杠会被切成一个空分段、直接报错——删除就是这样在真宿主上整条失败的（0.4.33）。
	 * 前缀匹配本来只是字符串比较，放在这里做，宿主的入参形状就不再是删除能不能成功的前提；
	 * `list()` 不带参数时宿主不会跑那段校验，返回值也涵盖整个命名空间。
	 */
	private async listUnder(prefix: string): Promise<string[]> {
		const all = await this.storage.list();
		return all.filter((path) => path.startsWith(prefix));
	}

	/**
	 * 删掉一本书：它的全部文件、它的决策流水与伏笔台账，以及索引里的那一行。
	 *
	 * 两条顺序是刻意的：
	 *
	 * 1. **文件先删，`book.json` 最后删。** 分批写不可能既删完又原子；万一中途失败，
	 *    只要 `book.json` 还在、索引里还有这一行，这本书就仍然可读、也仍然可以再删一次。
	 *    反过来先删 `book.json` 会留下一个「索引里有、打开却什么都没有」的空壳。
	 * 2. **索引最后写。** 它是唯一的人可见真相：索引里的那一行消失，就等于这本书没了。
	 *
	 * 每一批都带上一次的 revision；撞上的是与这本书无关的写入（活动流、凭证）时，
	 * 允许首次提交刷新一次基线重放——那时还一个文件都没删，`remove` 又幂等。
	 */
	async deleteBook(bookId: string): Promise<DeleteOutcome> {
		const index = await this.listBooks();
		if (!index.some((entry) => entry.id === bookId)) {
			return { ok: false, error: "book-not-found", detail: bookId };
		}

		const meta = bookMetaPath(bookId);
		let owned: string[];
		try {
			owned = await this.listUnder(`books/${bookId}/`);
		} catch (error) {
			// 读不出目录就不能假装删了，也不能把宿主的 IPC 错误整串抄到用户屏幕上。
			return { ok: false, error: "storage-unavailable", detail: storageErrorText(error) };
		}
		const payload = owned.filter((path) => path !== meta);
		const nextIndex = index.filter((entry) => entry.id !== bookId);

		// 基线现读：缓存会给「第一次失败之后就永远是同一个冲突」。
		let revision = await this.currentRevision();
		let removed = 0;
		// 第一次提交允许一次基线刷新重试：撞上的可能是与这本书无关的写入（活动流、凭证）。
		// 此时还一个文件都没删，`remove` 又幂等，重放是安全的；之后再冲突就认账——
		// 宁可让用户重来一次，也不能删了一半还报成功。
		let canRefresh = true;
		const publish = async (changes: StorageChange[]): Promise<{ revision: string }> => {
			try {
				return await this.storage.commit(changes, { expectedRevision: revision });
			} catch (error) {
				const failure = commitFailure(error);
				if (!canRefresh || failure.error !== "revision-conflict") throw error;
				const fresh = await this.currentRevision();
				if (fresh === undefined) throw error;
				canRefresh = false;
				revision = fresh;
				return await this.storage.commit(changes, { expectedRevision: fresh });
			}
		};

		try {
			for (const batch of chunk(payload, MAX_CHANGES_PER_COMMIT)) {
				const result = await publish(batch.map((path) => ({ type: "remove" as const, path })));
				revision = result.revision;
				removed += batch.length;
			}

			// `remove` 对不存在的路径是幂等的（宿主直接 `delete files[path]`），所以不必先探测。
			const tail: StorageChange[] = [
				{ type: "remove", path: decisionsPath(bookId) },
				{ type: "remove", path: threadsPath(bookId) },
				{ type: "remove", path: meta },
				{ type: "write", path: BOOK_INDEX_PATH, data: JSON.stringify(nextIndex), encoding: "utf8" },
			];
			const result = await publish(tail);
			// 计数从 tail 派生：以后往 tail 里再加一条 remove，这里不会默不作声地少算。
			const tailRemovals = tail.filter((change) => change.type === "remove").length;
			return { ok: true, revision: result.revision, removedPaths: removed + tailRemovals };
		} catch (error) {
			const failure = commitFailure(error);
			// 分批删到一半才撞上冲突：书已经少了一批文件，索引却还在，界面上仍是「完整的书」。
			// 「没删掉」这三个字会把这种半删状态藏起来，所以把已删数目带回去——
			// 至少下次重试或写报告时，看得出它不是一个干净的成功，也不是一个干净的不发生。
			if (removed === 0) return failure;
			return {
				...failure,
				detail: `${failure.detail} | stopped after removing ${removed} of ${payload.length + 3} file(s)`,
			};
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

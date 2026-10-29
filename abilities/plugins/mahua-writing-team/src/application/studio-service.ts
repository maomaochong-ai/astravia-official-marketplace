/**
 * 应用层：工具（给模型用）与工作台视图（给人用）唯一的写入口。
 *
 * 存在这一层的原因：如果工具直接改存储、视图直接改存储，两条路径的校验与阶段转移就会
 * 各自漂移（ADR 0001 要的"唯一一处算下一步"也就保不住）。
 */

import {
	acceptBrief,
	attachChapterFacts,
	closeArc,
	commitChapter,
	createBook as buildBook,
	expandArc,
	finalizeBook,
	reopenBook as reopen,
	recordFeedback,
	resolveFeedback,
	saveArcSummary,
	saveChapterDraft,
	saveChapterOutline,
	saveChapterPlan,
	saveChapterReview,
	saveFoundation as writeFoundation,
	saveUserRules as writeUserRules,
	saveVolumePlan,
	saveVolumeSummary,
	reviseOutlineTail,
	startDrafting,
} from "../domain/novel-progress.js";
import { analyzeStyle } from "../domain/style-analysis.js";
import { buildContext, type ContextPack } from "../domain/context-pack.js";
import { checkConsistency } from "../domain/consistency.js";
import { extractChapterFacts } from "../domain/chapter-facts.js";
import { lintChapter, normalizeRules, type WritingRules } from "../domain/writing-rules.js";
import { routeNovel } from "../domain/novel-flow.js";
import { auditPremise, parsePremise, type PremiseParse } from "../domain/premise.js";
import {
	addThread,
	auditThreads,
	closeThread as closeStoryThread,
	type ThreadAudit,
	type ThreadInput,
} from "../domain/threads.js";
import type {
	Arc,
	ArbitrationRecord,
	ArbitrationScenario,
	Finding,
	Foundation,
	Instruction,
	NovelBook,
	ReviewDimension,
	ReviewReport,
	StyleStats,
	Volume,
	StoryThread,
} from "../domain/novel-types.js";
import type { BookIndexEntry, ManuscriptRepository } from "../repository/manuscript-repository.js";
import type { EntitlementGate } from "../entitlement/entitlement-gate.js";
import type { EntitlementState } from "../entitlement/verify-entitlement.js";

export type ServiceResult<T> =
	| { ok: true; data: T }
	| { ok: false; error: string; detail?: string };

function failure<T>(error: string, detail?: string): ServiceResult<T> {
	return detail ? { ok: false, error, detail } : { ok: false, error };
}

export interface BookStatus {
	book: NovelBook;
	instruction: Instruction | null;
	currentWords: number;
	pendingRewrite: number[];
}

export interface CreateBookRequest {
	title: string;
	genre: string;
	premise: string;
	targetChapters: number;
	styleSample?: string;
}

export interface VolumePlanRequest {
	id?: string;
	title: string;
	goal: string;
	hook: string;
	arcs: { id?: string; title: string; goal: string; from: number; to: number }[];
}

export interface ArbitrateRequest {
	scenario: ArbitrationScenario;
	question: string;
	decision: string;
	rationale?: string;
}

/** 中文按字计、英文按词计——两种稿件的"字数"都要说得过去。 */
export function countWords(text: string): number {
	const cjk = text.match(/[\u3400-\u4dbf\u4e00-\u9fff\u3040-\u30ff]/g)?.length ?? 0;
	const latin = text
		.replace(/[\u3400-\u4dbf\u4e00-\u9fff\u3040-\u30ff]/g, " ")
		.split(/\s+/)
		.filter((token) => /[A-Za-z0-9]/.test(token)).length;
	return cjk + latin;
}

export class StudioService {
	/**
	 * 存储层的**全局** revision（SDK：一次 commit 发布整个插件命名空间的一个 revision）。
	 * 不是每本一个：写过书 B 之后书 A 的旧值就作废了，按书缓存会造出一次假冲突。
	 * 会话第一次写之前它是 undefined，那一次不设基线；之后每一次都带上。
	 */
	private revision: string | undefined;

	constructor(
		private readonly repository: ManuscriptRepository,
		private readonly gate: EntitlementGate,
		private readonly now: () => Date,
	) {}

	private nowIso(): string {
		return this.now().toISOString();
	}

	async listBooks(): Promise<ServiceResult<BookIndexEntry[]>> {
		return { ok: true, data: await this.repository.listBooks() };
	}

	async loadLatestBook(): Promise<NovelBook | null> {
		const books = await this.repository.listBooks();
		const first = books[0];
		if (!first) return null;
		return this.repository.loadBook(first.id);
	}

	async status(bookId?: string): Promise<ServiceResult<BookStatus>> {
		const book = await this.resolveBook(bookId);
		if (!book) return failure("book-not-found", bookId ?? "no book has been created yet");
		const currentWords = book.chapters.find((c) => c.n === book.progress.currentChapter)?.words ?? 0;
		return {
			ok: true,
			data: {
				book,
				instruction: routeNovel(book),
				currentWords,
				pendingRewrite: book.progress.pendingRewrite,
			},
		};
	}

	async nextInstruction(bookId?: string): Promise<ServiceResult<Instruction | null>> {
		const book = await this.resolveBook(bookId);
		if (!book) return failure("book-not-found");
		return { ok: true, data: routeNovel(book) };
	}

	async createBook(request: CreateBookRequest): Promise<ServiceResult<NovelBook>> {
		const denied = this.requireEntitlement<NovelBook>();
		if (denied) return denied;
		if (!request.title?.trim()) return failure("invalid-input", "title is required");
		if (!request.genre?.trim()) return failure("invalid-input", "genre is required");
		if (!request.premise?.trim()) return failure("invalid-input", "premise is required");
		if (!Number.isInteger(request.targetChapters) || request.targetChapters < 1) {
			return failure("invalid-input", "targetChapters must be a positive integer");
		}

		const existing = await this.repository.listBooks();
		if (existing.some((entry) => entry.title === request.title.trim())) {
			return failure("duplicate-title", "a book with this title already exists");
		}

		const id = this.uniqueId(request.title, existing.map((entry) => entry.id));
		const book = buildBook(
			{
				id,
				title: request.title,
				genre: request.genre,
				premise: request.premise,
				targetChapters: request.targetChapters,
				styleSample: request.styleSample,
			},
			this.nowIso(),
		);
		return this.persist(book);
	}

	async acceptBrief(bookId?: string): Promise<ServiceResult<NovelBook>> {
		const denied = this.requireEntitlement<NovelBook>();
		if (denied) return denied;
		const book = await this.resolveBook(bookId);
		if (!book) return failure("book-not-found");
		const result = acceptBrief(book, this.nowIso());
		return result.ok ? this.persist(result.book) : failure(result.error);
	}

	async savePlan(volume: VolumePlanRequest, bookId?: string): Promise<ServiceResult<NovelBook>> {
		const denied = this.requireEntitlement<NovelBook>();
		if (denied) return denied;
		const book = await this.resolveBook(bookId);
		if (!book) return failure("book-not-found");

		const id = volume.id?.trim() || `vol-${book.volumes.length + 1}`;
		const arcs: Arc[] = volume.arcs.map((arc, index) => ({
			id: arc.id?.trim() || `${id}-arc-${index + 1}`,
			title: arc.title,
			goal: arc.goal,
			from: arc.from,
			to: arc.to,
		}));
		const next: Volume = { id, title: volume.title, goal: volume.goal, hook: volume.hook, arcs };

		const result = saveVolumePlan(book, next, this.nowIso());
		return result.ok ? this.persist(result.book) : failure(result.error);
	}

	async startDrafting(bookId?: string): Promise<ServiceResult<NovelBook>> {
		const denied = this.requireEntitlement<NovelBook>();
		if (denied) return denied;
		const book = await this.resolveBook(bookId);
		if (!book) return failure("book-not-found");
		const result = startDrafting(book, this.nowIso());
		return result.ok ? this.persist(result.book) : failure(result.error);
	}

	/**
	 * 批章纲：一个弧一次写完，只落一次盘。架构师不该为 6 章发 6 次写请求，
	 * 失败时也不会留下半个弧的章纲。
	 */
	async saveOutlines(
		input: { chapters: { n: number; title: string }[] },
		bookId?: string,
	): Promise<ServiceResult<NovelBook>> {
		const denied = this.requireEntitlement<NovelBook>();
		if (denied) return denied;
		if (input.chapters.length === 0) return failure("invalid-input", "chapters must not be empty");
		const book = await this.resolveBook(bookId);
		if (!book) return failure("book-not-found");

		let working = book;
		for (const chapter of input.chapters) {
			const result = saveChapterOutline(working, chapter, this.nowIso());
			if (!result.ok) return failure(result.error);
			working = result.book;
		}
		return this.persist(working);
	}

	/**
	 * 尾段重写章纲：只能动还没写的章，理由进决策账本（ADR 0015）。
	 *
	 * 返回四个事实，不返回“接下来该去写第几章”——那是 `next_instruction` 的事。
	 */
	async reviseOutline(
		input: { fromChapter: number; replacement: { chapter: number; title: string }[]; reason: string },
		bookId?: string,
	): Promise<ServiceResult<{ from: number; to: number; replaced: number; dropped: number }>> {
		const denied = this.requireEntitlement<{ from: number; to: number; replaced: number; dropped: number }>();
		if (denied) return denied;
		if (!input.reason?.trim()) return failure("invalid-input", "reason is required when the outline is rewritten");
		const book = await this.resolveBook(bookId);
		if (!book) return failure("book-not-found");

		const result = reviseOutlineTail(book, input, this.nowIso());
		if (!result.ok) return failure(result.error);

		const from = input.fromChapter;
		const to = from + input.replacement.length - 1;
		const kept = new Set(input.replacement.map((item) => item.chapter));
		const dropped = book.chapters.filter((chapter) => chapter.n >= from && !kept.has(chapter.n)).length;
		const record: ArbitrationRecord = {
			at: this.nowIso(),
			scenario: "user-intervention",
			question: `outline from chapter ${from} rewritten`,
			decision: `${input.replacement.length} chapters planned, ${from}-${to}`,
			rationale: input.reason.trim(),
		};

		const outcome = await this.repository.save({
			book: result.book,
			decisions: [JSON.stringify(record)],
			expectedRevision: this.revision,
		});
		if (!outcome.ok) return failure(outcome.error, outcome.detail);
		this.revision = outcome.revision;
		return { ok: true, data: { from, to, replaced: input.replacement.length, dropped } };
	}


	/**
	 * 存正文与章节状态：一次 commit 同时写 `chapters/<n>.md` 与 `book.json`（ADR 0005）。
	 */
	async saveChapter(
		input: { n: number; content: string; title?: string },
		bookId?: string,
	): Promise<ServiceResult<NovelBook>> {
		const denied = this.requireEntitlement<NovelBook>();
		if (denied) return denied;
		const book = await this.resolveBook(bookId);
		if (!book) return failure("book-not-found");

		let working = book;
		const existing = book.chapters.find((chapter) => chapter.n === input.n);
		if (!existing || existing.title.trim().length === 0) {
			if (!input.title?.trim()) {
				return failure("outline-required", `chapter ${input.n} has no outline; pass title to create one`);
			}
			const outlined = saveChapterOutline(working, { n: input.n, title: input.title }, this.nowIso());
			if (!outlined.ok) return failure(outlined.error);
			working = outlined.book;
		}

		const words = countWords(input.content);
		const drafted = saveChapterDraft(working, { n: input.n, words }, this.nowIso());
		if (!drafted.ok) return failure(drafted.error);

		// 事实与正文同一次 commit：分开写会留下"有正文但没事实"的中间态。
		const withFacts = attachChapterFacts(
			drafted.book,
			input.n,
			extractChapterFacts(input.content, drafted.book.cast),
			this.nowIso(),
		);

		const outcome = await this.repository.save({
			book: withFacts,
			chapters: [{ n: input.n, text: input.content }],
			expectedRevision: this.revision,
		});
		if (!outcome.ok) {
			return failure(outcome.error, outcome.detail);
		}
		this.revision = outcome.revision;
		return { ok: true, data: withFacts };
	}

	async saveReview(
		input: { n: number; score: number; dimensions: ReviewDimension[]; mustFix: string[] },
		bookId?: string,
	): Promise<ServiceResult<NovelBook>> {
		const denied = this.requireEntitlement<NovelBook>();
		if (denied) return denied;
		const book = await this.resolveBook(bookId);
		if (!book) return failure("book-not-found");

		const report: ReviewReport = {
			chapter: input.n,
			score: input.score,
			dimensions: input.dimensions,
			mustFix: input.mustFix,
			reviewedAt: this.nowIso(),
		};
		const result = saveChapterReview(book, report, this.nowIso());
		if (!result.ok) return failure(result.error);

		const outcome = await this.repository.save({
			book: result.book,
			reviews: [report],
			expectedRevision: this.revision,
		});
		if (!outcome.ok) return failure(outcome.error, outcome.detail);
		this.revision = outcome.revision;
		return { ok: true, data: result.book };
	}

	async commitChapter(n: number, bookId?: string): Promise<ServiceResult<NovelBook>> {
		const denied = this.requireEntitlement<NovelBook>();
		if (denied) return denied;
		const book = await this.resolveBook(bookId);
		if (!book) return failure("book-not-found");
		const result = commitChapter(book, n, this.nowIso());
		return result.ok ? this.persist(result.book) : failure(result.error);
	}

	async closeArc(bookId?: string): Promise<ServiceResult<NovelBook>> {
		const denied = this.requireEntitlement<NovelBook>();
		if (denied) return denied;
		const book = await this.resolveBook(bookId);
		if (!book) return failure("book-not-found");
		const result = closeArc(book, this.nowIso());
		return result.ok ? this.persist(result.book) : failure(result.error);
	}

	async finalize(bookId?: string): Promise<ServiceResult<NovelBook>> {
		const denied = this.requireEntitlement<NovelBook>();
		if (denied) return denied;
		const book = await this.resolveBook(bookId);
		if (!book) return failure("book-not-found");
		const result = finalizeBook(book, this.nowIso());
		return result.ok ? this.persist(result.book) : failure(result.error);
	}

	async arbitrate(
		request: ArbitrateRequest,
		bookId?: string,
	): Promise<ServiceResult<{ record: string }>> {
		const denied = this.requireEntitlement<{ record: string }>();
		if (denied) return denied;
		const book = await this.resolveBook(bookId);
		if (!book) return failure("book-not-found");
		if (!request.question?.trim() || !request.decision?.trim()) {
			return failure("invalid-input", "question and decision are both required");
		}
		const record: ArbitrationRecord = {
			at: this.nowIso(),
			scenario: request.scenario,
			question: request.question,
			decision: request.decision,
			rationale: request.rationale ?? "",
		};
		// 与其它写路径保持一致：账面版本作为乐观并发基线，否则一次裁定会盖掉同时进行的章节推进。
		const outcome = await this.repository.save({
			book,
			decisions: [JSON.stringify(record)],
			expectedRevision: this.revision,
		});
		if (!outcome.ok) return failure(outcome.error, outcome.detail);
		this.revision = outcome.revision;
		return { ok: true, data: { record: JSON.stringify(record) } };
	}

	async readChapter(n: number, bookId?: string): Promise<ServiceResult<{ n: number; text: string }>> {
		const book = await this.resolveBook(bookId);
		if (!book) return failure("book-not-found");
		const text = await this.repository.readChapter(book.id, n);
		if (!text) return failure("chapter-empty", `chapter ${n} has no text yet`);
		return { ok: true, data: { n, text } };
	}

	async readReview(n: number, bookId?: string): Promise<ServiceResult<ReviewReport | null>> {
		const book = await this.resolveBook(bookId);
		if (!book) return failure("book-not-found");
		return { ok: true, data: await this.repository.readReview(book.id, n) };
	}

	/**
	 * 导出：把已写出的章节拼成一份 Markdown。
	 *
	 * 不写文件：工作区可能是任意 cwd，写到哪里都得用户先选；交给宿主剪贴板，用户自己决定粘到哪。
	 * 无副作用，因此不进门禁（ADR 0005）。
	 */
	async exportManuscript(bookId?: string): Promise<ServiceResult<{ text: string; chapters: number }>> {
		const book = await this.resolveBook(bookId);
		if (!book) return failure("book-not-found");

		const sections: string[] = [`# ${book.title}`, ""];
		let chapters = 0;
		for (const chapter of [...book.chapters].sort((a, b) => a.n - b.n)) {
			const text = await this.repository.readChapter(book.id, chapter.n);
			if (!text || !text.trim()) continue;
			sections.push(`## ${chapter.n}. ${chapter.title}`, "", text.trim(), "");
			chapters += 1;
		}
		if (chapters === 0) return failure("nothing-to-export", "no chapter has prose yet");
		return { ok: true, data: { text: sections.join("\n"), chapters } };
	}

	/**
	 * 激活也只从这里走。门禁负责验签与持久化，视图不该绕过服务层直接写它——
	 * AGENTS.md 的「写操作只有 StudioService 一个入口」不区分业务写与凭证写。
	 * 返回的是新状态而非 ServiceResult：验签失败是"凭证无效"，不是服务失败。
	 */
	async activate(token: string): Promise<EntitlementState> {
		return this.gate.activate(token);
	}

	/** 当前凭证状态。视图渲染徽章用它，避免自己读门禁。 */
	get entitlementState(): EntitlementState {
		return this.gate.current;
	}

	/** 可接受的签发密钥，激活页要显示"信任谁签的"。 */
	trustedKeys() {
		return this.gate.trustedKeys();
	}

	async saveFoundation(
		input: Omit<Foundation, "taboo" | "hook"> & Partial<Pick<Foundation, "taboo" | "hook">> & { cast?: string[] },
		bookId?: string,
	): Promise<ServiceResult<NovelBook>> {
		const denied = this.requireEntitlement<NovelBook>();
		if (denied) return denied;
		const book = await this.resolveBook(bookId);
		if (!book) return failure("book-not-found");
		const foundation: Foundation = {
			theme: input.theme?.trim() ?? "",
			conflict: input.conflict?.trim() ?? "",
			protagonist: input.protagonist?.trim() ?? "",
			ending: input.ending?.trim() ?? "",
			taboo: input.taboo?.trim() ?? "",
			hook: input.hook?.trim() ?? "",
		};
		const result = writeFoundation(book, foundation, input.cast ?? book.cast, this.nowIso());
		return result.ok ? this.persist(result.book) : failure(result.error);
	}

	/** 设定体检：缺项即缺项，不做"差不多齐了"的判断。 */
	async auditFoundation(bookId?: string): Promise<ServiceResult<{ findings: Finding[] }>> {
		const book = await this.resolveBook(bookId);
		if (!book) return failure("book-not-found");
		const findings: Finding[] = [];
		const required: (keyof Foundation)[] = ["theme", "conflict", "protagonist", "ending"];
		for (const key of required) {
			const value = book.foundation?.[key]?.trim() ?? "";
			if (value.length === 0) findings.push({ code: "foundation.missing", severity: "error", detail: key });
		}
		if (book.cast.length === 0) findings.push({ code: "foundation.noCast", severity: "warning" });
		return { ok: true, data: { findings } };
	}

	/**
	 * 解析一段前提文本：读工具，不进门禁，不读写存储（ADR 0015）。
	 *
	 * 与 `auditFoundation` 的分工：它看“一段文本”，后者看“已存的书”。
	 */
	premiseStructure(text: string): ServiceResult<PremiseParse & { findings: Finding[] }> {
		if (!text.trim()) return failure("invalid-input", "text must not be empty");
		return { ok: true, data: { ...parsePremise(text), findings: auditPremise(text) } };
	}

	async saveUserRules(raw: Record<string, unknown>, bookId?: string): Promise<ServiceResult<NovelBook>> {
		const denied = this.requireEntitlement<NovelBook>();
		if (denied) return denied;
		const book = await this.resolveBook(bookId);
		if (!book) return failure("book-not-found");
		const rules = normalizeRules(raw) as unknown as Record<string, string | number | string[]>;
		const result = writeUserRules(book, rules, this.nowIso());
		return result.ok ? this.persist(result.book) : failure(result.error);
	}

	/** 当前生效的写作规则：用户没设过就用默认值，界面不显示"未配置"。 */
	rulesOf(book: NovelBook): WritingRules {
		return normalizeRules(book.userRules as Record<string, unknown>);
	}

	async planChapter(
		input: { n: number; goal: string; conflict: string; hook: string },
		bookId?: string,
	): Promise<ServiceResult<NovelBook>> {
		const denied = this.requireEntitlement<NovelBook>();
		if (denied) return denied;
		const book = await this.resolveBook(bookId);
		if (!book) return failure("book-not-found");
		const result = saveChapterPlan(book, { ...input, at: this.nowIso() }, this.nowIso());
		return result.ok ? this.persist(result.book) : failure(result.error);
	}

	/**
	 * 局部改写：一次只替换一处片段，或用 append 追加。
	 * 不做全文重写——那等于把 writer 的工作搬到工具里，还会吞掉上一版的事实。
	 */
	async editChapter(
		input: { n: number; find?: string; replace?: string; append?: string },
		bookId?: string,
	): Promise<ServiceResult<NovelBook>> {
		const denied = this.requireEntitlement<NovelBook>();
		if (denied) return denied;
		const book = await this.resolveBook(bookId);
		if (!book) return failure("book-not-found");
		const chapter = book.chapters.find((item) => item.n === input.n);
		if (!chapter) return failure("chapter-empty", `chapter ${input.n} has no text yet`);
		if (chapter.status === "committed") return failure("chapter-committed", `chapter ${input.n} is committed`);

		const current = await this.repository.readChapter(book.id, input.n);
		if (!current) return failure("chapter-empty", `chapter ${input.n} has no text yet`);

		let text = current;
		if (input.find !== undefined) {
			if (!input.find.trim()) return failure("invalid-input", "find must be non-empty");
			if (!text.includes(input.find)) return failure("fragment-not-found", "the fragment does not appear verbatim");
			text = text.replace(input.find, input.replace ?? "");
		}
		if (input.append?.trim()) text = `${text.trimEnd()}\n\n${input.append.trim()}`;
		if (text === current) return failure("invalid-input", "nothing to change: pass find or append");

		const words = countWords(text);
		const drafted = saveChapterDraft(book, { n: input.n, words }, this.nowIso());
		if (!drafted.ok) return failure(drafted.error);
		const withFacts = attachChapterFacts(
			drafted.book,
			input.n,
			extractChapterFacts(text, drafted.book.cast),
			this.nowIso(),
		);
		const outcome = await this.repository.save({
			book: withFacts,
			chapters: [{ n: input.n, text }],
			expectedRevision: this.revision,
		});
		if (!outcome.ok) return failure(outcome.error, outcome.detail);
		this.revision = outcome.revision;
		return { ok: true, data: withFacts };
	}

	async expandNextArc(
		input: { volumeId: string; id?: string; title: string; goal: string; from: number; to: number },
		bookId?: string,
	): Promise<ServiceResult<NovelBook>> {
		const denied = this.requireEntitlement<NovelBook>();
		if (denied) return denied;
		const book = await this.resolveBook(bookId);
		if (!book) return failure("book-not-found");
		const arc: Arc = {
			id: input.id?.trim() || `${input.volumeId}-arc-${book.volumes.length + 1}`,
			title: input.title,
			goal: input.goal,
			from: input.from,
			to: input.to,
		};
		const result = expandArc(book, input.volumeId, arc, this.nowIso());
		return result.ok ? this.persist(result.book) : failure(result.error);
	}

	async saveArcSummary(
		input: { arcId: string; summary: string },
		bookId?: string,
	): Promise<ServiceResult<NovelBook>> {
		const denied = this.requireEntitlement<NovelBook>();
		if (denied) return denied;
		const book = await this.resolveBook(bookId);
		if (!book) return failure("book-not-found");
		const result = saveArcSummary(book, input.arcId, input.summary, this.nowIso());
		return result.ok ? this.persist(result.book) : failure(result.error);
	}

	async saveVolumeSummary(
		input: { volumeId: string; summary: string },
		bookId?: string,
	): Promise<ServiceResult<NovelBook>> {
		const denied = this.requireEntitlement<NovelBook>();
		if (denied) return denied;
		const book = await this.resolveBook(bookId);
		if (!book) return failure("book-not-found");
		const result = saveVolumeSummary(book, input.volumeId, input.summary, this.nowIso());
		return result.ok ? this.persist(result.book) : failure(result.error);
	}

	async flagFeedback(
		input: { chapter: number; note: string },
		bookId?: string,
	): Promise<ServiceResult<NovelBook>> {
		const denied = this.requireEntitlement<NovelBook>();
		if (denied) return denied;
		const book = await this.resolveBook(bookId);
		if (!book) return failure("book-not-found");
		const result = recordFeedback(book, input, this.nowIso());
		return result.ok ? this.persist(result.book) : failure(result.error);
	}

	async resolveOutlineFeedback(
		input: { id: string; disposition: "accepted" | "revised" | "rejected"; resolution?: string },
		bookId?: string,
	): Promise<ServiceResult<NovelBook>> {
		const denied = this.requireEntitlement<NovelBook>();
		if (denied) return denied;
		const book = await this.resolveBook(bookId);
		if (!book) return failure("book-not-found");
		const result = resolveFeedback(book, input, this.nowIso());
		return result.ok ? this.persist(result.book) : failure(result.error);
	}

	async checkConsistency(bookId?: string): Promise<ServiceResult<{ findings: Finding[] }>> {
		const book = await this.resolveBook(bookId);
		if (!book) return failure("book-not-found");
		return { ok: true, data: { findings: checkConsistency(book) } };
	}

	async checkRules(
		input: { n: number },
		bookId?: string,
	): Promise<ServiceResult<{ findings: Finding[]; words: number }>> {
		const book = await this.resolveBook(bookId);
		if (!book) return failure("book-not-found");
		const chapter = book.chapters.find((item) => item.n === input.n);
		if (!chapter) return failure("chapter-empty", `chapter ${input.n} has no outline yet`);
		const text = await this.repository.readChapter(book.id, input.n);
		if (!text) return failure("chapter-empty", `chapter ${input.n} has no text yet`);
		const words = countWords(text);
		return { ok: true, data: { findings: lintChapter({ text, words, rules: this.rulesOf(book) }), words } };
	}

	async styleStats(bookId?: string): Promise<ServiceResult<StyleStats>> {
		const book = await this.resolveBook(bookId);
		if (!book) return failure("book-not-found");
		const texts: string[] = [];
		for (const chapter of book.chapters) {
			const text = await this.repository.readChapter(book.id, chapter.n);
			if (text) texts.push(text);
		}
		return { ok: true, data: analyzeStyle(texts) };
	}

	async contextPack(input: { bookId?: string } | undefined): Promise<ServiceResult<ContextPack>> {
		const book = await this.resolveBook(input?.bookId);
		if (!book) return failure("book-not-found");
		const threads = await this.repository.readThreads(book.id);
		return { ok: true, data: buildContext(book, threads) };
	}

	async reopenBook(targetChapters: number, bookId?: string): Promise<ServiceResult<NovelBook>> {
		const denied = this.requireEntitlement<NovelBook>();
		if (denied) return denied;
		const book = await this.resolveBook(bookId);
		if (!book) return failure("book-not-found");
		const result = reopen(book, targetChapters, this.nowIso());
		return result.ok ? this.persist(result.book) : failure(result.error);
	}

	/** 台账读取。只读，不进门禁。 */
	async threads(bookId?: string): Promise<ServiceResult<StoryThread[]>> {
		const book = await this.resolveBook(bookId);
		if (!book) return failure("book-not-found");
		return { ok: true, data: await this.repository.readThreads(book.id) };
	}

	/** 记一笔伏笔。台账与书同一次 commit，不会出现「书推进了、台账没跟上」。 */
	async flagThread(
		input: ThreadInput,
		bookId?: string,
	): Promise<ServiceResult<{ thread: StoryThread; threads: StoryThread[] }>> {
		const denied = this.requireEntitlement<{ thread: StoryThread; threads: StoryThread[] }>();
		if (denied) return denied;
		const book = await this.resolveBook(bookId);
		if (!book) return failure("book-not-found");
		const current = await this.repository.readThreads(book.id);
		const result = addThread(current, input);
		if (!result.ok) return failure(result.error, result.detail);
		const saved = await this.persistThreads(book, result.threads);
		return saved.ok ? { ok: true, data: { thread: result.thread, threads: result.threads } } : saved;
	}

	/** 收一笔伏笔。已收的不重复收，报错而不是静默成功。 */
	async closeThread(
		input: { id: string; chapter: number },
		bookId?: string,
	): Promise<ServiceResult<{ thread: StoryThread; threads: StoryThread[] }>> {
		const denied = this.requireEntitlement<{ thread: StoryThread; threads: StoryThread[] }>();
		if (denied) return denied;
		const book = await this.resolveBook(bookId);
		if (!book) return failure("book-not-found");
		const current = await this.repository.readThreads(book.id);
		const result = closeStoryThread(current, input.id, input.chapter);
		if (!result.ok) return failure(result.error, result.detail);
		const saved = await this.persistThreads(book, result.threads);
		return saved.ok ? { ok: true, data: { thread: result.thread, threads: result.threads } } : saved;
	}

	/** 台账体检。只读，不进门禁；判据全在领域层（ADR 0021 §2）。 */
	async checkThreads(bookId?: string): Promise<ServiceResult<ThreadAudit>> {
		const book = await this.resolveBook(bookId);
		if (!book) return failure("book-not-found");
		const threads = await this.repository.readThreads(book.id);
		return { ok: true, data: auditThreads(threads, this.committedMax(book)) };
	}

	async resolveBook(bookId?: string): Promise<NovelBook | null> {
		if (bookId) return this.repository.loadBook(bookId);
		return this.loadLatestBook();
	}

	/** 门禁在这里判一次，工具与视图都走这里，因此没有"某条路径忘了校验"的可能。 */
	private requireEntitlement<T>(): ServiceResult<T> | null {
		if (this.gate.active) return null;
		return {
			ok: false,
			error: "entitlement-required",
			detail: `plugin is ${this.gate.current.status}; activate a credential in the workspace settings view`,
		};
	}

	private async persist(book: NovelBook): Promise<ServiceResult<NovelBook>> {
		const outcome = await this.repository.save({
			book,
			expectedRevision: this.revision,
		});
		if (!outcome.ok) return failure(outcome.error, outcome.detail);
		this.revision = outcome.revision;
		return { ok: true, data: book };
	}

	/** 台账写入也走一次 commit：书不变，只换 `threads/` 与 revision。 */
	private async persistThreads(
		book: NovelBook,
		threads: StoryThread[],
	): Promise<ServiceResult<StoryThread[]>> {
		const outcome = await this.repository.save({ book, threads, expectedRevision: this.revision });
		if (!outcome.ok) return failure(outcome.error, outcome.detail);
		this.revision = outcome.revision;
		return { ok: true, data: threads };
	}

	private committedMax(book: NovelBook): number {
		return book.chapters.reduce(
			(max, chapter) => (chapter.status === "committed" ? Math.max(max, chapter.n) : max),
			0,
		);
	}

	private uniqueId(title: string, taken: string[]): string {
		const base =
			title
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "-")
				.replace(/^-|-$/g, "")
				.slice(0, 32) || "book";
		if (!taken.includes(base)) return base;
		let index = 2;
		while (taken.includes(`${base}-${index}`)) index += 1;
		return `${base}-${index}`;
	}
}

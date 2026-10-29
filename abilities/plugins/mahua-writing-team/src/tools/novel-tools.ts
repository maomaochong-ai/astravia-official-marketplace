/**
 * 工具注册（ADR 0007）。三类：读 / 写 / 路由。
 *
 * 纪律：写工具只回事实（`{ ok, phase, currentChapter, ... }`），不附带"接下来请调用 X"。
 * 下一步一律由 `mahua_next_instruction` 给出，避免模型看到两个来源。
 */

import type { PluginContext } from "@astravia-org/plugin-sdk";
import type { StudioService } from "../application/studio-service.js";
import { THREAD_WEIGHTS } from "../domain/threads.js";
import type { Instruction, ReviewDimension, ThreadWeight } from "../domain/novel-types.js";
import { DEFAULT_REFERENCE_BUDGET, listReferences, readReference } from "../reference/reference-index.js";
import type { ReferenceKind } from "../reference/reference-types.js";
import { REFERENCE_LIBRARY } from "../reference/library.generated.js";

const SCENARIOS = ["conversation", "project"] as const;

function bookIdProperty(): Record<string, unknown> {
	return { type: "string", description: "Book id. Omit to use the most recently updated book." };
}
/**
 * 工具输出里的理由要给模型看得懂的自然语言，catalog key 留给自己。
 * 语言跟宿主的 `ctx.i18n` 走，因此同一份路由结果在中英文界面下都对。
 */
function localize(ctx: PluginContext, instruction: Instruction | null): Record<string, unknown> | null {
	if (!instruction) return null;
	const { reasonKey, reasonParams, ...facts } = instruction;
	return { ...facts, reason: ctx.i18n.t(reasonKey, reasonParams) };
}

/**
 * 只返事实。下一步只能从 `mahua_next_instruction` 拿（ADR 0007）：
 * 两个出口都报路由结果，模型就会看到两份可能不一致的"下一步"。
 */
function summaryOf(result: Awaited<ReturnType<StudioService["status"]>>): Record<string, unknown> {
	if (!result.ok) return { ok: false, error: result.error, detail: result.detail };
	const { book } = result.data;
	const chapter = book.chapters.find((item) => item.n === book.progress.currentChapter) ?? null;
	return {
		ok: true,
		bookId: book.id,
		title: book.title,
		phase: book.phase,
		currentChapter: book.progress.currentChapter,
		committedCount: book.progress.committedCount,
		targetChapters: book.targetChapters,
		currentChapterStatus: chapter?.status ?? null,
		currentChapterWords: chapter?.words ?? 0,
		pendingRewrite: book.progress.pendingRewrite,
	};
}

export function registerNovelTools(ctx: PluginContext, service: StudioService): void {
	ctx.agent.registerTool<{ bookId?: string }>({
		id: "mahua_list_books",
		label: "Mahua Novels: list books",
		description:
			"List every book in the Mahua Novels studio with its phase, current chapter and progress. Read-only.",
		parameters: { type: "object", properties: {}, additionalProperties: false },
		scope_use: [...SCENARIOS],
		handler: async () => {
			const result = await service.listBooks();
			if (!result.ok) return { ok: false, error: result.error };
			return { ok: true, books: result.data };
		},
	});

	ctx.agent.registerTool<{ bookId?: string }>({
		id: "mahua_book_status",
		label: "Mahua Novels: book status",
		description:
			"Report one book's phase, chapter states, committed count and the instruction the router computed. Read-only; use it before deciding anything.",
		parameters: {
			type: "object",
			properties: { bookId: bookIdProperty() },
			additionalProperties: false,
		},
		scope_use: [...SCENARIOS],
		handler: async (context) => summaryOf(await service.status(context.trigger.input.bookId)),
	});

	ctx.agent.registerTool<{ bookId?: string }>({
		id: "mahua_next_instruction",
		label: "Mahua Novels: next step",
		description:
			"Ask the deterministic router what should happen next: which role acts, on which chapter, and why. Pure function of stored facts; call it instead of inventing the next step.",
		parameters: {
			type: "object",
			properties: { bookId: bookIdProperty() },
			additionalProperties: false,
		},
		scope_use: [...SCENARIOS],
		handler: async (context) => {
			const result = await service.nextInstruction(context.trigger.input.bookId);
			if (!result.ok) return { ok: false, error: result.error, detail: result.detail };
			return { ok: true, instruction: localize(ctx, result.data) };
		},
	});

	ctx.agent.registerTool<{ bookId?: string; chapter: number }>({
		id: "mahua_read_chapter",
		label: "Mahua Novels: read chapter",
		description: "Read the stored manuscript text of one chapter.",
		parameters: {
			type: "object",
			properties: {
				bookId: bookIdProperty(),
				chapter: { type: "number", description: "Chapter number, starting at 1." },
			},
			required: ["chapter"],
			additionalProperties: false,
		},
		scope_use: [...SCENARIOS],
		handler: async (context) => {
			const { bookId, chapter } = context.trigger.input;
			const result = await service.readChapter(chapter, bookId);
			if (!result.ok) return { ok: false, error: result.error, detail: result.detail };
			return { ok: true, chapter, text: result.data.text };
		},
	});

	ctx.agent.registerTool<{
		title: string;
		genre: string;
		premise: string;
		targetChapters: number;
		styleSample?: string;
	}>({
		id: "mahua_create_book",
		label: "Mahua Novels: create book",
		description:
			"Create a book at phase `briefing`. Requires title, genre, one-sentence premise and the target chapter count. Requires an activated credential.",
		parameters: {
			type: "object",
			properties: {
				title: { type: "string" },
				genre: { type: "string", description: "Genre plus target readership, one line." },
				premise: { type: "string", description: "One-sentence logline." },
				targetChapters: { type: "number", description: "Total chapters planned, e.g. 120." },
				styleSample: { type: "string", description: "Optional prose sample used as a voice reference." },
			},
			required: ["title", "genre", "premise", "targetChapters"],
			additionalProperties: false,
		},
		scope_use: [...SCENARIOS],
		handler: async (context) => {
			const result = await service.createBook(context.trigger.input);
			if (!result.ok) return { ok: false, error: result.error, detail: result.detail };
			return {
				ok: true,
				bookId: result.data.id,
				phase: result.data.phase,
				targetChapters: result.data.targetChapters,
			};
		},
	});

	ctx.agent.registerTool<{ bookId?: string }>({
		id: "mahua_accept_brief",
		label: "Mahua Novels: accept brief",
		description:
			"Lock the brief and move the book from `briefing` to `planning`. Fails if title, genre or premise is still empty. Requires an activated credential.",
		parameters: {
			type: "object",
			properties: { bookId: bookIdProperty() },
			additionalProperties: false,
		},
		scope_use: [...SCENARIOS],
		handler: async (context) => {
			const result = await service.acceptBrief(context.trigger.input.bookId);
			if (!result.ok) return { ok: false, error: result.error, detail: result.detail };
			return { ok: true, bookId: result.data.id, phase: result.data.phase };
		},
	});

	ctx.agent.registerTool<{
		bookId?: string;
		volume: {
			id?: string;
			title: string;
			goal: string;
			hook: string;
			arcs: { id?: string; title: string; goal: string; from: number; to: number }[];
		};
	}>({
		id: "mahua_save_plan",
		label: "Mahua Novels: save volume plan",
		description:
			"Store one volume with its arcs. Arc ranges are absolute chapter numbers and must not overlap. Requires an activated credential.",
		parameters: {
			type: "object",
			properties: {
				bookId: bookIdProperty(),
				volume: {
					type: "object",
					properties: {
						id: { type: "string" },
						title: { type: "string" },
						goal: { type: "string", description: "What must be true when this volume ends." },
						hook: { type: "string", description: "The cliffhanger that carries into the next volume." },
						arcs: {
							type: "array",
							minItems: 1,
							items: {
								type: "object",
								properties: {
									id: { type: "string" },
									title: { type: "string" },
									goal: { type: "string" },
									from: { type: "number" },
									to: { type: "number" },
								},
								required: ["title", "goal", "from", "to"],
								additionalProperties: false,
							},
						},
					},
					required: ["title", "goal", "hook", "arcs"],
					additionalProperties: false,
				},
			},
			required: ["volume"],
			additionalProperties: false,
		},
		scope_use: [...SCENARIOS],
		handler: async (context) => {
			const { bookId, volume } = context.trigger.input;
			const result = await service.savePlan(volume, bookId);
			if (!result.ok) return { ok: false, error: result.error, detail: result.detail };
			return { ok: true, bookId: result.data.id, phase: result.data.phase, volumes: result.data.volumes.length };
		},
	});


	ctx.agent.registerTool<{ bookId?: string; chapters: { chapter: number; title: string }[] }>({
		id: "mahua_save_outline",
		label: "Mahua Novels: save chapter outlines",
		description:
			"Store chapter outlines for one arc in a single write. Every chapter number must fall inside a planned arc, and committed chapters are frozen. Requires an activated credential.",
		parameters: {
			type: "object",
			properties: {
				bookId: bookIdProperty(),
				chapters: {
					type: "array",
					minItems: 1,
					items: {
						type: "object",
						properties: {
							chapter: { type: "number" },
							title: { type: "string", description: "One line that states what happens." },
						},
						required: ["chapter", "title"],
						additionalProperties: false,
					},
				},
			},
			required: ["chapters"],
			additionalProperties: false,
		},
		scope_use: [...SCENARIOS],
		handler: async (context) => {
			const { bookId, chapters } = context.trigger.input;
			const result = await service.saveOutlines(
				{ chapters: chapters.map((item) => ({ n: item.chapter, title: item.title })) },
				bookId,
			);
			if (!result.ok) return { ok: false, error: result.error, detail: result.detail };
			return {
				ok: true,
				bookId: result.data.id,
				outlined: chapters.map((item) => item.chapter),
				currentChapter: result.data.progress.currentChapter,
			};
		},
	});

	ctx.agent.registerTool<{
		bookId?: string;
		fromChapter: number;
		replacement: { chapter: number; title: string }[];
		reason: string;
	}>({
		id: "mahua_revise_outline",
		label: "Mahua Novels: revise outline tail",
		description:
			"Replace every chapter outline from `fromChapter` onward with `replacement`. Chapters that already carry prose cannot be crossed. `reason` is recorded in the decision log. Requires an activated credential.",
		parameters: {
			type: "object",
			properties: {
				bookId: bookIdProperty(),
				fromChapter: { type: "number", description: "First chapter to replace, 1-based." },
				replacement: {
					type: "array",
					minItems: 1,
					items: {
						type: "object",
						properties: {
							chapter: { type: "number", description: "Must run from `fromChapter` upward without gaps." },
							title: { type: "string", description: "One line that states what happens." },
						},
						required: ["chapter", "title"],
						additionalProperties: false,
					},
				},
				reason: { type: "string", description: "Why the remaining plan no longer holds." },
			},
			required: ["fromChapter", "replacement", "reason"],
			additionalProperties: false,
		},
		scope_use: [...SCENARIOS],
		handler: async (context) => {
			const { bookId, fromChapter, replacement, reason } = context.trigger.input;
			const result = await service.reviseOutline({ fromChapter, replacement, reason }, bookId);
			if (!result.ok) return { ok: false, error: result.error, detail: result.detail };
			return { ok: true, from: result.data.from, to: result.data.to, replaced: result.data.replaced, dropped: result.data.dropped };
		},
	});

	ctx.agent.registerTool<{ bookId?: string }>({
		id: "mahua_start_drafting",
		label: "Mahua Novels: start drafting",
		description:
			"Move the book from `planning` to `drafting` once at least one volume exists. Requires an activated credential.",
		parameters: {
			type: "object",
			properties: { bookId: bookIdProperty() },
			additionalProperties: false,
		},
		scope_use: [...SCENARIOS],
		handler: async (context) => {
			const result = await service.startDrafting(context.trigger.input.bookId);
			if (!result.ok) return { ok: false, error: result.error, detail: result.detail };
			return { ok: true, bookId: result.data.id, phase: result.data.phase };
		},
	});

	ctx.agent.registerTool<{ bookId?: string; chapter: number; title?: string; content: string }>({
		id: "mahua_save_chapter",
		label: "Mahua Novels: save chapter",
		description:
			"Store chapter prose and move that chapter to `drafting`. If the chapter has no outline yet, pass `title` to create one in the same step. Requires an activated credential.",
		parameters: {
			type: "object",
			properties: {
				bookId: bookIdProperty(),
				chapter: { type: "number" },
				title: { type: "string", description: "Only needed when the chapter has no outline." },
				content: { type: "string", description: "Full chapter prose in Markdown." },
			},
			required: ["chapter", "content"],
			additionalProperties: false,
		},
		scope_use: [...SCENARIOS],
		handler: async (context) => {
			const { bookId, chapter, title, content } = context.trigger.input;
			const result = await service.saveChapter({ n: chapter, title, content }, bookId);
			if (!result.ok) return { ok: false, error: result.error, detail: result.detail };
			const stored = result.data.chapters.find((item) => item.n === chapter);
			return {
				ok: true,
				bookId: result.data.id,
				chapter,
				status: stored?.status ?? null,
				words: stored?.words ?? 0,
			};
		},
	});

	ctx.agent.registerTool<{
		bookId?: string;
		chapter: number;
		score: number;
		dimensions: ReviewDimension[];
		mustFix: string[];
	}>({
		id: "mahua_save_review",
		label: "Mahua Novels: save review",
		description:
			"Store a seven-dimension review. The chapter is marked `reviewed` only when the score reaches 72 AND `mustFix` is empty; otherwise it is marked `blocked`. Requires an activated credential.",
		parameters: {
			type: "object",
			properties: {
				bookId: bookIdProperty(),
				chapter: { type: "number" },
				score: { type: "number", description: "Weighted total, 0-100." },
				dimensions: {
					type: "array",
					minItems: 7,
					maxItems: 7,
					items: {
						type: "object",
						properties: {
							key: {
								type: "string",
								enum: ["plot", "character", "pacing", "prose", "dialogue", "continuity", "hook"],
							},
							score: { type: "number" },
							note: { type: "string" },
						},
						required: ["key", "score", "note"],
						additionalProperties: false,
					},
				},
				mustFix: { type: "array", items: { type: "string" } },
			},
			required: ["chapter", "score", "dimensions", "mustFix"],
			additionalProperties: false,
		},
		scope_use: [...SCENARIOS],
		handler: async (context) => {
			const { bookId, chapter, score, dimensions, mustFix } = context.trigger.input;
			const result = await service.saveReview({ n: chapter, score, dimensions, mustFix }, bookId);
			if (!result.ok) return { ok: false, error: result.error, detail: result.detail };
			const stored = result.data.chapters.find((item) => item.n === chapter);
			return {
				ok: true,
				bookId: result.data.id,
				chapter,
				status: stored?.status ?? null,
				reviewScore: stored?.reviewScore ?? null,
				phase: result.data.phase,
			};
		},
	});

	ctx.agent.registerTool<{ bookId?: string; chapter: number }>({
		id: "mahua_commit_chapter",
		label: "Mahua Novels: commit chapter",
		description:
			"Commit one reviewed chapter and advance progress. Refuses anything that has not passed review. Requires an activated credential.",
		parameters: {
			type: "object",
			properties: {
				bookId: bookIdProperty(),
				chapter: { type: "number" },
			},
			required: ["chapter"],
			additionalProperties: false,
		},
		scope_use: [...SCENARIOS],
		handler: async (context) => {
			const { bookId, chapter } = context.trigger.input;
			const result = await service.commitChapter(chapter, bookId);
			if (!result.ok) return { ok: false, error: result.error, detail: result.detail };
			return {
				ok: true,
				bookId: result.data.id,
				chapter,
				phase: result.data.phase,
				currentChapter: result.data.progress.currentChapter,
				committedCount: result.data.progress.committedCount,
				arcClosed: result.data.phase === "arc_close",
			};
		},
	});

	ctx.agent.registerTool<{ bookId?: string }>({
		id: "mahua_close_arc",
		label: "Mahua Novels: close arc",
		description:
			"Close the arc that just ended and hand control back to drafting (or planning when no arc is left). Requires an activated credential.",
		parameters: {
			type: "object",
			properties: { bookId: bookIdProperty() },
			additionalProperties: false,
		},
		scope_use: [...SCENARIOS],
		handler: async (context) => {
			const result = await service.closeArc(context.trigger.input.bookId);
			if (!result.ok) return { ok: false, error: result.error, detail: result.detail };
			return { ok: true, bookId: result.data.id, phase: result.data.phase };
		},
	});

	ctx.agent.registerTool<{ bookId?: string }>({
		id: "mahua_finalize",
		label: "Mahua Novels: finalize book",
		description:
			"Freeze a book whose committed count reached the target and mark it `completed`. Requires an activated credential.",
		parameters: {
			type: "object",
			properties: { bookId: bookIdProperty() },
			additionalProperties: false,
		},
		scope_use: [...SCENARIOS],
		handler: async (context) => {
			const result = await service.finalize(context.trigger.input.bookId);
			if (!result.ok) return { ok: false, error: result.error, detail: result.detail };
			return { ok: true, bookId: result.data.id, phase: result.data.phase };
		},
	});

	ctx.agent.registerTool<{
		bookId?: string;
		scenario: "premise-conflict" | "deadlock" | "user-intervention";
		question: string;
		decision: string;
		rationale?: string;
	}>({
		id: "mahua_arbitrate",
		label: "Mahua Novels: arbitrate",
		description:
			"Record a binding decision for one of three enumerated conflicts (premise-conflict, deadlock, user-intervention) into the append-only decision log. Requires an activated credential.",
		parameters: {
			type: "object",
			properties: {
				bookId: bookIdProperty(),
				scenario: {
					type: "string",
					enum: ["premise-conflict", "deadlock", "user-intervention"],
					description: "Closed enum — do not invent new scenarios.",
				},
				question: { type: "string" },
				decision: { type: "string" },
				rationale: { type: "string" },
			},
			required: ["scenario", "question", "decision"],
			additionalProperties: false,
		},
		scope_use: [...SCENARIOS],
		handler: async (context) => {
			const { bookId, scenario, question, decision, rationale } = context.trigger.input;
			const result = await service.arbitrate({ scenario, question, decision, rationale }, bookId);
			if (!result.ok) return { ok: false, error: result.error, detail: result.detail };
			return { ok: true, scenario, ledger: "decisions.jsonl" };
		},
	});

	// ---- 与 ainovel-cli 对齐的其余能力（ADR 0009）----
	// 每个工具只做一件事；读工具不进门禁，写工具必须带凭证。

	ctx.agent.registerTool<{
		bookId?: string;
		theme: string;
		conflict: string;
		protagonist: string;
		ending: string;
		taboo?: string;
		hook?: string;
		cast?: string[];
	}>({
		id: "mahua_save_foundation",
		label: "Mahua Novels: save foundation",
		description:
			"Store the six foundation fields (theme, conflict, protagonist, ending, taboo, hook) plus the cast list. Call before planning arcs. Requires an activated credential.",
		parameters: {
			type: "object",
			properties: {
				bookId: bookIdProperty(),
				theme: { type: "string", description: "Genre positioning, one line." },
				conflict: { type: "string", description: "The core conflict that drives the whole book." },
				protagonist: { type: "string", description: "What the protagonist wants and what blocks it." },
				ending: { type: "string", description: "Where the book must end." },
				taboo: { type: "string", description: "What the prose must never do." },
				hook: { type: "string", description: "The differentiator readers come for." },
				cast: { type: "array", items: { type: "string" }, description: "Names allowed to appear in chapters." },
			},
			required: ["theme", "conflict", "protagonist", "ending"],
			additionalProperties: false,
		},
		scope_use: [...SCENARIOS],
		handler: async (context) => {
			const { bookId, ...input } = context.trigger.input;
			const result = await service.saveFoundation(input, bookId);
			if (!result.ok) return { ok: false, error: result.error, detail: result.detail };
			return { ok: true, bookId: result.data.id, cast: result.data.cast.length };
		},
	});

	ctx.agent.registerTool<{ bookId?: string }>({
		id: "mahua_audit_foundation",
		label: "Mahua Novels: audit foundation",
		description:
			"Report which foundation fields are still missing before writing starts. Read-only; returns findings with catalog keys.",
		parameters: { type: "object", properties: { bookId: bookIdProperty() }, additionalProperties: false },
		scope_use: [...SCENARIOS],
		handler: async (context) => {
			const result = await service.auditFoundation(context.trigger.input.bookId);
			if (!result.ok) return { ok: false, error: result.error, detail: result.detail };
			return { ok: true, findings: result.data.findings };
		},
	});

	ctx.agent.registerTool<{ text: string }>({
		id: "mahua_premise_structure",
		label: "Mahua Novels: parse premise structure",
		description:
			"Split a structured story premise into sections by its headings and map the recognised ones onto the foundation fields. Pure text in, findings out; never writes the book.",
		parameters: {
			type: "object",
			properties: { text: { type: "string", description: "The premise text, with or without markdown headings." } },
			required: ["text"],
			additionalProperties: false,
		},
		scope_use: [...SCENARIOS],
		handler: async (context) => {
			const result = service.premiseStructure(context.trigger.input.text);
			if (!result.ok) return { ok: false, error: result.error, detail: result.detail };
			const { sections, foundation, cast, unknownHeadings, findings } = result.data;
			return { ok: true, sections, foundation, cast, unknownHeadings, findings };
		},
	});

	ctx.agent.registerTool<{ bookId?: string; rules: Record<string, unknown> }>({
		id: "mahua_set_user_rules",
		label: "Mahua Novels: set writing rules",
		description:
			"Store executable writing rules: bannedWords (string[]), pointOfView (first | third | any), minWords, maxWords. Unknown fields are dropped. Requires an activated credential.",
		parameters: {
			type: "object",
			properties: {
				bookId: bookIdProperty(),
				rules: {
					type: "object",
					properties: {
						bannedWords: { type: "array", items: { type: "string" } },
						pointOfView: { type: "string", enum: ["first", "third", "any"] },
						minWords: { type: "number" },
						maxWords: { type: "number" },
					},
					additionalProperties: false,
				},
			},
			required: ["rules"],
			additionalProperties: false,
		},
		scope_use: [...SCENARIOS],
		handler: async (context) => {
			const { bookId, rules } = context.trigger.input;
			const result = await service.saveUserRules(rules, bookId);
			if (!result.ok) return { ok: false, error: result.error, detail: result.detail };
			return { ok: true, bookId: result.data.id, rules: result.data.userRules };
		},
	});

	ctx.agent.registerTool<{
		bookId?: string;
		chapter: number;
		goal: string;
		conflict: string;
		hook: string;
	}>({
		id: "mahua_plan_chapter",
		label: "Mahua Novels: plan chapter",
		description:
			"Write the one-page plan for a chapter before drafting it: goal, conflict, closing hook. Overwrites an earlier plan; a committed chapter is history and cannot be re-planned. Requires an activated credential.",
		parameters: {
			type: "object",
			properties: {
				bookId: bookIdProperty(),
				chapter: { type: "number", description: "Chapter number, 1-based." },
				goal: { type: "string" },
				conflict: { type: "string" },
				hook: { type: "string", description: "What the last line must leave the reader with." },
			},
			required: ["chapter", "goal", "conflict", "hook"],
			additionalProperties: false,
		},
		scope_use: [...SCENARIOS],
		handler: async (context) => {
			const { bookId, chapter, goal, conflict, hook } = context.trigger.input;
			const result = await service.planChapter({ n: chapter, goal, conflict, hook }, bookId);
			if (!result.ok) return { ok: false, error: result.error, detail: result.detail };
			return { ok: true, bookId: result.data.id, chapter, planned: true };
		},
	});

	ctx.agent.registerTool<{
		bookId?: string;
		chapter: number;
		find?: string;
		replace?: string;
		append?: string;
	}>({
		id: "mahua_edit_chapter",
		label: "Mahua Novels: edit chapter",
		description:
			"Change one fragment of an existing chapter verbatim (find + replace) or append prose, without rewriting the whole chapter. The chapter returns to drafting and must be reviewed again. Requires an activated credential.",
		parameters: {
			type: "object",
			properties: {
				bookId: bookIdProperty(),
				chapter: { type: "number" },
				find: { type: "string", description: "Exact text to replace; must appear verbatim." },
				replace: { type: "string", description: "Replacement text; omit to delete the fragment." },
				append: { type: "string", description: "Prose appended after a blank line instead." },
			},
			required: ["chapter"],
			additionalProperties: false,
		},
		scope_use: [...SCENARIOS],
		handler: async (context) => {
			const { bookId, chapter, find, replace, append } = context.trigger.input;
			const result = await service.editChapter({ n: chapter, find, replace, append }, bookId);
			if (!result.ok) return { ok: false, error: result.error, detail: result.detail };
			const target = result.data.chapters.find((item) => item.n === chapter);
			return { ok: true, bookId: result.data.id, chapter, words: target?.words ?? 0, status: target?.status ?? null };
		},
	});

	ctx.agent.registerTool<{
		bookId?: string;
		volumeId: string;
		title: string;
		goal: string;
		from: number;
		to: number;
	}>({
		id: "mahua_expand_next_arc",
		label: "Mahua Novels: expand next arc",
		description:
			"Append one more arc to an existing volume when the planned arcs run out. The range must not overlap and must not cover chapters that already exist. Requires an activated credential.",
		parameters: {
			type: "object",
			properties: {
				bookId: bookIdProperty(),
				volumeId: { type: "string" },
				title: { type: "string" },
				goal: { type: "string" },
				from: { type: "number" },
				to: { type: "number" },
			},
			required: ["volumeId", "title", "goal", "from", "to"],
			additionalProperties: false,
		},
		scope_use: [...SCENARIOS],
		handler: async (context) => {
			const { bookId, volumeId, title, goal, from, to } = context.trigger.input;
			const result = await service.expandNextArc({ volumeId, title, goal, from, to }, bookId);
			if (!result.ok) return { ok: false, error: result.error, detail: result.detail };
			return { ok: true, bookId: result.data.id, arcCount: result.data.volumes.reduce((sum, v) => sum + v.arcs.length, 0) };
		},
	});

	ctx.agent.registerTool<{ bookId?: string; arcId: string; summary: string }>({
		id: "mahua_save_arc_summary",
		label: "Mahua Novels: save arc summary",
		description:
			"Store the summary of a finished arc — what changed, what is still open. Written before closing the arc. Requires an activated credential.",
		parameters: {
			type: "object",
			properties: { bookId: bookIdProperty(), arcId: { type: "string" }, summary: { type: "string" } },
			required: ["arcId", "summary"],
			additionalProperties: false,
		},
		scope_use: [...SCENARIOS],
		handler: async (context) => {
			const { bookId, arcId, summary } = context.trigger.input;
			const result = await service.saveArcSummary({ arcId, summary }, bookId);
			if (!result.ok) return { ok: false, error: result.error, detail: result.detail };
			return { ok: true, bookId: result.data.id, arcId };
		},
	});

	ctx.agent.registerTool<{ bookId?: string; volumeId: string; summary: string }>({
		id: "mahua_save_volume_summary",
		label: "Mahua Novels: save volume summary",
		description:
			"Store the summary of a finished volume. Requires an activated credential.",
		parameters: {
			type: "object",
			properties: { bookId: bookIdProperty(), volumeId: { type: "string" }, summary: { type: "string" } },
			required: ["volumeId", "summary"],
			additionalProperties: false,
		},
		scope_use: [...SCENARIOS],
		handler: async (context) => {
			const { bookId, volumeId, summary } = context.trigger.input;
			const result = await service.saveVolumeSummary({ volumeId, summary }, bookId);
			if (!result.ok) return { ok: false, error: result.error, detail: result.detail };
			return { ok: true, bookId: result.data.id, volumeId };
		},
	});

	ctx.agent.registerTool<{ bookId?: string; chapter: number; note: string }>({
		id: "mahua_flag_outline_feedback",
		label: "Mahua Novels: flag outline feedback",
		description:
			"Record a reader or author objection against a planned chapter in the feedback pool. Duplicates are ignored. Requires an activated credential.",
		parameters: {
			type: "object",
			properties: {
				bookId: bookIdProperty(),
				chapter: { type: "number" },
				note: { type: "string" },
			},
			required: ["chapter", "note"],
			additionalProperties: false,
		},
		scope_use: [...SCENARIOS],
		handler: async (context) => {
			const { bookId, chapter, note } = context.trigger.input;
			const result = await service.flagFeedback({ chapter, note }, bookId);
			if (!result.ok) return { ok: false, error: result.error, detail: result.detail };
			return { ok: true, bookId: result.data.id, open: result.data.feedback.filter((item) => item.status === "open").length };
		},
	});

	ctx.agent.registerTool<{
		bookId?: string;
		feedbackId: string;
		disposition: "accepted" | "revised" | "rejected";
		resolution?: string;
	}>({
		id: "mahua_resolve_outline_feedback",
		label: "Mahua Novels: resolve outline feedback",
		description:
			"Close one feedback item with an enumerated disposition; a rejection must carry a reason. Requires an activated credential.",
		parameters: {
			type: "object",
			properties: {
				bookId: bookIdProperty(),
				feedbackId: { type: "string", description: "Id returned by flag_outline_feedback, e.g. fb-3." },
				disposition: { type: "string", enum: ["accepted", "revised", "rejected"] },
				resolution: { type: "string" },
			},
			required: ["feedbackId", "disposition"],
			additionalProperties: false,
		},
		scope_use: [...SCENARIOS],
		handler: async (context) => {
			const { bookId, feedbackId, disposition, resolution } = context.trigger.input;
			const result = await service.resolveOutlineFeedback({ id: feedbackId, disposition, resolution }, bookId);
			if (!result.ok) return { ok: false, error: result.error, detail: result.detail };
			return { ok: true, bookId: result.data.id, feedbackId, disposition };
		},
	});

	ctx.agent.registerTool<{ bookId?: string }>({
		id: "mahua_check_consistency",
		label: "Mahua Novels: check consistency",
		description:
			"Check cross-chapter facts: chapters outside every arc, unknown cast names, overlapping arcs, feedback on committed chapters, gaps in committed numbering. Read-only.",
		parameters: { type: "object", properties: { bookId: bookIdProperty() }, additionalProperties: false },
		scope_use: [...SCENARIOS],
		handler: async (context) => {
			const result = await service.checkConsistency(context.trigger.input.bookId);
			if (!result.ok) return { ok: false, error: result.error, detail: result.detail };
			return { ok: true, findings: result.data.findings };
		},
	});

	ctx.agent.registerTool<{ bookId?: string; chapter: number }>({
		id: "mahua_check_rules",
		label: "Mahua Novels: check writing rules",
		description:
			"Lint one chapter against the stored writing rules (banned words, point of view, word budget). Deterministic, no model judgement. Read-only.",
		parameters: {
			type: "object",
			properties: { bookId: bookIdProperty(), chapter: { type: "number" } },
			required: ["chapter"],
			additionalProperties: false,
		},
		scope_use: [...SCENARIOS],
		handler: async (context) => {
			const { bookId, chapter } = context.trigger.input;
			const result = await service.checkRules({ n: chapter }, bookId);
			if (!result.ok) return { ok: false, error: result.error, detail: result.detail };
			return { ok: true, chapter, words: result.data.words, findings: result.data.findings };
		},
	});

	ctx.agent.registerTool<{ bookId?: string }>({
		id: "mahua_style_stats",
		label: "Mahua Novels: style stats",
		description:
			"Compute the style baseline of the whole manuscript: average sentence length, dialogue ratio, paragraph count and repeated phrases. Read-only.",
		parameters: { type: "object", properties: { bookId: bookIdProperty() }, additionalProperties: false },
		scope_use: [...SCENARIOS],
		handler: async (context) => {
			const result = await service.styleStats(context.trigger.input.bookId);
			if (!result.ok) return { ok: false, error: result.error, detail: result.detail };
			return { ok: true, ...result.data };
		},
	});

	ctx.agent.registerTool<{ bookId?: string }>({
		id: "mahua_context",
		label: "Mahua Novels: context pack",
		description:
			"Return the fact pack a writer needs for the current chapter: phase, foundation, cast, current arc goal, previous chapter's closing line, open feedback. Read-only.",
		parameters: { type: "object", properties: { bookId: bookIdProperty() }, additionalProperties: false },
		scope_use: [...SCENARIOS],
		handler: async (context) => {
			const result = await service.contextPack({ bookId: context.trigger.input.bookId });
			if (!result.ok) return { ok: false, error: result.error, detail: result.detail };
			return { ok: true, ...result.data };
		},
	});

	ctx.agent.registerTool<{ bookId?: string }>({
		id: "mahua_check_threads",
		label: "Mahua Novels: check threads",
		description:
			"Audit the foreshadowing ledger: overdue plants, threads planted in unwritten chapters, closes that never happened, duplicate wording. Returns findings, open count, overdue count and the unresolved rate. Read-only.",
		parameters: { type: "object", properties: { bookId: bookIdProperty() }, additionalProperties: false },
		scope_use: [...SCENARIOS],
		handler: async (context) => {
			const result = await service.checkThreads(context.trigger.input.bookId);
			if (!result.ok) return { ok: false, error: result.error, detail: result.detail };
			return { ok: true, ...result.data };
		},
	});

	ctx.agent.registerTool<{
		bookId?: string;
		content: string;
		plantedIn: number;
		dueIn: number;
		weight: ThreadWeight;
	}>({
		id: "mahua_flag_thread",
		label: "Mahua Novels: flag thread",
		description:
			"Add one foreshadowing entry to the ledger: what was planted, the chapter it was planted in, and the chapter by which it must pay off. Weight (light/medium/heavy) decides how often it should resurface. Requires an activated credential.",
		parameters: {
			type: "object",
			properties: {
				bookId: bookIdProperty(),
				content: { type: "string" },
				plantedIn: { type: "number" },
				dueIn: { type: "number" },
				// enum 来自领域常量：改权重档位只改一处（ADR 0021）。
				weight: { type: "string", enum: [...THREAD_WEIGHTS] },
			},
			required: ["content", "plantedIn", "dueIn", "weight"],
			additionalProperties: false,
		},
		scope_use: [...SCENARIOS],
		handler: async (context) => {
			const { bookId, content, plantedIn, dueIn, weight } = context.trigger.input;
			const result = await service.flagThread({ content, plantedIn, dueIn, weight }, bookId);
			if (!result.ok) return { ok: false, error: result.error, detail: result.detail };
			return { ok: true, thread: result.data.thread, total: result.data.threads.length };
		},
	});

	ctx.agent.registerTool<{ bookId?: string; id: string; chapter: number }>({
		id: "mahua_close_thread",
		label: "Mahua Novels: close thread",
		description:
			"Mark one ledger entry as paid off in a chapter. Closing an already closed thread fails instead of silently succeeding. Requires an activated credential.",
		parameters: {
			type: "object",
			properties: { bookId: bookIdProperty(), id: { type: "string" }, chapter: { type: "number" } },
			required: ["id", "chapter"],
			additionalProperties: false,
		},
		scope_use: [...SCENARIOS],
		handler: async (context) => {
			const { bookId, id, chapter } = context.trigger.input;
			const result = await service.closeThread({ id, chapter }, bookId);
			if (!result.ok) return { ok: false, error: result.error, detail: result.detail };
			return { ok: true, thread: result.data.thread, total: result.data.threads.length };
		},
	});

	ctx.agent.registerTool<{ bookId?: string; targetChapters: number }>({
		id: "mahua_reopen_book",
		label: "Mahua Novels: reopen book",
		description:
			"Reopen a completed book to keep writing, raising the target chapter count. Requires an activated credential.",
		parameters: {
			type: "object",
			properties: { bookId: bookIdProperty(), targetChapters: { type: "number" } },
			required: ["targetChapters"],
			additionalProperties: false,
		},
		scope_use: [...SCENARIOS],
		handler: async (context) => {
			const { bookId, targetChapters } = context.trigger.input;
			const result = await service.reopenBook(targetChapters, bookId);
			if (!result.ok) return { ok: false, error: result.error, detail: result.detail };
			return { ok: true, bookId: result.data.id, phase: result.data.phase, targetChapters: result.data.targetChapters };
		},
	});

	/**
	 * 随包工艺库（ADR 0012）。两段式：不给 id 是目录，给 id 才读正文。
	 * 上游把这批文档整篇拼进提示词；这里改成按需取，读哪篇由当前动作决定。
	 */
	ctx.agent.registerTool<{ id?: string; kind?: ReferenceKind; budget?: number }>({
		id: "mahua_reference",
		label: "Mahua Novels: craft reference",
		description:
			"Read the bundled craft library: chapter craft, hooks, dialogue, plot structures, genre arc templates, style presets and the narrative voice. Call without id for the index, with id for the text. Read-only.",
		parameters: {
			type: "object",
			properties: {
				id: { type: "string", description: "Entry id from the index, e.g. hook-techniques or suspense-arc-templates." },
				kind: { type: "string", enum: ["guide", "genre", "style", "voice"], description: "Filter the index." },
				budget: { type: "number", description: `Character budget for the body. Default ${DEFAULT_REFERENCE_BUDGET}.` },
			},
			additionalProperties: false,
		},
		scope_use: [...SCENARIOS],
		handler: async (context) => {
			const { id, kind, budget } = context.trigger.input;
			if (!id) return { ok: true, entries: listReferences(REFERENCE_LIBRARY, kind ? { kind } : {}) };
			const page = readReference(REFERENCE_LIBRARY, id, budget);
			if (!page) return { ok: false, error: "reference.unknown", detail: id };
			return { ok: true, ...page };
		},
	});
}

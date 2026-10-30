/**
 * 正文层：进入连载、章前计划、存稿、局部改写、评审、提交、收弧、完结、重开。
 * 全部是写工具，进门禁（ADR 0011）；只回事实。
 */

import type { PluginContext } from "@astravia-org/plugin-sdk";

import type { StudioService } from "../application/studio-service.js";
import { bookIdProperty } from "../application/tool-schemas.js";
import type { ReviewDimension } from "../domain/novel-types.js";
import { SCENARIOS } from "../scenarios.js";

export function registerChapterTools(ctx: PluginContext, service: StudioService): void {
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
}

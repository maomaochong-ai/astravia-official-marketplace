/**
 * 规划层：卷与弧的计划、章纲、尾部改写、续弧、弧/卷小结、大纲反馈池。
 * 全部是写工具，进门禁（ADR 0011）。
 */

import type { PluginContext } from "@astravia-org/plugin-sdk";

import type { StudioService } from "../application/studio-service.js";
import { bookIdProperty } from "../application/tool-schemas.js";
import { SCENARIOS } from "../scenarios.js";

export function registerOutlineTools(ctx: PluginContext, service: StudioService): void {
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
		description: "Store the summary of a finished volume. Requires an activated credential.",
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
}

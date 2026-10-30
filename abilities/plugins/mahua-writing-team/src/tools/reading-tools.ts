/**
 * 读工具（12 个）。一个都不进门禁（ADR 0011）：拦住读会让"先看看再决定"变成死路。
 *
 * 只回事实，不附带"接下来请调用 X"——下一步一律由 `mahua_next_instruction` 给。
 */

import type { PluginContext } from "@astravia-org/plugin-sdk";

import type { StudioService } from "../application/studio-service.js";
import { bookIdProperty } from "../application/tool-schemas.js";
import { localize, summaryOf } from "../application/tool-output.js";
import { DEFAULT_REFERENCE_BUDGET, listReferences, readReference } from "../reference/reference-index.js";
import type { ReferenceKind } from "../reference/reference-types.js";
import { REFERENCE_LIBRARY } from "../reference/library.generated.js";
import { SCENARIOS } from "../scenarios.js";

export function registerReadingTools(ctx: PluginContext, service: StudioService): void {
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

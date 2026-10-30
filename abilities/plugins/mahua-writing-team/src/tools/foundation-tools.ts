/**
 * 开书与地基：建书、认下 brief、存六项地基、存可执行写作规则。
 * 全部是写工具，进门禁（ADR 0011）；只回事实，不给下一步。
 */

import type { PluginContext } from "@astravia-org/plugin-sdk";

import type { StudioService } from "../application/studio-service.js";
import { bookIdProperty } from "../application/tool-schemas.js";
import { SCENARIOS } from "../scenarios.js";

export function registerFoundationTools(ctx: PluginContext, service: StudioService): void {
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
}

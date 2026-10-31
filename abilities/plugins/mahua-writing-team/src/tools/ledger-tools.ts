/**
 * 两本追加型账本：伏笔（种下 / 兑现）与决策（仲裁结论）。
 *
 * 都是写工具，进门禁（ADR 0011）。伏笔的清理检查在 `mahua_check_threads`，读侧不进这里。
 */

import type { PluginContext } from "@astravia-org/plugin-sdk";

import type { StudioService } from "../application/studio-service.js";
import { bookIdProperty } from "../application/tool-schemas.js";
import { THREAD_WEIGHTS } from "../domain/thread-ledger.js";
import type { ThreadWeight } from "../domain/novel-types.js";
import { SCENARIOS } from "../scenarios.js";

export function registerLedgerTools(ctx: PluginContext, service: StudioService): void {
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
}

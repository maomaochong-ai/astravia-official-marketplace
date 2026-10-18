/**
 * Host model adapter.
 *
 * `ctx.ai` uses the user's configured provider and credentials, so the plugin
 * never stores a key. When no model is configured the call throws; callers turn
 * that into a readable message rather than an empty JSON document.
 */

import type { PluginContext } from "@astravia-org/plugin-sdk";
import type { AiPort } from "../domain/ai/extract";

export function hasAiApi(ctx: PluginContext): boolean {
	const ai = ctx.ai as PluginContext["ai"] | undefined;
	return Boolean(ai && typeof ai.complete === "function");
}

export function createAiPort(ctx: PluginContext): AiPort | undefined {
	if (!hasAiApi(ctx)) return undefined;
	return {
		async complete(request) {
			const result = await ctx.ai.complete({
				systemPrompt: request.system,
				prompt: request.prompt,
				maxTokens: request.maxTokens ?? 2_000,
			});
			return result.text;
		},
	};
}

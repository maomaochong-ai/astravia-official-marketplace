import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { matchBoardmixIntent } from "../domain/boardmix-intent";
import {
	describeRunForModel,
	runAutomation,
} from "../features/boardmix-workspace/services/automation";

const HOOK_TIMEOUT_MS = 20_000;
const TAB_WAIT_MS = 1500;

/**
 * 提问时就把面板带到位——这是「自动化」真正发生的地方：用户还没等到回答，
 * 白板面板已经在动了。只认产品名与「白板」，别的提问一律放过去。
 */
export function registerPromptAutomation(ctx: PluginContext): Disposable | null {
	if (!ctx.permissions.has("agent.hooks.register")) return null;
	if (!ctx.permissions.has("agent.hookHandler.execute")) return null;

	return ctx.agent.registerHook<"UserPromptSubmit">({
		id: "boardmix-prompt-automation",
		eventName: "UserPromptSubmit",
		scope_use: ["conversation", "project"],
		timeoutMs: HOOK_TIMEOUT_MS,
		handler: async ({ event }) => {
			const recipe = matchBoardmixIntent(event.prompt);
			if (!recipe) return;
			try {
				const run = await runAutomation(ctx, { recipe, reason: "prompt", waitMs: TAB_WAIT_MS });
				return { action: "continue", additionalContexts: [describeRunForModel(run)] };
			} catch {
				// 自动化失败不该拦住这一轮对话；面板状态由用户自己看。
				return;
			}
		},
	});
}

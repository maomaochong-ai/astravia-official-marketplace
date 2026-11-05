import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import {
	AUTOMATION_RECIPES,
	handsOffToUser,
	isAutomationRecipe,
	type AutomationRecipeId,
} from "../domain/boardmix-run";
import { runAutomation } from "../features/boardmix-workspace/services/automation";
import { TOOL_IDS } from "../plugin-ids";

const TOOL_SCOPE = ["conversation", "project"] as const;

/**
 * 一条 recipe 换一次真实的多步执行，并把每一跑到哪一步原样带回来。
 * 返回体就是运行记录本身，所以对话里的步骤卡片能直接用工具结果渲染。
 */
export function registerAutomationTool(ctx: PluginContext): Disposable[] {
	return [
		ctx.agent.registerTool<{ recipe: AutomationRecipeId; url?: string }>({
			id: TOOL_IDS.automate,
			label: "%tool.automate.label%",
			description:
				"Run one Boardmix recipe as a sequence of real steps: make sure the panel is open, pass the origin gate, " +
				"navigate, then read where the page actually landed. " +
				"Use it when the user wants the panel moved somewhere and should see that it happened: focus (workspace), " +
				"create (create entry), ai-ppt / ai-flowchart / ai-chat (Boardmix's own AI entries), open-url (one boardmix.cn address). " +
				"The result reports every step's status and the landing address. " +
				"Do NOT use it to draw, click inside the canvas or press generate: those stay with the user.",
			parameters: {
				type: "object",
				properties: {
					recipe: {
						type: "string",
						enum: [...AUTOMATION_RECIPES],
						description: "Which recipe to run.",
					},
					url: {
						type: "string",
						description: "Only for recipe = open-url. Full https address on boardmix.cn.",
					},
				},
				required: ["recipe"],
				additionalProperties: false,
			},
			scope_use: TOOL_SCOPE,
			timeoutMs: 40_000,
			handler: async ({ trigger }) => {
				const recipe = trigger.input?.recipe;
				if (!isAutomationRecipe(recipe)) {
					return JSON.stringify({
						ok: false,
						reason: "invalid-recipe",
						next: `Use one of: ${AUTOMATION_RECIPES.join(", ")}.`,
					});
				}
				const run = await runAutomation(ctx, {
					recipe,
					url: typeof trigger.input?.url === "string" ? trigger.input.url : undefined,
					reason: "tool",
					waitMs: 5000,
				});
				const needsUserAction = handsOffToUser(recipe);
				return JSON.stringify({
					...run,
					ok: run.status === "done",
					needsUserAction,
					next: needsUserAction
						? "Tell the user the step that is theirs to click. Do not claim a board, deck or diagram was created."
						: "Report the landing address. You still cannot read, click or export the canvas.",
				});
			},
		}),
	];
}

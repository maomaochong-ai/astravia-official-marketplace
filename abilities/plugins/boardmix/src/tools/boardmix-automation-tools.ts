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
 * 停在某一步时到底该说什么。每个 detail 都是一种真实成因，处置不同；
 * 三种都包括在内：**不得说成「面板已经移过去了」**。
 */
function stopHint(note: string | null): string {
	switch (note) {
		case "tab-never-mounted":
			return "The panel never attached, so nothing was navigated. Ask the user to open Boardmix once from its tab button, then run this again.";
		case "network":
			return "The machine is offline or a VPN dropped the connection. Say that plainly and do not retry in a loop — the panel reloads itself when the network returns.";
		case "page-not-loaded":
			return (
				"The panel is open but its page never finished loading, so it stayed on whatever it showed before. " +
				"Read the failure text in the step trail (ERR_NAME_NOT_RESOLVED means DNS or a proxy, ERR_ABORTED a cancelled load). " +
				"Ask the user to check the panel's own notice and press Retry there; if it still will not load, offer boardmix_open_in_browser. " +
				"Do not claim the panel moved."
			);
		default:
			return "Say which step stopped and what the user can do about it.";
	}
}
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
			handler: async ({ trigger, session }) => {
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
					// 12 s：面板第一次创建要载入 boardmix 整个前端，4 s 和 5 s 都不够。
					waitMs: 12_000,
					cwd: session.cwd,
				});
				const needsUserAction = handsOffToUser(recipe);
				return JSON.stringify({
					...run,
					ok: run.status === "done",
					needsUserAction,
					stoppedAt: run.status === "done" ? null : (run.note ?? null),
					next:
						run.status !== "done"
							? stopHint(run.note)
							: needsUserAction
								? "Tell the user the step that is theirs to click. Do not claim a board, deck or diagram was created."
								: "Report the landing address. Then use boardmix_read (controls plus click points), boardmix_act " +
									"(real clicks and typing) and boardmix_shot (a PNG you can look at) to carry on yourself.",
				});
			},
		}),
	];
}

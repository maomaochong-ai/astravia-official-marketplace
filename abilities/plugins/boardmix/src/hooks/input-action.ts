import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { boardmixStateInstruction } from "../domain/boardmix-attachment";
import { readBoardmixState, setBoardmixEngaged } from "../features/boardmix-workspace/hooks/use-prompt-attachment";
import { ACTIVITY_TAB_ID, TOOL_IDS } from "../plugin-ids";

/**
 * 输入栏下面那排开关里的「白板」。
 *
 * 这一条补的是真实缺口：插件声明了 `ui.slot.input-action`，却从来没注册过开关，于是
 * **用户没有办法在对话里把白板"挂上"**——只能等模型的工具调用，或者自己去标签栏里翻。
 * 打开开关做两件事：把面板打开（用户点了白板就该看到白板），并把这一轮的白板状态交给模型。
 *
 * 状态走 `decoratePrompt`，不走 `setPromptAttachment`：后者会把一枚胶囊画在输入框卡片
 * **下沿外面**，跨消息、跨会话都在，那是宿主内置附件的位置。市场插件不该占那里——
 * 它在这儿的可见形态，只有用户亲手打开的这一枚开关。
 *
 * `decoratePrompt` 里的说明是**写给模型看的**，不是给人看的：它要说清三条路的优先顺序，
 * 免得模型又回到"点坐标"这一个动作上。
 */
export function registerBoardmixInputAction(ctx: PluginContext): Disposable | null {
	if (!ctx.permissions.has("ui.slot.input-action")) return null;

	return ctx.ui.registerInputAction({ ...({ placement: "capsule" } as Record<string, unknown>),
		id: "boardmix-whiteboard",
		label: "%input.label%",
		// 与工具的 scope 一致：只在这两种会话里出现。
		scope_use: ["conversation", "project"],
		// 工具被场景屏蔽时不摆一个点了也没用的开关。
		requiresActiveTool: TOOL_IDS.read,
		onToggle(active) {
			setBoardmixEngaged(active === true);
			if (active === true) {
				// 点白板就该看见白板；面板自己走 seed 阶梯，这里不猜地址。
				ctx.ui.openActivityTab(ACTIVITY_TAB_ID, { width: "max" });
			}
		},
		decoratePrompt() {
			const attached = readBoardmixState();
			return {
				instructions: [
					...(attached ? [boardmixStateInstruction(attached.state)] : []),
					"The user attached the Boardmix whiteboard to this turn. The panel is a real Boardmix board " +
						"on boardmix.cn, not a drawing surface you can parse.",
					"Pick the cheapest route that can actually do the job, in this order: " +
						"(1) for anything Boardmix's own AI can generate — a deck, a doc, an image, a diagram it " +
						"draws, or a change to the board — compose the prompt and deliver it with boardmix_ai_prompt " +
						"(it sends only when the user said so; a generation spends their points); " +
						"(2) for a diagram you write yourself, hand the Mermaid to boardmix_diagram; " +
						"(3) only for the page itself, use boardmix_read then boardmix_act with the points it prints.",
					"Confirm with boardmix_read or a boardmix_shot you actually looked at before claiming anything " +
						"landed. Canvas shapes exist only in pixels: describe them from a screenshot, never as data.",
				],
			};
		},
	});
}

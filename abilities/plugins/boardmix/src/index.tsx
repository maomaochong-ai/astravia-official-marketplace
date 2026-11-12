import { definePlugin } from "@astravia-org/plugin-sdk";
import { createElement } from "react";
import { BoardmixWorkspace, AutomationRunSlot } from "./features/boardmix-workspace";
import { registerBoardmixInputAction } from "./hooks/input-action";
import { registerPromptAutomation } from "./hooks/prompt-submit-automation";
import { ACTIVITY_TAB_ID, TOOL_IDS } from "./plugin-ids";
import { setRuntime } from "./runtime-contract";
import { registerTools } from "./tools/register-tools";
import "./style.css";

export default definePlugin({
	activate(ctx) {
		setRuntime(ctx);
		// 白板状态（面板上报 + 开关）存在一个模块 store 里，发送时由 decoratePrompt 取走。

		// 面板内容：一个 webview，装 boardmix 自己的网页产品。
		const tab = ctx.ui.registerActivityTab({
			id: ACTIVITY_TAB_ID,
			label: "%tab.title%",
			component: () => createElement(BoardmixWorkspace, { ctx }),
			scope_use: ["conversation", "project"],
			// 不再自动上栏：这条会话没用过白板时，标签栏里不该先摆一个位置。工具调用走
			// `openActivityTab`，会把它 attach 上栏并选中；用户自己点「+」加一次，宿主按
			// 工作区记住这次可见性。
			initiallyVisible: false,
			retention: "warm",
		});

		// 输入栏上的「白板」开关：打开就把面板带出来，并把这一轮挂上。
		const inputAction = registerBoardmixInputAction(ctx);

		// Agent 面：工具。没权限时返回空数组。
		const tools = registerTools(ctx);

		// 自动化在对话里显示成步骤时间线，而不是一段 JSON。
		const toolCallSlot = ctx.permissions.has("ui.slot.tool-call")
			? ctx.ui.registerToolCallSlot({
					id: "boardmix-automation-run",
					toolName: TOOL_IDS.automate,
					component: AutomationRunSlot,
				})
			: null;

		// 用户一提问，面板就动起来——这是自动化真正的入口。
		const promptAutomation = registerPromptAutomation(ctx);

		return () => {
			promptAutomation?.dispose();
			toolCallSlot?.dispose();
			for (const tool of tools) tool.dispose();
			inputAction?.dispose();
			setRuntime(null);
			tab.dispose();
		};
	},
});

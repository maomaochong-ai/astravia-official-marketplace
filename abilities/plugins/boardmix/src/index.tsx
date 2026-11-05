import { definePlugin } from "@astravia-org/plugin-sdk";
import { createElement } from "react";
import { BoardmixWorkspace } from "./features/boardmix-workspace";
import { ACTIVITY_TAB_ID } from "./plugin-ids";
import { setRuntime } from "./runtime-contract";
import { registerTools } from "./tools/register-tools";
import "./style.css";

export default definePlugin({
	activate(ctx) {
		setRuntime(ctx);

		// 面板内容：一个 webview，装 boardmix 自己的网页产品。
		const tab = ctx.ui.registerActivityTab({
			id: ACTIVITY_TAB_ID,
			label: "%tab.title%",
			component: () => createElement(BoardmixWorkspace, { ctx }),
			scope_use: ["conversation", "project"],
			initiallyVisible: true,
			retention: "warm",
		});

		// Agent 面：六个只改标签页状态的工具。没权限时返回空数组。
		const tools = registerTools(ctx);

		return () => {
			setRuntime(null);
			for (const tool of tools) tool.dispose();
			tab.dispose();
		};
	},
});

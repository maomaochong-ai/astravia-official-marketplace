/**
 * dbx-pro 插件装配入口 — activate + registerActivityTab + 初始化运行时契约。
 *
 * 宿主 ctx 被 setRuntime(ctx) 保存到 runtime-contract.ts，各 feature 层通过
 * getCommand/getConversation/getAgent 访问。
 */

import "./style.css";
import { definePlugin } from "@astravia-org/plugin-sdk";
import { setRuntime } from "./runtime-contract";
import { DbxProPanel } from "./features/main-panel/components/dbx-pro-panel";

export default definePlugin({
	activate(ctx) {
		setRuntime(ctx);

		ctx.ui.registerActivityTab({
			id: "dbx-pro",
			label: "dbx-pro",
			icon: (
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
					<ellipse cx="12" cy="5" rx="8" ry="3" />
					<path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5" />
					<path d="M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" />
				</svg>
			),
			component: DbxProPanel,
			initiallyVisible: true,
		});
	},
});


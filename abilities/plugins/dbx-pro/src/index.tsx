/**
 * dbx-pro 插件装配入口 — 只负责 activate + registerActivityTab。
 *
 * 业务逻辑全部在 features/ 和 domain/ 下，主面板在
 * features/main-panel/components/dbx-pro-panel.tsx。
 */

import "./style.css";
import { definePlugin } from "@astravia-org/plugin-sdk";
import { setCommand } from "./features/main-panel/components/dbx-pro-panel";
import { DbxProPanel } from "./features/main-panel/components/dbx-pro-panel";

export default definePlugin({
	activate(ctx) {
		setCommand(ctx.command);

		ctx.ui.registerActivityTab({
			id: "dbx-pro",
			label: { zh: "dbx-pro", en: "dbx-pro" },
			icon: (
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
					<ellipse cx="12" cy="5" rx="8" ry="3" />
					<path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5" />
					<path d="M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" />
				</svg>
			),
			component: DbxProPanel,
			scope_use: ["project", "conversation"],
			initiallyVisible: true,
			orderAfter: ["browser"],
		});
	},
});

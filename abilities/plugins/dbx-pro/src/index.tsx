/**
 * dbx-pro 插件装配入口 — activate + registerActivityTab + 初始化运行时契约。
 *
 * 宿主 ctx 被 setRuntime(ctx) 保存到 runtime-contract.ts，各 feature 层通过
 * getCommand/getConversation/getAgent 访问。
 */

import { lazy, Suspense, type ComponentType, type ReactElement } from "react";
import { definePlugin } from "@astravia-org/plugin-sdk";
import { setRuntime } from "./runtime-contract";
import "./style.css";

/** Lazy-load the panel with Suspense fallback — matches shimo's pattern. */
function lazyPanel<P extends object>(load: () => Promise<{ default: ComponentType<P> }>): () => ReactElement {
	const Lazy = lazy(load);
	return function LazyPanel(): ReactElement {
		return <Suspense fallback={null}><Lazy /></Suspense>;
	};
}

const DbxProPanel = lazyPanel(async () => ({ default: (await import("./features/main-panel/components/dbx-pro-panel")).DbxProPanel as unknown as ComponentType<unknown> }));

export default definePlugin({
	activate(ctx) {
		setRuntime(ctx);

		const activityTab = ctx.ui.registerActivityTab({
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
			scope_use: ["conversation", "project"],
			retention: "pinned",
			initiallyVisible: true,
		});

		return () => {
			activityTab.dispose();
		};
	},
});


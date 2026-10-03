/**
 * dbx-pro 插件装配入口 — activate + registerActivityTab + 初始化运行时契约。
 *
 * 宿主 ctx 被 setRuntime(ctx) 保存到 runtime-contract.ts，各 feature 层通过
 * getCommand/getConversation/getStorage/getServices 访问；ctx.services 在激活时绑定到
 * 自持引擎客户端，绑定失败（宿主不支持 services）时保持 null，查询路由会自动降级 CLI。
 * getCommand/getConversation/getAgent 访问。
 */

import { lazy, Suspense, type ComponentType, type ReactElement } from "react";
import { definePlugin } from "@astravia-org/plugin-sdk";
import { setRuntime } from "./runtime-contract";
import { bindEngineServices, type EngineServicesApi } from "./shared/services/engine-client";
import "./style.css";

/** Lazy-load the panel with Suspense fallback — matches shimo's pattern. */
function lazyPanel<P extends object>(load: () => Promise<{ default: ComponentType<P> }>): () => ReactElement {
	// 面板不接收任何 props；显式收窄为「无 props 组件」，避免 P 被推成 unknown。
	const Lazy = lazy(load) as unknown as ComponentType<Record<string, never>>;
	return function LazyPanel(): ReactElement {
		return <Suspense fallback={null}><Lazy /></Suspense>;
	};
}

const DatabaseWorkspace = lazyPanel(async () => ({
	default: (await import("./features/database-workspace/components/database-workspace")).DatabaseWorkspace as unknown as ComponentType<Record<string, never>>,
}));

export default definePlugin({
	activate(ctx) {
		setRuntime(ctx);
		// 绑定宿主 service 能力（plugin.json#providers.services → dbx-engine）。
		// 宿主不提供 services 时绑定 null：engine-client 会报 ENGINE_NOT_READY，
		// 由查询路由按设置回退本地 sqlite3 CLI。
		bindEngineServices(((ctx as { services?: unknown }).services ?? null) as EngineServicesApi | null);

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
			component: DatabaseWorkspace,
			scope_use: ["conversation", "project"],
			retention: "pinned",
			initiallyVisible: true,
		});

		return () => {
			activityTab.dispose();
		};
	},
});


/**
 * dbx-pro 插件装配入口 — activate + registerActivityTab + 初始化运行时契约。
 *
 * 宿主 ctx 被 setRuntime(ctx) 保存到 runtime-contract.ts，各 feature 层通过
 * getCommand/getConversation/getStorage/getServices 访问；ctx.services 在激活时绑定到
 * 自持引擎客户端，绑定失败（宿主不支持 services）时保持 null，查询路由会自动降级 CLI。
 * getCommand/getConversation/getAgent 访问。
 */

import { Component, lazy, Suspense, type ComponentType, type ReactElement, type ReactNode } from "react";
import { definePlugin } from "@astravia-org/plugin-sdk";
import { setRuntime } from "./runtime-contract";
import { ensureEngineStarted } from "./runtime";
import { bindEngineServices, type EngineServicesApi } from "./shared/services/engine-client";
import "./style.css";

/** 面板加载中：可见的轻量占位，避免点击后空白。 */
function PanelLoading(): ReactElement {
	return (
		<div className="flex h-full w-full items-center justify-center text-[12px] text-muted-foreground">
			<span className="icon-[lucide--loader] mr-2 h-3.5 w-3.5 animate-spin" />
			正在加载数据库工作台…
		</div>
	);
}

/** 面板 chunk 加载失败时给出可重试的提示，而不是整页空白。 */
class PanelErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
	state = { failed: false };
	static getDerivedStateFromError(): { failed: boolean } {
		return { failed: true };
	}
	render(): ReactNode {
		if (this.state.failed) {
			return (
				<div className="flex h-full w-full flex-col items-center justify-center gap-3 text-[12px] text-muted-foreground">
					<span>工作台加载失败</span>
					<button
						type="button"
						className="dbx-cta"
						onClick={() => this.setState({ failed: false })}
					>
						重试
					</button>
				</div>
			);
		}
		return this.props.children;
	}
}

/** Lazy-load the panel with a visible fallback + error boundary. */
function lazyPanel<P extends object>(load: () => Promise<{ default: ComponentType<P> }>): () => ReactElement {
	// 面板不接收任何 props；显式收窄为「无 props 组件」，避免 P 被推成 unknown。
	const Lazy = lazy(load) as unknown as ComponentType<Record<string, never>>;
	return function LazyPanel(): ReactElement {
		return (
			<PanelErrorBoundary>
				<Suspense fallback={<PanelLoading />}>
					<Lazy />
				</Suspense>
			</PanelErrorBoundary>
		);
	};
}

const DatabaseWorkspace = lazyPanel(async () => ({
	default: (await import("./features/database-workspace/components/database-workspace")).DatabaseWorkspace as unknown as ComponentType<Record<string, never>>,
}));

const DatabaseAtPicker = lazyPanel(async () => ({
	default: (await import("./features/database-at-picker")).DatabaseAtPicker as unknown as ComponentType<Record<string, never>>,
}));

export default definePlugin({
	async activate(ctx) {
		setRuntime(ctx);
		// 绑定宿主 service 能力（plugin.json#providers.services → dbx-engine）。
		// 宿主不提供 services 时绑定 null：engine-client 会报 ENGINE_NOT_READY。
		bindEngineServices(((ctx as { services?: unknown }).services ?? null) as EngineServicesApi | null);

		const activityTab = ctx.ui.registerActivityTab({
			id: "dbx-pro",
			label: "dbx-pro",
			icon: (
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
					<ellipse cx="12" cy="5" rx="8" ry="3" />
					<path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5" />
					<path d="M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v6" />
				</svg>
			),
			component: DatabaseWorkspace,
			scope_use: ["conversation", "project"],
			retention: "pinned",
			initiallyVisible: true,
		});

		// @ 数据库选择器：独立 activity tab，用户通过顶栏按钮打开后浏览连接/表，
		// 选中后通过 conversation.insertText() 注入 @`连接:表` 到宿主输入草稿。
		const atPickerTab = ctx.ui.registerActivityTab({
			id: "dbx-at-picker",
			label: "数据库",
			icon: (
				<span className="icon-[lucide--database] h-4 w-4" />
			),
			component: DatabaseAtPicker,
			scope_use: ["conversation", "project"],
			retention: "active-only",
			initiallyVisible: false,
			order: 11,
		});

		// 输入栏按钮：点击后打开 @ 数据库选择器。
		const inputAction = ctx.ui.registerInputAction({
			id: "dbx-at-picker-toggle",
			label: "数据库",
			icon: <span className="icon-[lucide--database] h-3.5 w-3.5" />,
			defaultActive: false,
			scope_use: ["conversation", "project", "cli"],
			onToggle(active) {
				if (active) {
					void ctx.ui.openActivityTab("dbx-at-picker");
				}
			},
		});

		// 安装并启动引擎 runtime（bridge 内联 + 平台二进制下载校验）。
		// 失败必须上报，不能静默，否则保存连接时只会得到笼统的 not ready。
		try {
			await ensureEngineStarted(ctx);
		} catch (reason: unknown) {
			ctx.ui.notify({
				message: "dbx-pro 引擎服务启动失败",
				error: reason,
				variant: "error",
			});
		}

		return () => {
			activityTab.dispose();
			atPickerTab.dispose();
			inputAction.dispose();
		};
	},
});


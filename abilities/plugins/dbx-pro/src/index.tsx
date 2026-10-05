/**
 * dbx-pro 插件装配入口 — activate + registerActivityTab + 初始化运行时契约。
 *
 * 宿主 ctx 被 setRuntime(ctx) 保存到 runtime-contract.ts，各 feature 层通过
 * getCommand/getConversation/getStorage/getServices 访问；ctx.services 在激活时绑定到
 * 自持引擎客户端，绑定失败（宿主不支持 services）时保持 null，查询路由会自动降级 CLI。
 */

import { Component, lazy, Suspense, type ComponentType, type ReactElement, type ReactNode } from "react";
import { definePlugin, type Disposable } from "@astravia-org/plugin-sdk";
import { setRuntime, clearRuntime, isRuntimeActive } from "./runtime-contract";
import { ensureEngineStarted, cancelEngineStartup } from "./runtime";
import { bindEngineServices, type EngineServicesApi } from "./shared/services/engine-client";
import { registerTools } from "./tools/register-tools";
// 样式按功能域拆分，避免单文件过大
import "./style.css";
import "./shared/styles/dbx-primitives.css";
import "./shared/styles/dbx-layout.css";
import "./shared/styles/dbx-loading.css";
import "./features/database-workspace/styles/sheet-modal.css";
import "./features/database-workspace/styles/connection-editor.css";
import "./features/database-workspace/styles/result-grid.css";
import "./features/database-workspace/styles/sql-editor.css";
import "./features/database-workspace/styles/ai-dialog.css";
import "./features/database-workspace/styles/table-info.css";

/** 插件版本号，用于显示和调试 */
export const PLUGIN_VERSION = "0.0.68";

/** 当前实例 ID，用于区分新旧实例的 DOM 元素 */
let _instanceId = 0;

/** 面板加载中：可见的轻量占位，避免点击后空白。显示版本号便于确认更新状态。 */
function PanelLoading(): ReactElement {
	return (
		<div data-astravia-plugin-root="dbx-pro" className="dbx-root dbx-loading-screen flex h-full w-full flex-col items-center justify-center bg-background text-foreground">
			<div className="dbx-loading-content">
				<div className="dbx-loading-spinner">
					<span className="icon-[lucide--database] h-8 w-8 animate-pulse text-muted-foreground" />
				</div>
				<span className="dbx-loading-text text-[12px] text-muted-foreground">正在加载数据库工作台…</span>
				<span className="dbx-loading-version text-[10px] text-muted-foreground/60">v{PLUGIN_VERSION}</span>
			</div>
		</div>
	);
}

/** 面板 chunk 加载失败时给出可重试的提示，而不是整页空白。 */
class PanelErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean; error?: Error }> {
	state = { failed: false, error: undefined as Error | undefined };
	static getDerivedStateFromError(error: Error): { failed: boolean; error: Error } {
		return { failed: true, error };
	}
	render(): ReactNode {
		if (this.state.failed) {
			const isActivationError = this.state.error?.message?.includes("no longer active") ||
				this.state.error?.name === "AbortError";
			return (
				<div data-astravia-plugin-root="dbx-pro" className="dbx-root flex h-full w-full flex-col items-center justify-center gap-3 bg-background text-[12px] text-muted-foreground">
					<span className="icon-[lucide--alert-circle] h-6 w-6 text-destructive" />
					<span>{isActivationError ? "插件正在更新中" : "工作台加载失败"}</span>
					{this.state.error && !isActivationError && (
						<span className="text-[10px] text-muted-foreground/60 max-w-[300px] text-center">
							{this.state.error.message}
						</span>
					)}
					{isActivationError ? (
						<span className="text-[10px] text-muted-foreground/60">请稍候，新版本正在加载...</span>
					) : (
						<button
							type="button"
							className="dbx-cta"
							onClick={() => this.setState({ failed: false, error: undefined })}
						>
							重试
						</button>
					)}
					<span className="text-[10px] text-muted-foreground/40">v{PLUGIN_VERSION}</span>
				</div>
			);
		}
		return this.props.children;
	}
}

/** Lazy-load the panel with a visible fallback + error boundary. */
function lazyPanel<P extends object>(load: () => Promise<{ default: ComponentType<P> }>): () => ReactElement {
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

const ConnectionManagerPanel = lazyPanel(async () => ({
	default: (await import("./features/database-workspace/components/connection-manager-view")).ConnectionManagerView as unknown as ComponentType<Record<string, never>>,
}));

export default definePlugin({
	async activate(ctx) {
		// 递增实例 ID，标记当前激活的实例
		const instanceId = String(++_instanceId);

		// 设置运行时上下文
		setRuntime(ctx);
		bindEngineServices(((ctx as { services?: unknown }).services ?? null) as EngineServicesApi | null);

		// 注册主工作台 Activity Tab
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
			scope_use: ["im-claw", "conversation", "project", "cli"],
			retention: "pinned",
			initiallyVisible: true,
		});

		// 侧边栏 dbx-pro数据库工作区视图（与工作台内新建连接同一套三步流程）
		const workspaceView = ctx.ui.registerWorkspaceView({
			id: "dbx-connections",
			label: "%connection.title%",
			description: "管理 dbx-pro 数据库连接",
			iconTint: false,
			component: ConnectionManagerPanel,
		});

		// 输入栏按钮
		let inputAction: Disposable | null = null;
		if (ctx.permissions.has("ui.slot.input-action")) {
			inputAction = ctx.ui.registerInputAction({
				id: "dbx-pro-toggle",
				label: "数据库",
				icon: <span className="icon-[lucide--database] h-3.5 w-3.5" />,
				defaultActive: false,
				scope_use: ["im-claw", "conversation", "project", "cli"],
				onToggle(active) {
					if (!isRuntimeActive()) return;
					if (active) {
						try {
							ctx.ui.openActivityTab("dbx-pro");
						} catch { /* 忽略失活后的错误 */ }
					}
				},
			});
		}

		// 注册 Agent 工具（数据库查询、表结构浏览、查询分析）
		const toolDisposables = registerTools(ctx);

		// 安装并启动引擎 runtime（安全处理异步操作）
		const engineStartupPromise = ensureEngineStarted(ctx).catch((reason: unknown) => {
			const isActivationError = reason instanceof Error && (
				reason.message?.includes("no longer active") ||
				reason.name === "AbortError"
			);
			if (!isActivationError && isRuntimeActive()) {
				try {
					ctx.ui.notify({
						message: "dbx-pro 引擎服务启动失败，查询功能暂不可用",
						error: reason,
						variant: "error",
					});
				} catch { /* 忽略通知失败 */ }
			}
		});

		return () => {
			// 1. 首先标记运行时为失活状态（阻止新的异步操作）
			clearRuntime();

			// 2. 取消正在进行的引擎启动
			cancelEngineStartup();

			// 3. 等待引擎启动完成（或被取消），避免竞态
			engineStartupPromise.catch(() => { /* 忽略取消导致的错误 */ });

			// 4. 清理 UI 资源（包裹 try-catch 防止失活后报错）
			try { activityTab.dispose(); } catch { /* ignore */ }
			try { workspaceView.dispose(); } catch { /* ignore */ }
			try { inputAction?.dispose(); } catch { /* ignore */ }
			for (const d of toolDisposables) { try { d.dispose(); } catch { /* ignore */ } }

			// 5. 只清理属于旧实例的 DOM 元素
			const roots = document.querySelectorAll(`[data-astravia-plugin-root="dbx-pro"][data-plugin-instance]:not([data-plugin-instance="${instanceId}"])`);
			roots.forEach((root) => root.remove());
		};
	},
});

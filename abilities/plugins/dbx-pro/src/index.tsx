/**
 * dbx-pro 插件装配入口 — activate + registerActivityTab + 初始化运行时契约。
 *
 * 宿主 ctx 被 setRuntime(ctx) 保存到 runtime-contract.ts，各 feature 层通过
 * getCommand/getConversation/getStorage/getServices 访问；ctx.services 在激活时绑定到
 * 自持引擎客户端，绑定失败（宿主不支持 services）时保持 null，查询路由会自动降级 CLI。
 * getCommand/getConversation/getAgent 访问。
 */

import { Component, lazy, Suspense, type ComponentType, type ReactElement, type ReactNode } from "react";
import { definePlugin, type Disposable } from "@astravia-org/plugin-sdk";
import { setRuntime, clearRuntime, isRuntimeActive } from "./runtime-contract";
import { ensureEngineStarted, cancelEngineStartup } from "./runtime";
import { bindEngineServices, type EngineServicesApi } from "./shared/services/engine-client";
import "./style.css";

/** 插件版本号，用于显示和调试 */
export const PLUGIN_VERSION = "0.0.53";

/**
 * 清理旧的插件 DOM 和样式，避免更新后 UI 混乱。
 * 插件更新时，旧的样式表和 DOM 元素可能仍然存在，导致样式冲突。
 */
function cleanupPreviousInstance(): void {
	// 清理旧的插件根元素
	const oldRoots = document.querySelectorAll('[data-astravia-plugin-root="dbx-pro"]');
	oldRoots.forEach((root) => {
		root.remove();
	});

	// 清理旧的样式表（通过查找包含 dbx-pro 的样式）
	const styleSheets = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'));
	styleSheets.forEach((sheet) => {
		const href = sheet.getAttribute('href') || '';
		const textContent = sheet.textContent || '';
		// 清理包含 dbx-pro 相关内容的样式
		if (href.includes('dbx-pro') || textContent.includes('dbx-root') || textContent.includes('dbx-')) {
			// 保留当前实例的样式（通过 data-style-instance 标记）
			if (!sheet.hasAttribute('data-style-instance')) {
				sheet.remove();
			}
		}
	});
}

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
			// 检查是否是插件失活导致的错误
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
						<span className="text-[10px] text-muted-foreground/60">
							请稍候，新版本正在加载...
						</span>
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

const ConnectionManagerPanel = lazyPanel(async () => ({
	default: (await import("./features/database-workspace/components/connection-manager-view")).ConnectionManagerView as unknown as ComponentType<Record<string, never>>,
}));

export default definePlugin({
	async activate(ctx) {
		// 清理旧实例，避免更新后 UI 混乱
		cleanupPreviousInstance();

		// 设置运行时上下文
		setRuntime(ctx);
		
		// 绑定宿主 service 能力（plugin.json#providers.services → dbx-engine）。
		// 宿主不提供 services 时绑定 null：engine-client 会报 ENGINE_NOT_READY。
		bindEngineServices(((ctx as { services?: unknown }).services ?? null) as EngineServicesApi | null);

		// 注册主工作台 Activity Tab。
		// 包含 im-claw（宿主默认聊天界面）以确保在对话页可见。
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

		// 侧边栏连接管理工作区视图：像小红书账号管理那样可直接从侧边栏打开，
		// 便于集中管理连接（新建/编辑/测试/删除），不必进入工作台弹窗。
		const workspaceView = ctx.ui.registerWorkspaceView({
			id: "dbx-connections",
			label: "%connection.title%",
			description: "管理 dbx-pro 数据库连接",
			iconTint: false,
			component: ConnectionManagerPanel,
		});

		// 输入栏按钮：点击后打开 dbx-pro 工作台，用户可在其中右键选择表注入 AI。
		// 仅在有权限时注册，避免报错阻断插件激活。
		let inputAction: Disposable | null = null;
		if (ctx.permissions.has("ui.slot.input-action")) {
			inputAction = ctx.ui.registerInputAction({
				id: "dbx-pro-toggle",
				label: "数据库",
				icon: <span className="icon-[lucide--database] h-3.5 w-3.5" />,
				defaultActive: false,
				scope_use: ["im-claw", "conversation", "project", "cli"],
				onToggle(active) {
					// 检查运行时是否仍然活跃
					if (!isRuntimeActive()) return;
					if (active) {
						try {
							ctx.ui.openActivityTab("dbx-pro");
						} catch {
							// 忽略失活后的错误
						}
					}
				},
			});
		}

		// 安装并启动引擎 runtime（bridge 内联 + 平台二进制下载校验）。
		// 使用安全的方式处理异步操作，避免在插件失活后继续执行。
		const engineStartupPromise = ensureEngineStarted(ctx).catch((reason: unknown) => {
			// 检查是否是失活导致的错误
			const isActivationError = reason instanceof Error && (
				reason.message?.includes("no longer active") || 
				reason.name === "AbortError"
			);
			
			// 只有在插件仍然活跃时才显示通知
			if (!isActivationError && isRuntimeActive()) {
				try {
					ctx.ui.notify({
						message: "dbx-pro 引擎服务启动失败，查询功能暂不可用",
						error: reason,
						variant: "error",
					});
				} catch {
					// 忽略通知失败
				}
			}
		});

		return () => {
			// 1. 首先标记运行时为失活状态
			clearRuntime();
			
			// 2. 取消正在进行的引擎启动
			cancelEngineStartup();
			
			// 3. 等待引擎启动完成（或被取消），避免竞态
			engineStartupPromise.catch(() => {
				// 忽略取消导致的错误
			});
			
			// 4. 清理 UI 资源
			try {
				activityTab.dispose();
			} catch {
				// 忽略失活后的错误
			}
			try {
				workspaceView.dispose();
			} catch {
				// 忽略失活后的错误
			}
			try {
				inputAction?.dispose();
			} catch {
				// 忽略失活后的错误
			}
			
			// 5. 清理 DOM 中的插件元素
			const roots = document.querySelectorAll('[data-astravia-plugin-root="dbx-pro"]');
			roots.forEach((root) => root.remove());
		};
	},
});

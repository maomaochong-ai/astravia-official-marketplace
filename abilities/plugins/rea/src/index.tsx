/**
 * REA 插件入口 —— 两个 UI 槽位：
 *   1. activity-tab "rea.workflow" — 6 阶段逆向工作流（顶部 provider 状态条 + 目标路由 +
 *      阶段条 + 阶段详情 + 控制器）
 *   2. input-action "rea.openTab" — 输入栏下方 toggle 按钮：on 自动上栏 + 打开；off 下栏。
 *      toggle on 时通过 decoratePrompt 给下一个 prompt 注入工作流指令，让 Agent 进入
 *      REA 逆向流程。
 *
 * CLI provider 状态通过 as-ocr 风格的桥接对象（closure over ctx）传入 tab 组件，
 * tab 内部 useEffect 订阅 onStatusChanged。
 * index.tsx 只做装配，不放业务组件。组件在 features/<feature>/components/。
 * 主题通过 src/style.css 的 @theme inline 跟随宿主。
 */
import "./style.css";
import type { JSX } from "react";
import type { Disposable, PluginCommandRunResult, PluginContext, SendPromptResult } from "@astravia-org/plugin-sdk";
import { definePlugin } from "@astravia-org/plugin-sdk";
import {
	ReaWorkflowTab,
	type ReaProviderBridge,
} from "./features/rea-workflow";
import { activateLiveWatch } from "./features/rea-workflow/live/activate-live-watch";
import { activateReaAgentIntegration } from "./features/rea-workflow/live/agent-integration";
import { activateProviderRecovery } from "./features/rea-workflow/live/provider-recovery";
import { ReaLiveStore } from "./features/rea-workflow/live/session-store";
import { registerReaWorkflowTools } from "./tools/rea-workflow-tools";

const REA_PROVIDER_ID = "rea-agents";
const REA_TAB_ID = "rea.workflow";
const REA_ACTION_ID = "rea.openTab";

// 宿主 tab 图标槽位按 <svg> 尺寸渲染，不能直接用 Iconify 的 CSS 类；
// 这里内联 @iconify-json/lucide 的 compass 图标（与面板内 lucide/solar 图标同一套视觉语言）。
const reaIcon = (): JSX.Element => (
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
		<circle cx="12" cy="12" r="10" />
		<path d="m16.24 7.76l-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z" />
	</svg>
);

function createProviderBridge(ctx: PluginContext): ReaProviderBridge {
	return {
		getStatus: () => ctx.cliProviders.getStatus(REA_PROVIDER_ID),
		onStatusChanged: (listener) =>
			ctx.cliProviders.onStatusChanged((status) => {
				if (status.providerId === REA_PROVIDER_ID) listener(status);
			}),
		retry: () => ctx.cliProviders.retry(REA_PROVIDER_ID),
		run: (args, options) => ctx.cliProviders.run(REA_PROVIDER_ID, [...args], options),
	};
}

/**
 * 「交给 Agent」的两条通道：
 *   sendPrompt —— 真正发进当前会话（需要 agent.session.write），宿主返回 sent/queued/failed；
 *   insertPrompt —— 只填入输入框，发送通道不可用时退回到这里。
 *
 * 只走插入会造成「点了没反应」：草稿在用户没看的位置，所以要优先发送。
 */
function createPromptSender(ctx: PluginContext): (prompt: string) => Promise<SendPromptResult> {
	return (prompt: string) => ctx.conversation.sendPrompt(prompt);
}

function createPromptWriter(ctx: PluginContext): (prompt: string) => boolean {
	return (prompt: string) => {
		try {
			ctx.conversation.insertText(prompt);
			return true;
		} catch (error) {
			console.warn("[rea] cannot write to composer", error);
			return false;
		}
	};
}

/**
 * 直接命令通道：工具探测（`--version`）与 brew 安装用。
 *
 * 需要 `agent.command.run` 权限 + `plugin.json` 声明，缺任一项调用就抛错；
 * 上层把这类错误当作「未授权」而不是「工具未安装」，不会误导用户。
 */
function createCommandRunner(
	ctx: PluginContext,
): ((file: string, args: readonly string[]) => Promise<PluginCommandRunResult>) | null {
	return async (file, args) => ctx.command.run(file, [...args], { timeoutMs: 10 * 60_000 });
}

/**
 * 实时层：会话事件 → 快照；引擎自愈；Agent 侧提示与自检工具。
 *
 * 逐段 try：任何一段失败只降级这部分能力，不让整次 activate 抛错——tab 与输入栏入口
 * 已经注册完毕，缺权限或 API 不可用时它们仍然在。
 */
function activateLiveLayer(ctx: PluginContext, store: ReaLiveStore): Disposable[] {
	const disposables: Disposable[] = [];
	const start = (name: string, activate: () => Disposable | Disposable[]): void => {
		try {
			const result = activate();
			for (const item of Array.isArray(result) ? result : [result]) disposables.push(item);
		} catch (error) {
			console.warn(`[rea] live layer "${name}" unavailable`, error);
		}
	};
	start("live-watch", () => activateLiveWatch(ctx, store));
	start("provider-recovery", () => activateProviderRecovery(ctx, store, REA_PROVIDER_ID));
	start("agent-integration", () => activateReaAgentIntegration(ctx, store));
	start("tools", () => registerReaWorkflowTools(ctx, store, REA_PROVIDER_ID));
	return disposables;
}

export default definePlugin({
	async activate(ctx: PluginContext): Promise<Disposable> {
		const provider = createProviderBridge(ctx);
		const sendPrompt = createPromptSender(ctx);
		const insertPrompt = createPromptWriter(ctx);
		const runCommand = createCommandRunner(ctx);
		const store = new ReaLiveStore();

		// UI 槽位先注册：它是插件的可见入口，不能因为后面某一层不可用就整个消失。
		const tabDisposable = ctx.ui.registerActivityTab({
			id: REA_TAB_ID,
			label: ctx.i18n.t("tab.label"),
			icon: reaIcon(),
			order: 22,
			scope_use: ["conversation", "project"],
			initiallyVisible: true,
			component: () => (
				<ReaWorkflowTab
					provider={provider}
					store={store}
					sendPrompt={sendPrompt}
					insertPrompt={insertPrompt}
					runCommand={runCommand}
				/>
			),
		});

		// 输入栏 toggle：on 时把面板上栏 + 打开；off 时下栏。
		// decoratePrompt 注入 REA 工作流指令，让下一条 prompt 自动进入逆向流程。
		const actionDisposable = ctx.ui.registerInputAction({
			id: REA_ACTION_ID,
			label: ctx.i18n.t("action.openTab.label"),
			icon: reaIcon(),
			scope_use: ["conversation", "project"],
			onToggle: (active) => {
				if (active) {
					ctx.ui.setActivityTabVisible(REA_TAB_ID, true);
					ctx.ui.openActivityTab(REA_TAB_ID, { width: "max" });
				} else {
					ctx.ui.setActivityTabVisible(REA_TAB_ID, false);
				}
			},
			decoratePrompt: () => ({
				instructions: [ctx.i18n.t("prompt.workflow.instructions")],
			}),
		});

		const liveDisposables = activateLiveLayer(ctx, store);

		return {
			dispose(): void {
				for (const disposable of liveDisposables.reverse()) disposable.dispose();
				actionDisposable.dispose();
				tabDisposable.dispose();
			},
		};
	},
});

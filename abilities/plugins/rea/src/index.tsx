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
import type {
	Disposable,
	PluginCommandRunResult,
	PluginCommandSpawnHandle,
	PluginContext,
	SendPromptResult,
} from "@astravia-org/plugin-sdk";
import { definePlugin } from "@astravia-org/plugin-sdk";
import {
	ReaWorkflowTab,
	type ReaProviderBridge,
} from "./features/rea-workflow";
import { activateLiveWatch } from "./features/rea-workflow/live/activate-live-watch";
import { createReaProviderBridge } from "./features/rea-workflow/live/engine-bridge";
import { activateReaAgentIntegration } from "./features/rea-workflow/live/agent-integration";
import { activateProviderRecovery } from "./features/rea-workflow/live/provider-recovery";
import { ReaLiveStore } from "./features/rea-workflow/live/session-store";
import { registerReaWorkflowTools } from "./tools/rea-workflow-tools";

const REA_PROVIDER_ID = "rea-agents";
const REA_TAB_ID = "rea.workflow";
const REA_ACTION_ID = "rea.openTab";

// 两个槽位的图标都不内联：省略 `icon` 时宿主回落到 plugin.json#icon（同一张官方 R 徽标），
// tab 与能力页因此是同一套标识，不会多出一套自绘图形。

// 参数前缀（`-y rea-agents@latest`）在桥接层统一补齐：provider 命令是 `npx`，
// 宿主只做 command + args，调用方只写子命令。见 live/engine-bridge.ts 的说明。
function createProviderBridge(ctx: PluginContext): ReaProviderBridge {
	return createReaProviderBridge(ctx.cliProviders, REA_PROVIDER_ID);
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
 * 长驻命令通道：一键安装要「看得到过程、停得下来」，`run` 两者都做不到。
 *
 * 需要 `agent.command.spawn` 权限 + `plugin.json` 声明；缺失时整条通道为 null，
 * 面板会退回只给可复制命令，而不是给一个点了没反应的按钮。
 */
function createCommandSpawner(
	ctx: PluginContext,
): ((file: string, args: readonly string[]) => Promise<PluginCommandSpawnHandle>) | null {
	// 旧宿主没有 spawn 时直接不给通道——不能返回一个必然抛错的函数。
	if (typeof ctx.command?.spawn !== "function") return null;
	const spawn = ctx.command.spawn.bind(ctx.command);
	return async (file, args) => spawn(file, [...args], {});
}

/**
 * 活动面板宽度通道：宿主没有 tab 级 fullscreen，只能用 `ui.setActivityPanelWidth`
 * 把面板拉满 / 还原。旧宿主没有这个方法时返回 null，按钮随之隐藏。
 */
function createPanelWidthSetter(ctx: PluginContext): ((width: number | "max") => void) | null {
	const api = ctx.ui as { setActivityPanelWidth?: unknown };
	if (typeof api.setActivityPanelWidth !== "function") return null;
	const setWidth = ctx.ui.setActivityPanelWidth.bind(ctx.ui);
	return (width) => setWidth(width);
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
		const spawnCommand = createCommandSpawner(ctx);
		const setPanelWidth = createPanelWidthSetter(ctx);
		const store = new ReaLiveStore();

		// UI 槽位先注册：它是插件的可见入口，不能因为后面某一层不可用就整个消失。
		const tabDisposable = ctx.ui.registerActivityTab({
			id: REA_TAB_ID,
			label: ctx.i18n.t("tab.label"),
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
					spawnCommand={spawnCommand}
					setPanelWidth={setPanelWidth}
				/>
			),
		});

		// 输入栏 toggle：on 时把面板上栏 + 打开；off 时下栏。
		// decoratePrompt 注入 REA 工作流指令，让下一条 prompt 自动进入逆向流程。
		// label 取短名：宿主 actions 行是单行 nowrap，chip 太长会把同一行的其它插件挤到可视区外。
		const actionDisposable = ctx.ui.registerInputAction({
			id: REA_ACTION_ID,
			label: ctx.i18n.t("action.openTab.label"),
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

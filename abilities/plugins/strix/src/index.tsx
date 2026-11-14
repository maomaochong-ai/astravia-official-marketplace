import "./style.css";
import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { definePlugin, useActiveConversation } from "@astravia-org/plugin-sdk";
import { useEffect, useRef } from "react";
import { createBridgeClient } from "./domain/bridge-client";
import { hasPanelBeenSeen, isStrixEngaged, setStrixEngaged } from "./domain/engagement";
import { StrixTab } from "./features/scan-console/components/strix-tab";
import { useStrixSession } from "./features/scan-console/hooks/use-strix-session";
import { createServiceRuntime, type ServiceRuntime } from "./runtime";

/**
 * The tab's own keys, registered while the tab is the surface in front.
 *
 * ADR strix-0004: a panel that behaves like an app has to answer keys even when the
 * focus sits in its own textarea — the launch screen's Ctrl+C previously worked only
 * if the pointer had not moved focus elsewhere, which reads as "shortcuts do nothing".
 * These go through the host's shortcut stack rather than a `document` listener, so the
 * host keeps ownership of what wins when scopes overlap.
 */
let registerShortcutScope: PluginContext["ui"]["registerShortcutScope"] | null = null;

const TAB_ID = "strix.console";
const ACTION_ID = "strix.activate";

/**
 * The tab root binds the panel to the host.
 *
 * `useActiveConversation()` is the wiring that makes this a first-class surface rather
 * than a silo, and it is now the *only* model in the picture: the panel reads the
 * conversation's model, workspace and streaming state, and every prompt it accepts is
 * delivered into that conversation. There is no `ctx.ai` call here — the host agent owns
 * the loop and reaches this plugin through its `strix_*` MCP tools.
 */
function StrixTabRoot({
	ctx,
	runtime,
	onQuit,
}: {
	ctx: PluginContext;
	runtime: ServiceRuntime;
	onQuit: () => void;
}): React.ReactElement {
	// 必须把 params 转发下去：`t("scan.newRows", { count })` 若丢掉第二个参数，
	// 界面就会直接显示 `{count} 条新消息`——真机截图里的那个 bug。
	const t = (key: string, params?: Record<string, string | number>) => ctx.i18n.t(key, params);
	const conversation = useActiveConversation();
	// One client per mounted tab: rebuilding it during render would hand the hook a new
	// identity on every paint, and its effects would re-run the boot sequence forever.
	const client = useRef(createBridgeClient(() => runtime.ensureReady())).current;
	const session = useStrixSession({
		runtime,
		client,
		conversation,
		subscribe: (listener) => ctx.conversation.on(listener),
		sendPrompt: (text) => ctx.conversation.sendPrompt(text),
		// 拿不到工作目录时的退路：把话放进宿主输入框，让宿主的"新会话页"自己建会话。
		insertText: (text) => ctx.conversation.insertText(text),
		createSession: (cwd) => ctx.conversation.createSession(cwd),
		abort: () => ctx.conversation.abort(),
		// 宿主打开的工作目录：会话没有 cwd 时（新会话页、刚切目录）用它，而不是报"先打开目录"。
		workspaceRoot: () => {
			try {
				return ctx.fileExplorer.getWorkspaceRoots()[0]?.path;
			} catch {
				// 老宿主没有 workspace.read，或用户没打开目录：交给上层报错。
				return undefined;
			}
		},
		t,
	});

	// Keys the panel answers wherever focus sits inside it. Registered imperatively through
	// the host's stack (not a `document` listener, ADR strix-0004) and re-reading the live
	// session through a ref, so the bindings do not need re-registering on every render.
	// `when: "always"` on purpose: the composer is a textarea, and a scope that skipped
	// editable targets would be dead exactly when the user is typing.
	const live = useRef(session);
	live.current = session;
	useEffect(() => {
		if (!registerShortcutScope) return;
		const scope = registerShortcutScope({
			id: "console",
			kind: "surface",
			bindings: () => [
				{ key: "mod+k", when: "always", run: () => void live.current.refresh() },
				{
					// Stop the run, not the tab: leaving while a scan is live loses the session.
					key: "escape",
					when: "always",
					run: () => {
						if (live.current.hostStreaming) void live.current.stop();
					},
				},
				{ key: "mod+shift+c", when: "always", run: () => onQuit() },
			],
		});
		return () => scope.dispose();
	}, [onQuit]);

	return (
		<StrixTab
			t={t}
			version={ctx.plugin.version}
			phase={session.phase}
			log={session.log}
			boot={session.boot}
			model={session.model}
			workspace={session.workspace}
			hostStreaming={session.hostStreaming}
			environment={session.environment}
			sandbox={session.sandbox}
			findings={session.findings}
			todos={session.todos}
			notes={session.notes}
			coverage={session.coverage}
			sessions={session.sessions}
			mcp={session.mcp}
			trace={session.trace}
			onOpenNote={session.onOpenNote}
			environmentMode={session.environmentMode}
			environmentReady={session.environment?.docker?.ready !== false}
			docker={session.docker}
			onPullImage={session.pullImage}
			onEnvironmentMode={(mode) => void session.setEnvironmentMode(mode)}
			onInstallDocker={() => void session.installDocker()}
			onRefreshEnvironment={() => void session.refresh()}
			forceLaunch={session.showLaunch}
			onOpenLaunch={session.openLaunch}
			onNewSession={() => void session.newSession()}
			{...(session.coverageTally ? { coverageTally: session.coverageTally } : {})}
			busy={session.busy}
			start={session.start}
			send={session.send}
			stop={session.stop}
			onQuit={onQuit}
		/>
	);
}

export default definePlugin({
	async activate(ctx: PluginContext): Promise<Disposable> {
		const runtime = createServiceRuntime(ctx);
		// 先把 bridge 拉起再注册贡献：宿主的 MCP 贡献是「服务就绪才物化」的
		// （plugin-runtime-config-builder / resolveServiceMcp 返回 undefined 就跳过），
		// 所以等到用户点胶囊才启动，这一会话已经建好，`strix_*` 永远不会出现在工具表里。
		// 这里不 await：激活不能等一个子进程，失败了由胶囊/面板再报一次。
		void runtime.ensureReady().catch(() => undefined);
		// Captured once: the React tree needs it to register the panel's own keys, the same
		// pattern `notify` uses (a component cannot reach `ctx`).
		registerShortcutScope = ctx.ui.registerShortcutScope?.bind(ctx.ui) ?? null;

		const tab: Disposable = ctx.ui.registerActivityTab({
			id: TAB_ID,
			label: ctx.i18n.t("tab.label"),
			order: 31,
			scope_use: ["conversation", "project"],
			// Requirement: no panel until the user asks for one.
			initiallyVisible: false,
			component: () => (
				<StrixTabRoot
					ctx={ctx}
					runtime={runtime}
					// ctrl+c closes the tab, the way it quits the CLI: the screen is a
					// terminal, and the tab is what it occupies here.
					onQuit={() => ctx.ui.setActivityTabVisible(TAB_ID, false)}
				/>
			),
		});

		/**
		 * 轮次一开始就把面板带到前面（1.0.6）。
		 *
		 * 订阅挂在这里而不是组件里：宿主的 docked 面板关着时整棵子树是不挂载的
		 * （ActivityPanelView `renderDockedPanel = model.isOpen`），面板根本收不到事件，
		 * 也就无法自己跳出来。
		 *
		 * 三道门（1.0.6 审查后）：
		 *  1. 胶囊开着——这一轮交给了 Strix；没开就不是插件的活，抢焦点就是骚扰。
		 *  2. `hasPanelBeenSeen`——这个会话里面板确实开过。胶囊在状态机里也是个模块级布尔，
		 *     不然在 A 会话开着的胶囊会让 B 会话的面板被拽出来。
		 *  3. 传当前会话的 cwd——宿主在“没有活动工作区”时是**静默跳过**的
		 *     （plugin-ui-context: resolveActivityTabScopeKey 返回 null → no-activity-workspace），
		 *     不传 cwd 就只能在已有工作区的会话里生效，新会话页永远跳不过去。
		 *
		 * 不带 `width`：`openActivityTab` 已经把“上栏 + 激活 + 展开”做完了，再指定 max
		 * 等于每轮把用户手动拖的宽度覆掉，那不是“跳过去”。
		 */
		let activeConversation: { id: string | null; cwd: string | null } = { id: null, cwd: null };
		const turnFocus: Disposable = ctx.conversation.on((event) => {
			if (event.type === "conversation-changed") {
				activeConversation = { id: event.conversation.id, cwd: event.conversation.cwd };
				return;
			}
			if (event.type !== "turn-start") return;
			if (!isStrixEngaged()) return;
			if (!hasPanelBeenSeen(activeConversation.id)) return;
			try {
				ctx.ui.openActivityTab(TAB_ID, activeConversation.cwd ? { cwd: activeConversation.cwd } : undefined);
			} catch {
				// 老宿主没有这个方法：拿不到焦点不影响评估本身，不报错。
			}
		});

		const action: Disposable = ctx.ui.registerInputAction({
			id: ACTION_ID,
			label: ctx.i18n.t("action.label"),
			scope_use: ["conversation", "project"],
			onToggle: (active) => {
				setStrixEngaged(active === true);
				if (!active) {
					ctx.ui.setActivityTabVisible(TAB_ID, false);
					return;
				}
				ctx.ui.setActivityTabVisible(TAB_ID, true);
				// Enabling the chip is the moment the user expects the toolkit to exist. Install
				// and start the bridge now, not when a tab happens to mount: a capsule that only
				// sets a flag, while the service is not installed, does nothing at all.
				void runtime.ensureReady().catch((cause: unknown) => {
					ctx.ui.notify({
						message: `${ctx.i18n.t("log.bridgeError")}: ${cause instanceof Error ? cause.message : String(cause)}`,
						variant: "warning",
						durationMs: 8_000,
					});
				});
				ctx.ui.openActivityTab(TAB_ID, { width: "max" });
			},
			// The method travels with the prompt: the agent then knows which tools exist
			// and in what order to use them, without the user reciting a skill name.
			decoratePrompt: () => ({
				instructions: [ctx.i18n.t(runtime.lastStatus()?.phase === "ready" ? "prompt.instructions" : "prompt.instructionsStarting")],
			}),
		});

		return {
			dispose(): void {
				setStrixEngaged(false);
				turnFocus.dispose();
				action.dispose();
				tab.dispose();
				runtime.dispose();
			},
		};
	},
});

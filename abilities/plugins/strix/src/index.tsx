import "./style.css";
import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { definePlugin, useActiveConversation } from "@astravia-org/plugin-sdk";
import { useEffect, useRef } from "react";
import { createBridgeClient } from "./domain/bridge-client";
import { setStrixEngaged } from "./domain/engagement";
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
	const t = (key: string) => ctx.i18n.t(key);
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
		createSession: (cwd) => ctx.conversation.createSession(cwd),
		abort: () => ctx.conversation.abort(),
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
				action.dispose();
				tab.dispose();
				runtime.dispose();
			},
		};
	},
});

import { definePlugin, useTranslation, type Disposable, type PluginContext } from "@astravia-org/plugin-sdk";
import { useState, type JSX } from "react";
// Tailwind pipeline only — business CSS here would leak into the host page.
import "./style.css";
import { LogoCanvas } from "./features/canvas/components/logo-canvas";
import { PanelBoundary } from "./features/panel/panel-boundary";
import { LogoImageCard } from "./features/message/logo-image-card";
import { setPluginContext } from "./plugin-context";
import { activeScopeKey, canvasInstructions, setActiveConversation, setCanvasEngaged } from "./features/canvas/canvas-prompt";
import { ROUTER_BLOCK_ID, routerPrompt } from "./features/canvas/router-prompt";
import { IMAGE_CARD_TYPE, INPUT_ACTION_ID, INPUT_ACTION_LABEL_KEY, OPEN_FOLDER_LABEL_KEY, TAB_LABEL_KEY } from "./contributions";
import { IconCanvas, IconGenerate, IconImageSize } from "./shared/components/icons";
import { LOGO_TAB_ID } from "./tab-ids";
import { DESIGN_EXTENSION } from "./domain/design-folder";
import { openDesignFolder } from "./features/canvas/open-folder";
import { registerTools } from "./tools/register-tools";

/**
 * Activation order is a correctness concern, not a style one.
 *
 * The tab is the plugin's entire visible presence, and it used to be registered
 * *after* a `conversation.on(...)` subscription. `.on()` is a bridge call: when the
 * bridge is not ready it throws, `activate()` aborted, and the user got a plugin with
 * no tab at all — "装好了但标签页里没有". So:
 *
 *  1. **the tab goes first**, in its own guard;
 *  2. every later step is individually guarded, so one failure cannot roll back the
 *     ones before it;
 *  3. the tab is also explicitly attached (`setActivityTabVisible(true)`), because a
 *     user who once hit the minus leaves a *detach* record that overrides
 *     `initiallyVisible` for that project — the tab would stay gone forever;
 *  4. `scope_use` is widened to every interactive scenario: it is fail-closed, so a
 *     narrow list silently hides the tab in CLI/IM sessions.
 */

const SCOPES = ["conversation", "project", "im-claw", "cli"] as const;

const GATED = ["ui.slot.activity-tab", "ui.slot.input-action", "agent.tools.register"] as const;

function missingPermissions(ctx: PluginContext): string[] {
	return GATED.filter((permission) => !ctx.permissions.has(permission));
}

/**
 * The tab's root: an error boundary around the canvas.
 *
 * The canvas reads history, notes, settings and the provider list at mount. On a machine
 * where one of those files is corrupt or storage is read-only, the old build rendered an
 * empty frame — "the tab is installed but broken" with nothing to report. The boundary
 * turns that into a message, one reset button, and a log line.
 */
function PanelShell(): JSX.Element {
	const [resetKey, setResetKey] = useState(0);
	const { t } = useTranslation();
	return (
		<PanelBoundary
			resetKey={resetKey}
			onReset={() => setResetKey((value) => value + 1)}
			title={t("panel.crashTitle")}
			hint={t("panel.crashHint")}
			actionLabel={t("panel.crashRetry")}
		>
			<LogoCanvas />
		</PanelBoundary>
	);
}

export default definePlugin({
	activate(ctx) {
		setPluginContext(ctx);

		const missing = missingPermissions(ctx);
		if (missing.length > 0) {
			console.warn(
				`[logocreator] ${missing.length} permission(s) not granted: ${missing.join(", ")} — that part of the plugin stays off. ` +
					"Re-authorise it in Settings → Abilities → Plugins.",
			);
		}

		const owned: Disposable[] = [];
		const failed: string[] = [];
		const step = (label: string, run: () => void): void => {
			try {
				run();
			} catch (error) {
				failed.push(label);
				console.warn(`[logocreator] ${label} could not be registered`, error);
			}
		};

		/**
		 * The tab.
		 *
		 * Three things here are load-bearing:
		 *
		 *  1. **The icon is the plugin's own mark.** The host resolves `plugin.json#icon` into
		 *     `ctx.plugin.iconUrl`; carrying a hand-drawn glyph made the tab show one logo while
		 *     the ability card showed another. One icon, one source.
		 *  2. **A registration that throws is retried with the smallest payload.** An unsupported
		 *     option taking the whole call down inside our own guard is how "installed but no tab"
		 *     happened: nothing failed loudly, the tab just was not there.
		 *  3. **Visible per conversation.** Attach records are keyed by the session cwd, and at app
		 *     start there may be no displayed conversation yet — so the unconditional
		 *     `setActivityTabVisible(true)` can land on nothing. Re-asserted on every change below.
		 */
		const tabIcon = ctx.plugin.iconUrl ? (
			<img src={ctx.plugin.iconUrl} alt="" className="size-4 shrink-0 object-contain" draggable={false} />
		) : (
			<IconGenerate className="size-4" />
		);

		step("activity tab", () => {
			const register = (): Disposable =>
				ctx.ui.registerActivityTab({
					id: LOGO_TAB_ID,
					label: TAB_LABEL_KEY,
					icon: tabIcon,
					order: 26,
					scope_use: [...SCOPES],
					initiallyVisible: true,
					retention: "warm",
					component: PanelShell,
				});

			let disposable: Disposable;
			try {
				disposable = register();
			} catch (error) {
				console.warn("[logocreator] full tab registration rejected, retrying minimal", error);
				disposable = ctx.ui.registerActivityTab({
					id: LOGO_TAB_ID,
					label: TAB_LABEL_KEY,
					scope_use: [...SCOPES],
					component: PanelShell,
				});
			}
			owned.push(disposable);
			// Clear a stale detach record left by a previous "hide this tab" click.
			try {
				ctx.ui.setActivityTabVisible(LOGO_TAB_ID, true);
			} catch {
				/* 没有活跃会话时就是 no-op；下面的 conversation-changed 会补上。 */
			}
		});

		// ── 2. keep our scope pointer on the conversation the host is showing ──
		//      and make sure the tab really is on the strip for that conversation.
		//
		//      这条订阅需要 `agent.session.read`，而升级不会自动授予新权限。没有它也能用：
		//      面板自己走 `useActiveConversation()`（不需要额外权限）。所以这里只在有权限时订，
		//      没权限时一句话说清楚该去哪儿授权，而不是让它静默失败。
		if (!ctx.permissions.has("agent.session.read")) {
			console.warn(
				"[logocreator] agent.session.read not granted: the tab will not follow conversation switches until you re-authorise the plugin " +
					"(Settings → Abilities → Plugins), and a hidden tab will not be restored per conversation.",
			);
		} else {
			step("conversation subscription", () => {
				owned.push(
					ctx.conversation.on((event) => {
						if (event.type !== "conversation-changed") return;
						const { cwd } = event.conversation;
						setActiveConversation(cwd);
						// Attach records are per cwd; without this a tab hidden once stays hidden in
						// every later conversation even though `initiallyVisible` is true.
						if (!cwd) return;
						try {
							ctx.ui.setActivityTabVisible(LOGO_TAB_ID, true, { cwd });
						} catch {
							/* 旧宿主不接第三参：保持原行为，不因此中断事件订阅。 */
						}
					}),
				);
			});
		}

		// ── 3. tell every turn these tools exist ──────────────────────────────
		if (ctx.permissions.has("agent.tools.register")) {
			step("router prompt", () => {
				owned.push(
					ctx.agent.registerSystemPromptProvider({
						id: "logocreator:router",
						handler: () => [{ type: "addBlock", block: { id: ROUTER_BLOCK_ID, content: routerPrompt(), priority: 40 } }],
					}),
				);
			});
		}

		// ── 4. raster results under the message that produced them ────────────
		if (ctx.permissions.has("ui.slot.message")) {
			step("image card renderer", () => {
				owned.push(
					ctx.ui.registerCardRenderer({
						type: IMAGE_CARD_TYPE,
						component: LogoImageCard,
						title: "%card.image.title%",
						icon: <IconImageSize className="size-3.5" />,
						// Claims the space before the result lands, so the message does not jump.
						pendingFor: (toolCall) =>
							toolCall.toolName === "logocreator_image" ? { type: IMAGE_CARD_TYPE, payload: {} } : null,
					}),
				);
			});
		}

		// ── 5. the composer toggle ────────────────────────────────────────────
		if (ctx.permissions.has("ui.slot.input-action")) {
			step("composer toggle", () => {
				owned.push(
					ctx.ui.registerInputAction({
						// The host namespaces this as `<pluginId>:<id>`, so the id must not repeat
						// the plugin id — `logocreator:logocreator:brand` broke the state jumps.
						id: INPUT_ACTION_ID,
						label: INPUT_ACTION_LABEL_KEY,
						// 同一个商标：徽标也是品牌面，不该在 tab 上是产品 logo、在输入栏上又是另一枚。
						icon: tabIcon,
						scope_use: [...SCOPES],
						onToggle: (active) => {
							setCanvasEngaged(activeScopeKey(), active);
							// Turning it on is a request to look at the canvas; turning it off must
							// not close it (the panel may hold work nobody asked to discard).
							if (active) {
								ctx.ui.setActivityTabVisible(LOGO_TAB_ID, true);
								ctx.ui.openActivityTab(LOGO_TAB_ID);
							}
						},
						decoratePrompt: () => {
							const instructions = canvasInstructions();
							return instructions.length > 0 ? { instructions } : {};
						},
					}),
				);
			});
		}

		// ── 6. the design folder is a first-class document in the file tree ──
		//      `*.logocreator-design/` holds one design; opening it loads the canvas,
		//      exactly like the host's own `*.astravia-design/`.
		//      `ctx.fileExplorer` 在旧宿主上可能不存在：先看它在不在，不在就跳过。
		const explorer = ctx.fileExplorer;
		if (!explorer) console.info("[logocreator] file explorer api unavailable; design folders are not clickable here");
		if (explorer && ctx.permissions.has("ui.file-explorer.context-menu")) {
			step("design folder menu", () => {
				owned.push(
					explorer.registerContextMenuAction({
						id: "logocreator-open-design",
						label: OPEN_FOLDER_LABEL_KEY,
						icon: <IconCanvas className="size-3.5" />,
						when: { resourceType: "directory", extensions: [DESIGN_EXTENSION] },
						run: ({ entry }) => {
							void openDesignFolder(ctx, entry.path).then(result => {
								if (!result.opened) console.warn("[logocreator] could not open the design folder", entry.path, result.error);
							});
						},
					}),
				);
			});
		}

		if (explorer && ctx.permissions.has("ui.file-explorer.decorations")) {
			step("design folder icon", () => {
				const icon = ctx.plugin.iconUrl;
				if (!icon) return;
				owned.push(
					explorer.registerDecorationProvider({
						id: "logocreator-design-icon",
						priority: 100,
						when: { extensions: [DESIGN_EXTENSION] },
						provideDecoration: () => ({ icon }),
					}),
				);
			});
		}

		// ── 7. the tools ──────────────────────────────────────────────────────
		if (ctx.permissions.has("agent.tools.register")) {
			step("agent tools", () => {
				owned.push(...registerTools(ctx));
			});
		}

		// One line the user can find in the main-process log when something is missing.
		console.log(
			`[logocreator] activated · tab=${failed.includes("activity tab") ? "FAILED" : "registered"} · ` +
				`tools=${failed.includes("agent tools") ? "FAILED" : "registered"} · ` +
				`${failed.length === 0 ? "all contributions registered" : `failed: ${failed.join(", ")}`}`,
		);

		return () => {
			setCanvasEngaged(activeScopeKey(), false);
			for (const disposable of owned) disposable.dispose();
		};
	},
});

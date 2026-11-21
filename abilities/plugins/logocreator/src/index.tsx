import { definePlugin, type Disposable, type PluginContext } from "@astravia-org/plugin-sdk";
import type { JSX } from "react";
// Tailwind pipeline only — business CSS here would leak into the host page.
import "./style.css";
import { LogoCanvas } from "./features/canvas/components/logo-canvas";
import { LogoImageCard } from "./features/message/logo-image-card";
import { setPluginContext } from "./plugin-context";
import { activeScopeKey, canvasInstructions, setActiveConversation, setCanvasEngaged } from "./features/canvas/canvas-prompt";
import { ROUTER_BLOCK_ID, routerPrompt } from "./features/canvas/router-prompt";
import { IMAGE_CARD_TYPE, INPUT_ACTION_ID, INPUT_ACTION_LABEL_KEY, TAB_LABEL_KEY } from "./contributions";
import { IconGenerate, IconImageSize } from "./shared/components/icons";
import { LOGO_TAB_ID } from "./tab-ids";
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

function PanelShell(): JSX.Element {
	return <LogoCanvas />;
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

		// ── 1. the tab, before anything that can throw on its own ──────────────
		step("activity tab", () => {
			owned.push(
				ctx.ui.registerActivityTab({
					id: LOGO_TAB_ID,
					label: TAB_LABEL_KEY,
					// An explicit glyph: the inherited plugin icon is a 512 px photo, which at
					// the strip's 16 px reads as a rectangle.
					icon: <IconGenerate className="size-4" />,
					order: 26,
					scope_use: [...SCOPES],
					initiallyVisible: true,
					retention: "warm",
					component: PanelShell,
				}),
			);
			// Clear a stale detach record left by a previous "hide this tab" click.
			ctx.ui.setActivityTabVisible(LOGO_TAB_ID, true);
		});

		// ── 2. keep our scope pointer on the conversation the host is showing ──
		step("conversation subscription", () => {
			owned.push(
				ctx.conversation.on((event) => {
					if (event.type === "conversation-changed") setActiveConversation(event.conversation.cwd);
				}),
			);
		});

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
						icon: <IconGenerate className="size-3.5" />,
						defaultActive: false,
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

		// ── 6. the tools ──────────────────────────────────────────────────────
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

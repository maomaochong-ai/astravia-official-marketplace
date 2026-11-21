import { definePlugin, type Disposable, type PluginContext } from "@astravia-org/plugin-sdk";
import type { JSX } from "react";
// Tailwind pipeline only — business CSS here would leak into the host page.
import "./style.css";
import { LogoCanvas } from "./features/canvas/components/logo-canvas";
import { setPluginContext } from "./plugin-context";
import { IconGenerate, IconImageSize } from "./shared/components/icons";
import { activeScopeKey, canvasInstructions, setActiveConversation, setCanvasEngaged } from "./features/canvas/canvas-prompt";
import { IMAGE_CARD_TYPE, INPUT_ACTION_ID, INPUT_ACTION_LABEL_KEY, TAB_LABEL_KEY } from "./contributions";
import { ROUTER_BLOCK_ID, routerPrompt } from "./features/canvas/router-prompt";
import { LogoImageCard } from "./features/message/logo-image-card";
import { LOGO_TAB_ID } from "./tab-ids";
import { registerTools } from "./tools/register-tools";

/**
 * The panel is imported statically on purpose.
 *
 * The craft plugins lazy-load their editors because each one carries a 3–32 MB
 * wasm build; this panel is ~100 KB of React plus the engine, which the tools
 * already pull into the same chunk. Lazy-loading it only bought a second network
 * hop — and a dynamic import that fails inside the host leaves a Suspense that
 * never resolves, i.e. a tab that opens onto nothing. A panel that always renders
 * is worth more than 40 KB.
 */

const GATED = ["ui.slot.activity-tab", "ui.slot.input-action", "agent.tools.register"] as const;

function missingPermissions(ctx: PluginContext): string[] {
	return GATED.filter((permission) => !ctx.permissions.has(permission));
}

function PanelShell(): JSX.Element {
	return <LogoCanvas />;
}

export default definePlugin({
	activate(ctx) {
		// One context per activation; components read it lazily, tools via handlers.
		setPluginContext(ctx);

		const missing = missingPermissions(ctx);
		if (missing.length > 0) {
			console.warn(
				`[logocreator] ${missing.length} permission(s) not granted: ${missing.join(", ")}. ` +
					"Re-authorise the plugin in Settings → Abilities → Plugins; the entry returns with the next activation.",
			);
		}

		const owned: Disposable[] = [];

		// The host asks whichever input action is active *in the sending session*; keep
		// our own scope pointer on that same conversation so a decoration can never come
		// from the panel of a different one. The listener is replayed once on subscribe.
		owned.push(
			ctx.conversation.on((event) => {
				if (event.type === "conversation-changed") setActiveConversation(event.conversation.cwd);
			}),
		);

		// `initiallyVisible: true` is the whole point: this plugin exists to show a
		// studio, so the tab belongs on the strip. `initiallyVisible: false` (the
		// reference plugin's choice) is right for a canvas that only makes sense once
		// a design document exists — there is no equivalent marker here, so hiding it
		// meant a user installed the plugin and saw nothing at all.
		owned.push(
			ctx.ui.registerActivityTab({
				id: LOGO_TAB_ID,
				label: TAB_LABEL_KEY,
				// An explicit glyph: the inherited plugin icon is a 512 px photo, which
				// at the strip's 16 px reads as a rectangle (see TabMark).
				icon: <IconGenerate className="size-4" />,
				order: 26,
				scope_use: ["conversation", "project"],
				initiallyVisible: true,
				retention: "warm",
				component: PanelShell,
			}),
		);

		/**
		 * Tell every turn that these tools exist.
		 *
		 * The reference design plugin does the same thing and it is the missing half of
		 * "say it in the conversation and the canvas fills up": a skill only loads when the
		 * user picks it, so without a prompt block the model had no reason to reach for
		 * `logocreator_design` and answered in prose instead. The block is short and
		 * routes only; the procedure lives in the skill.
		 */
		if (ctx.permissions.has("agent.tools.register")) {
			try {
				owned.push(
					ctx.agent.registerSystemPromptProvider({
						id: "logocreator:router",
						handler: () => [{ type: "addBlock", block: { id: ROUTER_BLOCK_ID, content: routerPrompt(), priority: 40 } }],
					}),
				);
			} catch (error) {
				console.warn("[logocreator] the router prompt could not be registered", error);
			}
		}

		// Raster results appear under the message that produced them, with a skeleton while
		// the job runs. Without this, the tool's images only existed in the panel and the
		// conversation looked like nothing happened.
		if (ctx.permissions.has("ui.slot.message")) {
			try {
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
			} catch (error) {
				console.warn("[logocreator] the image card renderer could not be registered", error);
			}
		}

		if (ctx.permissions.has("ui.slot.input-action")) {
			try {
				owned.push(
					ctx.ui.registerInputAction({
						// The host namespaces this as `<pluginId>:<id>`, so the id must not
						// repeat the plugin id — `logocreator:logocreator:brand` broke jumps
						// between the toggle state and the tab.
						id: INPUT_ACTION_ID,
						label: INPUT_ACTION_LABEL_KEY,
						icon: <IconGenerate className="size-3.5" />,
						defaultActive: false,
						scope_use: ["conversation", "project"],
						onToggle: (active) => {
							// No cwd here: the host owns the per-session toggle state, and the
							// active scope is kept current by the conversation subscription above.
							setCanvasEngaged(activeScopeKey(), active);
							// Both directions keep the tab in sync: turning the toggle on is a
							// request to look at the studio, turning it off must not close it
							// (the panel may be holding work nobody asked to discard).
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
			} catch (error) {
				console.warn("[logocreator] the composer toggle could not be registered", error);
			}
		}

		if (ctx.permissions.has("agent.tools.register")) {
			try {
				owned.push(...registerTools(ctx));
			} catch (error) {
				console.warn("[logocreator] the agent tools could not be registered", error);
			}
		}

		return () => {
			setCanvasEngaged(activeScopeKey(), false);
			for (const disposable of owned) disposable.dispose();
		};
	},
});

import { definePlugin, type Disposable, type PluginContext } from "@astravia-org/plugin-sdk";
import type { JSX } from "react";
// Tailwind pipeline only — business CSS here would leak into the host page.
import "./style.css";
import { LogoCanvas } from "./features/canvas/components/logo-canvas";
import { setPluginContext } from "./plugin-context";
import { setCanvasEngaged, canvasInstructions } from "./features/canvas/canvas-prompt";
import { INPUT_ACTION_ID, INPUT_ACTION_LABEL_KEY, TAB_LABEL_KEY } from "./contributions";
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

		// `initiallyVisible: true` is the whole point: this plugin exists to show a
		// studio, so the tab belongs on the strip. `initiallyVisible: false` (the
		// reference plugin's choice) is right for a canvas that only makes sense once
		// a design document exists — there is no equivalent marker here, so hiding it
		// meant a user installed the plugin and saw nothing at all.
		owned.push(
			ctx.ui.registerActivityTab({
				id: LOGO_TAB_ID,
				label: TAB_LABEL_KEY,
				order: 26,
				scope_use: ["conversation", "project"],
				initiallyVisible: true,
				retention: "warm",
				component: PanelShell,
			}),
		);

		if (ctx.permissions.has("ui.slot.input-action")) {
			try {
				owned.push(
					ctx.ui.registerInputAction({
						// The host namespaces this as `<pluginId>:<id>`, so the id must not
						// repeat the plugin id — `logocreator:logocreator:brand` broke jumps
						// between the toggle state and the tab.
						id: INPUT_ACTION_ID,
						label: INPUT_ACTION_LABEL_KEY,
						defaultActive: false,
						scope_use: ["conversation", "project"],
						onToggle: (active) => {
							setCanvasEngaged(active);
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
			setCanvasEngaged(false);
			for (const disposable of owned) disposable.dispose();
		};
	},
});

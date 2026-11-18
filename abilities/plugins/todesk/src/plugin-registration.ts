import type { PluginContext } from "@astravia-org/plugin-sdk";
import { type ComponentType, createElement } from "react";
import type { ConsoleDeps } from "./runtime-contract";
import { registerTodeskTools } from "./tools/register-tools";

export const VIEW_ID = "console";
export const TAB_ID = "console";
export const INPUT_ACTION_ID = "console";

/**
 * Every surface this plugin contributes, registered in one place so the wiring can be
 * tested without the SDK:
 *
 *  - **workspace view** — sidebar page, cross-conversation identity;
 *  - **activity tab** — the panel on the right; `initiallyVisible: true` so it is on the
 *    bar as soon as the plugin is active instead of hiding behind the panel's “+”;
 *  - **input action** — a ToDesk button at the composer, which opens that tab. This is
 *    the composer-side entry: the composer's own “+” lists *bottom panels*, so a plugin
 *    that wants a composer button must register one of these;
 *  - **five agent tools** — the part that actually lets the agent do work.
 */
export function registerTodeskPlugin(
	ctx: PluginContext,
	deps: ConsoleDeps,
	Surface: ComponentType,
): { dispose: () => void } {
	// Neither surface reads the host's view props, so one zero-prop wrapper serves both.
	const element = (): ReturnType<typeof createElement> => createElement(Surface);

	const view = ctx.ui.registerWorkspaceView({
		id: VIEW_ID,
		label: "%view.label%",
		description: "%view.description%",
		component: element,
	});

	const tab = ctx.ui.registerActivityTab({
		id: TAB_ID,
		label: "%view.label%",
		component: element,
		scope_use: ["conversation", "project"],
		initiallyVisible: true,
		retention: "warm",
	});

	const action = ctx.ui.registerInputAction({
		id: INPUT_ACTION_ID,
		label: "%view.label%",
		scope_use: ["conversation", "project"],
		// A button, not a mode: pressing it brings the panel forward and the toggle
		// never stays "on", so `hardIsolation` is deliberately not used here — the
		// agent's tools must keep working whether or not this panel is open.
		onToggle: () => {
			ctx.ui.openActivityTab(TAB_ID);
			return false;
		},
	});

	const tools = registerTodeskTools(ctx, { run: deps.run, readSettings: deps.readSettings });

	return {
		dispose: () => {
			tools.dispose();
			action.dispose();
			tab.dispose();
			view.dispose();
		},
	};
}

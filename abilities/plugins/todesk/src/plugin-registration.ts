import type { PluginContext } from "@astravia-org/plugin-sdk";
import { type ComponentType, createElement } from "react";
import type { ConsoleDeps } from "./runtime-contract";
import { registerTodeskPrompt } from "./prompt/todesk-prompt";
import { registerTodeskTools } from "./tools/register-tools";

export const VIEW_ID = "console";
export const TAB_ID = "console";
export const INPUT_ACTION_ID = "console";

/**
 * Every surface this plugin contributes, registered in one place so the wiring can be
 * tested without the SDK:
 *
 *  - **workspace view** — sidebar page, cross-conversation identity;
 *  - **activity tab** — the panel on the right; dormant by default, opened on demand;
 *  - **input action** — a ToDesk button at the composer, which opens that tab. This is
 *    the composer-side entry: the composer's own “+” lists *bottom panels*, so a plugin
 *    that wants a composer button must register one of these;
 *  - **eleven agent tools** — the part that actually lets the agent do work (ADR 0010);
 *  - **a per-turn prompt block** — so the tools are reachable without naming a skill.
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
		// Default off on purpose: a mounted panel per conversation costs a render tree and
		// the identity read behind it. The composer button and the sidebar page open it on
		// demand — activation alone must not.
		initiallyVisible: false,
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

	const tools = registerTodeskTools(ctx, {
		run: deps.run,
		readSettings: deps.readSettings,
		readTextFile: deps.readTextFile,
		listDirectory: deps.listDirectory,
	});
	const prompt = registerTodeskPrompt(ctx);

	return {
		dispose: () => {
			prompt.dispose();
			tools.dispose();
			action.dispose();
			tab.dispose();
			view.dispose();
		},
	};
}

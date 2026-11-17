import type { PluginContext } from "@astravia-org/plugin-sdk";
import { type ComponentType, createElement } from "react";
import type { ConsoleDeps } from "./runtime-contract";
import { registerTodeskTools } from "./tools/register-tools";

export const VIEW_ID = "console";
export const TAB_ID = "console";

/**
 * Surfaces, registered in one place so the wiring can be tested without the SDK:
 *
 *  - a **workspace view** (sidebar page): this machine's identity, cross-conversation;
 *  - an **activity tab** (right-hand panel, addable from the composer's “+”): the same
 *    console next to the conversation the user is already in;
 *  - four **agent tools** that drive ToDesk's documented command line, so “install the
 *    plugin, ask the agent, it connects” works with no ToDesk setting at all.
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
		// Registers into the addable pool; the user attaches it from the panel's “+”.
		initiallyVisible: false,
		retention: "warm",
	});

	const tools = registerTodeskTools(ctx, { run: deps.run, readSettings: deps.readSettings });

	return {
		dispose: () => {
			tools.dispose();
			tab.dispose();
			view.dispose();
		},
	};
}

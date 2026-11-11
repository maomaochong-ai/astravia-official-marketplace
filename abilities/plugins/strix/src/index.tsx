/**
 * Strix plugin entry: registration only.
 *
 * Surfaces registered here, in this order:
 *  1. `strix.console` activity tab - `initiallyVisible: false`, so installing the
 *     plugin does not add a panel under the conversation. It appears when the
 *     user opens it from the tab menu or triggers activation below.
 *  2. `strix.activate` input action - opens the tab and marks the next prompt as
 *     a Strix request.
 *
 * The plugin's skills are declared with `defaultVisibility: "hidden"` in
 * plugin.json. They are implementation detail: a user installs *Strix*, and the
 * capability page, slash menu and skill picker must show Strix - icon and
 * description - not nine separate entries that look like nine products. The
 * agent still loads them through `agent.skillPaths`; activation therefore speaks
 * to the agent through `decoratePrompt` instead of typing a skill command.
 */

import "./style.css";
import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { definePlugin } from "@astravia-org/plugin-sdk";
import { useRef } from "react";
import { createBridgeClient } from "./domain/bridge-client";
import { publishHostModels, readRelayCredentials, serveModelRequests } from "./domain/host-llm-relay";
import { StrixConsolePanel } from "./features/scan-console/components/strix-console-panel";
import { useScanConsole } from "./features/scan-console/hooks/use-scan-console";
import { createServiceRuntime, type ServiceRuntime } from "./runtime";

const TAB_ID = "strix.console";
const ACTION_ID = "strix.activate";

function ConsoleTab({ ctx, runtime }: { ctx: PluginContext; runtime: ServiceRuntime }): React.ReactElement {
	const t = (key: string) => ctx.i18n.t(key);
	// One client per mounted tab. Rebuilding it during render would give the hook a new
	// identity on every paint, and its effects would re-run the boot sequence forever.
	const client = useRef(createBridgeClient(() => runtime.ensureReady())).current;
	const workspace = (ctx as unknown as { workspace?: { path?: string } }).workspace?.path;
	const model = useScanConsole(client, workspace);
	return <StrixConsolePanel t={t} model={model} status={runtime.lastStatus()} />;
}

export default definePlugin({
	async activate(ctx: PluginContext): Promise<Disposable> {
		const runtime = createServiceRuntime(ctx);

		// Borrow the host's model: publish the model list, then serve the bridge's
		// requests with ctx.ai. This lives with activation, not with the panel, so a
		// running scan keeps its model after the tab is closed.
		const relayAbort = new AbortController();
		void (async () => {
			try {
				const baseUrl = await runtime.ensureReady();
				const credentials = await readRelayCredentials(baseUrl);
				await publishHostModels(ctx, baseUrl);
				if (credentials) await serveModelRequests(ctx, baseUrl, relayAbort.signal);
			} catch (error) {
				console.warn("[strix] host model relay unavailable", error);
			}
		})();

		const tab: Disposable = ctx.ui.registerActivityTab({
			id: TAB_ID,
			label: ctx.i18n.t("tab.label"),
			order: 31,
			scope_use: ["conversation", "project"],
			// Requirement: no panel until the user asks for one.
			initiallyVisible: false,
			component: () => <ConsoleTab ctx={ctx} runtime={runtime} />,
		});

		const action: Disposable = ctx.ui.registerInputAction({
			id: ACTION_ID,
			label: ctx.i18n.t("action.label"),
			scope_use: ["conversation", "project"],
			onToggle: (active) => {
				if (!active) {
					ctx.ui.setActivityTabVisible(TAB_ID, false);
					return;
				}
				ctx.ui.setActivityTabVisible(TAB_ID, true);
				ctx.ui.openActivityTab(TAB_ID, { width: "max" });
			},
			// The plugin's own instructions travel with the prompt, so the agent knows the
			// console is open and what to do with a target - without the user having to
			// remember a hidden skill name.
			decoratePrompt: () => ({ instructions: [ctx.i18n.t("prompt.instructions")] }),
		});

		return {
			dispose(): void {
				action.dispose();
				tab.dispose();
				relayAbort.abort();
				runtime.dispose();
			},
		};
	},
});

/**
 * Strix plugin entry: registration only.
 *
 * Surfaces registered here, in this order:
 *  1. `strix.console` activity tab - `initiallyVisible: false`, so installing the
 *     plugin does not add a panel under the conversation. It appears when the
 *     user opens it from the tab menu or triggers activation below.
 *  2. `strix.activate` input action - one click opens the tab and offers the
 *     Strix skill command, which is how the agent side gets invoked.
 *
 * The skills themselves (`agent/skills/*`) are declared in plugin.json, so they
 * already appear in the host's slash-command list and skill picker; this file
 * only wires the UI to them.
 */

import "./style.css";
import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { definePlugin } from "@astravia-org/plugin-sdk";
import { useRef } from "react";
import { createBridgeClient } from "./domain/bridge-client";
import { StrixConsolePanel } from "./features/scan-console/components/strix-console-panel";
import { useScanConsole } from "./features/scan-console/hooks/use-scan-console";
import { createServiceRuntime, type ServiceRuntime } from "./runtime";

const TAB_ID = "strix.console";
const ACTION_ID = "strix.activate";
/** The primary skill; typing its slash command is the documented way in. */
const ENTRY_SKILL = "penetration-testing-with-strix";

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
				// Fill the composer with the skill command instead of sending it:
				// the user supplies the target, the agent then runs the workflow.
				try {
					ctx.conversation.insertText(`/${ENTRY_SKILL} `);
				} catch (error) {
					console.warn("[strix] cannot write to composer", error);
				}
			},
		});

		return {
			dispose(): void {
				action.dispose();
				tab.dispose();
				runtime.dispose();
			},
		};
	},
});

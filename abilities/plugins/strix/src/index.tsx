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

function ConsoleTab({ ctx, runtime }: { ctx: PluginContext; runtime: ServiceRuntime }): React.ReactElement {
	const t = (key: string) => ctx.i18n.t(key);
	// One client per mounted tab: rebuilding it during render would hand the hook a new
	// identity on every paint, and its effects would re-run the boot sequence forever.
	const client = useRef(createBridgeClient(() => runtime.ensureReady())).current;
	const model = useScanConsole(client);
	const send = (prompt: string) => ctx.conversation.sendPrompt(prompt);
	return (
		<StrixConsolePanel
			t={t}
			model={model}
			status={runtime.lastStatus()}
			send={send}
			iconUrl={ctx.plugin.iconUrl}
		/>
	);
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
			},
			// The method travels with the prompt: the agent then knows which tools exist
			// and in what order to use them, without the user reciting a skill name.
			decoratePrompt: () => ({ instructions: [ctx.i18n.t("prompt.instructions")] }),
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

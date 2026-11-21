import { definePlugin, type Disposable, type PluginContext } from "@astravia-org/plugin-sdk";
import { lazy, Suspense, type JSX } from "react";
// Tailwind pipeline only — business CSS here would leak into the host page.
import "./style.css";
import { setPluginContext } from "./plugin-context";
import { setStudioEngaged, studioInstructions } from "./features/studio/studio-prompt";
import { LOGO_TAB_ID } from "./tab-ids";
import { registerTools } from "./tools/register-tools";

/**
 * The studio panel is the expensive half of this plugin (engine + export + kit),
 * and it is only needed once the tab is actually opened. Splitting it keeps the
 * activation cost to the tab descriptor and the tool registrations.
 */
const LogoStudioPanel = lazy(() =>
	import("./features/studio/components/logo-studio-panel").then((module) => ({ default: module.LogoStudioPanel })),
);

function PanelShell(): JSX.Element {
	return (
		<Suspense
			fallback={
				<div className="flex h-full w-full items-center justify-center bg-background text-[11px] text-muted-foreground">
					LogoCreator
				</div>
			}
		>
			<LogoStudioPanel />
		</Suspense>
	);
}

const GATED = ["ui.slot.activity-tab", "ui.slot.input-action", "agent.tools.register"] as const;

function missingPermissions(ctx: PluginContext): string[] {
	return GATED.filter((permission) => !ctx.permissions.has(permission));
}

export default definePlugin({
	activate(ctx) {
		// One context per activation; the newest wins, and components read it lazily.
		setPluginContext(ctx);

		const missing = missingPermissions(ctx);
		if (missing.length > 0) {
			console.warn(
				`[logocreator] ${missing.length} permission(s) not granted: ${missing.join(", ")}. ` +
					"Re-authorise the plugin in Settings → Abilities → Plugins; the entry returns with the next activation.",
			);
		}

		const owned: Disposable[] = [];

		// Not on the tab strip by default: every conversation would inherit a logo
		// tab. It joins the strip from the composer toggle, the panel's "+" list, or
		// when a tool opens it.
		owned.push(
			ctx.ui.registerActivityTab({
				id: LOGO_TAB_ID,
				label: "%tab.label%",
				order: 26,
				scope_use: ["conversation", "project"],
				initiallyVisible: false,
				retention: "warm",
				component: PanelShell,
			}),
		);

		if (ctx.permissions.has("ui.slot.input-action")) {
			try {
				owned.push(
					ctx.ui.registerInputAction({
						id: "logocreator:brand",
						label: "%panel.title%",
						defaultActive: false,
						scope_use: ["conversation", "project"],
						onToggle: (active) => {
							setStudioEngaged(active);
							if (active) ctx.ui.openActivityTab(LOGO_TAB_ID);
						},
						decoratePrompt: () => {
							const instructions = studioInstructions();
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
			setStudioEngaged(false);
			for (const disposable of owned) disposable.dispose();
		};
	},
});

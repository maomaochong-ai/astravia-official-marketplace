import "./style.css";
import { definePlugin, type PluginActivityTabDefinition } from "@astravia-org/plugin-sdk";
import { DbxProPanel } from "./DbxProPanel";

export const plugin = definePlugin({
	id: "dbx-pro",
	activityTabs: [
		{
			id: "dbx-pro",
			label: { zh: "dbx-pro", en: "dbx-pro" },
			icon: (
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
					<ellipse cx="12" cy="5" rx="8" ry="3" />
					<path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5" />
					<path d="M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" />
				</svg>
			),
			initiallyVisible: true,
			width: "flex",
			orderAfter: ["browser"],
		} satisfies PluginActivityTabDefinition,
	],
	renderActivityTab: ({ ctx }) => {
		return <DbxProPanel ctx={ctx} />;
	},
});

export default plugin;

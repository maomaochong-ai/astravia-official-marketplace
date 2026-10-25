import { definePlugin } from "@astravia-org/plugin-sdk";
import { createElement } from "react";
import { GuideEntrySlot } from "./features/illustrated-guide/components/guide-entry-slot";
import { GuideView } from "./features/illustrated-guide/components/guide-view";
import { GUIDE_VIEW_ID } from "./features/illustrated-guide/guide-view-id";
// Tailwind pipeline only — business CSS here would leak into the host page.
import "./style.css";

/**
 * Ability pages that get the entry: the skill itself and this plugin's own card,
 * so the page is reachable from whichever of the two the user opens first.
 */
const ENTRY_ABILITY_IDS = ["qiushi-skill", "qiushi-guide"] as const;

export default definePlugin({
	activate(ctx) {
		const disposables = [
			...ENTRY_ABILITY_IDS.map(abilityId =>
				ctx.ui.registerAbilityDetailSlot({
					id: `guide-entry-${abilityId}`,
					abilityId,
					component: () => createElement(GuideEntrySlot, { onOpen: () => ctx.ui.openWorkspaceView(GUIDE_VIEW_ID) }),
				}),
			),
			ctx.ui.registerWorkspaceView({
				id: GUIDE_VIEW_ID,
				label: "%guide.view.title%",
				description: "%guide.view.subtitle%",
				// No iconify class: the host only generates CSS for classes it can see in
				// its own sources, so a plugin-declared one renders as an empty box. Without
				// one the entry falls back to this plugin's packaged icon from plugin.json.
				component: GuideView,
			}),
		];
		return () => {
			for (const disposable of disposables) disposable.dispose();
		};
	},
});

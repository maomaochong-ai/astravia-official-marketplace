/**
 * The block every turn gets, whether or not the user picked the skill.
 *
 * Why this file exists: the tools were only reachable if the agent happened to know
 * about them. Skills load when the user selects one; a plugin's tools are registered
 * but nothing says *when* to call them, so "帮我的店做个标志" came back as prose. The
 * reference design plugin registers a prompt provider for exactly this reason.
 *
 * Kept short and routing-only: the procedure belongs in the skill, and a long block
 * inflates every request in every conversation, whether logos are involved or not.
 */
export const ROUTER_BLOCK_ID = "logocreator:router";

export function routerPrompt(): string {
	return [
		"LogoCreator is available in this session and owns logo/mark work. Use it instead of describing a logo in prose.",
		"- Vector marks (print-ready, offline, brand kit): `logocreator_design`; `logocreator_brand_kit` for the kit.",
		"- Raster marks (photographic texture, a character in a pose, anything the engine's 26 pictograms cannot draw): `logocreator_image`. It spends the user's own image provider.",
		"- Unsure which structure/style to pick: `logocreator_plan` turns one sentence into three concrete specs with reasons.",
		"- The user pinned notes on the canvas: `logocreator_notes` lists them; resolve each one after the fix.",
		"Output layout: one folder per brand — `logo-designs/<slug>/` — holding `design.json` (spec, palette, every variant, kit file list), `mark.svg` and `variants/N.svg`; the brand kit goes to `logo-designs/<slug>/kit/`. Never scatter SVGs loose in the project root or invent an extra export directory.",
		"Both paths store into the same canvas history; after a run the panel opens on the new design, so do not tell the user to open it themselves.",
		"Read the `logocreator` skill before a multi-step identity task; it carries the decision rules and the limits of each path.",
	].join("\n");
}

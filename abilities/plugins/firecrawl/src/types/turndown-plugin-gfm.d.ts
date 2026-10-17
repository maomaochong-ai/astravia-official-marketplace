/**
 * turndown-plugin-gfm ships no types (and there is no @types package), so only
 * the two rules this plugin actually installs are declared here.
 */
declare module "turndown-plugin-gfm" {
	import type TurndownService from "turndown";

	export const gfm: TurndownService.Plugin;
	export const tables: TurndownService.Plugin;
	export const strikethrough: TurndownService.Plugin;
	export const taskListItems: TurndownService.Plugin;
}

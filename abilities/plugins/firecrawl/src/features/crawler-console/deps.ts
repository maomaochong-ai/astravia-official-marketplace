/**
 * Activation-time handles for the console's tool-call slot.
 *
 * The slot component is rendered by the host with only `{ toolCall }` — no plugin
 * runtime — so the store and context are published here during activation and read
 * back by the component. Activation always runs before a transcript renders.
 */

import type { PluginContext } from "@astravia-org/plugin-sdk";
import type { CrawlRunStore } from "./services/crawl-run-store";

export interface ConsoleDeps {
	ctx: PluginContext;
	store: CrawlRunStore;
}

let current: ConsoleDeps | null = null;

export function setConsoleDeps(deps: ConsoleDeps): void {
	current = deps;
}

export function getConsoleDeps(): ConsoleDeps | null {
	return current;
}

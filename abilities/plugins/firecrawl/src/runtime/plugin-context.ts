/**
 * Plugin context handle for zero-props components.
 *
 * Activity-tab components receive no props and MF fills shared dependencies
 * asynchronously, so the context is published during activate() and read lazily
 * by components — never evaluated at module top level.
 */

import type { PluginContext } from "@astravia-org/plugin-sdk";

let pluginContext: PluginContext | null = null;

export function setPluginContext(ctx: PluginContext): void {
	pluginContext = ctx;
}

export function getPluginContext(): PluginContext {
	if (!pluginContext) throw new Error("firecrawl: plugin context is not ready");
	return pluginContext;
}

export function hasPluginContext(): boolean {
	return pluginContext !== null;
}

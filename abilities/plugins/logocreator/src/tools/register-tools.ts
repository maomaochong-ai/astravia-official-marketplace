import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { createBrandKitTool } from "./brand-kit";
import { createCatalogTool } from "./catalog";
import { createDesignTool } from "./design-logo";
import { createNotesTool } from "./notes";

/**
 * Registers the agent tools and returns one handle per registration, so a
 * deactivation disposes exactly what this activation created.
 *
 * Four tools, one per verb the user can mean: design, kit, look up the vocabulary,
 * and read/close canvas notes.
 */
export function registerTools(ctx: PluginContext): Disposable[] {
	return [
		ctx.agent.registerTool(createDesignTool()),
		ctx.agent.registerTool(createBrandKitTool()),
		ctx.agent.registerTool(createCatalogTool()),
		ctx.agent.registerTool(createNotesTool()),
	];
}

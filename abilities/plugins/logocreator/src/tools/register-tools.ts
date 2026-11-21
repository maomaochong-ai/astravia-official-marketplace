import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { createBrandKitTool } from "./brand-kit";
import { createCatalogTool } from "./catalog";
import { createDesignTool } from "./design-logo";

/**
 * Registers the three agent tools and returns one handle per registration, so a
 * deactivation disposes exactly what this activation created.
 */
export function registerTools(ctx: PluginContext): Disposable[] {
	return [
		ctx.agent.registerTool(createDesignTool()),
		ctx.agent.registerTool(createBrandKitTool()),
		ctx.agent.registerTool(createCatalogTool()),
	];
}

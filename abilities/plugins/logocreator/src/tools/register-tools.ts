import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { createBrandKitTool } from "./brand-kit";
import { createCatalogTool } from "./catalog";
import { createDesignTool } from "./design-logo";
import { createImageTool } from "./image";
import { createNotesTool } from "./notes";
import { createOpenDesignTool } from "./open-design";
import { createPlanTool } from "./plan";

/**
 * Registers the agent tools and returns one handle per registration, so a
 * deactivation disposes exactly what this activation created.
 *
 * One tool per verb the user can mean: design, kit, look up the vocabulary,
 * read/close canvas notes, plan the next move, generate a raster mark, and open a
 * design package that already exists on disk.
 */
export function registerTools(ctx: PluginContext): Disposable[] {
	return [
		ctx.agent.registerTool(createDesignTool()),
		ctx.agent.registerTool(createBrandKitTool()),
		ctx.agent.registerTool(createCatalogTool()),
		ctx.agent.registerTool(createNotesTool()),
		ctx.agent.registerTool(createPlanTool()),
		ctx.agent.registerTool(createImageTool()),
		ctx.agent.registerTool(createOpenDesignTool()),
	];
}

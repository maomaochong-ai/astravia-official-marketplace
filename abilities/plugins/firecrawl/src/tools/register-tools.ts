/**
 * Tool registration.
 *
 * Three tools, one scope policy: they exist only in conversation/project
 * scenarios (scope_use is fail-closed in the host).
 */

import type { Disposable, PluginAgentToolRegistration, PluginContext } from "@astravia-org/plugin-sdk";
import type { HttpClient } from "../domain/scrape/http";
import type { CrawlRunStore } from "../features/crawler-console/services/crawl-run-store";
import { createCrawlTool } from "./crawl-tool";
import { createMapTool } from "./map-tool";
import { createScrapeTool } from "./scrape-tool";

type UnknownInput = Record<string, unknown>;

export function registerFirecrawlTools(
	ctx: PluginContext,
	client: HttpClient,
	store: CrawlRunStore,
): Disposable[] {
	const tools: Array<PluginAgentToolRegistration<UnknownInput>> = [
		createScrapeTool(ctx, client, store),
		createCrawlTool(ctx, store),
		createMapTool(ctx, client, store),
	] as Array<PluginAgentToolRegistration<UnknownInput>>;
	return tools.map((tool) => ctx.agent.registerTool(tool));
}

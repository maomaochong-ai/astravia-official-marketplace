/**
 * Tool registration.
 *
 * One scope policy for every tool: they exist only in conversation/project
 * scenarios (scope_use is fail-closed in the host). Every tool talks to the
 * Firecrawl API through the same configured client — there is no local engine
 * to route to, so registration is a flat list.
 */

import type { Disposable, PluginAgentToolRegistration, PluginContext } from "@astravia-org/plugin-sdk";
import type { ToolDeps } from "./deps";
import { createBatchScrapeTool } from "./batch-scrape-tool";
import { createCrawlTool } from "./crawl-tool";
import { createExtractTool } from "./extract-tool";
import { createMapTool } from "./map-tool";
import { createScrapeTool } from "./scrape-tool";
import { createSearchTool } from "./search-tool";
import { createJobStatusTool } from "./job-status-tool";
import { createMonitorTool } from "./monitor-tool";
import { createParseTool } from "./parse-tool";
import { createVideoTool } from "./video-tool";
import { createInteractTool } from "./interact-tool";
import { createAgentTool } from "./agent-tool";
import { createIndexSearchTool } from "./index-search-tool";

type UnknownInput = Record<string, unknown>;

export type ToolHandles = ToolDeps;

export function registerFirecrawlTools(ctx: PluginContext, deps: ToolDeps): Disposable[] {
	const tools = [
		createScrapeTool(deps),
		createBatchScrapeTool(deps),
		createCrawlTool(deps),
		createMapTool(deps),
		createSearchTool(deps),
		createExtractTool(deps),
		createParseTool(deps),
		createVideoTool(deps),
		createJobStatusTool(deps),
		createMonitorTool(deps),
		createInteractTool(deps),
		createAgentTool(deps),
		createIndexSearchTool(deps),
	] as Array<PluginAgentToolRegistration<UnknownInput>>;

	return tools.map((tool) => ctx.agent.registerTool(tool));
}

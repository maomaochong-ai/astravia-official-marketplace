/**
 * Tool registration.
 *
 * Five tools, one scope policy: they exist only in conversation/project
 * scenarios (scope_use is fail-closed in the host). The browser and model
 * handles are optional — a host without them still gets scrape/crawl/map.
 */

import type { Disposable, PluginAgentToolRegistration, PluginContext } from "@astravia-org/plugin-sdk";
import type { BinaryFetch, HttpClient } from "../domain/scrape/http";
import type { BrowserPortFactory } from "../domain/render/types";
import type { AiPort } from "../domain/ai/extract";
import type { CrawlRunStore } from "../features/crawler-console/services/crawl-run-store";
import { createCrawlTool } from "./crawl-tool";
import { createExtractTool } from "./extract-tool";
import { createMapTool } from "./map-tool";
import { createScrapeTool } from "./scrape-tool";
import { createSearchTool } from "./search-tool";

type UnknownInput = Record<string, unknown>;

export interface ToolHandles {
	client: HttpClient;
	store: CrawlRunStore;
	browser?: BrowserPortFactory;
	ai?: AiPort;
	/** Base64 transport; absent when the host cannot return binary bodies. */
	binary?: BinaryFetch;
}

export function registerFirecrawlTools(ctx: PluginContext, handles: ToolHandles): Disposable[] {
	const tools: Array<PluginAgentToolRegistration<UnknownInput>> = [
		createScrapeTool(ctx, handles.client, handles.store, handles.browser, handles.ai, handles.binary),
		createCrawlTool(ctx, handles.store),
		createMapTool(ctx, handles.client, handles.store, handles.browser),
		createSearchTool(ctx, handles.client, handles.store, handles.browser, handles.binary),
		createExtractTool(ctx, handles.client, handles.store, handles.browser, handles.ai, handles.binary),
	] as Array<PluginAgentToolRegistration<UnknownInput>>;
	return tools.map((tool) => ctx.agent.registerTool(tool));
}

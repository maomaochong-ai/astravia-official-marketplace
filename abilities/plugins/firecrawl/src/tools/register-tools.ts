/**
 * Tool registration.
 *
 * One scope policy for every tool: they exist only in conversation/project
 * scenarios (scope_use is fail-closed in the host). The browser, model, cache and
 * storage handles are optional — a host without them still gets scrape/crawl/map.
 *
 * Engine routing is a wrapper, not a fork: each tool keeps its local
 * implementation, and this file swaps in the Firecrawl API implementation when
 * the configured engine resolves to `upstream`. Tool ids, arguments and answers
 * therefore stay identical whichever engine ran.
 */

import type { Disposable, PluginAgentToolRegistration, PluginContext } from "@astravia-org/plugin-sdk";
import type { BinaryFetch, HttpClient } from "../domain/scrape/http";
import type { PageCache } from "../domain/scrape/cache";
import type { BrowserPortFactory } from "../domain/render/types";
import type { AiPort } from "../domain/ai/extract";
import type { CrawlRunStore } from "../features/crawler-console/services/crawl-run-store";
import type { UpstreamGate } from "../runtime/upstream";
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
import { readEnum } from "./tool-arguments";
import { upstreamImplementations } from "./upstream-tools";

type UnknownInput = Record<string, unknown>;

const ENGINE_CHOICES = ["auto", "upstream", "local"] as const;

export interface ToolHandles {
	client: HttpClient;
	store: CrawlRunStore;
	browser?: BrowserPortFactory;
	ai?: AiPort;
	/** Base64 transport; absent when the host cannot return binary bodies. */
	binary?: BinaryFetch;
	/** Plugin-private page cache; absent when storage is not permitted. */
	cache?: PageCache;
	/** Upstream gate; absent when `settings.json`/secrets are not permitted. */
	gate?: UpstreamGate;
}

export function registerFirecrawlTools(ctx: PluginContext, handles: ToolHandles): Disposable[] {
	const gate = handles.gate;
	const upstream = gate ? upstreamImplementations({ gate, store: handles.store }) : {};

	const local: Array<PluginAgentToolRegistration<UnknownInput>> = [
		createScrapeTool(ctx, handles.client, handles.store, handles.browser, handles.ai, handles.binary, handles.cache),
		createBatchScrapeTool(ctx, handles.client, handles.store, handles.browser, handles.binary, handles.cache),
		createCrawlTool(ctx, handles.store, handles.client, handles.ai),
		createMapTool(ctx, handles.client, handles.store, handles.browser),
		createSearchTool(ctx, handles.client, handles.store, handles.browser, handles.binary),
		createExtractTool(ctx, handles.client, handles.store, handles.browser, handles.ai, handles.binary),
		createParseTool(handles.binary),
		createVideoTool(handles.client, handles.binary),
	] as Array<PluginAgentToolRegistration<UnknownInput>>;

	const tools: Array<PluginAgentToolRegistration<UnknownInput>> = gate
		? local.map((tool) => routeByEngine(tool, upstream[tool.id], gate, handles.store))
		: local;

	if (gate) {
		tools.push(
			createJobStatusTool(gate) as PluginAgentToolRegistration<UnknownInput>,
			createMonitorTool(gate, handles.store) as PluginAgentToolRegistration<UnknownInput>,
		);
	}

	return tools.map((tool) => ctx.agent.registerTool(tool));
}

/** Same tool, two engines: `engine` picks, settings decide the default. */
function routeByEngine(
	tool: PluginAgentToolRegistration<UnknownInput>,
	upstream: ((input: unknown) => Promise<string>) | undefined,
	gate: UpstreamGate,
	store: CrawlRunStore,
): PluginAgentToolRegistration<UnknownInput> {
	if (!upstream) return tool;
	const localHandler = tool.handler;
	return {
		...tool,
		handler: async (context: Parameters<typeof localHandler>[0]) => {
			const input = (context as { trigger?: { input?: unknown } }).trigger?.input;
			const choice = readEnum(input, "engine", ENGINE_CHOICES, "auto");
			await gate.load();
			if (gate.resolve(choice) === "upstream") {
				const url = typeof (input as Record<string, unknown> | undefined)?.url === "string" ? String((input as Record<string, unknown>).url) : "";
				if (url.length > 0) store.note("info", `engine=upstream  ${url}`);
				return upstream(input);
			}
			return localHandler(context);
		},
	};
}

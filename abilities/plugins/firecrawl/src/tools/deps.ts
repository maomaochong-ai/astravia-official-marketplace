/** Shared dependencies for every tool module. */

import type { PluginContext } from "@astravia-org/plugin-sdk";
import type { FirecrawlConfig } from "../runtime/config";
import type { CrawlRunStore } from "../features/crawler-console/services/crawl-run-store";

export interface ToolDeps {
	ctx: PluginContext;
	config: FirecrawlConfig;
	store: CrawlRunStore;
}

/** What a tool handler receives at call time. */
export interface ToolTrigger {
	trigger: { input?: unknown };
}

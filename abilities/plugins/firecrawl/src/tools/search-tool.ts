/**
 * firecrawl_search — the web, then optionally the pages themselves.
 *
 * Upstream searches its own index and can immediately scrape the hits
 * (`scrapeOptions`). The plugin has no index, so it asks DuckDuckGo for the
 * ranking and then runs each hit through the same scrape pipeline — which is
 * what makes `search + read the top 3` one tool call instead of two round trips.
 */

import type { PluginContext } from "@astravia-org/plugin-sdk";
import { searchWeb } from "../domain/search/search";
import type { SearchResult } from "../domain/search/search";
import { scrapePage } from "../domain/scrape/pipeline";
import type { BinaryFetch, HttpClient } from "../domain/scrape/http";
import type { BrowserPortFactory, RenderMode } from "../domain/render/types";
import type { CrawlRunStore } from "../features/crawler-console/services/crawl-run-store";
import { clip, readBoolean, readEnum, readEnumArray, readNumber, readString, readStringArray } from "./tool-arguments";
import { formatDuration } from "../shared/formatters/format";
import { describeError } from "./scrape-tool";

const MAX_PAGE_MARKDOWN = 6_000;
const RENDER_MODES: readonly RenderMode[] = ["auto", "static", "browser"];

export function createSearchTool(
	_ctx: PluginContext,
	client: HttpClient,
	store: CrawlRunStore,
	browser: BrowserPortFactory | undefined,
	binary: BinaryFetch | undefined,
) {
	return {
		id: "firecrawl_search",
		name: "firecrawl_search",
		label: "%tool.search.label%",
		description: [
			"Search the web and — optionally — read the top results in the same call.",
			"",
			"Use it when the user asks a question that needs current pages but gives no URL, or says",
			"'find the official docs for X', 'search for recent posts about Y', 'what do people say about Z'.",
			"Set `scrape: true` (or `limit` ≤ 5) to also return each result's Markdown; without it you get",
			"titles, URLs and snippets, which is enough to pick one page for firecrawl_scrape.",
			"",
			"Do NOT use it for: a URL you already have (firecrawl_scrape), a site's URL list (firecrawl_map),",
			"or anything that must be exhaustive — this returns the provider's top hits, not a full index.",
			"Provider: DuckDuckGo HTML (no API key). Rate limits apply; limit above 20 pages through the provider's pager.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				query: { type: "string", description: "Search query, in the user's language." },
				limit: { type: "number", description: "Results to return (1-50, default 5). Above 20 uses the provider's pager." },
				sources: {
					type: "array",
					items: { type: "string", enum: ["web"] },
					description: "Where to search: only \"web\" is available (an HTML endpoint cannot serve an image index).",
				},
				categories: {
					type: "array",
					items: { type: "string", enum: ["github", "research", "pdf"] },
					description: "Narrow the search: github (site:github.com), research (site:arxiv.org), pdf (filetype:pdf).",
				},
				scrape: { type: "boolean", description: "Fetch each result and include its Markdown (default false)." },
				pagesToScrape: { type: "number", description: "How many results to fetch when scraping (1-5, default 3)." },
				country: { type: "string", description: "Region hint such as cn-zh, us-en, jp-jp." },
				lang: { type: "string", description: "Language hint such as zh, en, ja." },
				timeRange: { type: "string", enum: ["d", "w", "m", "y"], description: "Recency filter: day, week, month, year." },
				render: { type: "string", enum: [...RENDER_MODES], description: "Rendering mode for scraped results (default auto)." },
				timeoutMs: { type: "number", description: "Per-request timeout in milliseconds (1000-120000, default 30000)." },
			},
			required: ["query"],
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"] as const,
		context: { conversation: "summary" },
		timeoutMs: 300_000,
		handler: async (context: { trigger: { input?: unknown } }) => {
			const input = context.trigger.input;
			const query = readString(input, "query");
			if (!query) throw new Error('"query" is required');
			const limit = readNumber(input, "limit", { min: 1, max: 50, def: 5 });
			const sources = readStringArray(input, "sources", 4);
			if (sources.length > 0 && !sources.includes("web")) {
				throw new Error('Only the "web" source is available: this plugin searches an HTML endpoint with no image index.');
			}
			const categories = readEnumArray(input, "categories", ["github", "research", "pdf"] as const, 3);
			const scrape = readBoolean(input, "scrape", false);
			const pagesToScrape = readNumber(input, "pagesToScrape", { min: 1, max: 5, def: 3 });
			const render = readEnum(input, "render", RENDER_MODES, "auto");
			const timeoutMs = readNumber(input, "timeoutMs", { min: 1_000, max: 120_000, def: 30_000 });
			const timeRange = readEnum(input, "timeRange", ["d", "w", "m", "y"] as const, "w");

			let results: SearchResult[];
			try {
				results = await searchWeb(client, query, {
					limit,
					country: readString(input, "country"),
					lang: readString(input, "lang"),
					timeRange: readString(input, "timeRange") ? timeRange : undefined,
					timeoutMs: Math.min(timeoutMs, 30_000),
					categories,
				});
			} catch (error) {
				store.note("error", `search failed  ${describeError(error)}`);
				throw new Error(`Search failed: ${describeError(error)}`);
			}
			store.note("ok", `search  "${query}"  ${results.length} result(s)`);

			const lines = [`Search "${query}" → ${results.length} result(s) via duckduckgo.`];
			for (const result of results) {
				lines.push("", `${result.position}. ${result.title}`, `   ${result.url}`);
				if (result.description) lines.push(`   ${clip(result.description, 400)}`);
			}
			if (results.length === 0) {
				lines.push("", "No results. The provider may be rate limiting; retry later or scrape a known URL.");
			}

			if (scrape && results.length > 0) {
				lines.push("", "--- pages ---");
				for (const result of results.slice(0, pagesToScrape)) {
					try {
						const page = await scrapePage(
							client,
							result.url,
							{ render, timeoutMs, onlyMainContent: true, includeLinks: false },
							{ browser, binary },
						);
						lines.push(
							"",
							`## ${page.title || result.url}`,
							`${page.finalUrl}  (engine ${page.engine}, ${page.text.length} chars)`,
							clip(page.markdown, MAX_PAGE_MARKDOWN),
						);
						store.note("ok", `search→scrape  ${result.url}  ${formatDuration(page.durationMs)}`);
					} catch (error) {
						lines.push("", `## ${result.url}`, `Failed to read: ${describeError(error)}`);
					}
				}
			}

			return lines.join("\n");
		},
	};
}

export type { SearchResult };

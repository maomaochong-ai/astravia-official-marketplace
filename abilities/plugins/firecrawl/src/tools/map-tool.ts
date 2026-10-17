/**
 * firecrawl_map — URL discovery without fetching every page.
 */

import type { PluginContext } from "@astravia-org/plugin-sdk";
import { mapSite } from "../domain/crawl/map";
import type { HttpClient } from "../domain/scrape/http";
import type { CrawlRunStore } from "../features/crawler-console/services/crawl-run-store";
import { clampCrawlOptions } from "../tab-id";
import { DEFAULT_CRAWL_OPTIONS } from "../domain/events";
import { compilePatterns, readBoolean, readNumber, readStringArray, requireUrl } from "./tool-arguments";
import { formatDuration } from "../shared/formatters/format";

const MAX_URLS_LISTED = 300;

export function createMapTool(_ctx: PluginContext, client: HttpClient, store: CrawlRunStore) {
	return {
		id: "firecrawl_map",
		name: "firecrawl_map",
		label: "%tool.map.label%",
		description: [
			"List the URLs of a site without downloading its pages: reads robots.txt sitemaps and the links",
			"on the start page, then filters them with the same rules the crawler applies.",
			"",
			"Use it before firecrawl_crawl to choose which pages are worth reading, or when the user asks",
			"'what pages does this site have / which docs pages exist under /api'.",
			"Do NOT use it to fetch content (that is firecrawl_scrape). It returns URLs only, and it cannot",
			"invent pages a site does not link to or list in a sitemap.",
			"",
			"Defaults: 200 URLs, sitemap seeding on, same-site only.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				url: { type: "string", description: "Absolute http(s) URL whose site should be mapped." },
				limit: { type: "number", description: "Maximum URLs to return (1-500, default 200)." },
				includePaths: { type: "array", items: { type: "string" }, description: "Keep only paths matching these regular expressions." },
				excludePaths: { type: "array", items: { type: "string" }, description: "Drop paths matching these regular expressions." },
				allowExternalLinks: { type: "boolean", description: "Include links to other domains (default false)." },
				allowSubdomains: { type: "boolean", description: "Include subdomains (default false)." },
				allowBackwardCrawling: {
					type: "boolean",
					description: "Include URLs above the start path (default false keeps the start directory scope).",
				},
				ignoreRobotsTxt: { type: "boolean", description: "Ignore robots.txt disallow rules (default false)." },
				useSitemap: { type: "boolean", description: "Read robots.txt sitemaps (default true)." },
				timeoutMs: { type: "number", description: "Per-request timeout in milliseconds (1000-120000, default 30000)." },
			},
			required: ["url"],
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"] as const,
		context: { conversation: "summary" },
		timeoutMs: 180_000,
		handler: async (context: { trigger: { input?: unknown } }) => {
			const url = requireUrl(context.trigger.input);
			const base = clampCrawlOptions(DEFAULT_CRAWL_OPTIONS);
			const options = {
				limit: readNumber(context.trigger.input, "limit", { min: 1, max: 500, def: 200 }),
				includePaths: readStringArray(context.trigger.input, "includePaths"),
				excludePaths: readStringArray(context.trigger.input, "excludePaths"),
				allowExternalLinks: readBoolean(context.trigger.input, "allowExternalLinks", false),
				allowSubdomains: readBoolean(context.trigger.input, "allowSubdomains", false),
				allowBackwardCrawling: readBoolean(context.trigger.input, "allowBackwardCrawling", false),
				ignoreRobotsTxt: readBoolean(context.trigger.input, "ignoreRobotsTxt", false),
				useSitemap: readBoolean(context.trigger.input, "useSitemap", true),
				timeoutMs: readNumber(context.trigger.input, "timeoutMs", { min: 1_000, max: 120_000, def: base.timeoutMs }),
			};
			compilePatterns(options.includePaths);
			compilePatterns(options.excludePaths);

			const result = await mapSite(client, url, options, (event) => store.ingest(event));
			store.note(
				"ok",
				`map  ${url}  ${result.urls.length} urls  denied=${result.denied.length}  ${formatDuration(result.durationMs)}`,
			);

			const byCode = new Map<string, number>();
			for (const item of result.denied) byCode.set(item.code, (byCode.get(item.code) ?? 0) + 1);
			const lines = [
				`Mapped ${result.urls.length} URL(s) from ${result.startUrl} in ${formatDuration(result.durationMs)}.`,
				result.robots
					? `robots.txt: ${result.robots.present ? `${result.robots.status}, ${result.robots.rules} rules` : "not found"}${
							result.robots.failedOpen ? " (failed open)" : ""
						}; sitemaps declared: ${result.robots.sitemaps}`
					: "robots.txt: ignored by request",
				result.sitemap ? `sitemap: ${result.sitemap.fetched} file(s), ${result.sitemap.urls} URL(s)` : "sitemap: none used",
			];
			if (byCode.size > 0) {
				lines.push(`Refused: ${[...byCode.entries()].map(([code, count]) => `${code}×${count}`).join(", ")}`);
			}
			if (result.truncated) lines.push(`Note: stopped at the limit of ${options.limit}; raise it for more.`);
			lines.push("", "URLs:");
			for (const entry of result.urls.slice(0, MAX_URLS_LISTED)) lines.push(entry);
			if (result.urls.length > MAX_URLS_LISTED) {
				lines.push(`[... ${result.urls.length - MAX_URLS_LISTED} more URL(s) not listed]`);
			}
			return lines.join("\n");
		},
	};
}

/**
 * firecrawl_map — URL discovery without fetching every page.
 */

import type { PluginContext } from "@astravia-org/plugin-sdk";
import { DEFAULT_MAP_OPTIONS, mapSite } from "../domain/crawl/map";
import type { MapOptions } from "../domain/crawl/map";
import type { HttpClient } from "../domain/scrape/http";
import type { BrowserPortFactory, RenderMode } from "../domain/render/types";
import type { CrawlRunStore } from "../features/crawler-console/services/crawl-run-store";
import {
	compilePatterns,
	readBoolean,
	readEnum,
	readHeaders,
	readNumber,
	readString,
	readStringArray,
	requireUrl,
} from "./tool-arguments";
import { formatDuration } from "../shared/formatters/format";

const MAX_URLS_LISTED = 300;
const RENDER_MODES: readonly RenderMode[] = ["auto", "static", "browser"];

export function createMapTool(
	_ctx: PluginContext,
	client: HttpClient,
	store: CrawlRunStore,
	browser: BrowserPortFactory | undefined,
) {
	return {
		id: "firecrawl_map",
		name: "firecrawl_map",
		label: "%tool.map.label%",
		description: [
			"List the URLs of a site without downloading its pages: reads robots.txt sitemaps and the links",
			"on the start page, then filters them with the same rules the crawler applies.",
			"",
			"Use it before firecrawl_crawl to choose which pages are worth reading, or when the user asks",
			"'what pages does this site have / which docs pages exist under /api'. `search` narrows the list",
			"to URLs whose path mentions a word (e.g. \"api\", \"pricing\").",
			"Do NOT use it to fetch content (that is firecrawl_scrape). It returns URLs only, and it cannot",
			"invent pages a site does not link to or list in a sitemap.",
			"",
			"Defaults: 200 URLs, sitemap seeding on, same-site only, browser rendering for the start page.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				url: { type: "string", description: "Absolute http(s) URL whose site should be mapped." },
				limit: { type: "number", description: "Maximum URLs to return (1-5000, default 500)." },
				search: { type: "string", description: "Keep only URLs matching this word/phrase, best matches first." },
				includePaths: { type: "array", items: { type: "string" }, description: "Keep only paths matching these regular expressions." },
				excludePaths: { type: "array", items: { type: "string" }, description: "Drop paths matching these regular expressions." },
				filterByPath: { type: "boolean", description: "Apply includePaths as a filter (default false)." },
				includeSubdomains: { type: "boolean", description: "Include subdomains (default false)." },
				allowExternalLinks: { type: "boolean", description: "Include links to other domains (default false)." },
				ignoreQueryParameters: { type: "boolean", description: "Treat URLs differing only by query string as one (default false)." },
				ignoreCache: { type: "boolean", description: "Send Cache-Control: no-cache (default false)." },
				ignoreRobotsTxt: { type: "boolean", description: "Ignore robots.txt disallow rules (default false)." },
				ignoreSitemap: { type: "boolean", description: "Do not read robots.txt sitemaps (default false)." },
				sitemapOnly: { type: "boolean", description: "Report sitemap URLs only, skipping the start page (default false)." },
				render: { type: "string", enum: [...RENDER_MODES], description: "How to read the start page: auto (default), static or browser." },
				timeoutMs: { type: "number", description: "Per-request timeout in milliseconds (1000-120000, default 30000)." },
				headers: {
					type: "object",
					description: "Extra request headers for robots.txt, sitemaps and the start page, e.g. {\"accept-language\":\"de\"}.",
				},
			},
			required: ["url"],
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"] as const,
		context: { conversation: "summary" },
		timeoutMs: 180_000,
		handler: async (context: { trigger: { input?: unknown } }) => {
			const url = requireUrl(context.trigger.input);
			const options: MapOptions = {
				...DEFAULT_MAP_OPTIONS,
				limit: readNumber(context.trigger.input, "limit", { min: 1, max: 5_000, def: DEFAULT_MAP_OPTIONS.limit }),
				search: readString(context.trigger.input, "search"),
				includePaths: readStringArray(context.trigger.input, "includePaths"),
				excludePaths: readStringArray(context.trigger.input, "excludePaths"),
				filterByPath: readBoolean(context.trigger.input, "filterByPath", false),
				includeSubdomains: readBoolean(context.trigger.input, "includeSubdomains", false),
				allowExternalLinks: readBoolean(context.trigger.input, "allowExternalLinks", false),
				ignoreQueryParameters: readBoolean(context.trigger.input, "ignoreQueryParameters", false),
				ignoreRobotsTxt: readBoolean(context.trigger.input, "ignoreRobotsTxt", false),
				ignoreSitemap: readBoolean(context.trigger.input, "ignoreSitemap", false),
				sitemapOnly: readBoolean(context.trigger.input, "sitemapOnly", false),
				render: readEnum(context.trigger.input, "render", RENDER_MODES, "auto"),
				timeoutMs: readNumber(context.trigger.input, "timeoutMs", { min: 1_000, max: 120_000, def: DEFAULT_MAP_OPTIONS.timeoutMs }),
				headers: withNoCache(readHeaders(context.trigger.input), readBoolean(context.trigger.input, "ignoreCache", false)),
			};
			compilePatterns(options.includePaths);
			compilePatterns(options.excludePaths);

			const result = await mapSite(client, url, options, (event) => store.ingest(event), undefined, { browser });
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

function withNoCache(headers: Record<string, string>, ignoreCache: boolean): Record<string, string> {
	return ignoreCache ? { ...headers, "cache-control": "no-cache" } : headers;
}

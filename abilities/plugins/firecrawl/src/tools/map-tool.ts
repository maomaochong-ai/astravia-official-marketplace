/**
 * firecrawl_map — URL discovery without fetching page content.
 */

import type { ToolDeps } from "./deps";
import { mapBody } from "./request-bodies";

const MAX_URLS_LISTED = 500;

export function createMapTool({ config, store }: ToolDeps) {
	return {
		id: "firecrawl_map",
		name: "firecrawl_map",
		label: "%tool.map.label%",
		description: [
			"List a site's URLs without downloading its pages. Firecrawl reads the sitemap and the links it",
			"already knows, so the result is fast and cheap compared with crawling.",
			"",
			"Use it before firecrawl_crawl to choose which pages are worth reading, or when the user asks",
			"'what pages does this site have / which docs pages exist under /api'. `search` ranks URLs whose",
			"path mentions a word. `includePaths`/`excludePaths` narrow the result.",
			"",
			"Do NOT use it to fetch content (that is firecrawl_scrape). It returns URLs only and cannot invent",
			"pages a site does not link to or list in a sitemap.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				url: { type: "string", description: "Absolute http(s) URL whose site should be mapped." },
				search: { type: "string", description: "Keep only URLs matching this word or phrase, best matches first." },
				limit: { type: "number", description: "Maximum URLs to return (1-100000, default 5000)." },
				includePaths: { type: "array", items: { type: "string" }, description: "Keep only paths matching these patterns." },
				excludePaths: { type: "array", items: { type: "string" }, description: "Drop paths matching these patterns." },
				sitemap: {
					type: "string",
					enum: ["include", "only", "skip"],
					description: "How to use the sitemap: include (default), only, or skip.",
				},
				includeSubdomains: { type: "boolean", description: "Include subdomains. Default false." },
				allowExternalLinks: { type: "boolean", description: "Include links to other domains. Default false." },
				ignoreQueryParameters: { type: "boolean", description: "Treat URLs differing only by query string as one. Default false." },
				ignoreCache: { type: "boolean", description: "Bypass the upstream cache. Default false." },
			},
			required: ["url"],
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"] as const,
		context: { conversation: "summary" },
		timeoutMs: 180_000,
		handler: async (context: { trigger: { input?: unknown } }) => {
			const body = mapBody(context.trigger.input);
			const client = await config.require();
			const result = await client.map(body);
			store.note("ok", `map  ${String(body.url)}  ${result.count} urls`);
			const lines = [`Mapped ${result.count} URL(s) from ${String(body.url)}.`];
			if (result.creditsUsed !== undefined) lines.push(`Credits: ${result.creditsUsed}`);
			lines.push("", "URLs:");
			for (const link of result.links.slice(0, MAX_URLS_LISTED)) lines.push(link);
			if (result.links.length > MAX_URLS_LISTED) {
				lines.push(`[... ${result.links.length - MAX_URLS_LISTED} more URL(s) not listed]`);
			}
			return lines.join("\n");
		},
	};
}

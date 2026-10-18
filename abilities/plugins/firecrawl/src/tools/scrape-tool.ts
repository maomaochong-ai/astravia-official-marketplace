/**
 * firecrawl_scrape — one URL through the Firecrawl API.
 */

import { describeDocument } from "../domain/firecrawl/documents";
import type { ToolDeps } from "./deps";
import { scrapeBody } from "./request-bodies";
import { scrapeProperties, urlProperty } from "./scrape-arguments";
import { requireUrl } from "./tool-arguments";

export function createScrapeTool({ config, store }: ToolDeps) {
	return {
		id: "firecrawl_scrape",
		name: "firecrawl_scrape",
		label: "%tool.scrape.label%",
		description: [
			"Read one web page through Firecrawl. By default you get its main content as Markdown plus title,",
			"canonical URL, metadata, links and images; `formats` adds HTML, raw HTML, a screenshot, a summary,",
			"schema-shaped JSON, attribute selectors, branding/product/menu records, change tracking, or the page's",
			"video and audio URLs. A page whose content is media therefore comes back as URLs, not prose.",
			"Rendering, anti-bot handling and PDF parsing happen upstream.",
			"",
			"Use it when the user gives you a URL to read, quote, summarize, translate, screenshot or compare.",
			"Do NOT use it for: many pages (firecrawl_crawl), listing a site's URLs (firecrawl_map), finding",
			"pages on the web (firecrawl_search), multi-page structured data (firecrawl_extract), or reading a",
			"local document (firecrawl_parse).",
			"",
			"Useful options: `formats` to add outputs, `actions` + `waitFor` for pages that need interaction,",
			"`onlyMainContent` (default true) to drop navigation, `maxAge: 0` to bypass the cache.",
			"",
			"Limits: one page per call; Markdown is clipped at 60k characters; screenshots come back as a data",
			"URL and should be described rather than pasted unless the user asked for the image; `rawBase64`",
			"cannot be combined with other formats.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: { url: urlProperty, ...scrapeProperties },
			required: ["url"],
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"] as const,
		context: { conversation: "summary" },
		timeoutMs: 180_000,
		handler: async (context: { trigger: { input?: unknown } }) => {
			const input = context.trigger.input;
			const url = requireUrl(input);
			const body = scrapeBody(input);
			const client = await config.require();
			const started = Date.now();
			try {
				const document = await client.scrape(body);
				store.note("ok", `scrape  ${url}  ${document.markdown?.length ?? 0} chars`);
				return describeDocument(document, client.endpoint, Date.now() - started);
			} catch (error) {
				store.note("error", `scrape  ${url}  ${error instanceof Error ? error.message : String(error)}`);
				throw error;
			}
		},
	};
}

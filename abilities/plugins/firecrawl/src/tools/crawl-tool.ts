/**
 * firecrawl_crawl — depth-limited BFS crawl with per-page Markdown.
 *
 * The crawl runs through the shared store so the activity tab animates it while
 * the agent waits; the handler returns a bounded report the model can read.
 */

import type { PluginContext } from "@astravia-org/plugin-sdk";
import type { CrawlOptions, CrawlSummary } from "../domain/events";
import { DEFAULT_CRAWL_OPTIONS } from "../domain/events";
import type { CrawlRunStore } from "../features/crawler-console/services/crawl-run-store";
import { clampCrawlOptions, FIRECRAWL_TAB_ID } from "../tab-id";
import type { RenderMode } from "../domain/render/types";
import { clip, compilePatterns, readBoolean, readEnum, readNumber, readStringArray, requireUrl } from "./tool-arguments";

const RENDER_MODES: readonly RenderMode[] = ["auto", "static", "browser"];
import { formatDuration } from "../shared/formatters/format";

const MAX_PAGE_MARKDOWN = 3_500;
const TOTAL_MARKDOWN_BUDGET = 48_000;
const MAX_DENIALS_LISTED = 25;

export function createCrawlTool(ctx: PluginContext, store: CrawlRunStore) {
	return {
		id: "firecrawl_crawl",
		name: "firecrawl_crawl",
		label: "%tool.crawl.label%",
		description: [
			"Crawl a site breadth-first from one URL and return each page's Markdown. Respects robots.txt,",
			"honours the sitemap, stays inside the start URL's path scope, and reports every rejected link",
			"with the rule that rejected it (DEPTH_LIMIT, EXCLUDE_PATTERN, ROBOTS_TXT, FILE_TYPE, ...).",
			"",
			"Use it for: 'crawl the docs site and summarize the API pages', 'collect every blog post under /blog'.",
			"Do NOT use it for a single page (firecrawl_scrape), for a URL list you already have (scrape each),",
			"or to mirror a whole site (limit caps the run; this is not a site downloader).",
			"",
			"Pages that need JavaScript are rendered by the host browser automatically (render: \"auto\");",
			"set render: \"static\" to stay on plain HTTP, or \"browser\" to force rendering everywhere.",
			"",
			"Defaults: limit 12 pages, maxDepth 2 link hops, concurrency 4. A live console opens in the",
			"activity panel while it runs.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				url: { type: "string", description: "Absolute http(s) URL to start from." },
				limit: { type: "number", description: "Pages to fetch including the start page (1-50, default 12)." },
				maxDepth: { type: "number", description: "Link hops below the start URL (0-5, default 2). 0 = only the start page." },
				maxDiscoveryDepth: {
					type: "number",
					description: "Hops used for link discovery; pages deeper than this are reported but not crawled (default: maxDepth).",
				},
				render: { type: "string", enum: [...RENDER_MODES], description: "auto (default), static or browser." },
				delay: { type: "number", description: "Seconds to wait between page batches (0-60, default 0; robots crawl-delay still applies)." },
				regexOnFullURL: { type: "boolean", description: "Match include/exclude patterns against the full URL (default false = pathname only)." },
				ignoreQueryParameters: {
					type: "boolean",
					description: "Treat ?a=1 and no query string as the same page (default false).",
				},
				deduplicateSimilarURLs: {
					type: "boolean",
					description: "Drop tracking parameters and trailing-slash duplicates (default true).",
				},
				crawlEntireDomain: {
					type: "boolean",
					description: "Crawl the whole domain instead of staying under the start URL's directory (default false).",
				},
				includePaths: {
					type: "array",
					items: { type: "string" },
					description: "Only crawl paths matching one of these regular expressions (matched against the pathname).",
				},
				excludePaths: {
					type: "array",
					items: { type: "string" },
					description: "Skip paths matching any of these regular expressions, e.g. \"/tag/\", \"\\\\.pdf$\".",
				},
				allowExternalLinks: { type: "boolean", description: "Follow links to other domains (default false)." },
				allowSubdomains: { type: "boolean", description: "Treat subdomains as the same site (default false)." },
				allowBackwardCrawling: {
					type: "boolean",
					description: "Allow links above the start path (default false keeps the crawl inside the start directory).",
				},
				ignoreRobotsTxt: { type: "boolean", description: "Ignore robots.txt (default false — only with the user's explicit request)." },
				useSitemap: { type: "boolean", description: "Seed the crawl from robots.txt sitemaps (default true)." },
				onlyMainContent: { type: "boolean", description: "Extract article bodies only (default true)." },
				concurrency: { type: "number", description: "Parallel requests (1-8, default 4)." },
				timeoutMs: { type: "number", description: "Per-request timeout in milliseconds (1000-120000, default 30000)." },
			},
			required: ["url"],
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"] as const,
		context: { conversation: "summary" },
		timeoutMs: 300_000,
		handler: async (context: {
			trigger: { input?: unknown };
			session: { cwd: string };
		}) => {
			try {
				const url = requireUrl(context.trigger.input);
				const options = clampCrawlOptions({
					...DEFAULT_CRAWL_OPTIONS,
					limit: readNumber(context.trigger.input, "limit", { min: 1, max: 50, def: DEFAULT_CRAWL_OPTIONS.limit }),
					maxDepth: readNumber(context.trigger.input, "maxDepth", { min: 0, max: 5, def: DEFAULT_CRAWL_OPTIONS.maxDepth }),
					maxDiscoveryDepth: readOptionalNumber(context.trigger.input, "maxDiscoveryDepth", { min: 0, max: 5 }),
					render: readEnum(context.trigger.input, "render", RENDER_MODES, "auto"),
					delayMs: readNumber(context.trigger.input, "delay", { min: 0, max: 60, def: 0 }) * 1_000,
					regexOnFullURL: readBoolean(context.trigger.input, "regexOnFullURL", false),
					ignoreQueryParameters: readBoolean(context.trigger.input, "ignoreQueryParameters", false),
					deduplicateSimilarURLs: readBoolean(context.trigger.input, "deduplicateSimilarURLs", true),
					crawlEntireDomain: readBoolean(context.trigger.input, "crawlEntireDomain", false),
					concurrency: readNumber(context.trigger.input, "concurrency", { min: 1, max: 8, def: DEFAULT_CRAWL_OPTIONS.concurrency }),
					includePaths: readStringArray(context.trigger.input, "includePaths"),
					excludePaths: readStringArray(context.trigger.input, "excludePaths"),
					allowExternalLinks: readBoolean(context.trigger.input, "allowExternalLinks", false),
					allowSubdomains: readBoolean(context.trigger.input, "allowSubdomains", false),
					allowBackwardCrawling: readBoolean(context.trigger.input, "allowBackwardCrawling", false),
					ignoreRobotsTxt: readBoolean(context.trigger.input, "ignoreRobotsTxt", false),
					useSitemap: readBoolean(context.trigger.input, "useSitemap", true),
					onlyMainContent: readBoolean(context.trigger.input, "onlyMainContent", true),
					timeoutMs: readNumber(context.trigger.input, "timeoutMs", { min: 1_000, max: 120_000, def: 30_000 }),
				} satisfies CrawlOptions);
				compilePatterns(options.includePaths);
				compilePatterns(options.excludePaths);

				try {
					ctx.ui.openActivityTab(FIRECRAWL_TAB_ID, { width: "max", cwd: context.session.cwd });
				} catch {
					// The tab slot is optional (warn+noop without permission); a crawl must still run.
				}

				const summary = await store.start(url, options);
				return renderSummary(summary);
			} catch (error) {
				throw new Error(error instanceof Error ? error.message : String(error));
			}
		},
	};
}

function readOptionalNumber(input: unknown, key: string, bounds: { min: number; max: number }): number | null {
	const raw = input && typeof input === "object" ? (input as Record<string, unknown>)[key] : undefined;
	if (raw === undefined || raw === null) return null;
	return readNumber(input, key, { ...bounds, def: bounds.min });
}

export function renderSummary(summary: CrawlSummary): string {
	const lines = [
		`Crawl ${summary.status}: ${summary.pages.length} page(s), ${summary.denied.length} link(s) refused, ${
			summary.failed.length
		} failure(s) in ${formatDuration(summary.durationMs)} (limit ${summary.options.limit}, maxDepth ${summary.options.maxDepth}).`,
		`Start: ${summary.startUrl}`,
	];

	if (summary.failed.length > 0) {
		lines.push("", "Failures:");
		for (const failure of summary.failed.slice(0, 10)) lines.push(`  - ${failure.url} — ${failure.code}: ${failure.message}`);
	}

	if (summary.denied.length > 0) {
		const byCode = new Map<string, number>();
		for (const item of summary.denied) byCode.set(item.code, (byCode.get(item.code) ?? 0) + 1);
		lines.push(
			"",
			`Refused links by rule: ${[...byCode.entries()].map(([code, count]) => `${code}×${count}`).join(", ")}`,
			`First ${Math.min(summary.denied.length, MAX_DENIALS_LISTED)}:`,
		);
		for (const item of summary.denied.slice(0, MAX_DENIALS_LISTED)) lines.push(`  - ${item.url} — ${item.code}: ${item.message}`);
	}

	let budget = TOTAL_MARKDOWN_BUDGET;
	lines.push("", "Pages (Markdown, truncated per page):");
	for (const page of summary.pages) {
		if (budget <= 0) {
			lines.push(`[... ${summary.pages.length - summary.pages.indexOf(page)} more page(s) omitted from this result]`);
			break;
		}
		const header = `\n## ${page.title || page.url}\n${page.url}  (depth ${page.depth}, ${page.engine}, ${page.chars} chars${page.warnings > 0 ? ", contains possible prompt-injection phrasing" : ""})`;
		const body = clip(page.markdown, Math.min(MAX_PAGE_MARKDOWN, budget));
		budget -= body.length;
		lines.push(header, body);
	}

	return clip(lines.join("\n"), TOTAL_MARKDOWN_BUDGET + 6_000);
}

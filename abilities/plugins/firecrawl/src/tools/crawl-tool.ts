/**
 * firecrawl_crawl — depth-limited BFS crawl with per-page Markdown.
 *
 * The crawl runs through the shared store so the activity tab animates it while
 * the agent waits; the handler returns a bounded report the model can read.
 *
 * Two optional extra steps mirror upstream's `prompt` and `webhook`: after the
 * crawl, a `prompt` is answered over the collected pages with the host model, and
 * a `webhookUrl` receives the summary as a POST. Neither changes the crawl.
 */

import type { PluginContext } from "@astravia-org/plugin-sdk";
import type { CrawlOptions, CrawlSummary, SitemapMode } from "../domain/events";
import { DEFAULT_CRAWL_OPTIONS, redactCrawlOptions } from "../domain/events";
import type { CrawlRunStore } from "../features/crawler-console/services/crawl-run-store";
import { clampCrawlOptions, FIRECRAWL_TAB_ID } from "../tab-id";
import type { RenderMode } from "../domain/render/types";
import { coerceSelectors } from "../domain/html/attributes";
import type { HttpClient } from "../domain/scrape/http";
import type { AiPort } from "../domain/ai/extract";
import { answerOverPages } from "../domain/ai/extract";
import {
	clip,
	compilePatterns,
	readBoolean,
	readEnum,
	readHeaders,
	readNumber,
	readOptionalString,
	readStringArray,
	requireUrl,
	readAttributesInput,
} from "./tool-arguments";

const RENDER_MODES: readonly RenderMode[] = ["auto", "static", "browser"];
const SITEMAP_MODES: readonly SitemapMode[] = ["include", "only", "skip"];
import { formatDuration } from "../shared/formatters/format";

const MAX_PAGE_MARKDOWN = 3_500;
const TOTAL_MARKDOWN_BUDGET = 48_000;
const MAX_DENIALS_LISTED = 25;
const MAX_ANSWER_CHARS = 6_000;

export function createCrawlTool(ctx: PluginContext, store: CrawlRunStore, client: HttpClient, ai?: AiPort) {
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
			"Do NOT use it for a single page (firecrawl_scrape), for a URL list you already have",
			"(firecrawl_batch_scrape), or to mirror a whole site (limit caps the run; this is not a downloader).",
			"",
			"Pages that need JavaScript are rendered by the host browser automatically (render: \"auto\");",
			"set render: \"static\" to stay on plain HTTP, or \"browser\" to force rendering everywhere.",
			"",
			"Pass prompt to get one answer over the crawled pages instead of reading every page yourself;",
			"pass webhookUrl to have the summary POSTed when the crawl finishes.",
			"",
			"Defaults: limit 12 pages, maxDepth 2 link hops, concurrency 4. A live console opens in the",
			"activity panel while it runs.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				url: { type: "string", description: "Absolute http(s) URL to start from." },
				limit: { type: "number", description: "Pages to fetch including the start page (1-200, default 12)." },
				maxDepth: { type: "number", description: "Link hops below the start URL (0-10, default 2). 0 = only the start page." },
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
				sitemap: {
					type: "string",
					enum: [...SITEMAP_MODES],
					description: "include (default): seed from robots.txt sitemaps. only: crawl the sitemap URLs and never follow links. skip: ignore sitemaps.",
				},
				onlyMainContent: { type: "boolean", description: "Extract article bodies only (default true)." },
				concurrency: { type: "number", description: "Parallel requests (1-8, default 4)." },
				maxConcurrency: { type: "number", description: "Alias of concurrency (upstream name)." },
				headers: {
					type: "object",
					description: "Extra request headers for every page, e.g. {\"accept-language\":\"de\"}. HTTP engine only.",
				},
				robotsUserAgent: {
					type: "string",
					description: "User-Agent used to match robots.txt groups (default FirecrawlAgent).",
				},
				profile: {
					type: "string",
					description: "Persistent browser profile id, so a logged-in session is reused (1-64 letters, digits, dot, dash, underscore).",
				},
				prompt: {
					type: "string",
					description: "Question to answer over the crawled pages, e.g. 'Which pages document authentication?'.",
				},
				webhookUrl: {
					type: "string",
					description: "POST the crawl summary (JSON) to this absolute http(s) URL when the crawl finishes.",
				},
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
				const input = context.trigger.input;
				const concurrency = readNumber(input, "concurrency", { min: 1, max: 8, def: DEFAULT_CRAWL_OPTIONS.concurrency });
				const maxConcurrency = readNumber(input, "maxConcurrency", { min: 1, max: 8, def: concurrency });
				const options = clampCrawlOptions({
					...DEFAULT_CRAWL_OPTIONS,
					limit: readNumber(input, "limit", { min: 1, max: 200, def: DEFAULT_CRAWL_OPTIONS.limit }),
					maxDepth: readNumber(input, "maxDepth", { min: 0, max: 10, def: DEFAULT_CRAWL_OPTIONS.maxDepth }),
					maxDiscoveryDepth: readOptionalNumber(input, "maxDiscoveryDepth", { min: 0, max: 10 }),
					render: readEnum(input, "render", RENDER_MODES, "auto"),
					delayMs: readNumber(input, "delay", { min: 0, max: 60, def: 0 }) * 1_000,
					regexOnFullURL: readBoolean(input, "regexOnFullURL", false),
					ignoreQueryParameters: readBoolean(input, "ignoreQueryParameters", false),
					deduplicateSimilarURLs: readBoolean(input, "deduplicateSimilarURLs", true),
					crawlEntireDomain: readBoolean(input, "crawlEntireDomain", false),
					concurrency,
					includePaths: readStringArray(input, "includePaths"),
					excludePaths: readStringArray(input, "excludePaths"),
					allowExternalLinks: readBoolean(input, "allowExternalLinks", false),
					allowSubdomains: readBoolean(input, "allowSubdomains", false),
					allowBackwardCrawling: readBoolean(input, "allowBackwardCrawling", false),
					ignoreRobotsTxt: readBoolean(input, "ignoreRobotsTxt", false),
					sitemap: readEnum(input, "sitemap", SITEMAP_MODES, "include"),
					robotsUserAgent: readOptionalString(input, "robotsUserAgent") ?? DEFAULT_CRAWL_OPTIONS.robotsUserAgent,
					headers: readHeaders(input),
					profileId: readOptionalString(input, "profile"),
					maxAge: readNumber(input, "maxAge", { min: 0, max: 30 * 24 * 60 * 60 * 1_000, def: 0 }),
					attributeSelectors: coerceSelectors(readAttributesInput(input)),
					onlyMainContent: readBoolean(input, "onlyMainContent", true),
					timeoutMs: readNumber(input, "timeoutMs", { min: 1_000, max: 120_000, def: 30_000 }),
				} satisfies CrawlOptions);
				options.concurrency = Math.min(concurrency, maxConcurrency);
				compilePatterns(options.includePaths);
				compilePatterns(options.excludePaths);
				const prompt = readOptionalString(input, "prompt");
				const webhookUrl = readOptionalString(input, "webhookUrl");
				const webhook = webhookUrl ? requireUrl({ url: webhookUrl }) : null;

				try {
					ctx.ui.openActivityTab(FIRECRAWL_TAB_ID, { width: "max", cwd: context.session.cwd });
				} catch {
					// The tab slot is optional (warn+noop without permission); a crawl must still run.
				}

				const summary = await store.start(url, options);
				const sections = [renderSummary(summary)];

				if (prompt) sections.push(await answer(summary, prompt, ai));
				if (webhook) sections.push(await deliver(webhook, summary, client));
				return sections.join("\n\n");
			} catch (error) {
				throw new Error(error instanceof Error ? error.message : String(error));
			}
		},
	};
}

async function answer(summary: CrawlSummary, prompt: string, ai: AiPort | undefined): Promise<string> {
	if (!ai) return "Prompt skipped: no model is configured, so the crawl returned the pages instead.";
	try {
		const text = await answerOverPages(ai, summary.pages, prompt);
		return `Answer over ${summary.pages.length} crawled page(s):\n${clip(text, MAX_ANSWER_CHARS)}`;
	} catch (error) {
		return `Prompt failed: ${error instanceof Error ? error.message : String(error)}`;
	}
}

async function deliver(url: string, summary: CrawlSummary, client: HttpClient): Promise<string> {
	const payload = {
		type: "crawl.completed",
		startUrl: summary.startUrl,
		status: summary.status,
		durationMs: summary.durationMs,
		options: redactCrawlOptions(summary.options),
		scope: summary.scope,
		counts: {
			crawled: summary.pages.length,
			denied: summary.denied.length,
			failed: summary.failed.length,
		},
		pages: summary.pages.map((page) => ({
			url: page.url,
			title: page.title,
			depth: page.depth,
			chars: page.chars,
			engine: page.engine,
			status: page.status,
		})),
		failed: summary.failed,
	};
	try {
		const response = await client({
			url,
			method: "POST",
			headers: { "content-type": "application/json" },
			body: payload,
			timeoutMs: 20_000,
		});
		return `Webhook: POST ${url} → HTTP ${response.status}`;
	} catch (error) {
		return `Webhook failed: ${error instanceof Error ? error.message : String(error)}`;
	}
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

/**
 * Crawl options shared by the console and the `firecrawl_crawl` tool.
 *
 * The console form only offers the upstream discovery controls, so the same
 * object can be clamped and serialised into a `POST /v2/crawl` body without a
 * translation layer.
 */

import { DEFAULT_CRAWL_FORMATS, clampCrawlFormats, toUpstreamFormats, type CrawlFormatOption } from "./formats";

export interface CrawlJobOptions {
	limit: number;
	maxDiscoveryDepth: number;
	maxConcurrency: number;
	delay: number;
	sitemap: "include" | "skip";
	ignoreQueryParameters: boolean;
	allowExternalLinks: boolean;
	allowSubdomains: boolean;
	crawlEntireDomain: boolean;
	ignoreRobotsTxt: boolean;
	onlyMainContent: boolean;
	/** Per-page outputs. `markdown` stays in the list because the console renders it. */
	formats: CrawlFormatOption[];
}

export const CRAWL_LIMITS = {
	limit: { min: 1, max: 500, fallback: 25 },
	maxDiscoveryDepth: { min: 0, max: 5, fallback: 2 },
	maxConcurrency: { min: 1, max: 10, fallback: 3 },
	delay: { min: 0, max: 5_000, fallback: 0 },
} as const;

export const DEFAULT_CRAWL_JOB_OPTIONS: CrawlJobOptions = {
	limit: CRAWL_LIMITS.limit.fallback,
	maxDiscoveryDepth: CRAWL_LIMITS.maxDiscoveryDepth.fallback,
	maxConcurrency: CRAWL_LIMITS.maxConcurrency.fallback,
	delay: CRAWL_LIMITS.delay.fallback,
	sitemap: "include",
	ignoreQueryParameters: true,
	allowExternalLinks: false,
	allowSubdomains: false,
	crawlEntireDomain: false,
	ignoreRobotsTxt: false,
	onlyMainContent: true,
	formats: [...DEFAULT_CRAWL_FORMATS],
};

function clampNumber(value: unknown, bounds: { min: number; max: number; fallback: number }): number {
	if (typeof value !== "number" || !Number.isFinite(value)) return bounds.fallback;
	return Math.min(bounds.max, Math.max(bounds.min, Math.round(value)));
}

export function clampCrawlJobOptions(options: Partial<CrawlJobOptions>): CrawlJobOptions {
	return {
		limit: clampNumber(options.limit, CRAWL_LIMITS.limit),
		maxDiscoveryDepth: clampNumber(options.maxDiscoveryDepth, CRAWL_LIMITS.maxDiscoveryDepth),
		maxConcurrency: clampNumber(options.maxConcurrency, CRAWL_LIMITS.maxConcurrency),
		delay: clampNumber(options.delay, CRAWL_LIMITS.delay),
		sitemap: options.sitemap === "skip" ? "skip" : "include",
		ignoreQueryParameters: options.ignoreQueryParameters ?? DEFAULT_CRAWL_JOB_OPTIONS.ignoreQueryParameters,
		allowExternalLinks: options.allowExternalLinks ?? DEFAULT_CRAWL_JOB_OPTIONS.allowExternalLinks,
		allowSubdomains: options.allowSubdomains ?? DEFAULT_CRAWL_JOB_OPTIONS.allowSubdomains,
		crawlEntireDomain: options.crawlEntireDomain ?? DEFAULT_CRAWL_JOB_OPTIONS.crawlEntireDomain,
		ignoreRobotsTxt: options.ignoreRobotsTxt ?? DEFAULT_CRAWL_JOB_OPTIONS.ignoreRobotsTxt,
		onlyMainContent: options.onlyMainContent ?? DEFAULT_CRAWL_JOB_OPTIONS.onlyMainContent,
		formats: clampCrawlFormats(options.formats),
	};
}

export interface CrawlBodyExtras {
	includePaths?: string[];
	excludePaths?: string[];
	prompt?: string;
	webhookUrl?: string;
	/** Upstream scrape options applied to every crawled page. */
	scrapeOptions?: Record<string, unknown>;
}

export function crawlJobBody(url: string, options: CrawlJobOptions, extras: CrawlBodyExtras = {}): Record<string, unknown> {
	const body: Record<string, unknown> = {
		url,
		limit: options.limit,
		maxDiscoveryDepth: options.maxDiscoveryDepth,
		maxConcurrency: options.maxConcurrency,
		sitemap: options.sitemap,
		ignoreQueryParameters: options.ignoreQueryParameters,
		allowExternalLinks: options.allowExternalLinks,
		allowSubdomains: options.allowSubdomains,
		crawlEntireDomain: options.crawlEntireDomain,
		ignoreRobotsTxt: options.ignoreRobotsTxt,
	};
	if (options.delay > 0) body.delay = options.delay;
	if (extras.includePaths && extras.includePaths.length > 0) body.includePaths = extras.includePaths;
	if (extras.excludePaths && extras.excludePaths.length > 0) body.excludePaths = extras.excludePaths;
	if (extras.prompt) body.prompt = extras.prompt;
	if (extras.webhookUrl) body.webhook = { url: extras.webhookUrl, events: ["completed", "page"] };
	const scrapeOptions = extras.scrapeOptions ?? {};
	const perPage: Record<string, unknown> = {
		formats: toUpstreamFormats(options.formats),
		onlyMainContent: options.onlyMainContent,
		...scrapeOptions,
	};
	body.scrapeOptions = perPage;
	return body;
}

/** Depth of a crawled URL relative to the crawl root, by path segment. */
export function pathDepth(url: string, root?: string): number {
	const segments = (value: string | undefined): string[] => {
		if (!value) return [];
		try {
			return new URL(value).pathname.split("/").filter(Boolean);
		} catch {
			return [];
		}
	};
	const page = segments(url);
	if (!root) return Math.max(0, page.length - 1);
	const base = segments(root);
	let shared = 0;
	while (shared < base.length && shared < page.length && base[shared] === page[shared]) shared += 1;
	return Math.max(0, page.length - shared);
}

/** Short human label for a node in the spider view. */
export function urlLabel(url: string): string {
	try {
		const parsed = new URL(url);
		const path = parsed.pathname.replace(/\/+$/, "");
		return path.length > 0 && path !== "/" ? `${parsed.host}${path}` : parsed.host;
	} catch {
		return url;
	}
}

/**
 * map — discover a site's URLs without fetching every page.
 *
 * Seeds come from robots.txt sitemaps plus the links on the start page; both go
 * through the same admission filter the crawler uses, so `map` never reports a
 * URL that `crawl` would refuse. A client-rendered site contributes the links
 * the browser can see when `render` is not `static`.
 */

import type { HttpClient } from "../scrape/http";
import type { BrowserPortFactory, RenderMode } from "../render/types";
import type { CrawlEvent } from "../events";
import type { DenialCode } from "../denial";
import { scrapePage } from "../scrape/pipeline";
import { loadRobots } from "./robots";
import { collectSitemapUrls } from "./sitemap";
import { admitLink } from "./admission";
import { getCrawlScope } from "./scope";
import { dedupeKey, normalizeUrl, originOf } from "../url";

export interface MapOptions {
	limit: number;
	/** Keep only URLs containing this string (upstream ranks, we filter). */
	search?: string;
	includeSubdomains: boolean;
	allowExternalLinks: boolean;
	includePaths: string[];
	excludePaths: string[];
	/** Only report URLs whose path matches includePaths. */
	filterByPath: boolean;
	ignoreQueryParameters: boolean;
	ignoreRobotsTxt: boolean;
	ignoreSitemap: boolean;
	/** Skip the start page and report sitemap URLs only. */
	sitemapOnly: boolean;
	timeoutMs: number;
	render: RenderMode;
}

export const DEFAULT_MAP_OPTIONS: MapOptions = {
	limit: 200,
	includeSubdomains: false,
	allowExternalLinks: false,
	includePaths: [],
	excludePaths: [],
	filterByPath: false,
	ignoreQueryParameters: false,
	ignoreRobotsTxt: false,
	ignoreSitemap: false,
	sitemapOnly: false,
	timeoutMs: 30_000,
	render: "auto",
};

export interface MapResult {
	startUrl: string;
	urls: string[];
	denied: Array<{ url: string; code: DenialCode; message: string }>;
	sitemap: { fetched: number; urls: number } | null;
	robots: { present: boolean; status: number; rules: number; sitemaps: number; failedOpen: boolean } | null;
	durationMs: number;
	truncated: boolean;
}

export interface MapDeps {
	browser?: BrowserPortFactory;
}

export async function mapSite(
	client: HttpClient,
	startUrl: string,
	options: MapOptions,
	onEvent?: (event: CrawlEvent) => void,
	signal?: AbortSignal,
	deps: MapDeps = {},
): Promise<MapResult> {
	const startedAt = Date.now();
	const start = normalizeUrl(startUrl);
	if (!start) throw new Error(`Not a mappable URL: ${startUrl}`);
	const origin = originOf(start.href);
	const scope = getCrawlScope(start.href);
	const keyOf = (url: string): string => dedupeKey(url, { ignoreQueryParameters: options.ignoreQueryParameters });
	const visited = new Set<string>([keyOf(start.href)]);
	const urls: string[] = [];
	const denied: MapResult["denied"] = [];
	const denialSeen = new Map<DenialCode, number>();

	const robots = options.ignoreRobotsTxt
		? null
		: await loadRobots(client, origin, undefined, Math.min(options.timeoutMs, 15_000));
	if (robots) {
		onEvent?.({
			type: "robots",
			origin,
			present: robots.present,
			status: robots.status,
			rules: robots.ruleCount,
			crawlDelayMs: robots.crawlDelayMs,
			sitemaps: robots.sitemaps.length,
			failedOpen: robots.failedOpen,
			at: Date.now(),
		});
	}

	const candidates: string[] = [start.href];
	let sitemapInfo: MapResult["sitemap"] = null;
	if (!options.ignoreSitemap && robots && robots.sitemaps.length > 0) {
		const sitemap = await collectSitemapUrls(client, robots.sitemaps, { timeoutMs: options.timeoutMs });
		sitemapInfo = { fetched: sitemap.fetched, urls: sitemap.urls.length };
		onEvent?.({
			type: "sitemap",
			seed: robots.sitemaps[0] ?? "",
			fetched: sitemap.fetched,
			urls: sitemap.urls.length,
			truncated: sitemap.truncated,
			at: Date.now(),
		});
		candidates.push(...sitemap.urls);
	}

	// The start page's own links are what `map` reports when a site has no sitemap.
	if (!options.sitemapOnly) {
		try {
			const page = await scrapePage(
				client,
				start.href,
				{ onlyMainContent: true, timeoutMs: options.timeoutMs, render: options.render, includeLinks: true },
				{ browser: deps.browser },
			);
			candidates.push(...page.links.map((link) => link.url));
		} catch {
			// A start page that cannot be fetched is still mappable from its sitemap.
		}
	}

	const ranked = options.search ? rankBySearch(candidates, options.search) : candidates;

	for (const candidate of ranked) {
		if (signal?.aborted) break;
		if (urls.length >= options.limit) break;
		const verdict = admitLink(candidate, {
			startUrl: start.href,
			scope,
			depth: 0,
			maxDepth: Number.MAX_SAFE_INTEGER,
			includePaths: options.filterByPath ? options.includePaths : [],
			excludePaths: options.excludePaths,
			allowExternalLinks: options.allowExternalLinks,
			allowSubdomains: options.includeSubdomains,
			allowBackwardCrawling: true,
			regexOnFullURL: false,
			dedupeKey: keyOf,
			robots: robots ?? { isAllowed: () => true },
			ignoreRobotsTxt: options.ignoreRobotsTxt,
			visited,
		});
		if ("code" in verdict) {
			if (verdict.code === "DUPLICATE") continue;
			denied.push({ url: candidate, code: verdict.code, message: verdict.message });
			const seen = denialSeen.get(verdict.code) ?? 0;
			denialSeen.set(verdict.code, seen + 1);
			if (seen < 20) {
				onEvent?.({
					type: "denied",
					url: candidate,
					depth: 0,
					parent: null,
					code: verdict.code,
					message: verdict.message,
					at: Date.now(),
				});
			}
			continue;
		}
		visited.add(keyOf(verdict.url));
		urls.push(verdict.url);
		onEvent?.({ type: "queued", url: verdict.url, depth: 0, parent: null, via: "sitemap", at: Date.now() });
	}

	return {
		startUrl: start.href,
		urls,
		denied,
		sitemap: sitemapInfo,
		robots: robots
			? {
					present: robots.present,
					status: robots.status,
					rules: robots.ruleCount,
					sitemaps: robots.sitemaps.length,
					failedOpen: robots.failedOpen,
				}
			: null,
		durationMs: Date.now() - startedAt,
		truncated: urls.length >= options.limit,
	};
}

/** Stable ordering: exact/token hits first, then substring hits, then the rest. */
function rankBySearch(candidates: readonly string[], search: string): string[] {
	const needle = search.trim().toLowerCase();
	if (!needle) return [...candidates];
	const tokens = needle.split(/\s+/).filter(Boolean);
	const score = (url: string): number => {
		const haystack = url.toLowerCase();
		let value = 0;
		if (haystack.includes(needle)) value += 10;
		for (const token of tokens) if (haystack.includes(token)) value += 1;
		return value;
	};
	return candidates
		.map((url, index) => ({ url, index, score: score(url) }))
		.sort((left, right) => right.score - left.score || left.index - right.index)
		.map((entry) => entry.url);
}

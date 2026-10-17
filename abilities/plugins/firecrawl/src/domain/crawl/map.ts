/**
 * map — discover a site's URLs without fetching every page.
 *
 * Seeds come from robots.txt sitemaps plus the links on the start page; both go
 * through the same admission filter the crawler uses, so `map` never reports a
 * URL that `crawl` would refuse.
 */

import type { HttpClient } from "../scrape/http";
import type { CrawlEvent } from "../events";
import type { DenialCode } from "../denial";
import { scrapePage } from "../scrape/pipeline";
import { loadRobots } from "./robots";
import { collectSitemapUrls } from "./sitemap";
import { admitLink } from "./admission";
import { getCrawlScope } from "./scope";
import { normalizeUrl, originOf } from "../url";

export interface MapOptions {
	limit: number;
	includePaths: string[];
	excludePaths: string[];
	allowExternalLinks: boolean;
	allowSubdomains: boolean;
	allowBackwardCrawling: boolean;
	ignoreRobotsTxt: boolean;
	useSitemap: boolean;
	timeoutMs: number;
}

export interface MapResult {
	startUrl: string;
	urls: string[];
	denied: Array<{ url: string; code: DenialCode; message: string }>;
	sitemap: { fetched: number; urls: number } | null;
	robots: { present: boolean; status: number; rules: number; sitemaps: number; failedOpen: boolean } | null;
	durationMs: number;
	truncated: boolean;
}

export async function mapSite(
	client: HttpClient,
	startUrl: string,
	options: MapOptions,
	onEvent?: (event: CrawlEvent) => void,
	signal?: AbortSignal,
): Promise<MapResult> {
	const startedAt = Date.now();
	const start = normalizeUrl(startUrl);
	if (!start) throw new Error(`Not a mappable URL: ${startUrl}`);
	const origin = originOf(start.href);
	const scope = getCrawlScope(start.href);
	const visited = new Set<string>();
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
	if (options.useSitemap && robots && robots.sitemaps.length > 0) {
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
	try {
		const page = await scrapePage(client, start.href, { onlyMainContent: true, timeoutMs: options.timeoutMs });
		candidates.push(...page.links.map((link) => link.url));
	} catch {
		// A start page that cannot be fetched is still mappable from its sitemap.
	}

	for (const candidate of candidates) {
		if (signal?.aborted) break;
		if (urls.length >= options.limit) break;
		const verdict = admitLink(candidate, {
			startUrl: start.href,
			scope,
			depth: 0,
			maxDepth: 99,
			includePaths: options.includePaths,
			excludePaths: options.excludePaths,
			allowExternalLinks: options.allowExternalLinks,
			allowSubdomains: options.allowSubdomains,
			allowBackwardCrawling: options.allowBackwardCrawling,
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
		visited.add(verdict.url);
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

/**
 * Breadth-first crawler.
 *
 * Deliberately a port rather than a wrapper: firecrawl's server owns Queues,
 * Redis and Fire Engine; the plugin owns the same decision surface (admission
 * rules, robots, sitemap seeding, depth, limit, per-page denial accounting) and
 * runs it in-process so the console can animate a crawl the user can watch.
 */

import { DEFAULT_USER_AGENT, ScrapeError, scrapePage } from "../scrape/pipeline";
import type { HttpClient } from "../scrape/http";
import type { CrawlEvent, CrawlOptions, CrawlPage, CrawlSummary } from "../events";
import type { DenialCode } from "../denial";
import { describeCrawlScope, getCrawlScope } from "./scope";
import { admitLink } from "./admission";
import { loadRobots, type RobotsPolicy } from "./robots";
import { collectSitemapUrls } from "./sitemap";
import { normalizeUrl, originOf } from "../url";

export interface CrawlHooks {
	onEvent?: (event: CrawlEvent) => void;
	onPage?: (page: CrawlPage) => void;
	signal?: AbortSignal;
	/** Denial events emitted per code, to keep a 500-link page from flooding the console. */
	denialEventCap?: number;
}

interface FrontierItem {
	url: string;
	depth: number;
	parent: string | null;
	via: "seed" | "link" | "sitemap";
}

const MAX_FRONTIER_FACTOR = 6;

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
	if (ms <= 0) return Promise.resolve();
	return new Promise((resolve) => {
		const timer = setTimeout(resolve, ms);
		signal?.addEventListener(
			"abort",
			() => {
				clearTimeout(timer);
				resolve();
			},
			{ once: true },
		);
	});
}

export async function crawlSite(
	client: HttpClient,
	startUrl: string,
	options: CrawlOptions,
	hooks: CrawlHooks = {},
): Promise<CrawlSummary> {
	const startedAt = Date.now();
	const emit = (event: CrawlEvent): void => hooks.onEvent?.(event);
	const now = (): number => Date.now();
	const denyCounts = new Map<DenialCode, number>();
	const denialCap = hooks.denialEventCap ?? 40;

	const start = normalizeUrl(startUrl);
	if (!start) {
		throw new Error(`Not a crawlable URL: ${startUrl}`);
	}
	const origin = originOf(start.href);
	const scope = getCrawlScope(start.href);
	const visited = new Set<string>([start.href]);
	const queue: FrontierItem[] = [];
	const pages: CrawlPage[] = [];
	const denied: CrawlSummary["denied"] = [];
	const failed: CrawlSummary["failed"] = [];
	const frontierCeiling = Math.max(options.limit * MAX_FRONTIER_FACTOR, options.limit + 10);

	let robots: RobotsPolicy = { present: false, status: 0, sitemaps: [], crawlDelayMs: null, ruleCount: 0, failedOpen: false, isAllowed: () => true };

	emit({ type: "run-start", target: start.href, options, at: now() });

	const recordDenial = (url: string, depth: number, parent: string | null, code: DenialCode, message: string): void => {
		denied.push({ url, code, message, depth });
		const seen = (denyCounts.get(code) ?? 0) + 1;
		denyCounts.set(code, seen);
		if (seen <= denialCap) emit({ type: "denied", url, depth, parent, code, message, at: now() });
	};

	const push = (item: FrontierItem): void => {
		if (queue.length >= frontierCeiling) {
			recordDenial(item.url, item.depth, item.parent, "LIMIT_REACHED", "frontier full — raise limit to keep discovering");
			return;
		}
		visited.add(item.url);
		queue.push(item);
		emit({ type: "queued", url: item.url, depth: item.depth, parent: item.parent, via: item.via, at: now() });
	};

	// 1. robots.txt — always fetched for the origin unless the caller opted out.
	if (!options.ignoreRobotsTxt) {
		robots = await loadRobots(client, origin, DEFAULT_USER_AGENT, Math.min(options.timeoutMs, 15_000));
		emit({
			type: "robots",
			origin,
			present: robots.present,
			status: robots.status,
			rules: robots.ruleCount,
			crawlDelayMs: robots.crawlDelayMs,
			sitemaps: robots.sitemaps.length,
			failedOpen: robots.failedOpen,
			at: now(),
		});
	}

	// 2. Sitemap seeding — the frontier gets the site's own map before hop 1.
	if (options.useSitemap && options.maxDepth >= 1 && robots.sitemaps.length > 0) {
		const sitemap = await collectSitemapUrls(client, robots.sitemaps, { timeoutMs: options.timeoutMs });
		emit({
			type: "sitemap",
			seed: robots.sitemaps[0] ?? "",
			fetched: sitemap.fetched,
			urls: sitemap.urls.length,
			truncated: sitemap.truncated,
			at: now(),
		});
		for (const url of sitemap.urls) {
			if (queue.length >= frontierCeiling) break;
			const verdict = admitLink(url, {
				startUrl: start.href,
				scope,
				depth: 1,
				maxDepth: Math.max(options.maxDepth, 1),
				includePaths: options.includePaths,
				excludePaths: options.excludePaths,
				allowExternalLinks: options.allowExternalLinks,
				allowSubdomains: options.allowSubdomains,
				allowBackwardCrawling: options.allowBackwardCrawling,
				robots,
				ignoreRobotsTxt: options.ignoreRobotsTxt,
				visited,
			});
			if ("code" in verdict) {
				// A sitemap repeats the same URLs across child maps; duplicates are not a decision worth counting.
				if (verdict.code !== "DUPLICATE") denyCounts.set(verdict.code, (denyCounts.get(verdict.code) ?? 0) + 1);
				continue;
			}
			push({ url: verdict.url, depth: 1, parent: null, via: "sitemap" });
		}
	}

	// The start URL is the seed of hop 0: sitemap URLs are a shortcut for discovery,
	// but the page the user asked for must be crawled first.
	queue.unshift({ url: start.href, depth: 0, parent: null, via: "seed" });

	const crawlOne = async (item: FrontierItem): Promise<void> => {
		emit({ type: "fetching", url: item.url, depth: item.depth, parent: item.parent, at: now() });
		try {
			const result = await scrapePage(client, item.url, {
				onlyMainContent: options.onlyMainContent,
				timeoutMs: options.timeoutMs,
				userAgent: DEFAULT_USER_AGENT,
			});
			if (result.fallbackReason) {
				emit({
					type: "engine-fallback",
					url: item.url,
					from: result.attemptedEngines[0] ?? "fetch",
					to: result.engine,
					reason: result.fallbackReason,
					at: now(),
				});
			}
			const page: CrawlPage = {
				url: item.url,
				finalUrl: result.finalUrl,
				depth: item.depth,
				parent: item.parent,
				title: result.title,
				markdown: result.markdown,
				linkCount: result.links.length,
				status: result.status,
				engine: result.engine,
				bytes: result.bytes,
				chars: result.charCount,
				durationMs: result.durationMs,
				warnings: result.warnings.length,
			};
			pages.push(page);
			hooks.onPage?.(page);
			emit({
				type: "crawled",
				url: item.url,
				depth: item.depth,
				parent: item.parent,
				status: result.status,
				engine: result.engine,
				bytes: result.bytes,
				chars: result.charCount,
				links: result.links.length,
				durationMs: result.durationMs,
				title: result.title,
				at: now(),
			});

			// No early return at maxDepth: the links of the deepest page still have to be
			// reported as DEPTH_LIMIT so the console can say what stopped the crawl.
			for (const link of result.links) {
				if (visited.size >= frontierCeiling && queue.length >= frontierCeiling) break;
				if (link.anchored) {
					if ((denyCounts.get("SECTION_LINK") ?? 0) < denialCap) {
						recordDenial(link.url, item.depth + 1, item.url, "SECTION_LINK", "section anchor of a page already crawled");
					} else {
						denyCounts.set("SECTION_LINK", (denyCounts.get("SECTION_LINK") ?? 0) + 1);
					}
					continue;
				}
				const verdict = admitLink(link.url, {
					startUrl: start.href,
					scope,
					depth: item.depth + 1,
					maxDepth: options.maxDepth,
					includePaths: options.includePaths,
					excludePaths: options.excludePaths,
					allowExternalLinks: options.allowExternalLinks,
					allowSubdomains: options.allowSubdomains,
					allowBackwardCrawling: options.allowBackwardCrawling,
					robots,
					ignoreRobotsTxt: options.ignoreRobotsTxt,
					visited,
				});
				if ("code" in verdict) {
					if (verdict.code === "DUPLICATE") continue;
					recordDenial(link.url, item.depth + 1, item.url, verdict.code, verdict.message);
					continue;
				}
				push({ url: verdict.url, depth: item.depth + 1, parent: item.url, via: "link" });
			}
		} catch (error) {
			const code = error instanceof ScrapeError ? error.code : "unknown";
			const status = error instanceof ScrapeError ? error.status : 0;
			const message = error instanceof Error ? error.message : String(error);
			failed.push({ url: item.url, message, code });
			emit({ type: "failed", url: item.url, depth: item.depth, parent: item.parent, message, code, status, at: now() });
		}
	};

	let aborted = false;
	while (queue.length > 0 && pages.length < options.limit) {
		if (hooks.signal?.aborted) {
			aborted = true;
			break;
		}
		const batch = queue.splice(0, Math.max(1, Math.min(options.concurrency, options.limit - pages.length)));
		await Promise.all(batch.map((item) => crawlOne(item)));
		if (robots.crawlDelayMs && queue.length > 0) await sleep(robots.crawlDelayMs, hooks.signal);
	}
	if (hooks.signal?.aborted) aborted = true;

	const status: CrawlSummary["status"] = aborted ? "stopped" : pages.length === 0 && failed.length > 0 ? "failed" : "completed";
	const durationMs = Date.now() - startedAt;
	emit({
		type: "run-end",
		status,
		crawled: pages.length,
		failed: failed.length,
		denied: denied.length,
		discovered: visited.size,
		durationMs,
		at: now(),
	});

	return { startUrl: start.href, pages, denied, failed, status, durationMs, options };
}


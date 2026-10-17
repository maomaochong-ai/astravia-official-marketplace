/**
 * Link admission — the JS filter path of firecrawl's `WebCrawler.filterLinks`.
 *
 * Order matters and is preserved: protocol → site → crawl scope → depth →
 * exclude → include → robots → file type → social → duplicate. The first rule
 * that rejects wins, so the console always reports the most actionable reason.
 */

import { denial } from "../denial";
import type { DenialVerdict } from "../denial";
import {
	fileExtension,
	hostOf,
	isFileUrl,
	isSameSite,
	isSocialMediaHost,
	isSubdomainOf,
	normalizeUrl,
	pathForPatterns,
} from "../url";
import { describeCrawlScope, isWithinCrawlScope } from "./scope";
import type { CrawlScope } from "./scope";

export interface AdmissionContext {
	startUrl: string;
	scope: CrawlScope;
	depth: number;
	maxDepth: number;
	includePaths: readonly string[];
	excludePaths: readonly string[];
	allowExternalLinks: boolean;
	allowSubdomains: boolean;
	allowBackwardCrawling: boolean;
	robots: { isAllowed(url: string): boolean };
	ignoreRobotsTxt: boolean;
	/** Already queued or crawled (normalized hrefs). */
	visited: ReadonlySet<string>;
}

function matchesAnyPattern(path: string, patterns: readonly string[]): string | null {
	for (const pattern of patterns) {
		try {
			if (new RegExp(pattern).test(path)) return pattern;
		} catch {
			// An invalid regex is the caller's problem; the tool validates first.
		}
	}
	return null;
}

export function admitLink(rawUrl: string, context: AdmissionContext): { url: string } | DenialVerdict {
	const normalized = normalizeUrl(rawUrl, context.startUrl);
	if (!normalized) {
		return denial("URL_PARSE_ERROR", { url: rawUrl });
	}
	const url = normalized.href;
	const path = pathForPatterns(url);

	const startHost = hostOf(context.startUrl);
	const host = hostOf(url);
	const sameSite = isSameSite(host, startHost);
	const sameDomain = sameSite || (context.allowSubdomains && isSubdomainOf(host, startHost));
	if (!sameDomain && !context.allowExternalLinks) {
		return denial("EXTERNAL_LINK", { url });
	}
	if (!context.allowBackwardCrawling && !isWithinCrawlScope(path, context.scope)) {
		return denial("BACKWARD_CRAWLING", { url, scope: describeCrawlScope(context.scope) });
	}
	if (context.depth > context.maxDepth) {
		return denial("DEPTH_LIMIT", { url, depth: context.depth, maxDepth: context.maxDepth });
	}
	const excluded = matchesAnyPattern(path, context.excludePaths);
	if (excluded) {
		return denial("EXCLUDE_PATTERN", { url, pattern: excluded });
	}
	if (context.includePaths.length > 0 && !matchesAnyPattern(path, context.includePaths)) {
		return denial("INCLUDE_PATTERN", { url, patterns: context.includePaths });
	}
	if (isSocialMediaHost(host)) {
		return denial("SOCIAL_MEDIA", { url });
	}
	if (isFileUrl(url)) {
		return denial("FILE_TYPE", { url, extension: fileExtension(url) ?? "" });
	}
	if (!context.ignoreRobotsTxt && !context.robots.isAllowed(url)) {
		return denial("ROBOTS_TXT", { url });
	}
	if (context.visited.has(url)) {
		return denial("DUPLICATE", { url });
	}
	return { url };
}

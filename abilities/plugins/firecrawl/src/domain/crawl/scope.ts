/**
 * Crawl scope — port of firecrawl's `lib/crawl-scope.ts`.
 *
 * With `allowBackwardCrawling: false` a crawl may only walk *down* from the
 * starting path. A start URL that looks like a document (`/guide/intro`) also
 * keeps its sibling directory crawlable, hence the `exact` slot.
 */

export interface CrawlScope {
	/** Directory every crawled path must sit under. Always ends with "/". */
	prefix: string;
	/** Single path allowed alongside the prefix, or null. */
	exact: string | null;
}

const DOCUMENT_SEGMENT = /\.[A-Za-z0-9]{2,}$/;

export function getCrawlScope(initialUrl: string): CrawlScope {
	let pathname: string;
	try {
		pathname = new URL(initialUrl).pathname;
	} catch {
		return { prefix: "/", exact: null };
	}
	if (!pathname.startsWith("/")) pathname = `/${pathname}`;
	if (pathname.endsWith("/")) return { prefix: pathname, exact: null };
	const lastSlash = pathname.lastIndexOf("/");
	if (DOCUMENT_SEGMENT.test(pathname.slice(lastSlash + 1))) {
		return { prefix: pathname.slice(0, lastSlash + 1), exact: null };
	}
	return { prefix: `${pathname}/`, exact: pathname };
}

export function isWithinCrawlScope(pathname: string, scope: CrawlScope): boolean {
	return pathname === scope.exact || pathname.startsWith(scope.prefix);
}

export function describeCrawlScope(scope: CrawlScope): string {
	return scope.exact ? `${scope.exact} or ${scope.prefix}*` : `${scope.prefix}*`;
}

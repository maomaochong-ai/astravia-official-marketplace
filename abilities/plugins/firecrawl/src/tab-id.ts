import type { CrawlOptions } from "./domain/events";

/** Activity tab id — one string, shared by the registration and the tool opener. */
export const FIRECRAWL_TAB_ID = "crawl.console";

const MAX_LIMIT = 50;
const MAX_DEPTH = 5;
const MAX_CONCURRENCY = 8;

/**
 * Keeps programmatic runs inside the same envelope the tool schema advertises.
 * The console UI and the tool handler both go through here so a value typed in
 * the panel cannot exceed what the model is allowed to ask for.
 */
export function clampCrawlOptions(options: CrawlOptions): CrawlOptions {
	return {
		...options,
		limit: clamp(options.limit, 1, MAX_LIMIT, 12),
		maxDepth: clamp(options.maxDepth, 0, MAX_DEPTH, 2),
		concurrency: clamp(options.concurrency, 1, MAX_CONCURRENCY, 4),
		timeoutMs: clamp(options.timeoutMs, 1_000, 120_000, 30_000),
	};
}

function clamp(value: number, min: number, max: number, fallback: number): number {
	if (!Number.isFinite(value)) return fallback;
	return Math.min(max, Math.max(min, Math.round(value)));
}

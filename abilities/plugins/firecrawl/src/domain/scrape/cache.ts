/**
 * Reuse of a previously scraped page.
 *
 * firecrawl keeps a crawl cache keyed by URL + options and serves a stored copy
 * while it is younger than `maxAge`. A plugin cannot share firecrawl's cache, so
 * the same contract is rebuilt on the host's plugin-private storage: the runtime
 * adapter persists entries, this module owns the key and the freshness rules.
 *
 * `changeTracking` rides on the same entry: the copy that is about to be
 * replaced is the baseline for the diff, which is why the read happens before
 * the fetch.
 */

import type { ExtractedLink, PageMetadata } from "../html/document";
import type { ElementProfile, MediaRef } from "../html/elements";
import type { RenderEngineName } from "../render/types";

/** Everything a `ScrapeResult` can be rebuilt from, minus live-only data (screenshots). */
export interface CachedPage {
	url: string;
	finalUrl: string;
	status: number;
	engine: RenderEngineName;
	title: string;
	metadata: PageMetadata;
	markdown: string;
	text: string;
	html: string;
	rawHtml: string;
	links: ExtractedLink[];
	media: MediaRef[];
	bytes: number;
	elements?: ElementProfile;
	storedAt: number;
}

export interface PageCache {
	read(key: string): Promise<CachedPage | null>;
	write(key: string, page: CachedPage): Promise<void>;
}

export interface CacheIdentity {
	url: string;
	render?: string;
	onlyMainContent?: boolean;
	formats?: readonly string[];
	includeTags?: readonly string[];
	excludeTags?: readonly string[];
	profileId?: string;
}

/**
 * Two calls share a cache entry only when everything that changes the result
 * matches. Screenshots are excluded: they are never stored.
 */
export function cacheKey(identity: CacheIdentity): string {
	const fingerprint = [
		identity.url,
		identity.render ?? "auto",
		identity.onlyMainContent === false ? "full" : "main",
		(identity.formats ?? [])
			.filter((format) => !format.startsWith("screenshot") && format !== "changeTracking")
			.slice()
			.sort()
			.join(","),
		(identity.includeTags ?? []).slice().sort().join(","),
		(identity.excludeTags ?? []).slice().sort().join(","),
		identity.profileId ?? "",
	].join("\u0000");
	return `p${fnv1a(fingerprint, 0x811c9dc5)}${fnv1a(fingerprint, 0x01000193)}`;
}

/** Age of a stored entry in seconds. */
export function cacheAgeSeconds(page: CachedPage, now = Date.now()): number {
	return Math.max(0, Math.round((now - page.storedAt) / 1000));
}

/** `maxAge` is milliseconds, like firecrawl's; 0 means "never reuse". */
export function isFresh(page: CachedPage, maxAgeMs: number, now = Date.now()): boolean {
	if (!Number.isFinite(maxAgeMs) || maxAgeMs <= 0) return false;
	return now - page.storedAt <= maxAgeMs;
}

function fnv1a(text: string, seed: number): string {
	let hash = seed >>> 0;
	for (let index = 0; index < text.length; index += 1) {
		hash ^= text.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193) >>> 0;
	}
	return hash.toString(16).padStart(8, "0");
}

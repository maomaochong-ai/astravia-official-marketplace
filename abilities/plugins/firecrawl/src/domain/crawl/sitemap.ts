/**
 * Sitemap seeding.
 *
 * Same shape as firecrawl's `scraper/WebScraper/sitemap.ts` reduced to what a
 * client-side crawler needs: fetch the index, follow child sitemaps breadth
 * first with a fixed concurrency, cap the number of documents, then hand the
 * URLs to the frontier's filter.
 */

import type { HttpClient } from "../scrape/http";

export const SITEMAP_LIMIT = 25;
export const SITEMAP_FETCH_CONCURRENCY = 3;
export const SITEMAP_URL_LIMIT = 2_000;

export interface SitemapResult {
	/** Documents discovered across every sitemap. */
	urls: string[];
	/** Sitemap documents actually fetched. */
	fetched: number;
	/** Sitemap documents skipped by `SITEMAP_LIMIT`. */
	skipped: number;
	truncated: boolean;
}

const LOC = /<loc>\s*([\s\S]*?)\s*<\/loc>/gi;

function decodeXml(value: string): string {
	return value
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
		.replace(/&amp;/g, "&");
}

export function parseSitemap(xml: string): { urls: string[]; children: string[] } {
	const locs: string[] = [];
	for (const match of xml.matchAll(LOC)) {
		const value = decodeXml(match[1] ?? "").trim();
		if (value) locs.push(value);
	}
	if (/<sitemapindex[\s>]/i.test(xml)) return { urls: [], children: locs };
	return { urls: locs, children: [] };
}

export async function collectSitemapUrls(
	client: HttpClient,
	seeds: readonly string[],
	options: { timeoutMs?: number; limit?: number; urlLimit?: number } = {},
): Promise<SitemapResult> {
	const limit = options.limit ?? SITEMAP_LIMIT;
	const urlLimit = options.urlLimit ?? SITEMAP_URL_LIMIT;
	const timeoutMs = options.timeoutMs ?? 20_000;
	const urls = new Set<string>();
	const queue = [...seeds];
	const seen = new Set<string>();
	let fetched = 0;
	let skipped = 0;

	while (queue.length > 0 && fetched < limit && urls.size < urlLimit) {
		const batch = queue.splice(0, SITEMAP_FETCH_CONCURRENCY);
		const results = await Promise.all(
			batch.map(async (url) => {
				if (seen.has(url)) return null;
				seen.add(url);
				try {
					const response = await client({ url, timeoutMs });
					if (!response.ok) return null;
					return parseSitemap(response.body);
				} catch {
					return null;
				}
			}),
		);
		for (const result of results) {
			if (!result) continue;
			fetched += 1;
			for (const url of result.urls) {
				if (urls.size >= urlLimit) break;
				urls.add(url);
			}
			for (const child of result.children) {
				if (queue.length + fetched >= limit) {
					skipped += 1;
					continue;
				}
				queue.push(child);
			}
		}
	}

	return {
		urls: [...urls],
		fetched,
		skipped,
		truncated: urls.size >= urlLimit || queue.length > 0,
	};
}

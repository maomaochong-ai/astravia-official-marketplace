/**
 * Web search, without an API key.
 *
 * firecrawl's `search` is backed by its own index; a plugin cannot ship an
 * index, so the default provider is DuckDuckGo's server-rendered HTML endpoint —
 * no key, no JavaScript, parseable with the same DOM the scraper already uses.
 * The shape of the result (`url`, `title`, `description`) is what the tools and
 * the agent see, so a different provider can be added without touching them.
 *
 * `categories` is firecrawl's way of narrowing a search; there is no category
 * index here, so each one becomes the equivalent query operator instead
 * (`filetype:pdf`, `site:github.com`, …). `sources` is handled by the tool: only
 * the `web` source can be served by an HTML endpoint.
 */

import type { HttpClient } from "../scrape/http";
import { parseHtml } from "../html/document";

export interface SearchResult {
	url: string;
	title: string;
	description: string;
	/** 1-based position in the provider's ranking. */
	position: number;
	/** Backend that produced the result. */
	provider: string;
}

export type SearchCategory = "github" | "research" | "pdf";

/** firecrawl's categories, expressed as the closest search operator. */
export const CATEGORY_OPERATORS: Record<SearchCategory, string> = {
	github: "site:github.com",
	research: "site:arxiv.org",
	pdf: "filetype:pdf",
};

export interface SearchOptions {
	limit?: number;
	/** DuckDuckGo region, e.g. `cn-zh`, `us-en`. */
	country?: string;
	lang?: string;
	/** `d` day, `w` week, `m` month, `y` year. */
	timeRange?: "d" | "w" | "m" | "y";
	/** Appended to the query as `key:value` operators. */
	categories?: readonly SearchCategory[];
	timeoutMs?: number;
}

const ENDPOINT = "https://html.duckduckgo.com/html/";
const MAX_LIMIT = 50;
const PAGE_SIZE = 20;
const MAX_PAGES = 4;

export async function searchWeb(client: HttpClient, query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
	const trimmed = query.trim();
	if (!trimmed) throw new Error("search query is required");
	const limit = Math.min(Math.max(options.limit ?? 5, 1), MAX_LIMIT);
	const effective = withCategories(trimmed, options.categories);

	const results: SearchResult[] = [];
	const seen = new Set<string>();
	// One HTML page holds ~10-20 hits; a bigger `limit` needs the `s=` offset pager.
	for (let page = 0; page < MAX_PAGES && results.length < limit; page += 1) {
		const body = new URLSearchParams({ q: effective });
		// DDG takes a region, not a bare country: `cn` + `zh` → `cn-zh`.
		const region = options.country ? (options.lang ? `${options.country}-${options.lang}` : options.country) : "";
		if (region) body.set("kl", region);
		if (options.timeRange) body.set("df", options.timeRange);
		if (page > 0) body.set("s", String(page * PAGE_SIZE));

		const response = await client({
			url: `${ENDPOINT}?${body.toString()}`,
			timeoutMs: options.timeoutMs ?? 20_000,
			headers: {
				accept: "text/html,application/xhtml+xml",
				"accept-language": options.lang ? `${options.lang},en;q=0.8` : "en-US,en;q=0.9",
				"content-type": "application/x-www-form-urlencoded",
			},
		});

		if (response.status >= 400) {
			if (page === 0) {
				throw new Error(`Search provider returned HTTP ${response.status}${response.status === 429 ? " (rate limited)" : ""}`);
			}
			// A later page failing must not discard results already collected.
			break;
		}

		const batch = parseDuckDuckGoHtml(response.body, limit);
		let added = 0;
		for (const result of batch) {
			if (results.length >= limit) break;
			if (seen.has(result.url)) continue;
			seen.add(result.url);
			results.push({ ...result, position: results.length + 1 });
			added += 1;
		}
		if (added === 0) break;
	}

	return results;
}

function withCategories(query: string, categories: readonly SearchCategory[] | undefined): string {
	if (!categories || categories.length === 0) return query;
	// Operators are ORed by DDG when repeated in one query, which is what a
	// multi-category search means: "any of these source types".
	const operators = categories.map((category) => CATEGORY_OPERATORS[category]).filter(Boolean);
	return operators.length === 0 ? query : `(${operators.map((op) => `${query} ${op}`).join(" OR ")})`;
}

/** Exported for tests: the parser is the only provider-specific logic. */
export function parseDuckDuckGoHtml(html: string, limit: number): SearchResult[] {
	const doc = parseHtml(html, "https://duckduckgo.com/");
	const results: SearchResult[] = [];
	const seen = new Set<string>();

	const anchors = Array.from(doc.querySelectorAll("a.result__a, a.result-link, h2 a"));
	for (const anchor of anchors) {
		if (results.length >= limit) break;
		const href = anchor.getAttribute("href");
		if (!href) continue;
		const url = decodeRedirect(href);
		if (!url || seen.has(url)) continue;
		const container = anchor.closest(".result, .web-result, li") ?? anchor.parentElement;
		const snippet =
			container?.querySelector(".result__snippet, .result-snippet, .snippet")?.textContent?.replace(/\s+/g, " ").trim() ??
			"";
		seen.add(url);
		results.push({
			url,
			title: (anchor.textContent ?? "").replace(/\s+/g, " ").trim() || url,
			description: snippet,
			position: results.length + 1,
			provider: "duckduckgo",
		});
	}
	return results;
}

/** DDG wraps outbound links as `/l/?uddg=<encoded>`; unwrap to the real target. */
function decodeRedirect(href: string): string | null {
	const candidates: string[] = [];
	if (href.startsWith("//")) candidates.push(`https:${href}`);
	else candidates.push(href);
	for (const candidate of candidates) {
		let parsed: URL;
		try {
			parsed = new URL(candidate, "https://duckduckgo.com/");
		} catch {
			continue;
		}
		const target = parsed.searchParams.get("uddg");
		if (target) {
			try {
				const decoded = new URL(target);
				if (decoded.protocol === "http:" || decoded.protocol === "https:") return decoded.toString();
			} catch {
				continue;
			}
		}
		if (parsed.hostname.endsWith("duckduckgo.com")) continue;
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue;
		return parsed.toString();
	}
	return null;
}

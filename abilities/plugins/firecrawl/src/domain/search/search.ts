/**
 * Web search, without an API key.
 *
 * firecrawl's `search` is backed by its own index; a plugin cannot ship an
 * index, so the default provider is DuckDuckGo's server-rendered HTML endpoint —
 * no key, no JavaScript, parseable with the same DOM the scraper already uses.
 * The shape of the result (`url`, `title`, `description`) is what the tools and
 * the agent see, so a different provider can be added without touching them.
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

export interface SearchOptions {
	limit?: number;
	/** DuckDuckGo region, e.g. `cn-zh`, `us-en`. */
	country?: string;
	lang?: string;
	/** `d` day, `w` week, `m` month, `y` year. */
	timeRange?: "d" | "w" | "m" | "y";
	timeoutMs?: number;
}

const ENDPOINT = "https://html.duckduckgo.com/html/";

export async function searchWeb(client: HttpClient, query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
	const trimmed = query.trim();
	if (!trimmed) throw new Error("search query is required");
	const limit = Math.min(Math.max(options.limit ?? 5, 1), 20);

	const body = new URLSearchParams({ q: trimmed });
	// DDG takes a region, not a bare country: `cn` + `zh` → `cn-zh`.
	const region = options.country ? (options.lang ? `${options.country}-${options.lang}` : options.country) : "";
	if (region) body.set("kl", region);
	if (options.timeRange) body.set("df", options.timeRange);

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
		throw new Error(`Search provider returned HTTP ${response.status}${response.status === 429 ? " (rate limited)" : ""}`);
	}

	return parseDuckDuckGoHtml(response.body, limit);
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

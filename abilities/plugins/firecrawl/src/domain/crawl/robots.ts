/**
 * robots.txt handling.
 *
 * Policy mirrors firecrawl's crawler:
 * - missing / broken robots.txt fails **open** (crawl continues),
 * - `Crawl-delay` is honoured once per run,
 * - sitemaps declared in robots.txt seed the crawl frontier.
 */

import robotsParser from "robots-parser";
import type { HttpClient } from "../scrape/http";

export const DEFAULT_ROBOTS_USER_AGENT = "FirecrawlAgent";

export interface RobotsPolicy {
	/** robots.txt was fetched and parsed. */
	present: boolean;
	/** Served HTTP status, 0 when the request failed. */
	status: number;
	sitemaps: string[];
	crawlDelayMs: number | null;
	/** Number of Allow/Disallow directives seen — shown in the console. */
	ruleCount: number;
	/** True when the request failed and the crawl continued unconstrained. */
	failedOpen: boolean;
	isAllowed(url: string): boolean;
}

const ALLOW_ALL: RobotsPolicy = {
	present: false,
	status: 0,
	sitemaps: [],
	crawlDelayMs: null,
	ruleCount: 0,
	failedOpen: false,
	isAllowed: () => true,
};

export function parseRobots(txt: string, origin: string, userAgent = DEFAULT_ROBOTS_USER_AGENT): RobotsPolicy {
	const robots = robotsParser(`${origin}/robots.txt`, txt);
	const delay = robots.getCrawlDelay(userAgent) ?? robots.getCrawlDelay("FirecrawlAgent") ?? robots.getCrawlDelay("FireCrawlAgent");
	const ruleCount = txt
		.split("\n")
		.map((line) => line.trim().toLowerCase())
		.filter((line) => line.startsWith("allow:") || line.startsWith("disallow:")).length;
	return {
		present: true,
		status: 200,
		sitemaps: robots.getSitemaps() ?? [],
		crawlDelayMs: typeof delay === "number" && Number.isFinite(delay) ? Math.min(delay * 1000, 30_000) : null,
		ruleCount,
		failedOpen: false,
		isAllowed: (url: string) => robots.isAllowed(url, userAgent) !== false,
	};
}

export async function loadRobots(
	client: HttpClient,
	origin: string,
	userAgent = DEFAULT_ROBOTS_USER_AGENT,
	timeoutMs = 15_000,
	headers?: Record<string, string>,
): Promise<RobotsPolicy> {
	try {
		const request: { url: string; timeoutMs: number; headers?: Record<string, string> } = {
			url: `${origin}/robots.txt`,
			timeoutMs,
		};
		if (headers && Object.keys(headers).length > 0) request.headers = headers;
		const response = await client(request);
		if (response.status === 404 || response.status === 410) {
			return { ...ALLOW_ALL, status: response.status, present: true, isAllowed: () => true };
		}
		if (!response.ok) {
			return { ...ALLOW_ALL, status: response.status, failedOpen: true };
		}
		return { ...parseRobots(response.body, origin, userAgent), status: response.status };
	} catch {
		return { ...ALLOW_ALL, failedOpen: true };
	}
}

/**
 * Event stream shared by the crawl engine, the tools and the console UI.
 *
 * One vocabulary, three consumers: the engine emits, the run store reduces, the
 * spider panel and console render. Keeping it in the domain layer is what lets
 * a tool-triggered crawl animate a tab the tool never touches.
 */

import type { DenialCode } from "./denial";
import type { OutputFormat, RenderEngineName, RenderMode } from "./render/types";
import type { ElementProfile } from "./html/elements";

/** Engines a page can be produced by, shared by events, tools and the console. */
export type EngineName = RenderEngineName;

export interface CrawlOptions {
	/** Pages to fetch, including the start URL. */
	limit: number;
	/** Link hops below the start URL (firecrawl `maxDepth`, default 10 upstream). */
	maxDepth: number;
	/** Hops used for discovery only; null means "same as maxDepth". */
	maxDiscoveryDepth: number | null;
	concurrency: number;
	includePaths: string[];
	excludePaths: string[];
	allowExternalLinks: boolean;
	allowSubdomains: boolean;
	allowBackwardCrawling: boolean;
	/** firecrawl's replacement for `allowBackwardLinks`: crawl the whole domain, not just deeper paths. */
	crawlEntireDomain: boolean;
	ignoreRobotsTxt: boolean;
	useSitemap: boolean;
	onlyMainContent: boolean;
	timeoutMs: number;
	/** Match include/exclude regexes against the full URL. */
	regexOnFullURL: boolean;
	/** `?a=1` and no query string are the same page. */
	ignoreQueryParameters: boolean;
	/** Drop tracking parameters and trailing-slash duplicates. */
	deduplicateSimilarURLs: boolean;
	/** Politeness delay between page fetches. */
	delayMs: number;
	/** Engine policy for every page in the crawl. */
	render: RenderMode;
	/** Extra per-page outputs (`links`, `html`, `json`). */
	formats: OutputFormat[];
}

export const DEFAULT_CRAWL_OPTIONS: CrawlOptions = {
	limit: 12,
	maxDepth: 2,
	maxDiscoveryDepth: null,
	concurrency: 4,
	includePaths: [],
	excludePaths: [],
	allowExternalLinks: false,
	allowSubdomains: false,
	allowBackwardCrawling: false,
	crawlEntireDomain: false,
	ignoreRobotsTxt: false,
	useSitemap: true,
	onlyMainContent: true,
	timeoutMs: 30_000,
	regexOnFullURL: false,
	ignoreQueryParameters: false,
	deduplicateSimilarURLs: true,
	delayMs: 0,
	render: "auto",
	formats: ["markdown"],
};

export type CrawlEvent =
	| { type: "run-start"; target: string; options: CrawlOptions; at: number }
	| {
			type: "robots";
			origin: string;
			present: boolean;
			status: number;
			rules: number;
			crawlDelayMs: number | null;
			sitemaps: number;
			failedOpen: boolean;
			at: number;
	  }
	| { type: "sitemap"; seed: string; fetched: number; urls: number; truncated: boolean; at: number }
	| { type: "queued"; url: string; depth: number; parent: string | null; via: "seed" | "link" | "sitemap"; at: number }
	| {
			type: "denied";
			url: string;
			depth: number;
			parent: string | null;
			code: DenialCode;
			message: string;
			at: number;
	  }
	| { type: "fetching"; url: string; depth: number; parent: string | null; at: number }
	| {
			type: "crawled";
			url: string;
			depth: number;
			parent: string | null;
			status: number;
			engine: EngineName;
			rendered: boolean;
			bytes: number;
			chars: number;
			links: number;
			durationMs: number;
			title: string;
			/** Page structure, so the console can animate what was extracted. */
			elements?: ElementProfile;
			at: number;
	  }
	| {
			type: "failed";
			url: string;
			depth: number;
			parent: string | null;
			message: string;
			code: string;
			status: number;
			at: number;
	  }
	| { type: "engine-fallback"; url: string; from: EngineName; to: EngineName; reason: string; at: number }
	| {
			type: "run-end";
			status: "completed" | "stopped" | "failed";
			crawled: number;
			failed: number;
			denied: number;
			discovered: number;
			durationMs: number;
			at: number;
	  };

export type CrawlEventType = CrawlEvent["type"];

export interface CrawlPage {
	url: string;
	finalUrl: string;
	depth: number;
	parent: string | null;
	title: string;
	markdown: string;
	linkCount: number;
	status: number;
	engine: EngineName;
	bytes: number;
	chars: number;
	durationMs: number;
	warnings: number;
	elements?: ElementProfile;
}

export interface CrawlSummary {
	startUrl: string;
	pages: CrawlPage[];
	denied: Array<{ url: string; code: DenialCode; message: string; depth: number }>;
	failed: Array<{ url: string; message: string; code: string }>;
	status: "completed" | "stopped" | "failed";
	durationMs: number;
	options: CrawlOptions;
	/** Human-readable crawl scope (`/docs/*`), useful in tool output. */
	scope: string;
}

/**
 * Event stream shared by the crawl engine, the tools and the console UI.
 *
 * One vocabulary, three consumers: the engine emits, the run store reduces, the
 * spider panel and console render. Keeping it in the domain layer is what lets
 * a tool-triggered crawl animate a tab the tool never touches.
 */

import type { DenialCode } from "./denial";
import type { EngineName } from "./scrape/pipeline";

export interface CrawlOptions {
	/** Pages to fetch, including the start URL. */
	limit: number;
	/** Link hops below the start URL. */
	maxDepth: number;
	concurrency: number;
	includePaths: string[];
	excludePaths: string[];
	allowExternalLinks: boolean;
	allowSubdomains: boolean;
	allowBackwardCrawling: boolean;
	ignoreRobotsTxt: boolean;
	useSitemap: boolean;
	onlyMainContent: boolean;
	timeoutMs: number;
}

export const DEFAULT_CRAWL_OPTIONS: CrawlOptions = {
	limit: 12,
	maxDepth: 2,
	concurrency: 4,
	includePaths: [],
	excludePaths: [],
	allowExternalLinks: false,
	allowSubdomains: false,
	allowBackwardCrawling: false,
	ignoreRobotsTxt: false,
	useSitemap: true,
	onlyMainContent: true,
	timeoutMs: 30_000,
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
			bytes: number;
			chars: number;
			links: number;
			durationMs: number;
			title: string;
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
}

export interface CrawlSummary {
	startUrl: string;
	pages: CrawlPage[];
	denied: Array<{ url: string; code: DenialCode; message: string; depth: number }>;
	failed: Array<{ url: string; message: string; code: string }>;
	status: "completed" | "stopped" | "failed";
	durationMs: number;
	options: CrawlOptions;
}

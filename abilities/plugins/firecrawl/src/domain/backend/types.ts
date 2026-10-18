/**
 * Upstream contract.
 *
 * The plugin does not reimplement Firecrawl: when an endpoint is configured it
 * drives the same v2 REST API the official SDK and MCP server use, so every
 * capability the upstream service ships (parsers, attributes, actions, proxy,
 * monitors, async jobs) is available without a local copy of it. The local
 * engine stays as the offline path.
 */

/** One scraped page, shaped like `Document` in the upstream API. */
export interface UpstreamDocument {
	url?: string;
	title?: string;
	description?: string;
	markdown?: string;
	html?: string;
	rawHtml?: string;
	rawBase64?: string;
	links?: string[];
	images?: string[];
	screenshot?: string;
	audio?: string;
	video?: string;
	videos?: Array<Record<string, unknown>>;
	json?: unknown;
	extract?: unknown;
	summary?: string;
	answer?: string;
	highlights?: string;
	attributes?: Array<{ selector: string; attribute: string; values: string[] }>;
	pages?: Array<{ pageNumber: number; markdown: string }>;
	blocks?: unknown;
	warning?: string;
	metadata?: Record<string, unknown>;
	[key: string]: unknown;
}

export type JobKind = "crawl" | "batch";

export interface UpstreamJob {
	id: string;
	url?: string;
	invalidURLs?: unknown[];
}

export interface UpstreamJobStatus {
	status: "scraping" | "completed" | "failed" | "cancelled";
	completed: number;
	total: number;
	creditsUsed?: number;
	expiresAt?: string;
	next?: string | null;
	data: UpstreamDocument[];
	error?: string;
	warning?: string;
}

export interface UpstreamMonitor {
	id: string;
	name?: string;
	status?: string;
	schedule?: { cron?: string; timezone?: string };
	targets?: unknown[];
	nextRunAt?: string | null;
	lastRunAt?: string | null;
	lastCheckSummary?: unknown;
	[key: string]: unknown;
}

export interface UpstreamClient {
	readonly endpoint: string;
	readonly hasKey: boolean;
	scrape(body: Record<string, unknown>): Promise<UpstreamDocument>;
	batchScrape(body: Record<string, unknown>): Promise<UpstreamJob>;
	crawl(body: Record<string, unknown>): Promise<UpstreamJob>;
	job(kind: JobKind, id: string): Promise<UpstreamJobStatus>;
	cancel(kind: JobKind, id: string): Promise<void>;
	jobErrors(kind: JobKind, id: string): Promise<unknown>;
	map(body: Record<string, unknown>): Promise<{ links: string[]; count?: number; creditsUsed?: number }>;
	search(body: Record<string, unknown>): Promise<{ results: Array<Record<string, unknown>>; creditsUsed?: number; warning?: string }>;
	extract(body: Record<string, unknown>): Promise<UpstreamJob>;
	extractStatus(id: string): Promise<{ status: string; data?: unknown; error?: string }>;
	monitors: {
		create(body: Record<string, unknown>): Promise<UpstreamMonitor>;
		list(): Promise<UpstreamMonitor[]>;
		get(id: string): Promise<UpstreamMonitor>;
		update(id: string, body: Record<string, unknown>): Promise<UpstreamMonitor>;
		remove(id: string): Promise<void>;
		run(id: string): Promise<unknown>;
		checks(id: string, options?: { limit?: number; skip?: number }): Promise<{ data: unknown[]; next?: string | null }>;
	};
	credits(): Promise<unknown>;
}

export class UpstreamError extends Error {
	constructor(
		message: string,
		readonly status: number,
		readonly code: string,
	) {
		super(message);
		this.name = "UpstreamError";
	}
}

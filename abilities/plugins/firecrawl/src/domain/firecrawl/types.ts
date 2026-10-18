/**
 * Shapes returned by the Firecrawl v2 API.
 *
 * Deliberately loose: the service owns its own field set, so documents are
 * indexed records rather than a modelled schema. Only the fields this plugin
 * actually reads or formats are named.
 */

export interface DocumentMetadata {
	title?: string;
	description?: string;
	sourceURL?: string;
	url?: string;
	statusCode?: number;
	[key: string]: unknown;
}

export interface FirecrawlDocument {
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
	summary?: string;
	json?: unknown;
	extract?: unknown;
	answer?: string;
	highlights?: string[];
	attributes?: Array<{ selector: string; attribute: string; values: string[] }>;
	accounting?: unknown;
	branding?: Record<string, unknown>;
	product?: Record<string, unknown>;
	menu?: Record<string, unknown>;
	/** Captures produced by `actions[]`, in order. */
	actions?: {
		screenshots?: string[];
		scrapes?: FirecrawlDocument[];
		javascriptReturns?: Array<{ type?: string; value?: unknown; error?: string }>;
		pdfs?: string[];
	};
	/** Typed layout blocks when a PDF parser asked for them. */
	blocks?: unknown[];
	tools?: Record<string, unknown>;
	pages?: Array<{ pageNumber: number; markdown: string }>;
	video?: string;
	videos?: unknown[];
	audio?: string;
	warning?: string;
	parser?: unknown;
	metadata?: DocumentMetadata;
	[key: string]: unknown;
}

export type JobKind = "crawl" | "batch";

/** `interact` session: a live browser the caller drives by running code in it. */
export interface InteractSession {
	id: string;
	cdpUrl?: string;
	liveViewUrl?: string;
	interactiveLiveViewUrl?: string;
	expiresAt?: string;
}

export interface InteractResult {
	stdout?: string | null;
	stderr?: string | null;
	exitCode?: number | null;
	killed?: boolean;
	error?: string | null;
}

/** `agent` run: a Firecrawl-hosted model browsing on the caller's behalf. */
export interface AgentRun {
	id: string;
	threadId?: string;
	threadTurn?: number;
}

export interface AgentStatus {
	status: "processing" | "completed" | "failed";
	data?: unknown;
	partial?: unknown;
	partialSchemaValid?: boolean;
	stopReason?: string;
	message?: string;
	model?: string;
	effort?: string;
	error?: string;
	expiresAt?: string;
	creditsUsed?: number;
	threadId?: string;
}

/** One step of an agent run. Ordered by `producerSequence`, never by `occurredAt`. */
export interface AgentTraceEvent {
	type?: string;
	eventId?: string;
	occurredAt?: string;
	producerSequence?: number;
	[key: string]: unknown;
}

export interface AgentTrace {
	events: AgentTraceEvent[];
	creditsUsed?: number;
	activeBrowserSessions?: number;
}

/** `/v2/team/queue-status`: what the account is running and what it may run. */
export interface QueueStatus {
	jobsInQueue: number;
	activeJobsInQueue: number;
	waitingJobsInQueue: number;
	maxConcurrency: number;
	mostRecentSuccess?: string;
}

/** `/v2/crawl/active`: crawls upstream is still working on for this key. */
export interface ActiveCrawl {
	id: string;
	url?: string;
	status?: string;
	createdAt?: string;
	/** The page limit the crawl was started with — an intent, not progress. */
	limit?: number;
}

export interface IndexHit {
	type?: string;
	url?: string;
	title?: string;
	passages?: Array<{ text?: string; [key: string]: unknown }>;
	[key: string]: unknown;
}

export interface DeveloperSearchResult {
	results: IndexHit[];
	coverage?: Record<string, string>;
	reranked?: boolean;
	repos?: unknown[];
	sources?: unknown[];
	warning?: string;
}

export interface GovSearchResult {
	results: IndexHit[];
	warning?: string;
}

export interface PaperHit {
	paperId?: string;
	primaryId?: string;
	title?: string;
	abstract?: string;
	score?: number;
	authors?: string;
	categories?: string[];
	ids?: Record<string, string[]>;
	[key: string]: unknown;
}

export interface PaperSearchResult {
	results: PaperHit[];
	paper?: PaperHit;
	passages?: Array<Record<string, unknown>>;
}

export type IndexName = "developer" | "gov" | "research";

export interface JobHandle {
	id: string;
	url?: string;
	invalidURLs?: unknown[];
}

export interface JobStatus {
	status: "scraping" | "completed" | "failed" | "cancelled";
	completed: number;
	total: number;
	creditsUsed?: number;
	expiresAt?: string;
	/** Absolute URL of the next result page; the first response is capped at 10 MB. */
	next?: string | null;
	data: FirecrawlDocument[];
	error?: string;
	warning?: string;
}

export interface JobPageError {
	url?: string;
	error?: string;
	code?: string;
	statusCode?: number;
	/**
	 * Set when upstream reported the URL under `robotsBlocked` instead of `errors`.
	 * That array carries bare URLs, so there is no code or message to show.
	 */
	robots?: boolean;
}

export interface MapResult {
	links: string[];
	count: number;
	creditsUsed?: number;
}

export interface SearchResult {
	results: Array<Record<string, unknown>>;
	creditsUsed?: number;
	warning?: string;
}

export interface ExtractStatus {
	status: string;
	data?: unknown;
	error?: string;
}

export interface MonitorCheck {
	[key: string]: unknown;
}

export interface Monitor {
	id?: string;
	name?: string;
	status?: string;
	schedule?: Record<string, unknown>;
	targets?: unknown[];
	[key: string]: unknown;
}

export interface CreditUsage {
	remainingCredits?: number;
	planCredits?: number;
	billingPeriodStart?: string;
	billingPeriodEnd?: string;
	[key: string]: unknown;
}

export interface FirecrawlClient {
	readonly endpoint: string;
	readonly hasKey: boolean;
	scrape(body: Record<string, unknown>): Promise<FirecrawlDocument>;
	/** Multipart upload to `/v2/parse`; the body is built by the caller. */
	upload(body: unknown): Promise<FirecrawlDocument>;
	batchScrape(body: Record<string, unknown>): Promise<JobHandle>;
	crawl(body: Record<string, unknown>): Promise<JobHandle>;
	job(kind: JobKind, id: string, cursor?: string): Promise<JobStatus>;
	cancel(kind: JobKind, id: string): Promise<void>;
	jobErrors(kind: JobKind, id: string): Promise<JobPageError[]>;
	map(body: Record<string, unknown>): Promise<MapResult>;
	search(body: Record<string, unknown>): Promise<SearchResult>;
	extract(body: Record<string, unknown>): Promise<JobHandle>;
	extractStatus(id: string): Promise<ExtractStatus>;
	interact: {
		create(body: Record<string, unknown>): Promise<InteractSession>;
		execute(id: string, body: Record<string, unknown>): Promise<InteractResult>;
		stop(id: string): Promise<void>;
	};
	agent: {
		start(body: Record<string, unknown>): Promise<AgentRun>;
		status(id: string): Promise<AgentStatus>;
		trace(id: string, options?: { liveView?: boolean }): Promise<AgentTrace>;
	};
	searchDeveloper(body: Record<string, unknown>): Promise<DeveloperSearchResult>;
	searchGov(body: Record<string, unknown>): Promise<GovSearchResult>;
	searchPapers(params: Record<string, string | number | boolean | undefined>): Promise<PaperSearchResult>;
	paper(id: string, params?: { query?: string; k?: number }): Promise<PaperSearchResult>;
	similarPapers(id: string, params: { intent: string; mode?: string; k?: number; rerank?: boolean; anchor?: string[] }): Promise<PaperSearchResult>;
	monitors: {
		create(body: Record<string, unknown>): Promise<Monitor>;
		list(): Promise<Monitor[]>;
		get(id: string): Promise<Monitor>;
		update(id: string, body: Record<string, unknown>): Promise<Monitor>;
		remove(id: string): Promise<void>;
		run(id: string): Promise<unknown>;
		checks(id: string, options?: { limit?: number; skip?: number }): Promise<{ data: MonitorCheck[]; next: string | null }>;
	};
	credits(): Promise<CreditUsage>;
	queue(): Promise<QueueStatus>;
	activeCrawls(): Promise<ActiveCrawl[]>;
}

export class FirecrawlError extends Error {
	constructor(
		message: string,
		readonly status: number,
		readonly code: string,
	) {
		super(message);
		this.name = "FirecrawlError";
	}
}

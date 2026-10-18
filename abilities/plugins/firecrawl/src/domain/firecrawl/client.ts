/**
 * Firecrawl v2 REST client.
 *
 * One thin layer over `POST/GET/DELETE /v2/...`: it owns authentication,
 * envelope unwrapping, timeouts and retry, and nothing else. Keeping it thin is
 * the point — the service is the source of truth for scraping behaviour, so a
 * new upstream option is passed through rather than modelled here.
 */

import {
	FirecrawlError,
	type ExtractStatus,
	type FirecrawlClient,
	type FirecrawlDocument,
	type JobHandle,
	type JobKind,
	type JobPageError,
	type JobStatus,
	type MapResult,
	type ActiveCrawl,
	type AgentRun,
	type AgentStatus,
	type AgentTrace,
	type AgentTraceEvent,
	type DeveloperSearchResult,
	type GovSearchResult,
	type IndexHit,
	type InteractResult,
	type InteractSession,
	type Monitor,
	type PaperHit,
	type PaperSearchResult,
	type QueueStatus,
	type SearchResult,
} from "./types";
import type { Transport, TransportBody } from "./transport";

export const DEFAULT_ENDPOINT = "https://api.firecrawl.dev";

/** Job creation can take a while when the upstream queue is busy. */
const SUBMIT_TIMEOUT_MS = 120_000;
const READ_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 2;

export interface ClientOptions {
	endpoint?: string;
	apiKey?: string;
	/** Replaces the host transport in tests. */
	transport: Transport;
}

export function normalizeEndpoint(raw: string | undefined): string {
	const trimmed = (raw ?? "").trim().replace(/\/+$/, "");
	if (trimmed.length === 0) return DEFAULT_ENDPOINT;
	return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function describeFailure(status: number, payload: unknown): { message: string; code: string } {
	const record = (payload ?? {}) as Record<string, unknown>;
	const upstreamError = record.error;
	const detail =
		typeof upstreamError === "string"
			? upstreamError
			: upstreamError && typeof upstreamError === "object"
				? String((upstreamError as Record<string, unknown>).message ?? "")
				: typeof record.detail === "string"
					? record.detail
					: "";
	const code = typeof record.code === "string" ? record.code : `http_${status}`;
	if (status === 401) {
		return {
			message: `Upstream rejected the API key (401)${detail.length > 0 ? `: ${detail}` : ""}. Connect a valid key on the ability page or in the console.`,
			code,
		};
	}
	if (status === 403) {
		// Firecrawl answers 403 for policy denials, not for a bad key: an endpoint,
		// format or IP allowlist on the key/team, an Enterprise-only option
		// (`ignoreRobotsTxt`, `zeroDataRetention`), or the legacy v0 API. The body
		// names the exact rule, so it has to reach the user verbatim.
		return {
			message:
				detail.length > 0
					? `Upstream denied this request (403): ${detail}`
					: "Upstream denied this request (403). The key or team is restricted (allowed endpoints, formats or IP addresses), or the request uses an Enterprise-only option such as ignoreRobotsTxt or zeroDataRetention. The key itself is valid.",
			code,
		};
	}
	if (status === 402) {
		return {
			message: `Upstream reports insufficient credits for this request${detail.length > 0 ? ` (${detail})` : ""}.`,
			code,
		};
	}
	if (status === 429) {
		return { message: "Upstream rate limit reached. Retry shortly, or lower concurrency.", code };
	}
	return {
		message: detail.length > 0 ? detail : `Upstream request failed with HTTP ${status}.`,
		code,
	};
}

function asDocument(payload: Record<string, unknown>): FirecrawlDocument {
	const candidate = payload.data ?? payload.document ?? payload;
	if (!candidate || typeof candidate !== "object") {
		throw new FirecrawlError("Upstream returned no page content", 502, "empty_document");
	}
	return candidate as FirecrawlDocument;
}

function asStringArray(value: unknown): string[] {
	return Array.isArray(value) ? value.map(String) : [];
}

/** Query string from defined values, already encoded. */
function toQuery(params: Record<string, string | number | boolean | undefined>): string {
	const search = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		if (value === undefined || value === "") continue;
		search.set(key, String(value));
	}
	const query = search.toString();
	return query ? `?${query}` : "";
}

function toPaperResult(payload: Record<string, unknown>): PaperSearchResult {
	const results = Array.isArray(payload.results) ? (payload.results as PaperHit[]) : [];
	return {
		results,
		paper: payload.paper && typeof payload.paper === "object" ? (payload.paper as PaperHit) : undefined,
		passages: Array.isArray(payload.passages) ? (payload.passages as Array<Record<string, unknown>>) : undefined,
	};
}

export function createClient(options: ClientOptions): FirecrawlClient {
	const endpoint = normalizeEndpoint(options.endpoint);
	const apiKey = options.apiKey?.trim() ?? "";
	const transport = options.transport;

	async function send(
		method: "GET" | "POST" | "PATCH" | "DELETE",
		target: string,
		body?: TransportBody,
		timeoutMs = READ_TIMEOUT_MS,
	): Promise<Record<string, unknown>> {
		const url = /^https?:\/\//i.test(target) ? target : `${endpoint}${target}`;
		let lastError: unknown;
		for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
			let response;
			try {
				response = await transport({
					url,
					method,
					body,
					headers: {
						accept: "application/json",
						...(body?.type === "json" ? { "content-type": "application/json" } : {}),
						...(apiKey.length > 0 ? { authorization: `Bearer ${apiKey}` } : {}),
					},
					timeoutMs,
				});
			} catch (error) {
				lastError = error;
				if (attempt === MAX_ATTEMPTS) break;
				await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
				continue;
			}

			let payload: unknown = null;
			try {
				payload = response.body.length > 0 ? JSON.parse(response.body) : null;
			} catch {
				payload = { error: response.body.slice(0, 400) };
			}

			if (response.ok) return (payload ?? {}) as Record<string, unknown>;
			const retryable = response.status === 429 || response.status >= 500;
			if (retryable && attempt < MAX_ATTEMPTS) {
				await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
				continue;
			}
			const failure = describeFailure(response.status, payload);
			throw new FirecrawlError(failure.message, response.status, failure.code);
		}
		const message = lastError instanceof Error ? lastError.message : String(lastError ?? "Upstream unreachable");
		throw new FirecrawlError(`Could not reach ${endpoint}: ${message}`, 0, "unreachable");
	}

	function json(body: unknown): TransportBody {
		return { type: "json", value: body };
	}

	async function submit(path: string, body: Record<string, unknown>): Promise<JobHandle> {
		const payload = await send("POST", path, json(body), SUBMIT_TIMEOUT_MS);
		const id = typeof payload.id === "string" ? payload.id : "";
		if (!id) throw new FirecrawlError(`${path} did not return a job id`, 502, "no_job_id");
		return {
			id,
			url: typeof payload.url === "string" ? payload.url : undefined,
			invalidURLs: Array.isArray(payload.invalidURLs) ? payload.invalidURLs : undefined,
		};
	}

	function jobPath(kind: JobKind, id: string): string {
		return kind === "batch" ? `/v2/batch/scrape/${id}` : `/v2/crawl/${id}`;
	}

	function toStatus(payload: Record<string, unknown>): JobStatus {
		const raw = String(payload.status ?? (payload.success === false ? "failed" : "scraping"));
		const status = (["scraping", "completed", "failed", "cancelled"].includes(raw) ? raw : "scraping") as JobStatus["status"];
		return {
			status,
			completed: Number(payload.completed ?? 0),
			total: Number(payload.total ?? 0),
			creditsUsed: typeof payload.creditsUsed === "number" ? payload.creditsUsed : undefined,
			expiresAt: typeof payload.expiresAt === "string" ? payload.expiresAt : undefined,
			next: typeof payload.next === "string" ? payload.next : null,
			data: Array.isArray(payload.data) ? (payload.data as FirecrawlDocument[]) : [],
			error: typeof payload.error === "string" ? payload.error : undefined,
			warning: typeof payload.warning === "string" ? payload.warning : undefined,
		};
	}

	return {
		endpoint,
		hasKey: apiKey.length > 0,

		async scrape(body) {
			const payload = await send("POST", "/v2/scrape", json(body), SUBMIT_TIMEOUT_MS);
			return asDocument(payload);
		},

		async upload(body) {
			const payload = await send("POST", "/v2/parse", body as TransportBody, SUBMIT_TIMEOUT_MS);
			return asDocument(payload);
		},

		batchScrape: (body) => submit("/v2/batch/scrape", body),
		crawl: (body) => submit("/v2/crawl", body),

		async job(kind, id, cursor) {
			const payload = await send("GET", cursor ?? jobPath(kind, id));
			return toStatus(payload);
		},

		async cancel(kind, id) {
			await send("DELETE", jobPath(kind, id));
		},

		async jobErrors(kind, id) {
			const payload = await send("GET", `${jobPath(kind, id)}/errors`);
			const list = Array.isArray(payload.errors)
				? payload.errors
				: Array.isArray(payload.data)
					? payload.data
					: [];
			return list
				.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
				.map(
					(entry): JobPageError => ({
						url: typeof entry.url === "string" ? entry.url : undefined,
						error: typeof entry.error === "string" ? entry.error : undefined,
						code: typeof entry.code === "string" ? entry.code : undefined,
						statusCode: typeof entry.statusCode === "number" ? entry.statusCode : undefined,
					}),
				);
		},

		async map(body) {
			const payload = await send("POST", "/v2/map", json(body));
			const links = asStringArray(payload.links);
			return {
				links,
				count: typeof payload.count === "number" ? payload.count : links.length,
				creditsUsed: typeof payload.creditsUsed === "number" ? payload.creditsUsed : undefined,
			} satisfies MapResult;
		},

		async search(body) {
			const payload = await send("POST", "/v2/search", json(body));
			const data = payload.data;
			const results = Array.isArray(data)
				? (data as Array<Record<string, unknown>>)
				: data && typeof data === "object" && Array.isArray((data as Record<string, unknown>).web)
					? ((data as Record<string, unknown>).web as Array<Record<string, unknown>>)
					: [];
			return {
				results,
				creditsUsed: typeof payload.creditsUsed === "number" ? payload.creditsUsed : undefined,
				warning: typeof payload.warning === "string" ? payload.warning : undefined,
			} satisfies SearchResult;
		},

		extract: (body) => submit("/v2/extract", body),

		async extractStatus(id) {
			const payload = await send("GET", `/v2/extract/${id}`);
			return {
				status: String(payload.status ?? "processing"),
				data: payload.data,
				error: typeof payload.error === "string" ? payload.error : undefined,
			} satisfies ExtractStatus;
		},

		interact: {
			async create(body) {
				const payload = await send("POST", "/v2/interact", json(body), SUBMIT_TIMEOUT_MS);
				const id = typeof payload.id === "string" ? payload.id : "";
				if (!id) throw new FirecrawlError("interact did not return a session id", 502, "no_session_id");
				return {
					id,
					cdpUrl: typeof payload.cdpUrl === "string" ? payload.cdpUrl : undefined,
					liveViewUrl: typeof payload.liveViewUrl === "string" ? payload.liveViewUrl : undefined,
					interactiveLiveViewUrl: typeof payload.interactiveLiveViewUrl === "string" ? payload.interactiveLiveViewUrl : undefined,
					expiresAt: typeof payload.expiresAt === "string" ? payload.expiresAt : undefined,
				} satisfies InteractSession;
			},
			async execute(id, body) {
				const payload = await send("POST", `/v2/interact/${id}/execute`, json(body), SUBMIT_TIMEOUT_MS);
				return {
					stdout: typeof payload.stdout === "string" ? payload.stdout : typeof payload.result === "string" ? payload.result : null,
					stderr: typeof payload.stderr === "string" ? payload.stderr : null,
					exitCode: typeof payload.exitCode === "number" ? payload.exitCode : null,
					killed: payload.killed === true,
					error: typeof payload.error === "string" ? payload.error : null,
				} satisfies InteractResult;
			},
			async stop(id) {
				await send("DELETE", `/v2/interact/${id}`);
			},
		},

		agent: {
			async start(body) {
				const payload = await send("POST", "/v2/agent", json(body), SUBMIT_TIMEOUT_MS);
				const id = typeof payload.id === "string" ? payload.id : "";
				if (!id) throw new FirecrawlError("agent did not return a job id", 502, "no_job_id");
				return {
					id,
					threadId: typeof payload.threadId === "string" ? payload.threadId : undefined,
					threadTurn: typeof payload.threadTurn === "number" ? payload.threadTurn : undefined,
				} satisfies AgentRun;
			},
			async status(id) {
				const payload = await send("GET", `/v2/agent/${id}`);
				const raw = String(payload.status ?? "processing");
				const status = (["processing", "completed", "failed"].includes(raw) ? raw : "processing") as AgentStatus["status"];
				return {
					status,
					data: payload.data,
					partial: payload.partial,
					partialSchemaValid: payload.partialSchemaValid === true,
					stopReason: typeof payload.stopReason === "string" ? payload.stopReason : undefined,
					message: typeof payload.message === "string" ? payload.message : undefined,
					model: typeof payload.model === "string" ? payload.model : undefined,
					effort: typeof payload.effort === "string" ? payload.effort : undefined,
					error: typeof payload.error === "string" ? payload.error : undefined,
					expiresAt: typeof payload.expiresAt === "string" ? payload.expiresAt : undefined,
					creditsUsed: typeof payload.creditsUsed === "number" ? payload.creditsUsed : undefined,
					threadId: typeof payload.threadId === "string" ? payload.threadId : undefined,
				} satisfies AgentStatus;
			},
			async trace(id, options = {}) {
				const payload = await send("GET", `/v2/agent/${id}/trace${toQuery({ liveView: options.liveView })}`);
				const events = Array.isArray(payload.events) ? (payload.events as AgentTraceEvent[]) : [];
				// `occurredAt` is wall-clock and can repeat or arrive out of order; the
				// producer's monotonic counter is the only stable reading order.
				events.sort((left, right) => (left.producerSequence ?? 0) - (right.producerSequence ?? 0));
				return {
					events,
					creditsUsed: typeof payload.creditsUsed === "number" ? payload.creditsUsed : undefined,
					activeBrowserSessions:
						typeof payload.activeBrowserSessions === "number" ? payload.activeBrowserSessions : undefined,
				} satisfies AgentTrace;
			},
		},

		async searchDeveloper(body) {
			const payload = await send("POST", "/v2/search/developer", json(body), SUBMIT_TIMEOUT_MS);
			return {
				results: Array.isArray(payload.results) ? (payload.results as IndexHit[]) : [],
				coverage: payload.coverage && typeof payload.coverage === "object" ? (payload.coverage as Record<string, string>) : undefined,
				reranked: payload.reranked === true,
				repos: Array.isArray(payload.repos) ? payload.repos : undefined,
				sources: Array.isArray(payload.sources) ? payload.sources : undefined,
				warning: typeof payload.warning === "string" ? payload.warning : undefined,
			} satisfies DeveloperSearchResult;
		},

		async searchGov(body) {
			const payload = await send("POST", "/v2/search/gov", json(body), SUBMIT_TIMEOUT_MS);
			const data = payload.data;
			const results = data && typeof data === "object" && Array.isArray((data as Record<string, unknown>).web)
				? ((data as Record<string, unknown>).web as IndexHit[])
				: Array.isArray(payload.results)
					? (payload.results as IndexHit[])
					: [];
			return {
				results,
				warning: typeof payload.warning === "string" ? payload.warning : undefined,
			} satisfies GovSearchResult;
		},

		async searchPapers(params) {
			const payload = await send("GET", `/v2/search/research/papers${toQuery(params)}`, undefined, SUBMIT_TIMEOUT_MS);
			return toPaperResult(payload);
		},

		async paper(id, params = {}) {
			const payload = await send(
				"GET",
				`/v2/search/research/papers/${encodeURIComponent(id)}${toQuery({ query: params.query, k: params.k })}`,
				undefined,
				SUBMIT_TIMEOUT_MS,
			);
			return toPaperResult(payload);
		},

		async similarPapers(id, params) {
			const query = toQuery({
				intent: params.intent,
				mode: params.mode,
				k: params.k,
				rerank: params.rerank,
			});
			const extra = (params.anchor ?? []).map((entry) => `anchor=${encodeURIComponent(entry)}`).join("&");
			const payload = await send(
				"GET",
				`/v2/search/research/papers/${encodeURIComponent(id)}/similar${query}${extra ? `&${extra}` : ""}`,
				undefined,
				SUBMIT_TIMEOUT_MS,
			);
			return toPaperResult(payload);
		},

		monitors: {
			async create(body) {
				const payload = await send("POST", "/v2/monitor", json(body), SUBMIT_TIMEOUT_MS);
				return (payload.data ?? payload) as Monitor;
			},
			async list() {
				const payload = await send("GET", "/v2/monitor");
				return Array.isArray(payload.data) ? (payload.data as Monitor[]) : [];
			},
			async get(id) {
				const payload = await send("GET", `/v2/monitor/${id}`);
				return (payload.data ?? payload) as Monitor;
			},
			async update(id, body) {
				const payload = await send("POST", `/v2/monitor/${id}`, json(body));
				return (payload.data ?? payload) as Monitor;
			},
			async remove(id) {
				await send("DELETE", `/v2/monitor/${id}`);
			},
			async run(id) {
				return send("POST", `/v2/monitor/${id}/run`, json({}));
			},
			async checks(id, options = {}) {
				const params = new URLSearchParams();
				if (options.limit !== undefined) params.set("limit", String(options.limit));
				if (options.skip !== undefined) params.set("skip", String(options.skip));
				const query = params.toString();
				const payload = await send("GET", `/v2/monitor/${id}/checks${query ? `?${query}` : ""}`);
				const data = payload.data;
				const list = Array.isArray(data)
					? data
					: data && typeof data === "object" && Array.isArray((data as Record<string, unknown>).checks)
						? ((data as Record<string, unknown>).checks as unknown[])
						: [];
				return { data: list as Array<Record<string, unknown>>, next: typeof payload.next === "string" ? payload.next : null };
			},
		},

		async credits() {
			const payload = await send("GET", "/v2/team/credit-usage");
			return (payload.data ?? payload) as Record<string, unknown>;
		},

		async queue() {
			const payload = await send("GET", "/v2/team/queue-status");
			const number = (key: string): number => (typeof payload[key] === "number" ? (payload[key] as number) : 0);
			return {
				jobsInQueue: number("jobsInQueue"),
				activeJobsInQueue: number("activeJobsInQueue"),
				waitingJobsInQueue: number("waitingJobsInQueue"),
				maxConcurrency: number("maxConcurrency"),
				mostRecentSuccess:
					typeof payload.mostRecentSuccess === "string" ? payload.mostRecentSuccess : undefined,
			} satisfies QueueStatus;
		},

		async activeCrawls() {
			const payload = await send("GET", "/v2/crawl/active");
			// The schema advertises `crawls` but the documented example returns `data`,
			// so neither spelling is trusted on its own.
			const raw = Array.isArray(payload.crawls)
				? payload.crawls
				: Array.isArray(payload.data)
					? payload.data
					: [];
			return raw
				.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
				.map((entry) => {
					const options = entry.options && typeof entry.options === "object" ? (entry.options as Record<string, unknown>) : {};
					const scrapeOptions =
						options.scrapeOptions && typeof options.scrapeOptions === "object"
							? (options.scrapeOptions as Record<string, unknown>)
							: {};
					return {
						id: typeof entry.id === "string" ? entry.id : "",
						url: typeof entry.url === "string" ? entry.url : undefined,
						status: typeof entry.status === "string" ? entry.status : undefined,
						createdAt: typeof entry.createdAt === "string" ? entry.createdAt : undefined,
						// Upstream reports no per-crawl progress here, so only the requested limit is kept.
						limit: typeof scrapeOptions.limit === "number" ? (scrapeOptions.limit as number) : undefined,
					} satisfies ActiveCrawl;
				})
				.filter((entry) => entry.id.length > 0);
		},
	};
}

/** Poll an async job until it leaves `scraping`, reporting progress on the way. */
export async function pollJob(
	client: FirecrawlClient,
	kind: JobKind,
	id: string,
	options: { timeoutMs?: number; intervalMs?: number; onProgress?: (status: JobStatus) => void } = {},
): Promise<JobStatus> {
	const timeoutMs = options.timeoutMs ?? 300_000;
	const intervalMs = options.intervalMs ?? 2_000;
	const deadline = Date.now() + timeoutMs;
	let status = await client.job(kind, id);
	options.onProgress?.(status);

	while (status.status === "scraping" && Date.now() < deadline) {
		await new Promise((resolve) => setTimeout(resolve, intervalMs));
		status = await client.job(kind, id);
		options.onProgress?.(status);
	}
	return status;
}

/**
 * Follow the `next` cursor until the job's result set is exhausted.
 *
 * A single status response carries at most 10 MB, so a large crawl needs
 * several requests before the page list is complete.
 */
export async function readJobPages(
	client: FirecrawlClient,
	kind: JobKind,
	id: string,
	options: { maxPages?: number; onProgress?: (count: number) => void } = {},
): Promise<FirecrawlDocument[]> {
	const maxPages = options.maxPages ?? 20;
	const documents: FirecrawlDocument[] = [];
	let cursor: string | null | undefined;
	for (let page = 0; page < maxPages; page += 1) {
		const status = await client.job(kind, id, cursor ?? undefined);
		documents.push(...status.data);
		options.onProgress?.(documents.length);
		cursor = status.next;
		if (!cursor) break;
	}
	return documents;
}

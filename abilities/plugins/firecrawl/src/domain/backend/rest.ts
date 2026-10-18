/**
 * Firecrawl v2 REST client.
 *
 * One thin layer over `POST/GET/DELETE /v2/...`: it owns authentication,
 * envelope unwrapping, timeouts and retry, and nothing else. Keeping it thin is
 * the point — the service behind it is the source of truth for scraping
 * behaviour, so a new upstream option is passed through rather than modelled.
 */

import type { HttpClient } from "../scrape/http";
import {
	UpstreamError,
	type JobKind,
	type UpstreamClient,
	type UpstreamDocument,
	type UpstreamJob,
	type UpstreamJobStatus,
	type UpstreamMonitor,
} from "./types";

export const DEFAULT_ENDPOINT = "https://api.firecrawl.dev";

/** Job creation can take a while when the upstream queue is busy. */
const SUBMIT_TIMEOUT_MS = 120_000;
const READ_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 2;

export interface RestClientOptions {
	endpoint?: string;
	apiKey?: string;
	/** Replaces the host transport in tests. */
	client: HttpClient;
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
	if (status === 401 || status === 403) {
		return {
			message: `Upstream rejected the API key (${status}). Set a valid key in the crawler console, or switch the engine to local.`,
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

export function createRestClient(options: RestClientOptions): UpstreamClient {
	const endpoint = normalizeEndpoint(options.endpoint);
	const apiKey = options.apiKey?.trim() ?? "";
	const transport = options.client;

	async function request<T>(
		method: "GET" | "POST" | "PATCH" | "DELETE",
		path: string,
		body?: unknown,
		timeoutMs = READ_TIMEOUT_MS,
	): Promise<T> {
		let lastError: unknown;
		for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
			let response;
			try {
				response = await transport({
					url: `${endpoint}${path}`,
					method,
					body,
					headers: {
						"content-type": "application/json",
						accept: "application/json",
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

			if (response.ok) return payload as T;
			const retryable = response.status === 429 || response.status >= 500;
			if (retryable && attempt < MAX_ATTEMPTS) {
				await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
				continue;
			}
			const failure = describeFailure(response.status, payload);
			throw new UpstreamError(failure.message, response.status, failure.code);
		}
		const message = lastError instanceof Error ? lastError.message : String(lastError ?? "Upstream unreachable");
		throw new UpstreamError(`Could not reach ${endpoint}: ${message}`, 0, "unreachable");
	}

	async function submit(path: string, body: Record<string, unknown>): Promise<UpstreamJob> {
		const payload = await request<Record<string, unknown>>("POST", path, body, SUBMIT_TIMEOUT_MS);
		const id = typeof payload.id === "string" ? payload.id : "";
		if (!id) {
			throw new UpstreamError(`${path} did not return a job id`, 502, "no_job_id");
		}
		return {
			id,
			url: typeof payload.url === "string" ? payload.url : undefined,
			invalidURLs: Array.isArray(payload.invalidURLs) ? payload.invalidURLs : undefined,
		};
	}

	function jobPath(kind: JobKind, id: string): string {
		return kind === "batch" ? `/v2/batch/scrape/${id}` : `/v2/crawl/${id}`;
	}

	return {
		endpoint,
		hasKey: apiKey.length > 0,

		async scrape(body) {
			const payload = await request<Record<string, unknown>>("POST", "/v2/scrape", body, SUBMIT_TIMEOUT_MS);
			const document = (payload.data ?? payload) as UpstreamDocument;
			if (!document || typeof document !== "object") {
				throw new UpstreamError("Upstream returned no page content", 502, "empty_document");
			}
			return document;
		},

		batchScrape: (body) => submit("/v2/batch/scrape", body),
		crawl: (body) => submit("/v2/crawl", body),

		async job(kind, id) {
			const payload = await request<Record<string, unknown>>("GET", jobPath(kind, id));
			const status = String(payload.status ?? (payload.success === false ? "failed" : "scraping"));
			return {
				status: (["scraping", "completed", "failed", "cancelled"].includes(status) ? status : "scraping") as UpstreamJobStatus["status"],
				completed: Number(payload.completed ?? 0),
				total: Number(payload.total ?? 0),
				creditsUsed: typeof payload.creditsUsed === "number" ? payload.creditsUsed : undefined,
				expiresAt: typeof payload.expiresAt === "string" ? payload.expiresAt : undefined,
				next: typeof payload.next === "string" ? payload.next : null,
				data: Array.isArray(payload.data) ? (payload.data as UpstreamDocument[]) : [],
				error: typeof payload.error === "string" ? payload.error : undefined,
				warning: typeof payload.warning === "string" ? payload.warning : undefined,
			};
		},

		async cancel(kind, id) {
			await request("DELETE", jobPath(kind, id));
		},

		async jobErrors(kind, id) {
			return request("GET", `${jobPath(kind, id)}/errors`);
		},

		async map(body) {
			const payload = await request<Record<string, unknown>>("POST", "/v2/map", body);
			const links = Array.isArray(payload.links) ? payload.links.map(String) : [];
			return {
				links,
				count: typeof payload.count === "number" ? payload.count : links.length,
				creditsUsed: typeof payload.creditsUsed === "number" ? payload.creditsUsed : undefined,
			};
		},

		async search(body) {
			const payload = await request<Record<string, unknown>>("POST", "/v2/search", body);
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
			};
		},

		extract: (body) => submit("/v2/extract", body),

		async extractStatus(id) {
			const payload = await request<Record<string, unknown>>("GET", `/v2/extract/${id}`);
			return {
				status: String(payload.status ?? "processing"),
				data: payload.data,
				error: typeof payload.error === "string" ? payload.error : undefined,
			};
		},

		monitors: {
			async create(body) {
				const payload = await request<Record<string, unknown>>("POST", "/v2/monitor", body, SUBMIT_TIMEOUT_MS);
				return (payload.data ?? payload) as UpstreamMonitor;
			},
			async list() {
				const payload = await request<Record<string, unknown>>("GET", "/v2/monitor");
				return Array.isArray(payload.data) ? (payload.data as UpstreamMonitor[]) : [];
			},
			async get(id) {
				const payload = await request<Record<string, unknown>>("GET", `/v2/monitor/${id}`);
				return (payload.data ?? payload) as UpstreamMonitor;
			},
			async update(id, body) {
				const payload = await request<Record<string, unknown>>("POST", `/v2/monitor/${id}`, body);
				return (payload.data ?? payload) as UpstreamMonitor;
			},
			async remove(id) {
				await request("DELETE", `/v2/monitor/${id}`);
			},
			async run(id) {
				return request("POST", `/v2/monitor/${id}/run`, {});
			},
			async checks(id, options = {}) {
				const params = new URLSearchParams();
				if (options.limit !== undefined) params.set("limit", String(options.limit));
				if (options.skip !== undefined) params.set("skip", String(options.skip));
				const query = params.toString();
				const payload = await request<Record<string, unknown>>(
					"GET",
					`/v2/monitor/${id}/checks${query ? `?${query}` : ""}`,
				);
				const data = payload.data;
				const list = Array.isArray(data)
					? data
					: data && typeof data === "object" && Array.isArray((data as Record<string, unknown>).checks)
						? ((data as Record<string, unknown>).checks as unknown[])
						: [];
				return { data: list, next: typeof payload.next === "string" ? payload.next : null };
			},
		},

		async credits() {
			const payload = await request<Record<string, unknown>>("GET", "/v2/team/credit-usage");
			return payload.data ?? payload;
		},
	};
}

/** Poll an async job until it leaves `scraping`, reporting progress on the way. */
export async function pollUpstreamJob(
	client: UpstreamClient,
	kind: JobKind,
	id: string,
	options: { timeoutMs?: number; intervalMs?: number; onProgress?: (status: UpstreamJobStatus) => void } = {},
): Promise<UpstreamJobStatus> {
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

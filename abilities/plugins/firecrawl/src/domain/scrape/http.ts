/**
 * Transport contract for the crawl engine.
 *
 * The domain layer never touches plugin APIs directly: the plugin injects a
 * host-mediated client (`ctx.network.request`, executed in the main process so
 * renderer CORS never applies). Tests inject a plain fake.
 */

export interface HttpRequestInit {
	url: string;
	headers?: Record<string, string>;
	timeoutMs?: number;
}

export interface HttpResponse {
	/** Final URL after redirects, when the transport reports it. */
	url: string;
	status: number;
	ok: boolean;
	headers: Record<string, string>;
	body: string;
	durationMs: number;
	bytes: number;
}

export type HttpClient = (request: HttpRequestInit) => Promise<HttpResponse>;

/** Binary payload (PDF) as base64 — the host transport cannot return bytes to a plugin. */
export interface HttpBinaryResponse {
	url: string;
	status: number;
	ok: boolean;
	headers: Record<string, string>;
	base64: string;
	bytes: number;
}

export type BinaryFetch = (request: HttpRequestInit) => Promise<HttpBinaryResponse>;

export class HttpTransportError extends Error {
	constructor(
		message: string,
		readonly reason: string,
	) {
		super(message);
		this.name = "HttpTransportError";
	}
}

export function headerValue(headers: Record<string, string>, name: string): string {
	const wanted = name.toLowerCase();
	for (const [key, value] of Object.entries(headers)) {
		if (key.toLowerCase() === wanted) return value;
	}
	return "";
}

/** `text/html; charset=utf-8` → `text/html`. */
export function mimeType(headers: Record<string, string>): string {
	const raw = headerValue(headers, "content-type");
	return raw.split(";")[0]?.trim().toLowerCase() ?? "";
}

export function charsetOf(headers: Record<string, string>): string | null {
	const raw = headerValue(headers, "content-type");
	const match = /charset\s*=\s*"?([\w-]+)"?/i.exec(raw);
	return match?.[1]?.toLowerCase() ?? null;
}

export function isHtmlContentType(type: string): boolean {
	return type === "text/html" || type === "application/xhtml+xml" || type === "";
}

export function isMarkdownContentType(type: string): boolean {
	return type === "text/markdown" || type === "text/x-markdown";
}

export function isTextContentType(type: string): boolean {
	return type.startsWith("text/") || type === "application/json" || type === "application/xml" || type === "text/xml";
}

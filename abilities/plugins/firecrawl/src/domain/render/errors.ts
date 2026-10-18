/**
 * Render-time errors.
 *
 * The crawl console and the tools need a stable code, not a string match, so
 * both engines raise the same shape: what failed, and whether retrying on the
 * other engine could help.
 */

export type RenderErrorCode =
	| "transport"
	| "http-status"
	| "unsupported-content"
	| "empty-content"
	| "browser-unavailable"
	| "browser-failed"
	| "pdf-unreadable";

export class ScrapeError extends Error {
	constructor(
		message: string,
		readonly code: RenderErrorCode,
		readonly status = 0,
	) {
		super(message);
		this.name = "ScrapeError";
	}
}

export class BrowserUnavailableError extends ScrapeError {
	constructor(message: string) {
		super(message, "browser-unavailable");
		this.name = "BrowserUnavailableError";
	}
}

/** True when the failure is about the page, not about our ability to look at it. */
export function isRetryableOnBrowser(error: unknown): boolean {
	return error instanceof ScrapeError && (error.code === "empty-content" || error.code === "unsupported-content");
}

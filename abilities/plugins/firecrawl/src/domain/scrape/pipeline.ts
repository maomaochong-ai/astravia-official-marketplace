/**
 * Scrape pipeline: one URL → clean Markdown + metadata + links.
 *
 * Engine list mirrors firecrawl's fallback model (`buildFallbackList`), reduced
 * to the engines a browser plugin can honestly run:
 *
 *   fetch     – real HTML, readability-scored main content (the primary engine)
 *   raw-html  – same bytes, whole-body conversion, used when scoring produces
 *               nothing usable (JS-heavy pages render as a shell)
 *   markdown  – the server already sent Markdown; pass it through
 *   text      – plain text/JSON; wrapped, never parsed as HTML
 *
 * Every failure records why, so the console can show the retry instead of
 * silently returning an empty page.
 */

import { HttpTransportError, headerValue, isHtmlContentType, isMarkdownContentType, isTextContentType, mimeType } from "./http";
import type { HttpClient } from "./http";
import { cleanDocument, extractLinks, extractMetadata, parseHtml } from "../html/document";
import type { ExtractedLink, PageMetadata } from "../html/document";
import { extractMainContent } from "../html/main-content";
import { htmlToMarkdown, tidyMarkdown } from "../html/markdown";
import { scanForInjection } from "../html/injection";
import type { ContentWarning } from "../html/injection";

export type EngineName = "fetch" | "raw-html" | "markdown" | "text";

export const DEFAULT_USER_AGENT =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 FirecrawlPlugin/0.1";

export interface ScrapeOptions {
	onlyMainContent?: boolean;
	includeLinks?: boolean;
	timeoutMs?: number;
	userAgent?: string;
	headers?: Record<string, string>;
}

export interface ScrapeResult {
	url: string;
	finalUrl: string;
	status: number;
	engine: EngineName;
	attemptedEngines: EngineName[];
	fallbackReason: string | null;
	title: string;
	metadata: PageMetadata;
	markdown: string;
	links: ExtractedLink[];
	bytes: number;
	charCount: number;
	durationMs: number;
	warnings: ContentWarning[];
}

export class ScrapeError extends Error {
	constructor(
		message: string,
		readonly code: "transport" | "http-status" | "unsupported-content" | "empty-content",
		readonly status = 0,
	) {
		super(message);
		this.name = "ScrapeError";
	}
}

/** Below this, the readability engine is considered to have failed. */
const MIN_ENGINE_CHARS = 200;

export async function scrapePage(
	client: HttpClient,
	url: string,
	options: ScrapeOptions = {},
): Promise<ScrapeResult> {
	const startedAt = Date.now();
	let response;
	try {
		response = await client({
			url,
			timeoutMs: options.timeoutMs ?? 30_000,
			headers: {
				"user-agent": options.userAgent ?? DEFAULT_USER_AGENT,
				accept: "text/html,application/xhtml+xml,text/markdown;q=0.9,text/plain;q=0.8,*/*;q=0.5",
				"accept-language": "en-US,en;q=0.9",
				...options.headers,
			},
		});
	} catch (error) {
		const reason = error instanceof HttpTransportError ? error.reason : "transport-failed";
		throw new ScrapeError(
			`Transport failed (${reason}): ${error instanceof Error ? error.message : String(error)}`,
			"transport",
		);
	}

	if (response.status >= 400) {
		throw new ScrapeError(
			`HTTP ${response.status} from ${response.url || url}${response.status === 429 ? " — rate limited, retry later or lower concurrency" : ""}`,
			"http-status",
			response.status,
		);
	}

	const type = mimeType(response.headers);
	const html = isHtmlContentType(type);
	if (!html && !isMarkdownContentType(type) && !isTextContentType(type)) {
		throw new ScrapeError(
			`Unsupported content type "${type || headerValue(response.headers, "content-type") || "unknown"}" — the crawler only reads HTML, Markdown and plain text`,
			"unsupported-content",
			response.status,
		);
	}

	const attempted: EngineName[] = [];
	let fallbackReason: string | null = null;
	let engine: EngineName;
	let markdown = "";
	let title = "";
	let metadata: PageMetadata = { title: "", description: "", canonical: response.url || url, lang: "", siteName: "", image: "" };
	let links: ExtractedLink[] = [];

	if (isMarkdownContentType(type)) {
		engine = "markdown";
		attempted.push(engine);
		markdown = tidyMarkdown(response.body);
	} else if (isTextContentType(type) && !html) {
		engine = "text";
		attempted.push(engine);
		markdown = tidyMarkdown(response.body);
	} else {
		const original = parseHtml(response.body, response.url || url);
		metadata = extractMetadata(original, response.url || url);
		title = metadata.title;
		if (options.includeLinks !== false) links = extractLinks(original, response.url || url);

		engine = "fetch";
		attempted.push(engine);
		if (options.onlyMainContent !== false) {
			const scored = extractMainContent(original.cloneNode(true) as Document);
			markdown = htmlToMarkdown(scored.html);
			if (!scored.scored) fallbackReason = "Readability scored no main content; kept the structural <article>/<main> subtree";
		} else {
			const loose = original.cloneNode(true) as Document;
			cleanDocument(loose, { chrome: true });
			markdown = htmlToMarkdown(loose.body?.innerHTML ?? "");
		}

		if (markdown.trim().length < MIN_ENGINE_CHARS) {
			const raw = parseHtml(response.body, response.url || url);
			cleanDocument(raw, { chrome: true });
			const rawMarkdown = htmlToMarkdown(raw.body?.innerHTML ?? "");
			if (rawMarkdown.trim().length > markdown.trim().length) {
				fallbackReason = `Engine "fetch" produced ${markdown.trim().length} chars; fell back to "raw-html"`;
				engine = "raw-html";
				attempted.push(engine);
				markdown = rawMarkdown;
			}
		}
	}

	if (!markdown.trim()) {
		throw new ScrapeError("Page produced no readable text (empty document or fully client-rendered)", "empty-content", response.status);
	}

	return {
		url,
		finalUrl: response.url || url,
		status: response.status,
		engine,
		attemptedEngines: attempted,
		fallbackReason,
		title: title || metadata.title,
		metadata,
		markdown,
		links,
		bytes: response.bytes,
		charCount: markdown.length,
		durationMs: Date.now() - startedAt,
		warnings: scanForInjection(markdown),
	};
}

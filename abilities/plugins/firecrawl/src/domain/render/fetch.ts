/**
 * Static engine: the bytes the server sent, parsed and cleaned.
 *
 * Fast, structured, and blind to JavaScript. `auto` rendering escalates from
 * here when the result is a shell, which is why the shell check lives here: this
 * engine is the only one that can tell "the page is empty" from "the page needs
 * a browser".
 */

import {
	HttpTransportError,
	headerValue,
	isHtmlContentType,
	isMarkdownContentType,
	isTextContentType,
	mimeType,
} from "../scrape/http";
import type { HttpClient } from "../scrape/http";
import { cleanDocument, extractLinks, extractMetadata, parseHtml } from "../html/document";
import type { ExtractedLink, PageMetadata } from "../html/document";
import { extractMainContent } from "../html/main-content";
import { htmlToMarkdown, tidyMarkdown } from "../html/markdown";
import { applyTagFilters, domText } from "../html/tags";
import { scanForInjection } from "../html/injection";
import { profileElements, profileText } from "../html/elements";
import type { ElementProfile } from "../html/elements";
import type { ContentWarning } from "../html/injection";
import { ScrapeError } from "./errors";
import type { RenderEngineName, RenderedPage } from "./types";

export const DEFAULT_USER_AGENT =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 FirecrawlPlugin/0.2";

export interface FetchRenderOptions {
	onlyMainContent?: boolean;
	includeLinks?: boolean;
	timeoutMs?: number;
	userAgent?: string;
	headers?: Record<string, string>;
	includeTags?: readonly string[];
	excludeTags?: readonly string[];
	/** Drop `data:` image payloads from Markdown (firecrawl defaults this to true). */
	removeBase64Images?: boolean;
}

/** Below this, the readability engine is considered to have failed. */
const MIN_ENGINE_CHARS = 200;

export interface FetchRender extends RenderedPage {
	warnings: ContentWarning[];
	/** Set when the page looks like it needs JavaScript to render. */
	looksClientRendered: boolean;
}

export async function renderWithFetch(
	client: HttpClient,
	url: string,
	options: FetchRenderOptions = {},
): Promise<FetchRender> {
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
			`Unsupported content type "${type || headerValue(response.headers, "content-type") || "unknown"}"`,
			"unsupported-content",
			response.status,
		);
	}

	const attempts: RenderEngineName[] = [];
	const notes: string[] = [];
	let fallbackReason: string | null = null;
	let engine: RenderEngineName;
	let markdown = "";
	let text = "";
	let cleanedHtml = "";
	let title = "";
	let metadata: PageMetadata = {
		title: "",
		description: "",
		canonical: response.url || url,
		lang: "",
		siteName: "",
		image: "",
	};
	let links: ExtractedLink[] = [];
	let looksClientRendered = false;
	let elements: ElementProfile | undefined;

	if (isMarkdownContentType(type)) {
		engine = "markdown";
		attempts.push(engine);
		markdown = tidyMarkdown(response.body);
		text = markdown;
		elements = profileText(markdown);
	} else if (isTextContentType(type) && !html) {
		engine = "text";
		attempts.push(engine);
		markdown = tidyMarkdown(response.body);
		text = markdown;
		elements = profileText(markdown);
	} else {
		const original = parseHtml(response.body, response.url || url);
		metadata = extractMetadata(original, response.url || url);
		title = metadata.title;
		if (options.includeLinks !== false) links = extractLinks(original, response.url || url);

		const filtered = original.cloneNode(true) as Document;
		if ((options.includeTags?.length ?? 0) > 0 || (options.excludeTags?.length ?? 0) > 0) {
			const report = applyTagFilters(filtered, options.includeTags ?? [], options.excludeTags ?? []);
			if (report.ignored.length > 0) notes.push(`Tag selectors matched nothing or were invalid: ${report.ignored.join(", ")}`);
		}

		engine = "fetch";
		attempts.push(engine);
		if (options.onlyMainContent !== false) {
			const scored = extractMainContent(filtered.cloneNode(true) as Document);
			cleanedHtml = scored.html;
			markdown = htmlToMarkdown(scored.html);
			if (!scored.scored) fallbackReason = "Readability scored no main content; kept the structural <article>/<main> subtree";
		} else {
			const loose = filtered.cloneNode(true) as Document;
			cleanDocument(loose, { chrome: true });
			cleanedHtml = loose.body?.innerHTML ?? "";
			markdown = htmlToMarkdown(cleanedHtml);
		}
		text = domText(parseHtml(cleanedHtml, response.url || url).body);

		if (markdown.trim().length < MIN_ENGINE_CHARS) {
			const raw = filtered.cloneNode(true) as Document;
			cleanDocument(raw, { chrome: true });
			const rawMarkdown = htmlToMarkdown(raw.body?.innerHTML ?? "");
			if (rawMarkdown.trim().length > markdown.trim().length) {
				fallbackReason = `Engine "fetch" produced ${markdown.trim().length} chars; fell back to "raw-html"`;
				engine = "raw-html";
				attempts.push(engine);
				markdown = rawMarkdown;
				cleanedHtml = raw.body?.innerHTML ?? "";
				text = domText(raw.body);
			}
		}

		// A shell is a document whose scripts outweigh any text we could read.
		const scriptBytes = (response.body.match(/<script\b/gi) ?? []).length;
		const bodyText = (text || markdown).trim();
		looksClientRendered =
			bodyText.length < 320 &&
			scriptBytes > 0 &&
			/<(div|main|section)[^>]+(id|class)="[^"]*(\broot\b|\bapp\b|__next|__nuxt|svelte|astro)/i.test(response.body);
		if (looksClientRendered) notes.push("The HTML shipped by the server looks like a JavaScript shell");
		elements = profileElements(original, markdown.trim().length);
	}

	if (options.removeBase64Images !== false) markdown = stripDataImages(markdown);

	if (!markdown.trim() && !looksClientRendered) {
		throw new ScrapeError("Page produced no readable text (empty document)", "empty-content", response.status);
	}

	return {
		requestedUrl: url,
		finalUrl: response.url || url,
		status: response.status,
		engine,
		attempts,
		fallbackReason,
		title: title || metadata.title,
		metadata,
		markdown,
		text: text || markdown,
		html: cleanedHtml,
		rawHtml: response.body,
		links,
		screenshotDataUrl: null,
		bytes: response.bytes,
		durationMs: Date.now() - startedAt,
		notes,
		warnings: scanForInjection(markdown),
		looksClientRendered,
		elements,
	};
}

function stripDataImages(markdown: string): string {
	return markdown.replace(/!\[([^\]]*)\]\(data:[^)]*\)/g, (_match, alt: string) => (alt ? `_${alt}_` : ""));
}

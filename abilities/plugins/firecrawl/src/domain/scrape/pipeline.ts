/**
 * Scrape orchestration: one URL → whichever engine can actually see it.
 *
 * Engine order mirrors what firecrawl promises and what a sandboxed plugin can
 * deliver:
 *
 *   fetch    – real HTML, readability-scored main content (structured Markdown)
 *   browser  – host Chromium, so client-rendered apps and `actions`/`waitFor`
 *              behave like they do on firecrawl's Playwright engine
 *
 * `render: "auto"` starts on fetch and escalates when the payload is a shell;
 * the fetch result is still kept for metadata and links, because the browser API
 * exposes rendered text but not the DOM.
 */

import type { BinaryFetch, HttpClient } from "../scrape/http";
import { ScrapeError } from "../render/errors";

export { ScrapeError } from "../render/errors";
import { renderWithFetch } from "../render/fetch";
import type { FetchRender } from "../render/fetch";
import { renderWithBrowser } from "../render/browser";
import { renderPdf } from "../render/pdf";
import { isPdfUrl } from "../url";
import { JS_SHELL_MIN_CHARS } from "../render/types";
import type {
	BrowserAction,
	BrowserPortFactory,
	OutputFormat,
	RenderMode,
	RenderedPage,
} from "../render/types";
import type { ContentWarning } from "../html/injection";

export interface ScrapeOptions {
	/** auto (default) escalates to the browser when the page needs JavaScript. */
	render?: RenderMode;
	/** Extra outputs besides Markdown. Markdown is always produced. */
	formats?: readonly OutputFormat[];
	onlyMainContent?: boolean;
	includeLinks?: boolean;
	timeoutMs?: number;
	userAgent?: string;
	headers?: Record<string, string>;
	includeTags?: readonly string[];
	excludeTags?: readonly string[];
	removeBase64Images?: boolean;
	/** Milliseconds to wait after navigation (browser engine). */
	waitForMs?: number;
	/** Interactions run before the page is read (browser engine). */
	actions?: readonly BrowserAction[];
	/** Capture a screenshot even when `screenshot` is not in formats. */
	screenshot?: "none" | "viewport" | "fullPage";
}

export interface ScrapeDeps {
	/** Absent when the host browser is not configured; auto rendering then degrades to fetch. */
	browser?: BrowserPortFactory;
	/** Base64 transport, needed for PDFs. */
	binary?: BinaryFetch;
}

export interface ScrapeResult extends RenderedPage {
	warnings: ContentWarning[];
	requestedFormats: OutputFormat[];
	/** `html`, `rawHtml`, `links`, screenshots requested by the caller. */
	outputs: Partial<Record<OutputFormat, string>>;
	/** True when a browser was needed and worked. */
	rendered: boolean;
}

export async function scrapePage(
	client: HttpClient,
	url: string,
	options: ScrapeOptions = {},
	deps: ScrapeDeps = {},
): Promise<ScrapeResult> {
	const startedAt = Date.now();
	const formats = options.formats ?? ["markdown"];
	const wantsScreenshot = formats.includes("screenshot") || formats.includes("screenshot@fullPage") || options.screenshot === "fullPage";
	const mode = options.render ?? "auto";

	const notes: string[] = [];
	let page: RenderedPage;
	let warnings: ContentWarning[] = [];
	let rendered = false;

	const fetchOptions = {
		onlyMainContent: options.onlyMainContent,
		includeLinks: options.includeLinks,
		timeoutMs: options.timeoutMs,
		userAgent: options.userAgent,
		headers: options.headers,
		includeTags: options.includeTags,
		excludeTags: options.excludeTags,
		removeBase64Images: options.removeBase64Images,
	};

	if (isPdfUrl(url)) {
		// A PDF is a document, not a DOM: neither engine applies.
		page = await renderPdf(deps.binary, url, { timeoutMs: options.timeoutMs });
		return finish(page, url, startedAt, formats, notes, warnings, rendered);
	}

	if (mode === "browser") {
		page = await browserOrThrow(deps, url, options, wantsScreenshot);
		rendered = true;
	} else {
		let staticPage: FetchRender;
		try {
			staticPage = await renderWithFetch(client, url, fetchOptions);
		} catch (error) {
			// A browser can still read pages the fetcher refuses (PDF viewers, SPA-only sites).
			if (error instanceof ScrapeError && error.code === "unsupported-content" && /pdf/i.test(error.message)) {
				notes.push(`Server returned a PDF; parsed it as a document instead of HTML`);
				page = await renderPdf(deps.binary, url, { timeoutMs: options.timeoutMs });
				return finish(page, url, startedAt, formats, notes, warnings, rendered);
			}
			if (mode === "auto" && deps.browser && error instanceof ScrapeError && error.code === "unsupported-content") {
				notes.push(`Static engine refused the payload (${error.message}); retried in the browser`);
				page = await browserOrThrow(deps, url, options, wantsScreenshot);
				rendered = true;
				warnings = [];
				return finish(page, url, startedAt, formats, notes, warnings, rendered);
			}
			throw error;
		}
		warnings = staticPage.warnings;
		page = staticPage;
		notes.push(...staticPage.notes);

		const shell = staticPage.looksClientRendered || staticPage.markdown.trim().length < JS_SHELL_MIN_CHARS;
		if (mode === "auto" && deps.browser && (shell || wantsScreenshot)) {
			const reason = wantsScreenshot && !shell
				? "screenshot format requested"
				: `static engine returned ${staticPage.markdown.trim().length} chars`;
			try {
				const browserPage = await browserOrThrow(deps, url, options, wantsScreenshot);
				rendered = true;
				notes.push(`Rendered in the browser (${reason})`);
				page = mergeRender(staticPage, browserPage, notes);
			} catch (error) {
				notes.push(
					`Browser rendering skipped (${reason}): ${error instanceof Error ? error.message : String(error)} — returning the server HTML`,
				);
			}
		}
	}

	if (!page.markdown.trim()) {
		// The notes say why the page is empty — an agent needs that to choose a retry.
		const hint = notes.length > 0 ? ` (${notes.join("; ")})` : "";
		throw new ScrapeError(
			`Page produced no readable text (empty document or fully client-rendered)${hint}`,
			"empty-content",
			page.status,
		);
	}
	return finish(page, url, startedAt, formats, notes, warnings, rendered);
}

async function browserOrThrow(
	deps: ScrapeDeps,
	url: string,
	options: ScrapeOptions,
	wantsScreenshot: boolean,
): Promise<RenderedPage> {
	if (!deps.browser) {
		throw new ScrapeError(
			"Browser rendering was requested but the host browser is not available to this plugin",
			"browser-unavailable",
		);
	}
	return renderWithBrowser(deps.browser, {
		url,
		waitForMs: options.waitForMs,
		actions: options.actions,
		timeoutMs: options.timeoutMs ?? 60_000,
		includeLinks: options.includeLinks,
		screenshot: wantsScreenshot ? "fullPage" : "none",
	});
}

/**
 * Keeps the structured half of the fetch result and the visible half of the
 * rendered one: metadata and links from HTML, prose from the browser.
 */
function mergeRender(staticPage: RenderedPage, browserPage: RenderedPage, notes: string[]): RenderedPage {
	const renderedIsRicher = browserPage.markdown.trim().length > staticPage.markdown.trim().length * 1.2;
	const markdown = renderedIsRicher ? browserPage.markdown : staticPage.markdown;
	if (!renderedIsRicher) notes.push("Rendered text was not richer than the server HTML; kept the structured Markdown");
	const links = staticPage.links.length >= browserPage.links.length ? staticPage.links : browserPage.links;
	return {
		...browserPage,
		markdown,
		text: browserPage.text || staticPage.text,
		html: staticPage.html,
		rawHtml: staticPage.rawHtml,
		metadata: {
			...browserPage.metadata,
			description: staticPage.metadata.description,
			canonical: staticPage.metadata.canonical || browserPage.metadata.canonical,
			lang: staticPage.metadata.lang,
			siteName: staticPage.metadata.siteName,
			image: staticPage.metadata.image,
		},
		title: browserPage.title || staticPage.title,
		links,
		bytes: staticPage.bytes,
		durationMs: staticPage.durationMs + browserPage.durationMs,
		notes: [...staticPage.notes, ...browserPage.notes],
		attempts: [...staticPage.attempts, ...browserPage.attempts],
		fallbackReason: staticPage.fallbackReason ?? browserPage.fallbackReason,
	};
}

function finish(
	page: RenderedPage,
	url: string,
	startedAt: number,
	formats: readonly OutputFormat[],
	notes: string[],
	warnings: ContentWarning[],
	rendered: boolean,
): ScrapeResult {
	const outputs: ScrapeResult["outputs"] = {};
	if (formats.includes("html")) outputs.html = page.html || page.markdown;
	if (formats.includes("rawHtml")) outputs.rawHtml = page.rawHtml || page.text;
	if (formats.includes("links")) {
		outputs.links = page.links.length > 0 ? page.links.map((link) => link.url).join("\n") : "";
	}
	if (page.screenshotDataUrl) outputs.screenshot = page.screenshotDataUrl;
	if (formats.includes("media") && page.elements) {
		// Media URLs are data, not text: JSON keeps kind/label/manifest per entry.
		outputs.media = JSON.stringify({ media: page.elements.media, streamed: page.elements.streamed }, null, 2);
		if (page.elements.streamed > 0) {
			notes.push(
				`${page.elements.streamed} player(s) expose a blob: Media Source stream only — that content is not a file this plugin can download`,
			);
		}
	}

	return {
		...page,
		requestedUrl: url,
		warnings,
		requestedFormats: [...formats],
		outputs,
		rendered,
		durationMs: Date.now() - startedAt,
		notes: dedupe(notes),
	};
}

function dedupe(values: readonly string[]): string[] {
	return Array.from(new Set(values.filter(Boolean)));
}

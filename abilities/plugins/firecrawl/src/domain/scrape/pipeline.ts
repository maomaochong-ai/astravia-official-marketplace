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
 *
 * A stored copy of a page can be reused (`maxAgeMs`) and the difference against
 * that copy can be reported (`changeTracking`). Both live here because the cache
 * entry has to be read *before* the fetch and written *after* it.
 */

import type { BinaryFetch, HttpClient } from "../scrape/http";
import { ScrapeError } from "../render/errors";

export { ScrapeError } from "../render/errors";
import { renderWithFetch } from "../render/fetch";
import { DEFAULT_USER_AGENT } from "../render/fetch";
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
import { extractAttributes } from "../html/attributes";
import type { AttributeSelector } from "../html/attributes";
import type { CachedPage, PageCache } from "./cache";
import { cacheAgeSeconds, cacheKey, isFresh } from "./cache";
import { describeChanges } from "./change";
import { toBase64 } from "./base64";

export interface ScrapeOptions {
	/** auto (default) escalates to the browser when the page needs JavaScript. */
	render?: RenderMode;
	/** Extra outputs besides Markdown. Markdown is always produced. */
	formats?: readonly OutputFormat[];
	onlyMainContent?: boolean;
	includeLinks?: boolean;
	timeoutMs?: number;
	userAgent?: string;
	/** Sent by the HTTP fetch; the browser engine renders that snapshot. */
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
	/** Reuse a stored copy younger than this, in milliseconds. 0 disables reuse. */
	/** Selectors for the `attributes` format. */
	attributeSelectors?: readonly AttributeSelector[];
	maxAgeMs?: number;
	/** Store the result for later reuse (default true when a cache is present). */
	storeInCache?: boolean;
	/** Report what changed against the stored copy of the same URL. */
	changeTracking?: boolean;
	/** Persistent browser profile id, so a logged-in session can be reused. */
	profileId?: string;
}

export interface ScrapeDeps {
	/** Absent when the host browser is not configured; auto rendering then degrades to fetch. */
	browser?: BrowserPortFactory;
	/** Base64 transport, needed for PDFs. */
	binary?: BinaryFetch;
	/** Plugin-private cache; absent in tests and when storage is not permitted. */
	cache?: PageCache;
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
	const wantsChangeTracking = options.changeTracking === true || formats.includes("changeTracking");
	const wantsScreenshot = formats.includes("screenshot") || formats.includes("screenshot@fullPage") || options.screenshot === "fullPage";
	const mode = options.render ?? "auto";

	const notes: string[] = [];
	let page: RenderedPage;
	let warnings: ContentWarning[] = [];
	let rendered = false;

	const key = deps.cache
		? cacheKey({
				url,
				render: mode,
				onlyMainContent: options.onlyMainContent,
				formats,
				includeTags: options.includeTags,
				excludeTags: options.excludeTags,
				profileId: options.profileId,
			})
		: null;
	const previous = key ? await readCache(deps.cache, key, url) : null;

	const finalize = async (input: ScrapeResult): Promise<ScrapeResult> => {
		const result = withAttributes(input, url, options, formats, notes);
		const tracked = wantsChangeTracking ? withChangeTracking(result, previous) : result;
		if (key && deps.cache && options.storeInCache !== false) {
			await writeCache(deps.cache, key, tracked, url);
		}
		return tracked;
	};

	if (previous && options.maxAgeMs !== undefined && isFresh(previous, options.maxAgeMs)) {
		const age = cacheAgeSeconds(previous);
		notes.push(
			`Served from the plugin cache (${age}s old, maxAge ${Math.round(options.maxAgeMs / 1000)}s); no request was made`,
		);
		return finalize(finish(fromCache(previous, url), url, startedAt, formats, notes, [], false));
	}

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
		return finalize(finish(page, url, startedAt, formats, notes, warnings, rendered));
	}

	if (mode === "browser") {
		page = await browserOrThrow(client, deps, url, options, wantsScreenshot, notes);
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
				return finalize(finish(page, url, startedAt, formats, notes, warnings, rendered));
			}
			if (mode === "auto" && deps.browser && error instanceof ScrapeError && error.code === "unsupported-content") {
				notes.push(`Static engine refused the payload (${error.message}); retried in the browser`);
				page = await browserOrThrow(client, deps, url, options, wantsScreenshot, notes);
				rendered = true;
				warnings = [];
				return finalize(finish(page, url, startedAt, formats, notes, warnings, rendered));
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
				const browserPage = await browserOrThrow(client, deps, url, options, wantsScreenshot, notes);
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
	return finalize(finish(page, url, startedAt, formats, notes, warnings, rendered));
}

async function readCache(cache: PageCache | undefined, key: string, url: string): Promise<CachedPage | null> {
	if (!cache) return null;
	try {
		const entry = await cache.read(key);
		// The key is a hash; the URL inside is the proof it belongs to this page.
		return entry && entry.url === url ? entry : null;
	} catch {
		return null;
	}
}

async function writeCache(cache: PageCache, key: string, result: ScrapeResult, url: string): Promise<void> {
	try {
		await cache.write(key, {
			url,
			finalUrl: result.finalUrl,
			status: result.status,
			engine: result.engine,
			title: result.title,
			metadata: result.metadata,
			markdown: result.markdown,
			text: result.text,
			html: result.html,
			rawHtml: result.rawHtml,
			links: result.links,
			media: result.elements?.media ?? [],
			bytes: result.bytes,
			elements: result.elements,
			storedAt: Date.now(),
		});
	} catch {
		// The cache is best-effort: a rejected write must never fail a scrape.
	}
}

function fromCache(entry: CachedPage, url: string): RenderedPage {
	return {
		requestedUrl: url,
		finalUrl: entry.finalUrl,
		status: entry.status,
		engine: entry.engine,
		attempts: [],
		fallbackReason: null,
		title: entry.title,
		metadata: entry.metadata,
		markdown: entry.markdown,
		text: entry.text,
		html: entry.html,
		rawHtml: entry.rawHtml,
		links: entry.links,
		screenshotDataUrl: null,
		bytes: entry.bytes,
		durationMs: 0,
		notes: [],
		elements: entry.elements,
	};
}

function withChangeTracking(result: ScrapeResult, previous: CachedPage | null): ScrapeResult {
	const report = describeChanges(
		previous ? previous.markdown : null,
		previous ? previous.storedAt : null,
		result.markdown,
	);
	const outputs: ScrapeResult["outputs"] = { ...result.outputs, changeTracking: JSON.stringify(report, null, 2) };
	const notes = [...result.notes];
	if (report.changeStatus === "new") notes.push("changeTracking: this is the first stored copy of the URL");
	else if (report.changeStatus === "changed") {
		notes.push(`changeTracking: ${report.addedLines} line(s) added, ${report.removedLines} removed since the stored copy`);
	}
	return { ...result, outputs, requestedFormats: includeFormat(result.requestedFormats, "changeTracking"), notes: dedupe(notes) };
}

async function browserOrThrow(
	client: HttpClient,
	deps: ScrapeDeps,
	url: string,
	options: ScrapeOptions,
	wantsScreenshot: boolean,
	notes: string[],
): Promise<RenderedPage> {
	if (!deps.browser) {
		throw new ScrapeError(
			"Browser rendering was requested but the host browser is not available to this plugin",
			"browser-unavailable",
		);
	}
	const prefetchedHtml = options.headers ? await prefetchWithHeaders(client, url, options, notes) : undefined;
	return renderWithBrowser(deps.browser, {
		url,
		waitForMs: options.waitForMs,
		actions: options.actions,
		timeoutMs: options.timeoutMs ?? 60_000,
		includeLinks: options.includeLinks,
		screenshot: wantsScreenshot ? "fullPage" : "none",
		profileId: options.profileId,
		prefetchedHtml,
	});
}

/**
 * The host browser API cannot set request headers, so a header-gated page is
 * fetched here and rendered from that snapshot. Cookies are not replayed and
 * subresource requests still originate from the snapshot, so this is a fallback,
 * not an equivalent of the upstream stealth proxy.
 */
async function prefetchWithHeaders(
	client: HttpClient,
	url: string,
	options: ScrapeOptions,
	notes: string[],
): Promise<string | undefined> {
	const headers = options.headers ?? {};
	if (Object.keys(headers).length === 0) return undefined;
	try {
		const response = await client({
			url,
			timeoutMs: options.timeoutMs ?? 30_000,
			headers: { "user-agent": options.userAgent ?? DEFAULT_USER_AGENT, ...headers },
		});
		if (!response.ok || response.body.length === 0) {
			notes.push(`Custom headers were rejected by the server (HTTP ${response.status}); the browser navigated without them`);
			return undefined;
		}
		notes.push("Custom headers were sent by the HTTP fetch; the browser rendered that snapshot, so cookies and subresource requests do not carry them");
		return response.body;
	} catch (error) {
		notes.push(`Custom headers could not be sent: ${error instanceof Error ? error.message : String(error)}`);
		return undefined;
	}
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
	if (formats.includes("rawBase64")) outputs.rawBase64 = toBase64(page.rawHtml || page.text || page.markdown);
	if (formats.includes("links")) {
		outputs.links = page.links.length > 0 ? page.links.map((link) => link.url).join("\n") : "";
	}
	if (page.screenshotDataUrl) outputs.screenshot = page.screenshotDataUrl;
	if (formats.includes("images")) {
		const images = (page.elements?.media ?? [])
			.filter((entry) => entry.kind === "image")
			.map((entry) => ({ url: entry.url, alt: entry.label ?? "" }));
		outputs.images = JSON.stringify(images, null, 2);
	}
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

function includeFormat(formats: readonly OutputFormat[], format: OutputFormat): OutputFormat[] {
	return formats.includes(format) ? [...formats] : [...formats, format];
}

/**
 * The `attributes` format reads the served HTML, not the browser text, so it is
 * attached here: `finalize` sees whichever engine produced the page.
 */
function withAttributes(
	result: ScrapeResult,
	url: string,
	options: ScrapeOptions,
	formats: readonly OutputFormat[],
	notes: string[],
): ScrapeResult {
	if (!formats.includes("attributes")) return result;
	const selectors: readonly AttributeSelector[] = options.attributeSelectors ?? [];
	if (selectors.length === 0) {
		notes.push("The attributes format needs at least one selector, e.g. [\"a@href\", \"h2\"].");
		return { ...result, outputs: { ...result.outputs, attributes: "[]" } };
	}
	const html = result.html || result.rawHtml || "";
	if (html.trim().length === 0) {
		notes.push("No HTML was available to read attributes from on this page.");
		return { ...result, outputs: { ...result.outputs, attributes: "[]" } };
	}
	const values = extractAttributes(html, url, selectors);
	return { ...result, outputs: { ...result.outputs, attributes: JSON.stringify(values, null, 2) } };
}

function dedupe(values: readonly string[]): string[] {
	return Array.from(new Set(values.filter(Boolean)));
}

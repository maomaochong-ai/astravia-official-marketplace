/**
 * Rendering contracts.
 *
 * A page can be produced by two engines: the plain HTTP fetch (structured but
 * blind to JavaScript) and the host browser (sees the rendered DOM but only
 * exposes text and screenshots). Both funnel into `RenderedPage`, so the scrape
 * pipeline, the crawler and the tools never branch on where the bytes came from.
 */

import type { ExtractedLink, PageMetadata } from "../html/document";
import type { ElementProfile } from "../html/elements";

export type RenderMode = "auto" | "static" | "browser";

/** Mirrors firecrawl's document formats that this plugin can honestly produce. */
export type OutputFormat =
	| "markdown"
	| "html"
	| "rawHtml"
	| "links"
	| "screenshot"
	| "screenshot@fullPage"
	| "json"
	| "extract"
	| "summary"
	| "images"
	/** Base64 of the received body, so callers can archive the raw bytes. */
	| "rawBase64"
	/** Diff against the previous stored copy of the same URL. */
	| "changeTracking"
	/** Plugin extension: page structure plus every image / video / audio URL found. */
	| "media"
	/** Values of chosen attributes on matching elements. */
	| "attributes";

export const ALL_FORMATS: readonly OutputFormat[] = [
	"markdown",
	"html",
	"rawHtml",
	"links",
	"screenshot",
	"screenshot@fullPage",
	"json",
	"extract",
	"summary",
	"images",
	"rawBase64",
	"changeTracking",
	"media",
	"attributes",
];

/** Same action vocabulary as firecrawl's `actions[]`, restricted to what the host browser accepts. */
export type BrowserAction =
	| { type: "click"; target: string }
	| { type: "fill"; target: string; value: string }
	| { type: "type"; target: string; value: string }
	| { type: "select"; target: string; value: string }
	| { type: "check"; target: string; checked: boolean }
	| { type: "press"; key: string }
	| { type: "scroll"; direction: "up" | "down" | "left" | "right"; amount?: number }
	| { type: "wait"; milliseconds?: number; target?: string }
	| { type: "back" }
	| { type: "reload" };

export const ACTION_TYPES: readonly BrowserAction["type"][] = [
	"click",
	"fill",
	"type",
	"select",
	"check",
	"press",
	"scroll",
	"wait",
	"back",
	"reload",
];

/** One live browser page. Implemented by the host adapter; faked in tests. */
export interface BrowserPort {
	open(url: string, timeoutMs: number): Promise<{ url: string; title?: string }>;
	act(action: BrowserAction): Promise<void>;
	readText(): Promise<string>;
	/** Accessibility snapshot; used for link discovery on rendered pages. */
	snapshot(): Promise<string>;
	screenshot(fullPage: boolean): Promise<string>;
	close(): Promise<void>;
}

export interface BrowserOpenOptions {
	/** Persistent profile id; absent means an ephemeral session. */
	profileId?: string;
}

export type BrowserPortFactory = (options?: BrowserOpenOptions) => Promise<BrowserPort>;

export interface BrowserRenderOptions {
	url: string;
	/** Milliseconds to wait after navigation before reading the DOM. */
	waitForMs?: number;
	actions?: readonly BrowserAction[];
	timeoutMs: number;
	includeLinks?: boolean;
	screenshot?: "none" | "viewport" | "fullPage";
	/** Reuse a persistent browser profile so logins survive between calls. */
	profileId?: string;
	/**
	 * HTML already fetched with custom headers. The browser renders this snapshot
	 * through a `data:` URL instead of navigating to the origin, because the host
	 * browser API cannot set request headers.
	 */
	prefetchedHtml?: string;
}

export interface RenderedPage {
	requestedUrl: string;
	finalUrl: string;
	status: number;
	engine: RenderEngineName;
	/** Engines tried, in order. */
	attempts: RenderEngineName[];
	/** Why the pipeline moved on from the first engine, if it did. */
	fallbackReason: string | null;
	title: string;
	metadata: PageMetadata;
	markdown: string;
	/** Visible text with the DOM's own line breaks, before Markdown shaping. */
	text: string;
	/** Cleaned HTML (readability body when available). */
	html: string;
	/** Bytes as received, before cleaning. */
	rawHtml: string;
	links: ExtractedLink[];
	screenshotDataUrl: string | null;
	bytes: number;
	durationMs: number;
	/** Non-fatal observations worth surfacing to the caller. */
	notes: string[];
	/** Page structure; absent for engines that only see text (PDF, browser). */
	elements?: ElementProfile;
}

export type RenderEngineName = "fetch" | "raw-html" | "markdown" | "text" | "browser" | "pdf";

/** Engine that can answer "does this page need JavaScript?". */
export const JS_SHELL_MIN_CHARS = 320;

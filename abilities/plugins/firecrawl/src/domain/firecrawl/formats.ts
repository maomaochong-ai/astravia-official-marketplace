/**
 * Output formats: the connector vocabulary and how each entry becomes an
 * upstream `Formats` value.
 *
 * The contract is the v2 OpenAPI `Formats` schema — eighteen outputs, four of
 * which take a payload (`json`, `attributes`, `question`, `highlights`). Two
 * names below are local conveniences that upstream does not define:
 * `screenshot@fullPage` (shorthand for the screenshot object) and `media`
 * (audio + video). Both are documented as aliases so nobody mistakes them for
 * independent upstream formats.
 */

/** The upstream enum, kept for reference and drift checks. */
export const UPSTREAM_FORMAT_TYPES = [
	"markdown",
	"html",
	"rawHtml",
	"rawBase64",
	"links",
	"images",
	"screenshot",
	"summary",
	"json",
	"branding",
	"product",
	"menu",
	"attributes",
	"changeTracking",
	"audio",
	"video",
	"question",
	"highlights",
] as const;

/** Everything a caller may ask for, including the two aliases. */
export const FORMAT_OPTIONS = [
	"markdown",
	"html",
	"rawHtml",
	"links",
	"images",
	"screenshot",
	"screenshot@fullPage",
	"summary",
	"json",
	"branding",
	"product",
	"menu",
	"attributes",
	"changeTracking",
	"audio",
	"video",
	"media",
	"rawBase64",
] as const;

export type FormatOption = (typeof FORMAT_OPTIONS)[number];

/**
 * Formats offered at crawl scale, in the console's display order.
 *
 * A crawl produces one record per page, so every entry here has to survive being
 * multiplied by the page limit. That rules nothing out on capability — the list
 * mirrors the upstream per-page outputs — but `rawBase64` is exclusive upstream
 * and heavy per page, so selecting it pins the run to a couple of pages (see
 * `crawlJobBody`); `attributes` needs selectors and `json` can take a prompt, both
 * supplied from the console's format payload fields.
 */
export const CRAWL_FORMAT_OPTIONS = [
	"markdown",
	"links",
	"images",
	"video",
	"audio",
	"screenshot",
	"html",
	"rawHtml",
	"summary",
	"json",
	"attributes",
	"changeTracking",
	"rawBase64",
] as const;

export type CrawlFormatOption = (typeof CRAWL_FORMAT_OPTIONS)[number];

export const DEFAULT_CRAWL_FORMATS: CrawlFormatOption[] = ["markdown"];

/** The console can ask for the whole vocabulary; only `rawBase64` collapses it. */
export const MAX_CRAWL_FORMATS = CRAWL_FORMAT_OPTIONS.length;

/** `rawBase64` is a whole-page payload: upstream rejects it next to anything else. */
export function isExclusiveFormat(formats: readonly string[]): boolean {
	return formats.includes("rawBase64");
}

/** Pages worth crawling when the payload per page is the page itself. */
export const RAW_BASE64_PAGE_LIMIT = 2;

const MAX_FORMATS = 8;

function isFormatOption(value: string): value is FormatOption {
	return (FORMAT_OPTIONS as readonly string[]).includes(value);
}

export function isCrawlFormatOption(value: string): value is CrawlFormatOption {
	return (CRAWL_FORMAT_OPTIONS as readonly string[]).includes(value);
}

/**
 * Keeps the requested formats that exist, in the caller's order, without
 * duplicates. Anything unreadable falls back to Markdown rather than reaching
 * upstream as an invalid enum value.
 */
export function clampFormats(value: unknown, max = MAX_FORMATS): FormatOption[] {
	const source = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
	const kept: FormatOption[] = [];
	for (const entry of source) {
		if (typeof entry !== "string") continue;
		const name = entry.trim();
		if (!isFormatOption(name) || kept.includes(name)) continue;
		kept.push(name);
		if (kept.length >= max) break;
	}
	return kept.length > 0 ? kept : ["markdown"];
}

export function clampCrawlFormats(value: unknown, max = MAX_CRAWL_FORMATS): CrawlFormatOption[] {
	const source = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
	const kept: CrawlFormatOption[] = [];
	for (const entry of source) {
		if (typeof entry !== "string") continue;
		const name = entry.trim();
		// `media` was one combined chip before 0.4.2; expand it so a run saved in the
		// old shape still restores with both media outputs selected.
		const expanded = name === "media" ? ["video", "audio"] : [name];
		for (const item of expanded) {
			if (!isCrawlFormatOption(item) || kept.includes(item)) continue;
			kept.push(item);
			if (kept.length >= max) break;
		}
	}
	if (kept.includes("rawBase64")) return ["rawBase64"];
	// Markdown is the console's own preview, so a run that dropped it would look
	// empty even though it succeeded.
	if (!kept.includes("markdown")) kept.unshift("markdown");
	return kept.slice(0, max) as CrawlFormatOption[];
}

/** Payloads the object-shaped formats need; omitted entries fall back to plain strings. */
export interface FormatPayloads {
	prompt?: string;
	schema?: Record<string, unknown>;
	selectors?: Array<{ selector: string; attribute: string }>;
	question?: string;
	highlights?: string;
}

const MAX_SELECTORS = 20;

/**
 * Parses the console's selector field: `a@href, h2, .price@data-price`.
 *
 * The `@attribute` suffix is how the `attributes` format asks for something other
 * than the element's text, which is upstream's default. Newlines work as
 * separators too, because a long selector list reads better one per line.
 */
export function parseSelectorList(text: string): Array<{ selector: string; attribute: string }> {
	const out: Array<{ selector: string; attribute: string }> = [];
	for (const raw of text.split(/[,\n]/)) {
		const entry = raw.trim();
		if (!entry) continue;
		const at = entry.lastIndexOf("@");
		const selector = at > 0 ? entry.slice(0, at).trim() : entry;
		const attribute = at > 0 ? entry.slice(at + 1).trim() : "text";
		if (!selector) continue;
		if (out.some((item) => item.selector === selector && item.attribute === attribute)) continue;
		out.push({ selector, attribute: attribute || "text" });
		if (out.length >= MAX_SELECTORS) break;
	}
	return out;
}

/**
 * Translates the connector vocabulary into the upstream `Formats` array.
 *
 * `rawBase64` is exclusive upstream — the whole response becomes the payload —
 * so it collapses the list.
 */
export function toUpstreamFormats(
	formats: readonly string[],
	payloads: FormatPayloads = {},
): Array<string | Record<string, unknown>> {
	const result: Array<string | Record<string, unknown>> = [];
	const push = (value: string | Record<string, unknown>): void => {
		const key = typeof value === "string" ? value : JSON.stringify(value);
		if (!result.some((entry) => (typeof entry === "string" ? entry : JSON.stringify(entry)) === key)) result.push(value);
	};

	for (const format of formats) {
		switch (format) {
			case "media":
				push("video");
				push("audio");
				break;
			case "screenshot@fullPage":
				push({ type: "screenshot", fullPage: true });
				break;
			case "json":
				if (payloads.prompt || payloads.schema) {
					push({
						type: "json",
						...(payloads.prompt ? { prompt: payloads.prompt } : {}),
						...(payloads.schema ? { schema: payloads.schema } : {}),
					});
				} else {
					push("json");
				}
				break;
			case "attributes": {
				const selectors = (payloads.selectors ?? []).slice(0, MAX_SELECTORS);
				if (selectors.length > 0) push({ type: "attributes", selectors });
				break;
			}
			default:
				if (isFormatOption(format)) push(format);
		}
	}

	if (payloads.question) push({ type: "question", question: payloads.question });
	if (payloads.highlights) push({ type: "highlights", query: payloads.highlights });

	if (result.includes("rawBase64")) return ["rawBase64"];
	return result.length > 0 ? result : ["markdown"];
}

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
 * Formats worth offering at crawl scale.
 *
 * `screenshot` is excluded (a screenshot per page is megabytes of base64),
 * `rawBase64` is exclusive upstream, and `question`/`highlights`/`attributes`
 * need a per-page payload that a crawl has no single answer for.
 */
export const CRAWL_FORMAT_OPTIONS = [
	"markdown",
	"links",
	"images",
	"media",
	"summary",
	"html",
	"json",
	"changeTracking",
] as const;

export type CrawlFormatOption = (typeof CRAWL_FORMAT_OPTIONS)[number];

export const DEFAULT_CRAWL_FORMATS: CrawlFormatOption[] = ["markdown"];

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

export function clampCrawlFormats(value: unknown, max = MAX_FORMATS): CrawlFormatOption[] {
	const kept: CrawlFormatOption[] = [];
	for (const name of clampFormats(value, max)) {
		if (isCrawlFormatOption(name) && !kept.includes(name)) kept.push(name);
	}
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

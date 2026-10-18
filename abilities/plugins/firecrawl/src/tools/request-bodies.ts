/**
 * Tool arguments to Firecrawl v2 request bodies.
 *
 * Everything here is a pure translation: validate the model's input, drop what
 * the API cannot express, and otherwise pass options through. No scraping
 * behaviour lives in this file.
 */

import { CRAWL_LIMITS, crawlJobBody, type CrawlJobOptions } from "../domain/firecrawl/options";
import { clampCrawlFormats, clampFormats, toUpstreamFormats, type FormatOption, type FormatPayloads } from "../domain/firecrawl/formats";
import {
	readActions,
	readAttributeSelectors,
	readBoolean,
	readEnum,
	readHeaders,
	readJsonObject,
	readNumber,
	readOptionalBoolean,
	readOptionalString,
	readString,
	readStringArray,
	requireUrl,
	ToolArgumentError,
} from "./tool-arguments";

/** Re-exported for the JSON schemas, which list the enum for the model. */
export { FORMAT_OPTIONS } from "../domain/firecrawl/formats";

const MAX_ACTIONS_UPSTREAM = 10;
const MAX_TEXT_FORMAT_CHARS = 10_000;
const MAX_PROFILE_NAME = 128;

/** Per-request payloads the object-shaped formats carry. */
function formatPayloads(input: unknown, withTextFormats: boolean): FormatPayloads {
	const payloads: FormatPayloads = {
		prompt: readOptionalString(input, "prompt") ?? undefined,
		schema: readJsonObject(input, "schema"),
		selectors: readAttributeSelectors(input),
	};
	if (!withTextFormats) return payloads;
	const question = readOptionalString(input, "question");
	const highlights = readOptionalString(input, "highlights");
	if (question && question.length > MAX_TEXT_FORMAT_CHARS) {
		throw new ToolArgumentError(`"question" is longer than ${MAX_TEXT_FORMAT_CHARS} characters`);
	}
	if (highlights && highlights.length > MAX_TEXT_FORMAT_CHARS) {
		throw new ToolArgumentError(`"highlights" is longer than ${MAX_TEXT_FORMAT_CHARS} characters`);
	}
	return { ...payloads, question: question ?? undefined, highlights: highlights ?? undefined };
}

/** Shared `scrapeOptions` for `/v2/scrape`, `/v2/crawl` and `/v2/batch/scrape`. */
export function scrapeOptionsFromInput(
	input: unknown,
	formats: readonly string[],
	payloads: FormatPayloads = {},
): Record<string, unknown> {
	const options: Record<string, unknown> = {
		formats: toUpstreamFormats(formats, payloads),
		onlyMainContent: readBoolean(input, "onlyMainContent", true),
		removeBase64Images: readBoolean(input, "removeBase64Images", true),
		storeInCache: readBoolean(input, "storeInCache", true),
	};

	const onlyCleanContent = readOptionalBoolean(input, "onlyCleanContent");
	if (onlyCleanContent !== undefined) options.onlyCleanContent = onlyCleanContent;
	const mobile = readOptionalBoolean(input, "mobile");
	if (mobile !== undefined) options.mobile = mobile;
	const skipTlsVerification = readOptionalBoolean(input, "skipTlsVerification");
	if (skipTlsVerification !== undefined) options.skipTlsVerification = skipTlsVerification;
	// Upstream defaults this to true; only send it when the caller overrides.
	const blockAds = readOptionalBoolean(input, "blockAds");
	if (blockAds !== undefined) options.blockAds = blockAds;
	const lockdown = readOptionalBoolean(input, "lockdown");
	if (lockdown !== undefined) options.lockdown = lockdown;
	const checkPromptInjection = readOptionalBoolean(input, "checkPromptInjection");
	if (checkPromptInjection !== undefined) options.checkPromptInjection = checkPromptInjection;
	const redactPII = readOptionalBoolean(input, "redactPII");
	if (redactPII !== undefined) options.redactPII = redactPII;

	const includeLinks = readBoolean(input, "includeLinks", true);
	const excludeTags = readStringArray(input, "excludeTags", 10);
	if (!includeLinks) excludeTags.push("a");
	if (excludeTags.length > 0) options.excludeTags = excludeTags;

	const includeTags = readStringArray(input, "includeTags", 10);
	if (includeTags.length > 0) options.includeTags = includeTags;

	const headers = readHeaders(input);
	const headerJson = readOptionalString(input, "headersJson");
	const mergedHeaders = headerJson ? { ...headers, ...readHeaders({ headers: headerJson }) } : headers;
	if (Object.keys(mergedHeaders).length > 0) options.headers = mergedHeaders;

	const waitFor = readNumber(input, "waitFor", { min: 0, max: 60_000, def: 0 });
	if (waitFor > 0) options.waitFor = waitFor;
	const timeout = readNumber(input, "timeoutMs", { min: 1_000, max: 300_000, def: 0 });
	if (timeout > 0) options.timeout = timeout;
	const maxAge = readNumber(input, "maxAge", { min: 0, max: 30 * 24 * 60 * 60 * 1_000, def: -1 });
	if (maxAge >= 0) options.maxAge = maxAge;
	const minAge = readNumber(input, "minAge", { min: 0, max: 30 * 24 * 60 * 60 * 1_000, def: -1 });
	if (minAge >= 0) options.minAge = minAge;

	const actions = readActions(input);
	if (actions.length > 0) options.actions = actions.slice(0, MAX_ACTIONS_UPSTREAM);
	const proxy = readOptionalString(input, "proxy");
	if (proxy && ["basic", "enhanced", "auto"].includes(proxy)) options.proxy = proxy;

	const parsers = readStringArray(input, "parsers", 5).filter((entry) => entry === "pdf" || entry === "image");
	if (parsers.length > 0) options.parsers = parsers;

	const location = readOptionalString(input, "location");
	if (location) options.location = { country: location.toUpperCase() };

	const profile = readOptionalString(input, "profile");
	if (profile) {
		if (profile.length > MAX_PROFILE_NAME) throw new ToolArgumentError(`"profile" is longer than ${MAX_PROFILE_NAME} characters`);
		options.profile = { name: profile, saveChanges: readBoolean(input, "saveProfile", true) };
	}

	return options;
}

/** `formats`, plus the legacy `changeTracking` boolean folded into the list. */
function formatsFromInput(input: unknown): FormatOption[] {
	const formats = clampFormats((input as Record<string, unknown> | null)?.formats);
	if (readBoolean(input, "changeTracking", false) && !formats.includes("changeTracking") && formats.length < 8) {
		formats.push("changeTracking");
	}
	return formats;
}

export function scrapeBody(input: unknown): Record<string, unknown> {
	const url = requireUrl(input);
	const formats = formatsFromInput(input);
	const body: Record<string, unknown> = { url, ...scrapeOptionsFromInput(input, formats, formatPayloads(input, true)) };
	if (readBoolean(input, "zeroDataRetention", false)) body.zeroDataRetention = true;
	return body;
}

export function batchScrapeBody(input: unknown): { body: Record<string, unknown>; urls: string[] } {
	const urls = readStringArray(input, "urls", 200);
	if (urls.length === 0) throw new ToolArgumentError('"urls" is required for firecrawl_batch_scrape');
	for (const url of urls) {
		try {
			new URL(url);
		} catch {
			throw new ToolArgumentError(`"urls" contains an invalid URL: ${url}`);
		}
	}
	const formats = formatsFromInput(input);
	const body: Record<string, unknown> = { urls, ...scrapeOptionsFromInput(input, formats, formatPayloads(input, false)) };
	if (readBoolean(input, "zeroDataRetention", false)) body.zeroDataRetention = true;
	return { urls, body };
}

function crawlOptionsFromInput(input: unknown): CrawlJobOptions {
	return {
		limit: readNumber(input, "limit", { min: 1, max: 10_000, def: CRAWL_LIMITS.limit.fallback }),
		maxDiscoveryDepth: readNumber(input, "maxDepth", { min: 0, max: 20, def: CRAWL_LIMITS.maxDiscoveryDepth.fallback }),
		maxConcurrency: readNumber(input, "maxConcurrency", { min: 1, max: 10, def: CRAWL_LIMITS.maxConcurrency.fallback }),
		delay: readNumber(input, "delay", { min: 0, max: 5_000, def: CRAWL_LIMITS.delay.fallback }),
		sitemap: readEnum(input, "sitemap", ["include", "only", "skip"] as const, "include") === "skip" ? "skip" : "include",
		ignoreQueryParameters: readBoolean(input, "ignoreQueryParameters", true),
		allowExternalLinks: readBoolean(input, "allowExternalLinks", false),
		allowSubdomains: readBoolean(input, "allowSubdomains", false),
		crawlEntireDomain: readBoolean(input, "crawlEntireDomain", false),
		ignoreRobotsTxt: readBoolean(input, "ignoreRobotsTxt", false),
		onlyMainContent: readBoolean(input, "onlyMainContent", true),
		formats: clampCrawlFormats((input as Record<string, unknown> | null)?.formats),
	};
}

export function crawlRequestBody(input: unknown): {
	url: string;
	body: Record<string, unknown>;
	options: CrawlJobOptions;
} {
	const url = requireUrl(input);
	const options = crawlOptionsFromInput(input);
	const formats = formatsFromInput(input);
	const scrapeOptions = scrapeOptionsFromInput(input, formats);
	delete scrapeOptions.headers;
	const body = crawlJobBody(url, options, {
		includePaths: readStringArray(input, "includePaths", 30),
		excludePaths: readStringArray(input, "excludePaths", 30),
		prompt: readOptionalString(input, "prompt") ?? undefined,
		webhookUrl: readOptionalString(input, "webhookUrl") ?? undefined,
		scrapeOptions,
	});
	if (readBoolean(input, "zeroDataRetention", false)) body.zeroDataRetention = true;
	return { url, body, options };
}

export function mapBody(input: unknown): Record<string, unknown> {
	const url = requireUrl(input);
	const body: Record<string, unknown> = { url };
	const search = readOptionalString(input, "search");
	if (search) body.search = search;
	const limit = readNumber(input, "limit", { min: 1, max: 100_000, def: 5_000 });
	body.limit = limit;
	const includePaths = readStringArray(input, "includePaths", 30);
	if (includePaths.length > 0) body.includePaths = includePaths;
	const excludePaths = readStringArray(input, "excludePaths", 30);
	if (excludePaths.length > 0) body.excludePaths = excludePaths;
	body.sitemap = readEnum(input, "sitemap", ["include", "only", "skip"] as const, "include");
	body.ignoreQueryParameters = readBoolean(input, "ignoreQueryParameters", false);
	body.ignoreCache = readBoolean(input, "ignoreCache", false);
	body.allowExternalLinks = readBoolean(input, "allowExternalLinks", false);
	body.allowSubdomains = readBoolean(input, "includeSubdomains", false);
	return body;
}

export function searchBody(input: unknown): Record<string, unknown> {
	const query = readString(input, "query");
	if (!query) throw new ToolArgumentError('firecrawl_search needs a non-empty "query"');
	const body: Record<string, unknown> = { query, limit: readNumber(input, "limit", { min: 1, max: 100, def: 10 }) };
	const sources = readStringArray(input, "sources", 5);
	if (sources.length > 0) body.sources = sources;
	const categories = readStringArray(input, "categories", 5);
	if (categories.length > 0) body.categories = categories;
	const includeDomains = readStringArray(input, "includeDomains", 20);
	if (includeDomains.length > 0) body.includeDomains = includeDomains;
	const excludeDomains = readStringArray(input, "excludeDomains", 20);
	if (excludeDomains.length > 0) body.excludeDomains = excludeDomains;
	const timeRange = readOptionalString(input, "timeRange");
	if (timeRange) body.tbs = `qdr:${timeRange}`;
	if (readBoolean(input, "scrapeResults", false)) {
		body.scrapeOptions = { formats: ["markdown"], onlyMainContent: true };
	}
	return body;
}

export function extractBody(input: unknown): Record<string, unknown> {
	const urls = readStringArray(input, "urls", 50);
	const body: Record<string, unknown> = {};
	if (urls.length > 0) body.urls = urls;
	const prompt = readOptionalString(input, "prompt");
	if (prompt) body.prompt = prompt;
	const schema = readJsonObject(input, "schema");
	if (schema) body.schema = schema;
	if (!body.urls && !readString(input, "query")) {
		throw new ToolArgumentError('firecrawl_extract needs "urls" or a natural-language "query"');
	}
	const query = readOptionalString(input, "query");
	if (query) body.prompt = query;
	if (!body.prompt && !body.schema) throw new ToolArgumentError('firecrawl_extract needs "prompt" or "schema"');
	body.enableWebSearch = readBoolean(input, "enableWebSearch", false);
	return body;
}

/**
 * `/v2/parse` takes the file as multipart and the scrape options as a JSON
 * string field, so the body is assembled here rather than in the tool.
 */
export function parseBody(
	input: unknown,
	file: { fileName: string; mimeType: string; data: string },
): { type: "multipart"; fields: Record<string, string>; files: Array<{ fieldName: string; fileName: string; mimeType: string; data: string }> } {
	const formats = clampFormats((input as Record<string, unknown> | null)?.formats);
	const options = scrapeOptionsFromInput(input, formats);
	return {
		type: "multipart",
		fields: { options: JSON.stringify(options) },
		files: [{ fieldName: "file", fileName: file.fileName, mimeType: file.mimeType, data: file.data }],
	};
}

const MIME_BY_EXTENSION: Record<string, string> = {
	pdf: "application/pdf",
	docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	doc: "application/msword",
	xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	xls: "application/vnd.ms-excel",
	csv: "text/csv",
	pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
	html: "text/html",
	htm: "text/html",
	txt: "text/plain",
	md: "text/markdown",
	json: "application/json",
	rtf: "application/rtf",
	epub: "application/epub+zip",
};

export function mimeForFile(fileName: string): string {
	const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
	return MIME_BY_EXTENSION[extension] ?? "application/octet-stream";
}

/**
 * Upstream implementations of the existing tools.
 *
 * Each function here answers the same tool call the local engine answers, but by
 * calling the Firecrawl v2 API. They return the same plain-text shape, so the
 * agent sees one consistent tool and the user sees one consistent answer
 * regardless of which engine ran.
 */

import type { UpstreamClient, UpstreamDocument, UpstreamJobStatus } from "../domain/backend/types";
import { pollUpstreamJob } from "../domain/backend/rest";
import type { CrawlRunStore } from "../features/crawler-console/services/crawl-run-store";
import { formatBytes, formatCount, formatDuration } from "../shared/formatters/format";
import {
	readActions,
	readAttributesInput,
	readBoolean,
	readEnumArray,
	readHeaders,
	readNumber,
	readOptionalString,
	readString,
	readStringArray,
	requireUrl,
} from "./tool-arguments";
import { ALL_FORMATS } from "../domain/render/types";
import { coerceSelectors } from "../domain/html/attributes";

const MAX_MARKDOWN = 60_000;
const MAX_LISTED = 60;

/** Local-only formats have no upstream equivalent; map or drop them explicitly. */
function upstreamFormats(formats: readonly string[]): string[] {
	const mapped = new Set<string>();
	for (const format of formats) {
		if (format === "media") {
			mapped.add("video");
			continue;
		}
		// Both are handled by their own shapes below, not as a bare format string.
		if (format === "images" || format === "attributes") continue;
		mapped.add(format);
	}
	return [...mapped];
}

function commonScrapeBody(input: unknown): Record<string, unknown> {
	const body: Record<string, unknown> = {
		url: requireUrl(input),
		formats: upstreamFormats(readEnumArray(input, "formats", ALL_FORMATS, 6)),
		onlyMainContent: readBoolean(input, "onlyMainContent", true),
		removeBase64Images: readBoolean(input, "removeBase64Images", true),
	};
	const includeLinks = readBoolean(input, "includeLinks", true);
	if (!includeLinks) body.excludeTags = [...(readStringArray(input, "excludeTags", 10) ?? []), "a"];

	const includeTags = readStringArray(input, "includeTags", 10);
	if (includeTags.length > 0) body.includeTags = includeTags;
	const excludeTags = readStringArray(input, "excludeTags", 10);
	if (excludeTags.length > 0) body.excludeTags = excludeTags;

	const headers = readHeaders(input);
	const headerString = readOptionalString(input, "headersJson");
	const mergedHeaders = headerString ? { ...headers, ...readHeaders({ headers: headerString }) } : headers;
	if (Object.keys(mergedHeaders).length > 0) body.headers = mergedHeaders;

	const waitFor = readNumber(input, "waitFor", { min: 0, max: 60_000, def: 0 });
	if (waitFor > 0) body.waitFor = waitFor;
	const timeout = readNumber(input, "timeoutMs", { min: 1_000, max: 120_000, def: 0 });
	if (timeout > 0) body.timeout = timeout;
	const maxAge = readNumber(input, "maxAge", { min: 0, max: 30 * 24 * 60 * 60 * 1_000, def: -1 });
	if (maxAge >= 0) body.maxAge = maxAge;
	const storeInCache = readBoolean(input, "storeInCache", true);
	body.storeInCache = storeInCache;
	const changeTracking = readBoolean(input, "changeTracking", false);
	if (changeTracking) body.changeTrackingOptions = { modes: ["git-diff"], prompt: null, schema: null };

	const actions = readActions(input);
	if (actions.length > 0) body.actions = actions;
	const proxy = readOptionalString(input, "proxy");
	if (proxy && ["basic", "auto", "stealth"].includes(proxy)) body.proxy = proxy;
	const parsers = readStringArray(input, "parsers", 5);
	if (parsers.length > 0) body.parsers = parsers;
	const location = readOptionalString(input, "location");
	if (location) body.location = { country: location.toUpperCase() };

	// The upstream attributes format is an object inside `formats`, not a string.
	const selectors = coerceSelectors(readAttributesInput(input));
	if (selectors.length > 0) {
		const formats = Array.isArray(body.formats) ? body.formats : [];
		body.formats = [...formats, { type: "attributes", selectors }];
	}
	return body;
}

function describeDocument(document: UpstreamDocument, client: UpstreamClient, elapsedMs: number, credits?: number): string {
	const lines = [
		`URL: ${document.url ?? document.metadata?.sourceURL ?? "(unknown)"}`,
		`Engine: Firecrawl API ${client.endpoint}`,
		`Title: ${document.title ?? "(none)"}`,
	];
	const description = document.description ?? (document.metadata?.description as string | undefined);
	if (description) lines.push(`Description: ${description}`);
	const status = document.metadata?.statusCode;
	if (status !== undefined) lines.push(`Status: ${String(status)}`);
	lines.push(`Time: ${formatDuration(elapsedMs)}${credits !== undefined ? `  credits: ${credits}` : ""}`);
	if (document.warning) lines.push(`Warning: ${document.warning}`);
	if (document.parser) lines.push(`Parser: ${String(document.parser)}`);

	const markdown = document.markdown ?? "";
	lines.push("", `--- Markdown (${formatCount(markdown.length)} chars) ---`, clip(markdown, MAX_MARKDOWN));
	if (markdown.length > MAX_MARKDOWN) lines.push(`[... ${markdown.length - MAX_MARKDOWN} more characters]`);

	const extras = describeExtras(document);
	if (extras.length > 0) lines.push("", ...extras);
	return lines.join("\n");
}

function describeExtras(document: UpstreamDocument): string[] {
	const lines: string[] = [];
	if (document.html) lines.push(`HTML: ${formatCount(document.html.length)} chars captured.`);
	if (document.rawHtml) lines.push(`rawHtml: ${formatCount(document.rawHtml.length)} chars captured.`);
	if (document.rawBase64) lines.push(`rawBase64: ${formatBytes(Math.floor((document.rawBase64.length * 3) / 4))} captured.`);
	if (document.screenshot) lines.push("Screenshot: data URL captured.");
	if (document.summary) lines.push("", "--- Summary ---", clip(document.summary, 4_000));
	if (document.answer) lines.push("", "--- Answer ---", clip(document.answer, 4_000));
	if (document.highlights) lines.push("", "--- Highlights ---", clip(document.highlights, 4_000));
	if (document.json !== undefined && document.json !== null) {
		lines.push("", "--- JSON ---", clip(JSON.stringify(document.json, null, 2), 8_000));
	}
	if (document.extract !== undefined && document.extract !== null) {
		lines.push("", "--- Extracted ---", clip(JSON.stringify(document.extract, null, 2), 8_000));
	}
	if (Array.isArray(document.links) && document.links.length > 0) {
		lines.push("", `--- Links (${document.links.length}) ---`);
		for (const link of document.links.slice(0, MAX_LISTED)) lines.push(link);
		if (document.links.length > MAX_LISTED) lines.push(`[... ${document.links.length - MAX_LISTED} more]`);
	}
	if (Array.isArray(document.images) && document.images.length > 0) {
		lines.push("", `--- Images (${document.images.length}) ---`);
		for (const image of document.images.slice(0, MAX_LISTED)) lines.push(image);
	}
	if (Array.isArray(document.attributes) && document.attributes.length > 0) {
		lines.push("", "--- Attributes ---");
		for (const attribute of document.attributes) {
			lines.push(`${attribute.selector} @ ${attribute.attribute}: ${attribute.values.slice(0, 20).join(" | ")}`);
		}
	}
	if (Array.isArray(document.videos) && document.videos.length > 0) {
		lines.push("", `--- Videos (${document.videos.length}) ---`);
		for (const video of document.videos.slice(0, MAX_LISTED)) lines.push(JSON.stringify(video));
	}
	if (typeof document.video === "string" && document.video.length > 0) lines.push(`Video: ${document.video}`);
	if (typeof document.audio === "string" && document.audio.length > 0) lines.push(`Audio: ${document.audio}`);
	if (Array.isArray(document.pages) && document.pages.length > 0) {
		lines.push("", `--- Pages (${document.pages.length}) ---`);
		for (const page of document.pages.slice(0, 20)) lines.push(`p${page.pageNumber}: ${clip(page.markdown, 400)}`);
	}
	return lines;
}

function clip(value: string, max: number): string {
	return value.length <= max ? value : `${value.slice(0, max)}\n[... truncated]`;
}

function jobSummary(status: UpstreamJobStatus, client: UpstreamClient, kind: "crawl" | "batch"): string[] {
	const lines = [
		`Status: ${status.status}  ${status.completed}/${status.total || "?"} page(s)${
			status.creditsUsed !== undefined ? `  credits: ${status.creditsUsed}` : ""
		}`,
		`Engine: Firecrawl API ${client.endpoint} (${kind} job)`,
	];
	if (status.expiresAt) lines.push(`Expires: ${status.expiresAt}`);
	if (status.error) lines.push(`Error: ${status.error}`);
	if (status.warning) lines.push(`Warning: ${status.warning}`);
	return lines;
}

function pagesBlock(data: readonly UpstreamDocument[]): string[] {
	const lines: string[] = [];
	for (const [index, page] of data.entries()) {
		lines.push("", `### ${index + 1}. ${page.title ?? "(untitled)"}`, `URL: ${page.url ?? "(unknown)"}`);
		if (page.markdown) lines.push(clip(page.markdown, 6_000));
		if (page.warning) lines.push(`Warning: ${page.warning}`);
	}
	return lines;
}

export interface UpstreamToolDeps {
	gate: { load(): Promise<void>; require(): Promise<UpstreamClient> };
	store: CrawlRunStore;
}

export function upstreamImplementations(deps: UpstreamToolDeps): Record<string, (input: unknown) => Promise<string>> {
	const { store } = deps;
	return {
		firecrawl_scrape: async (input) => {
			const client = await deps.gate.require();
			const startedAt = Date.now();
			const document = await client.scrape(commonScrapeBody(input));
			const elapsed = Date.now() - startedAt;
			store.note("ok", `scrape  ${document.url ?? ""}  engine=upstream  ${formatDuration(elapsed)}`);
			return describeDocument(document, client, elapsed);
		},

		firecrawl_parse: async (input) => {
			const client = await deps.gate.require();
			const url = requireUrl(input);
			const startedAt = Date.now();
			const document = await client.scrape({
				url,
				formats: ["markdown"],
				parsers: readStringArray(input, "parsers", 5).length > 0 ? readStringArray(input, "parsers", 5) : ["pdf", "docx", "xlsx"],
				onlyMainContent: true,
			});
			const elapsed = Date.now() - startedAt;
			store.note("ok", `parse  ${url}  engine=upstream  ${formatDuration(elapsed)}`);
			return describeDocument(document, client, elapsed);
		},

		firecrawl_batch_scrape: async (input) => {
			const client = await deps.gate.require();
			const urls = readStringArray(input, "urls", 200);
			if (urls.length === 0) throw new Error("urls is required for firecrawl_batch_scrape");
			const body = commonScrapeBody({ url: urls[0] });
			delete body.url;
			delete body.excludeTags;
			body.urls = urls;
			const job = await client.batchScrape(body);
			const wait = readBoolean(input, "wait", true);
			if (!wait) {
				return [
					`Batch submitted: ${job.id}`,
					`${urls.length} URL(s) queued on ${client.endpoint}.`,
					"Poll it with firecrawl_job_status { kind: \"batch\", id }.",
					job.invalidURLs && job.invalidURLs.length > 0
						? `Rejected URLs: ${job.invalidURLs.slice(0, 20).map(String).join(", ")}`
						: "",
				]
					.filter(Boolean)
					.join("\n");
			}
			const timeoutMs = readNumber(input, "timeoutMs", { min: 10_000, max: 900_000, def: 300_000 });
			const status = await pollUpstreamJob(client, "batch", job.id, {
				timeoutMs,
				onProgress: (progress) =>
					store.note("info", `batch ${job.id}  ${progress.completed}/${progress.total || "?"}`),
			});
			const lines = [`Batch job: ${job.id}`, ...jobSummary(status, client, "batch"), ...pagesBlock(status.data)];
			if (status.status === "scraping") {
				lines.push("", `Still running after ${formatDuration(timeoutMs)}; poll firecrawl_job_status with this id.`);
			}
			return lines.join("\n");
		},

		firecrawl_crawl: async (input) => {
			const client = await deps.gate.require();
			const url = requireUrl(input);
			store.setTarget(url, "tool");
			const body: Record<string, unknown> = { url };
			const limit = readNumber(input, "limit", { min: 1, max: 100_000, def: 0 });
			if (limit > 0) body.limit = limit;
			const maxDepth = readNumber(input, "maxDepth", { min: 1, max: 20, def: 0 });
			if (maxDepth > 0) body.maxDiscoveryDepth = maxDepth;
			const includePaths = readStringArray(input, "includePaths", 30);
			if (includePaths.length > 0) body.includePaths = includePaths;
			const excludePaths = readStringArray(input, "excludePaths", 30);
			if (excludePaths.length > 0) body.excludePaths = excludePaths;
			const sitemap = readOptionalString(input, "sitemap");
			if (sitemap && ["only", "include", "skip"].includes(sitemap)) body.sitemap = sitemap;
			body.ignoreQueryParameters = readBoolean(input, "ignoreQueryParameters", true);
			body.allowExternalLinks = readBoolean(input, "allowExternalLinks", false);
			body.allowSubdomains = readBoolean(input, "allowSubdomains", false);
			body.crawlEntireDomain = readBoolean(input, "crawlEntireDomain", false);
			const prompt = readOptionalString(input, "prompt");
			if (prompt) body.prompt = prompt;
			const webhookUrl = readOptionalString(input, "webhookUrl");
			if (webhookUrl) body.webhook = { url: webhookUrl, events: ["completed", "page"] };
			const maxAge = readNumber(input, "maxAge", { min: 0, max: 30 * 24 * 60 * 60 * 1_000, def: -1 });
			if (maxAge >= 0) body.maxAge = maxAge;
			const scrapeOptions = commonScrapeBody({ url });
			delete scrapeOptions.url;
			delete scrapeOptions.headers;
			if (Object.keys(scrapeOptions).length > 0) body.scrapeOptions = scrapeOptions;

			const job = await client.crawl(body);
			const wait = readBoolean(input, "wait", true);
			if (!wait) {
				return [
					`Crawl started: ${job.id}`,
					`Poll firecrawl_job_status { kind: "crawl", id: "${job.id}" } for pages, or cancel with that tool.`,
				].join("\n");
			}
			const timeoutMs = readNumber(input, "timeoutMs", { min: 10_000, max: 900_000, def: 300_000 });
			const status = await pollUpstreamJob(client, "crawl", job.id, {
				timeoutMs,
				onProgress: (progress) => {
					store.note("info", `crawl ${job.id}  ${progress.completed}/${progress.total || "?"}`);
				},
			});
			store.note("ok", `crawl  ${url}  ${status.completed}/${status.total}  upstream`);
			const lines = [`Crawl job: ${job.id}`, ...jobSummary(status, client, "crawl"), ...pagesBlock(status.data)];
			if (status.status === "scraping") {
				lines.push("", `Still running after ${formatDuration(timeoutMs)}; poll firecrawl_job_status with this id.`);
			}
			return lines.join("\n");
		},

		firecrawl_map: async (input) => {
			const client = await deps.gate.require();
			const url = requireUrl(input);
			const body: Record<string, unknown> = { url };
			for (const key of [
				"search",
				"sitemap",
				"includeSubdomains",
				"ignoreQueryParameters",
				"ignoreCache",
			] as const) {
				const value = readOptionalString(input, key);
				if (value !== undefined) body[key] = value;
			}
			const limit = readNumber(input, "limit", { min: 1, max: 100_000, def: 0 });
			if (limit > 0) body.limit = limit;
			const includePaths = readStringArray(input, "includePaths", 30);
			if (includePaths.length > 0) body.includePaths = includePaths;
			const excludePaths = readStringArray(input, "excludePaths", 30);
			if (excludePaths.length > 0) body.excludePaths = excludePaths;
			body.filterByPath = readBoolean(input, "filterByPath", false);
			body.ignoreQueryParameters = readBoolean(input, "ignoreQueryParameters", false);
			body.ignoreSitemap = readBoolean(input, "ignoreSitemap", false);
			body.sitemapOnly = readBoolean(input, "sitemapOnly", false);
			body.allowExternalLinks = readBoolean(input, "allowExternalLinks", false);
			body.allowSubdomains = readBoolean(input, "includeSubdomains", false);

			const result = await client.map(body);
			store.note("ok", `map  ${url}  ${result.links.length} urls  upstream`);
			const lines = [
				`Mapped ${result.links.length} URL(s) from ${url} via ${client.endpoint}.`,
				result.creditsUsed !== undefined ? `credits: ${result.creditsUsed}` : "",
				"",
				"URLs:",
				...result.links.slice(0, MAX_LISTED),
			].filter(Boolean);
			if (result.links.length > MAX_LISTED) lines.push(`[... ${result.links.length - MAX_LISTED} more URL(s) not listed]`);
			return lines.join("\n");
		},

		firecrawl_search: async (input) => {
			const client = await deps.gate.require();
			const query = readString(input, "query");
			if (!query) throw new Error('firecrawl_search needs a non-empty "query"');
			const body: Record<string, unknown> = { query };
			const limit = readNumber(input, "limit", { min: 1, max: 100, def: 10 });
			body.limit = limit;
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

			const result = await client.search(body);
			store.note("ok", `search  ${query}  ${result.results.length} results  upstream`);
			const lines = [
				`${result.results.length} result(s) for "${query}" via ${client.endpoint}.`,
				result.creditsUsed !== undefined ? `credits: ${result.creditsUsed}` : "",
			].filter(Boolean);
			if (result.warning) lines.push(`Warning: ${result.warning}`);
			for (const [index, item] of result.results.entries()) {
				lines.push("", `${index + 1}. ${String(item.title ?? "(untitled)")}`, `   ${String(item.url ?? "")}`);
				const description = item.description ?? item.snippet;
				if (typeof description === "string" && description.length > 0) lines.push(`   ${clip(description, 400)}`);
			}
			return lines.join("\n");
		},

		firecrawl_extract: async (input) => {
			const client = await deps.gate.require();
			const urls = readStringArray(input, "urls", 50);
			const body: Record<string, unknown> = { urls };
			const prompt = readOptionalString(input, "prompt");
			if (prompt) body.prompt = prompt;
			const schema = readOptionalString(input, "schemaJson");
			if (schema) body.schema = JSON.parse(schema) as unknown;
			const job = await client.extract(body);
			const timeoutMs = readNumber(input, "timeoutMs", { min: 10_000, max: 900_000, def: 300_000 });
			const deadline = Date.now() + timeoutMs;
			let status = await client.extractStatus(job.id);
			while (status.status !== "completed" && status.status !== "failed" && Date.now() < deadline) {
				await new Promise((resolve) => setTimeout(resolve, 2_000));
				status = await client.extractStatus(job.id);
			}
			const lines = [
				`Extract job: ${job.id}`,
				`Status: ${status.status}`,
				status.error ? `Error: ${status.error}` : "",
				"",
				JSON.stringify(status.data ?? null, null, 2),
			].filter((line) => line !== "");
			return lines.join("\n");
		},
	};
}

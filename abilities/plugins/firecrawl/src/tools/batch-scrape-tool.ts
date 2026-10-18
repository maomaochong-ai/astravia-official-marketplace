/**
 * firecrawl_batch_scrape — several known URLs in one call.
 *
 * Upstream batches server-side and returns a job id to poll; a plugin has no
 * queue, so this runs the URLs concurrently inside one tool call and returns the
 * same per-URL shape. Use it instead of calling firecrawl_scrape in a loop: the
 * run store sees one target, so the console does not reset between pages.
 */

import type { PluginContext } from "@astravia-org/plugin-sdk";
import { scrapePage } from "../domain/scrape/pipeline";
import { ScrapeError } from "../domain/render/errors";
import type { BinaryFetch, HttpClient } from "../domain/scrape/http";
import type { PageCache } from "../domain/scrape/cache";
import type { BrowserPortFactory, OutputFormat, RenderMode } from "../domain/render/types";
import { ALL_FORMATS } from "../domain/render/types";
import type { CrawlRunStore } from "../features/crawler-console/services/crawl-run-store";
import { formatBytes, formatDuration } from "../shared/formatters/format";
import {
	clip,
	readBoolean,
	readEnum,
	readEnumArray,
	readHeaders,
	readNumber,
	readOptionalString,
	readStringArray,
	ToolArgumentError,
} from "./tool-arguments";

const RENDER_MODES: readonly RenderMode[] = ["auto", "static", "browser"];
const MAX_URLS = 20;
const MAX_MARKDOWN_PER_URL = 6_000;
const TOTAL_MARKDOWN_BUDGET = 40_000;

export function createBatchScrapeTool(
	_ctx: PluginContext,
	client: HttpClient,
	store: CrawlRunStore,
	browser: BrowserPortFactory | undefined,
	binary: BinaryFetch | undefined,
	cache?: PageCache,
) {
	return {
		id: "firecrawl_batch_scrape",
		name: "firecrawl_batch_scrape",
		label: "%tool.batch.label%",
		description: [
			"Read several known URLs in one call and return each page's Markdown, title and status.",
			"",
			"Use it when you already have a URL list and want all of them read — a release-notes roundup,",
			"a set of product pages, the same page in three languages. It is the same work as calling",
			"firecrawl_scrape per URL, done concurrently and reported as one result.",
			"",
			"Do NOT use it to discover URLs (firecrawl_map), to follow links (firecrawl_crawl), or for a",
			"single page (firecrawl_scrape).",
			"",
			"Limits: 1-20 URLs per call, concurrency 1-4, Markdown clipped at 6k characters per URL.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				urls: {
					type: "array",
					items: { type: "string" },
					description: "Absolute http(s) URLs to read (1-20).",
				},
				formats: {
					type: "array",
					items: { type: "string", enum: [...ALL_FORMATS] },
					description: "Extra outputs per URL: html, links, images, summary, json, extract, media. Markdown is always returned.",
				},
				render: { type: "string", enum: [...RENDER_MODES], description: "auto (default), static or browser." },
				concurrency: { type: "number", description: "URLs fetched in parallel (1-4, default 2)." },
				onlyMainContent: { type: "boolean", description: "Extract article bodies only (default true)." },
				headers: { type: "object", description: "Extra request headers for every URL. HTTP engine only." },
				profile: { type: "string", description: "Persistent browser profile id shared by every URL." },
				maxAge: { type: "number", description: "Milliseconds a stored copy of each URL may be reused for (0 = always fetch)." },
				timeoutMs: { type: "number", description: "Per-request timeout in milliseconds (1000-120000, default 30000)." },
			},
			required: ["urls"],
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"] as const,
		context: { conversation: "summary" },
		timeoutMs: 300_000,
		handler: async (context: { trigger: { input?: unknown } }) => {
			const input = context.trigger.input;
			try {
				const urls = readStringArray(input, "urls", MAX_URLS).map((entry) => requireHttpUrl(entry));
				if (urls.length === 0) throw new ToolArgumentError('"urls" needs at least one absolute http(s) URL');
				const formats = readEnumArray(input, "formats", ALL_FORMATS, 6);
				const render = readEnum(input, "render", RENDER_MODES, "auto");
				const concurrency = readNumber(input, "concurrency", { min: 1, max: 4, def: 2 });
				const onlyMainContent = readBoolean(input, "onlyMainContent", true);
				const headers = readHeaders(input);
				const profileId = readOptionalString(input, "profile") ?? undefined;
				const maxAgeMs = readNumber(input, "maxAge", { min: 0, max: 30 * 24 * 60 * 60 * 1_000, def: 0 });
				const timeoutMs = readNumber(input, "timeoutMs", { min: 1_000, max: 120_000, def: 30_000 });

				store.setTarget(urls[0]!, "tool");

				const pages: Array<
					| { url: string; ok: true; result: Awaited<ReturnType<typeof scrapePage>> }
					| { url: string; ok: false; error: string }
				> = new Array(urls.length);
				let cursor = 0;

				const worker = async (): Promise<void> => {
					while (cursor < urls.length) {
						const index = cursor;
						cursor += 1;
						const url = urls[index]!;
						try {
							const result = await scrapePage(
								client,
								url,
								{
									onlyMainContent,
									render,
									formats,
									headers,
									profileId,
									maxAgeMs,
									timeoutMs,
								},
								{ browser, binary, cache },
							);
							pages[index] = { url, ok: true, result };
							store.note(
								"ok",
								`batch  ${url}  ${formatBytes(result.bytes)}  engine=${result.engine}  ${formatDuration(result.durationMs)}`,
							);
						} catch (error) {
							pages[index] = { url, ok: false, error: describe(error) };
							store.note("error", `batch failed  ${url}  ${describe(error)}`);
						}
					}
				};

				await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, () => worker()));

				const ok = pages.filter((page) => page.ok).length;
				const lines = [`Batch: ${ok}/${pages.length} page(s) read.`];
				let budget = TOTAL_MARKDOWN_BUDGET;

				for (const page of pages) {
					if (!page.ok) {
						lines.push("", `## ${page.url}`, `FAILED: ${page.error}`);
						continue;
					}
					const { result } = page;
					lines.push(
						"",
						`## ${result.title || result.finalUrl}`,
						`${result.finalUrl}  (${result.status}, ${result.engine}${result.rendered ? " (rendered)" : ""}, ${formatBytes(result.bytes)}, ${formatDuration(result.durationMs)})`,
					);
					for (const note of result.notes) lines.push(`Note: ${note}`);
					if (budget <= 0) {
						lines.push("[remaining Markdown omitted from this result]");
						continue;
					}
					const body = clip(result.markdown, Math.min(MAX_MARKDOWN_PER_URL, budget));
					budget -= body.length;
					lines.push(body);
					if (result.outputs.changeTracking) lines.push("--- changeTracking ---", result.outputs.changeTracking);
					if (result.outputs.images) lines.push("--- images (JSON) ---", clip(result.outputs.images, 2_000));
				}

				return clip(lines.join("\n"), TOTAL_MARKDOWN_BUDGET + 8_000);
			} catch (error) {
				throw new Error(describe(error));
			}
		},
	};
}

function requireHttpUrl(raw: string): string {
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		throw new ToolArgumentError(`"urls" entry must be an absolute URL, got "${raw}"`);
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") {
		throw new ToolArgumentError(`"urls" entry must use http or https, got "${url.protocol}"`);
	}
	url.hash = "";
	return url.toString();
}

function describe(error: unknown): string {
	if (error instanceof ToolArgumentError) return error.message;
	if (error instanceof ScrapeError) return `${error.code}: ${error.message}`;
	return error instanceof Error ? error.message : String(error);
}

export type { OutputFormat };

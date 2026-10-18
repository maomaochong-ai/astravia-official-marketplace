/**
 * firecrawl_extract — structured data across several pages.
 *
 * Upstream runs FIRE-1 over a URL set. The plugin runs the user's own model over
 * the Markdown of those pages, returns parsed JSON, and refuses to pretend a
 * malformed answer is data.
 */

import type { PluginContext } from "@astravia-org/plugin-sdk";
import type { BinaryFetch, HttpClient } from "../domain/scrape/http";
import type { BrowserPortFactory, RenderMode } from "../domain/render/types";
import type { AiPort } from "../domain/ai/extract";
import { extractFromPages } from "../domain/ai/extract";
import { scrapePage } from "../domain/scrape/pipeline";
import type { CrawlRunStore } from "../features/crawler-console/services/crawl-run-store";
import { clip, readEnum, readJsonObject, readNumber, readString, readStringArray, requireUrl } from "./tool-arguments";
import { describeError } from "./scrape-tool";

const MAX_URLS = 10;
const MAX_MARKDOWN_PER_PAGE = 18_000;
const RENDER_MODES: readonly RenderMode[] = ["auto", "static", "browser"];

export function createExtractTool(
	_ctx: PluginContext,
	client: HttpClient,
	store: CrawlRunStore,
	browser: BrowserPortFactory | undefined,
	ai: AiPort | undefined,
	binary: BinaryFetch | undefined,
) {
	return {
		id: "firecrawl_extract",
		name: "firecrawl_extract",
		label: "%tool.extract.label%",
		description: [
			"Read several pages and return one JSON object matching a schema: prices, contacts, specs,",
			"release notes, comparison tables — anything that has to come back as fields, not prose.",
			"",
			"Give either `urls` (up to 10) or `url` alone. `prompt` says what to pull out; `schema` (JSON Schema)",
			"constrains the shape. The answer is parsed and validated as JSON — if the model returns prose,",
			"the call fails with what it said instead of inventing fields.",
			"",
			"Use it when the user wants a table/record out of one or more pages, or across a handful of URLs.",
			"Do NOT use it for: summarising (firecrawl_scrape with formats:[\"summary\"]), a single page's prose",
			"(firecrawl_scrape), or crawling a whole site first (firecrawl_crawl, then extract on chosen URLs).",
			"Requires a model configured in Astravia (uses the user's own provider and credits).",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				urls: { type: "array", items: { type: "string" }, description: "Pages to read (1-10 absolute http(s) URLs)." },
				url: { type: "string", description: "Single page shortcut when you only have one URL." },
				prompt: { type: "string", description: "What to extract, in plain language." },
				schema: { type: "object", description: "JSON Schema describing the object to return." },
				systemPrompt: { type: "string", description: "Optional override for the extraction instructions." },
				render: { type: "string", enum: [...RENDER_MODES], description: "Rendering mode for the pages (default auto)." },
				timeoutMs: { type: "number", description: "Per-page fetch timeout in milliseconds (1000-120000, default 30000)." },
			},
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"] as const,
		context: { conversation: "summary" },
		timeoutMs: 300_000,
		handler: async (context: { trigger: { input?: unknown } }) => {
			const input = context.trigger.input;
			if (!ai) {
				throw new Error("firecrawl_extract needs a configured model: choose one in Astravia settings, then retry");
			}
			const urls = dedupeUrls([
				...readStringArray(input, "urls", MAX_URLS).map((value) => requireUrl({ url: value })),
				...(readString(input, "url") ? [requireUrl(input)] : []),
			]);
			if (urls.length === 0) throw new Error('"urls" (or "url") is required');
			const render = readEnum(input, "render", RENDER_MODES, "auto");
			const timeoutMs = readNumber(input, "timeoutMs", { min: 1_000, max: 120_000, def: 30_000 });
			store.setTarget(urls[0], "tool");
			const prompt = readString(input, "prompt");
			const schema = readJsonObject(input, "schema");
			if (!prompt && !schema) throw new Error('give "prompt" or "schema" (or both) so the model knows what to extract');

			const pages: Array<{ url: string; markdown: string }> = [];
			const skipped: Array<{ url: string; reason: string }> = [];
			for (const url of urls) {
				try {
					const page = await scrapePage(
						client,
						url,
						{ render, timeoutMs, onlyMainContent: true, includeLinks: false },
						{ browser, binary },
					);
					pages.push({ url: page.finalUrl, markdown: clip(page.markdown, MAX_MARKDOWN_PER_PAGE) });
					store.note("ok", `extract←scrape  ${url}  chars=${page.text.length}`);
				} catch (error) {
					skipped.push({ url, reason: describeError(error) });
					store.note("warn", `extract skip  ${url}  ${describeError(error)}`);
				}
			}
			if (pages.length === 0) {
				throw new Error(`No page could be read: ${skipped.map((entry) => `${entry.url} (${entry.reason})`).join("; ")}`);
			}

			const extraction = await extractFromPages(ai, pages, {
				prompt,
				schema,
				systemPrompt: readString(input, "systemPrompt"),
			});
			store.note("ok", `extract  ${pages.length} page(s)  json=${JSON.stringify(extraction.data).length} chars`);

			const lines = [
				`Extracted from ${pages.length} page(s): ${extraction.usedUrls.join(", ")}`,
			];
			if (skipped.length > 0) lines.push(`Skipped: ${skipped.map((entry) => `${entry.url} (${entry.reason})`).join("; ")}`);
			if (extraction.repaired) lines.push("Note: the model's answer needed repair before it parsed as JSON — verify the values.");
			lines.push("", "```json", JSON.stringify(extraction.data, null, 2), "```");
			return lines.join("\n");
		},
	};
}

function dedupeUrls(urls: readonly string[]): string[] {
	return Array.from(new Set(urls)).slice(0, MAX_URLS);
}

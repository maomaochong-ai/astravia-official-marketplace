/**
 * firecrawl_search — web search, optionally with scraped page content.
 */

import { clip } from "../domain/firecrawl/documents";
import type { ToolDeps } from "./deps";
import { searchBody } from "./request-bodies";

function text(record: Record<string, unknown>, key: string): string {
	const value = record[key];
	return typeof value === "string" ? value : "";
}

export function createSearchTool({ config, store }: ToolDeps) {
	return {
		id: "firecrawl_search",
		name: "firecrawl_search",
		label: "%tool.search.label%",
		description: [
			"Search the web and get back result URLs, titles and snippets — with the option to scrape each",
			"result in the same call (`scrapeResults: true`), so you can answer from the content instead of",
			"guessing from a snippet.",
			"",
			"Use it when the user asks about something current, or when you do not know which URL holds the",
			"answer. Then read the best result with firecrawl_scrape if you need the full page.",
			"Do NOT use it to fetch a URL you already have (firecrawl_scrape), and do not present snippets as",
			"verified facts when `scrapeResults` is off.",
			"",
			"`sources` can include web, news, images; `categories` can include github, research, pdf.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				query: { type: "string", description: "What to search for, in natural language." },
				limit: { type: "number", description: "Number of results (1-100, default 10)." },
				sources: {
					type: "array",
					items: { type: "string", enum: ["web", "news", "images"] },
					description: "Result sources. Default web.",
				},
				categories: {
					type: "array",
					items: { type: "string", enum: ["github", "research", "pdf"] },
					description: "Restrict results to these kinds of sources.",
				},
				includeDomains: { type: "array", items: { type: "string" }, description: "Only these domains." },
				excludeDomains: { type: "array", items: { type: "string" }, description: "Never these domains." },
				timeRange: {
					type: "string",
					enum: ["hour", "day", "week", "month", "year"],
					description: "Only results published within this window.",
				},
				scrapeResults: {
					type: "boolean",
					description: "Also scrape each result and return its Markdown. Slower and costs more. Default false.",
				},
			},
			required: ["query"],
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"] as const,
		context: { conversation: "summary" },
		timeoutMs: 180_000,
		handler: async (context: { trigger: { input?: unknown } }) => {
			const body = searchBody(context.trigger.input);
			const client = await config.require();
			const result = await client.search(body);
			store.note("ok", `search  ${String(body.query)}  ${result.results.length} results`);
			const lines = [
				`${result.results.length} result(s) for "${String(body.query)}"${result.creditsUsed !== undefined ? `  credits: ${result.creditsUsed}` : ""}`,
			];
			if (result.warning) lines.push(`Warning: ${result.warning}`);
			for (const [index, entry] of result.results.entries()) {
				lines.push("", `${index + 1}. ${text(entry, "title") || "(untitled)"}`, `URL: ${text(entry, "url")}`);
				const description = text(entry, "description");
				if (description) lines.push(clip(description, 500));
				const markdown = text(entry, "markdown");
				if (markdown) lines.push("", clip(markdown, 2_000));
			}
			return lines.join("\n");
		},
	};
}

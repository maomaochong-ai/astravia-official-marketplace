/**
 * firecrawl_crawl — site crawl through an asynchronous upstream job.
 *
 * The console adopts the same job id, so a crawl started from the conversation
 * animates in the spider view while this handler waits for the answer.
 */

import { pollJob } from "../domain/firecrawl/client";
import { jobSummary, pagesBlock } from "../domain/firecrawl/documents";
import { formatDuration } from "../shared/formatters/format";
import type { ToolDeps } from "./deps";
import { crawlRequestBody } from "./request-bodies";
import { crawlProperties } from "./scrape-arguments";

export function createCrawlTool({ config, store }: ToolDeps) {
	return {
		id: "firecrawl_crawl",
		name: "firecrawl_crawl",
		label: "%tool.crawl.label%",
		description: [
			"Explore a site from one start URL and return the Markdown of every page it discovers, within the",
			"limits you set. Firecrawl follows links, respects robots.txt, uses the site's sitemap and returns",
			"the pages in one job.",
			"",
			"Use it when the user wants a site's content as a set (docs, a blog, a competitor's pages), not a",
			"single page (firecrawl_scrape) and not just a URL list (firecrawl_map). Bound the crawl: `limit`",
			"pages, `maxDepth` levels, `includePaths`/`excludePaths` to stay in one section. `prompt` steers",
			"which pages are worth following when the site is large.",
			"",
			"Returns a job id plus the first pages when `wait` is true (default). Large crawls exceed the wait",
			"window: keep the job id and read it with firecrawl_job_status (kind: \"crawl\"). The console shows",
			"the same run, including pages the crawler refused or failed on.",
			"",
			"Costs: credits scale with pages actually crawled. Start with a small limit and widen it.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				url: { type: "string", description: "Absolute http(s) URL where the crawl starts." },
				...crawlProperties,
				wait: { type: "boolean", description: "Wait for the crawl to finish before answering. Default true." },
				timeoutMs: { type: "number", description: "How long to wait for the crawl, in milliseconds (default 300000)." },
			},
			required: ["url"],
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"] as const,
		context: { conversation: "summary" },
		timeoutMs: 330_000,
		handler: async (context: { trigger: { input?: unknown } }) => {
			const input = context.trigger.input;
			const { url, body } = crawlRequestBody(input);
			const client = await config.require();
			const started = Date.now();
			const handle = await client.crawl(body);
			store.adopt(handle.id, url);
			store.note("ok", `crawl  ${url}  job=${handle.id}  limit=${String(body.limit)}`);

			const record = (input ?? {}) as Record<string, unknown>;
			const wait = record.wait !== false;
			if (!wait) {
				return [
					`Crawl started from ${url}.`,
					`Job id: ${handle.id}`,
					"Track it in the crawler console or with firecrawl_job_status (kind: \"crawl\").",
				].join("\n");
			}

			const requested = typeof record.timeoutMs === "number" ? record.timeoutMs : 300_000;
			const status = await pollJob(client, "crawl", handle.id, {
				timeoutMs: Math.min(300_000, Math.max(5_000, requested)),
				intervalMs: 2_500,
				onProgress: (update) => store.progress(update.completed, update.total),
			});
			const lines = [
				`Crawl ${status.status} from ${url} in ${formatDuration(Date.now() - started)}.`,
				...jobSummary(status, client.endpoint, "crawl"),
			];
			if (status.status === "completed") lines.push(...pagesBlock(status.data));
			else if (status.status === "scraping") {
				lines.push("", `The crawl is still running upstream. Read job ${handle.id} with firecrawl_job_status later.`);
			}
			return lines.join("\n");
		},
	};
}

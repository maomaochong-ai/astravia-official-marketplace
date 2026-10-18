/**
 * firecrawl_batch_scrape — many URLs through one asynchronous job.
 */

import { jobSummary, pagesBlock } from "../domain/firecrawl/documents";
import { pollJob } from "../domain/firecrawl/client";
import type { ToolDeps } from "./deps";
import { FORMAT_OPTIONS } from "../domain/firecrawl/formats";
import { batchScrapeBody } from "./request-bodies";
import { captureProperties, jsonProperties } from "./scrape-arguments";
import { formatDuration } from "../shared/formatters/format";

export function createBatchScrapeTool({ config, store }: ToolDeps) {
	return {
		id: "firecrawl_batch_scrape",
		name: "firecrawl_batch_scrape",
		label: "%tool.batch.label%",
		description: [
			"Scrape a fixed list of URLs in one job and return each page's Markdown. Use it when the user already",
			"knows the pages (a list of articles, releases, product pages) and wants them read consistently.",
			"",
			"Prefer firecrawl_crawl when the pages must be discovered from a site, and firecrawl_scrape for a",
			"single page. Duplicate URLs are de-duplicated upstream; invalid ones come back in `invalidURLs`.",
			"",
			"Returns a job id, status and the first pages when `wait` is true (default). With `wait: false` the",
			"job keeps running and firecrawl_job_status reads it later.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				urls: {
					type: "array",
					items: { type: "string" },
					description: "Absolute http(s) URLs to scrape (1-200).",
				},
				formats: {
					type: "array",
					items: { type: "string", enum: [...FORMAT_OPTIONS] },
					description: "Outputs per page. Defaults to Markdown; add HTML, links, images, media URLs, a summary or JSON.",
				},
				wait: { type: "boolean", description: "Wait for the job to finish before answering. Default true." },
				...captureProperties,
				...jsonProperties,
			},
			required: ["urls"],
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"] as const,
		context: { conversation: "summary" },
		timeoutMs: 330_000,
		handler: async (context: { trigger: { input?: unknown } }) => {
			const input = context.trigger.input;
			const { body, urls } = batchScrapeBody(input);
			const client = await config.require();
			const wait = (input as Record<string, unknown> | undefined)?.wait !== false;
			const started = Date.now();
			const handle = await client.batchScrape(body);
			store.note("ok", `batch  ${urls.length} urls  job=${handle.id}`);

			if (!wait) {
				return [
					`Batch job started for ${urls.length} URL(s).`,
					`Job id: ${handle.id}`,
					"Call firecrawl_job_status with kind: \"batch\" and this id to collect the pages.",
				].join("\n");
			}

			const status = await pollJob(client, "batch", handle.id, {
				timeoutMs: 300_000,
				intervalMs: 2_000,
				onProgress: (update) => store.progress(update.completed, update.total),
			});
			const lines = [
				`Batch scrape ${status.status} — ${status.completed}/${status.total} page(s) in ${formatDuration(Date.now() - started)}.`,
				...jobSummary(status, client.endpoint, "batch"),
			];
			if (Array.isArray(handle.invalidURLs) && handle.invalidURLs.length > 0) {
				lines.push(`Invalid URLs: ${handle.invalidURLs.join(", ")}`);
			}
			if (status.status === "completed") lines.push(...pagesBlock(status.data));
			else lines.push("", "The job is still running upstream; call firecrawl_job_status later to collect its pages.");
			return lines.join("\n");
		},
	};
}

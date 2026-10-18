/**
 * firecrawl_job_status — read, wait for, or cancel an asynchronous job.
 */

import { jobSummary, pagesBlock } from "../domain/firecrawl/documents";
import type { JobStatus } from "../domain/firecrawl/types";
import type { ToolDeps } from "./deps";
import { readBoolean, readEnum, readNumber, readOptionalString } from "./tool-arguments";

const KINDS = ["crawl", "batch"] as const;

export function createJobStatusTool({ config, store }: ToolDeps) {
	return {
		id: "firecrawl_job_status",
		name: "firecrawl_job_status",
		label: "%tool.job.label%",
		description: [
			"Read an asynchronous Firecrawl job by id: progress, credits used, pages collected so far and the",
			"pages that failed or were refused. `wait: true` blocks until the job finishes (bounded by",
			"`timeoutMs`), `cancel: true` stops it upstream.",
			"",
			"Use it after firecrawl_crawl or firecrawl_batch_scrape returned a job id because the work outlasted",
			"the wait window. Do NOT start a new crawl just to see progress — that costs credits again.",
			"",
			"`pages` controls how many page previews are included (default 5, max 20). The full result set is",
			"read across upstream pages, so a large crawl is not truncated silently.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				kind: { type: "string", enum: [...KINDS], description: "Job type: crawl or batch. Default crawl." },
				id: { type: "string", description: "Job id returned when the job was created." },
				wait: { type: "boolean", description: "Wait for the job to reach a terminal state. Default false." },
				cancel: { type: "boolean", description: "Cancel the job upstream instead of reading it." },
				timeoutMs: { type: "number", description: "Maximum wait in milliseconds (default 120000)." },
				pages: { type: "number", description: "How many page previews to include (0-20, default 5)." },
			},
			required: ["id"],
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"] as const,
		context: { conversation: "summary" },
		timeoutMs: 300_000,
		handler: async (context: { trigger: { input?: unknown } }) => {
			const input = context.trigger.input;
			const id = readOptionalString(input, "id");
			if (!id) throw new Error('"id" is required: the job id returned when the job was created');
			const kind = readEnum(input, "kind", KINDS, "crawl");
			const client = await config.require();

			if (readBoolean(input, "cancel", false)) {
				await client.cancel(kind, id);
				store.note("warn", `cancel  ${kind} ${id}`);
				return `Cancelled ${kind} job ${id}. Pages already crawled remain available upstream until the job expires.`;
			}

			let status: JobStatus = await client.job(kind, id);
			const wait = readBoolean(input, "wait", false);
			const timeoutMs = readNumber(input, "timeoutMs", { min: 1_000, max: 300_000, def: 120_000 });
			const deadline = Date.now() + timeoutMs;
			while (wait && status.status === "scraping" && Date.now() < deadline) {
				await new Promise((resolve) => setTimeout(resolve, 2_500));
				status = await client.job(kind, id);
				store.progress(status.completed, status.total);
			}

			const limit = readNumber(input, "pages", { min: 0, max: 20, def: 5 });
			const errors = await client.jobErrors(kind, id).catch(() => []);
			const lines = [`Job ${id} (${kind})`, ...jobSummary(status, client.endpoint, kind)];
			if (errors.length > 0) {
				lines.push("", `Failed or refused (${errors.length}):`);
				for (const error of errors.slice(0, 20)) {
					lines.push(`- ${error.url ?? "(unknown URL)"}: ${error.error ?? error.code ?? `HTTP ${error.statusCode ?? "?"}`}`);
				}
				if (errors.length > 20) lines.push(`[... ${errors.length - 20} more]`);
			}
			if (status.status === "completed" && status.data.length > 0 && limit > 0) {
				lines.push(...pagesBlock(status.data.slice(0, limit)));
			}
			if (status.status === "scraping") {
				lines.push("", "Still running. Call firecrawl_job_status again with the same id.");
			}
			return lines.join("\n");
		},
	};
}

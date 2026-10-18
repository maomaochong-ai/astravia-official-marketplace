/**
 * firecrawl_job_status — inspect, poll or cancel an async crawl/batch job.
 *
 * The plugin cannot register background work with the host, so a long crawl runs
 * on the Firecrawl API and this tool is how the agent comes back for the answer.
 */

import { pollUpstreamJob } from "../domain/backend/rest";
import type { JobKind, UpstreamClient, UpstreamDocument, UpstreamJobStatus } from "../domain/backend/types";
import type { UpstreamGate } from "../runtime/upstream";
import { readBoolean, readEnum, readNumber, readOptionalString } from "./tool-arguments";

const KINDS: readonly JobKind[] = ["crawl", "batch"];
const MAX_PAGES = 20;
const MAX_PAGE_CHARS = 4_000;

export function createJobStatusTool(gate: UpstreamGate) {
	return {
		id: "firecrawl_job_status",
		name: "firecrawl_job_status",
		label: "%tool.jobStatus.label%",
		description: [
			"Check a crawl or batch job started with `wait: false`: current progress, the pages collected so far,",
			"and the final state. Also cancels a running job.",
			"",
			"Use it when firecrawl_crawl or firecrawl_batch_scrape returned a job id instead of results. It needs",
			"the Firecrawl API engine; the local engine returns everything inside the original tool call.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				kind: { type: "string", enum: [...KINDS], description: "crawl or batch (default crawl)." },
				id: { type: "string", description: "Job id returned when the job was submitted." },
				wait: { type: "boolean", description: "Keep polling until the job finishes (default true)." },
				cancel: { type: "boolean", description: "Cancel the job instead of reading it." },
				timeoutMs: { type: "number", description: "How long to keep polling at most (1000-900000, default 120000)." },
				pages: { type: "number", description: "How many page previews to include (0-50, default 5)." },
			},
			required: ["id"],
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"] as const,
		timeoutMs: 900_000,
		handler: async (context: { trigger: { input?: unknown } }) => {
			const input = context.trigger.input;
			const client = await gate.require();
			const kind = readEnum(input, "kind", KINDS, "crawl");
			const id = readOptionalString(input, "id");
			if (!id) throw new Error('"id" is required: the job id returned by firecrawl_crawl / firecrawl_batch_scrape');

			if (readBoolean(input, "cancel", false)) {
				await client.cancel(kind, id);
				return `Cancelled ${kind} job ${id} on ${client.endpoint}.`;
			}

			const wait = readBoolean(input, "wait", true);
			const timeoutMs = readNumber(input, "timeoutMs", { min: 1_000, max: 900_000, def: 120_000 });
			const status = wait
				? await pollUpstreamJob(client, kind, id, { timeoutMs })
				: await client.job(kind, id);
			return describe(client, kind, id, status, readNumber(input, "pages", { min: 0, max: 50, def: 5 }));
		},
	};
}

function describe(
	client: UpstreamClient,
	kind: JobKind,
	id: string,
	status: UpstreamJobStatus,
	pages: number,
): string {
	const lines = [
		`${kind} job ${id} on ${client.endpoint}`,
		`Status: ${status.status}  ${status.completed}/${status.total || "?"} page(s)${
			status.creditsUsed !== undefined ? `  credits: ${status.creditsUsed}` : ""
		}`,
	];
	if (status.expiresAt) lines.push(`Expires: ${status.expiresAt}`);
	if (status.error) lines.push(`Error: ${status.error}`);
	if (status.warning) lines.push(`Warning: ${status.warning}`);
	if (status.status === "scraping") lines.push(`Still running. Poll again with the same id.`);

	const shown: UpstreamDocument[] = status.data.slice(0, pages);
	if (shown.length > 0) lines.push("", `Pages (${shown.length} of ${status.data.length}):`);
	for (const [index, page] of shown.entries()) {
		lines.push("", `### ${index + 1}. ${page.title ?? "(untitled)"}`, `URL: ${page.url ?? "(unknown)"}`);
		const markdown = page.markdown ?? "";
		if (markdown.length > 0) {
			lines.push(
				markdown.length > MAX_PAGE_CHARS ? `${markdown.slice(0, MAX_PAGE_CHARS)}\n[... truncated]` : markdown,
			);
		}
	}
	if (status.data.length > shown.length) {
		lines.push("", `[... ${status.data.length - shown.length} more page(s); raise "pages" to include them]`);
	}
	if (status.status === "completed" && status.data.length === 0) {
		lines.push("", "The job completed without returning pages (the site may have refused every URL).");
	}
	return lines.join("\n");
}

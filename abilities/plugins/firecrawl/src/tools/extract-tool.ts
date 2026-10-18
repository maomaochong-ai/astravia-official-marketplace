/**
 * firecrawl_extract — structured data across one or more pages.
 */

import { clip } from "../domain/firecrawl/documents";
import type { ExtractStatus } from "../domain/firecrawl/types";
import type { ToolDeps } from "./deps";
import { extractBody } from "./request-bodies";
import { readBoolean, readNumber, readOptionalString, requireUrl } from "./tool-arguments";

const TERMINAL = ["completed", "failed", "cancelled"];

export function createExtractTool({ config, store }: ToolDeps) {
	return {
		id: "firecrawl_extract",
		name: "firecrawl_extract",
		label: "%tool.extract.label%",
		description: [
			"Extract structured data from pages that match a JSON schema or a prompt. Firecrawl finds the",
			"right pages (from a URL, a list of URLs, or a web search) and returns one JSON object instead of",
			"page text.",
			"",
			"Use it when the user wants records — prices, contacts, release notes, product specs — not prose.",
			"Describe the shape in `schema` and say what to find in `prompt`.",
			"Do NOT use it for open-ended reading (firecrawl_scrape): extraction can silently drop fields the",
			"schema did not ask for, so quote whole pages when the user needs the original text.",
			"",
			"Extraction costs credits per page and may outlast the wait window. When that happens the answer",
			"includes a job id; call this tool again with `jobId` to collect the result instead of paying for",
			"a second run.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				urls: { type: "array", items: { type: "string" }, description: "Pages to extract from." },
				url: { type: "string", description: "Single start page to crawl from when `urls` is absent." },
				query: { type: "string", description: "Natural-language description when no URL is known; needs enableWebSearch." },
				prompt: { type: "string", description: "What to extract, in plain language." },
				schema: { type: "object", description: "JSON Schema the result must follow." },
				enableWebSearch: { type: "boolean", description: "Let Firecrawl search the web for matching pages. Default false." },
				wait: { type: "boolean", description: "Wait for the job to finish before answering. Default true." },
				timeoutMs: { type: "number", description: "How long to wait, in milliseconds (default 300000)." },
				jobId: { type: "string", description: "Read an extraction started by an earlier call instead of starting a new one." },
			},
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"] as const,
		context: { conversation: "summary" },
		timeoutMs: 330_000,
		handler: async (context: { trigger: { input?: unknown } }) => {
			const input = context.trigger.input;
			const client = await config.require();
			const existing = readOptionalString(input, "jobId");

			let jobId = existing ?? "";
			if (!jobId) {
				const body = extractBody(input);
				const startUrl = readOptionalString(input, "url");
				if (startUrl) body.url = requireUrl(input, "url");
				const handle = await client.extract(body);
				jobId = handle.id;
				store.note("ok", `extract  job=${handle.id}`);
				if (!readBoolean(input, "wait", true)) {
					return [
						"Extraction job started.",
						`Job id: ${jobId}`,
						`Call firecrawl_extract with jobId "${jobId}" once it finishes to collect the result.`,
					].join("\n");
				}
			}

			const timeoutMs = readNumber(input, "timeoutMs", { min: 5_000, max: 300_000, def: 300_000 });
			const deadline = Date.now() + timeoutMs;
			let status: ExtractStatus = await client.extractStatus(jobId);
			while (!TERMINAL.includes(status.status) && Date.now() < deadline) {
				await new Promise((resolve) => setTimeout(resolve, 2_500));
				status = await client.extractStatus(jobId);
			}

			const lines = [`Extraction ${status.status}  job=${jobId}`];
			if (status.error) lines.push(`Error: ${status.error}`);
			if (status.data !== undefined && status.data !== null) {
				lines.push("", clip(JSON.stringify(status.data, null, 2), 20_000));
			}
			if (!TERMINAL.includes(status.status)) {
				lines.push("", `Still running upstream. Call firecrawl_extract with jobId "${jobId}" again later.`);
			}
			return lines.join("\n");
		},
	};
}

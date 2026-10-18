/**
 * firecrawl_agent — Firecrawl's browsing agent, for questions no single page
 * answers.
 *
 * The agent decides which pages to open, so it is the only tool here that can
 * return an answer without the caller naming a URL. It is also the only one
 * billed per credit budget rather than per page, which is why `maxCredits` is
 * surfaced and why a run that stops at the limit is reported as partial rather
 * than failed.
 */

import { clip } from "../domain/firecrawl/documents";
import type { AgentStatus } from "../domain/firecrawl/types";
import type { ToolDeps } from "./deps";
import { readBoolean, readJsonObject, readNumber, readOptionalString, readStringArray } from "./tool-arguments";
import { ToolArgumentError, readEnum } from "./tool-arguments";

const EFFORTS = ["low", "medium", "high"] as const;
const TERMINAL = ["completed", "failed"];
const MAX_PROMPT_CHARS = 10_000;

function describeAgentStatus(status: AgentStatus): string {
	const lines = [`Agent run ${status.status}${status.model ? `  model=${status.model}` : ""}${status.effort ? `  effort=${status.effort}` : ""}`];
	if (status.creditsUsed !== undefined) lines.push(`Credits used: ${status.creditsUsed}`);
	if (status.error) lines.push(`Error: ${status.error}`);
	if (status.message) lines.push("", status.message);
	if (status.data !== undefined && status.data !== null) {
		lines.push("", "Result:", clip(JSON.stringify(status.data, null, 2), 20_000));
	} else if (status.partial !== undefined && status.partial !== null) {
		const note = status.stopReason === "credit_limit_reached" ? "Stopped at maxCredits." : "Incomplete run.";
		lines.push(
			"",
			`${note} Partial result${status.partialSchemaValid === false ? " (does not fully match the schema)" : ""}:`,
			clip(JSON.stringify(status.partial, null, 2), 20_000),
		);
	}
	return lines.join("\n");
}

export function createAgentTool({ config, store }: ToolDeps) {
	return {
		id: "firecrawl_agent",
		name: "firecrawl_agent",
		label: "%tool.agent.label%",
		description: [
			"Ask Firecrawl's browsing agent to research a question across the web and return one structured",
			"answer. You describe the question in `prompt` and optionally the JSON shape in `schema`; the agent",
			"decides which pages to open, so you do not need URLs.",
			"",
			"Use it for questions that need several sources — 'which of these three vendors ships SSO on the",
			"free plan', 'collect the release dates from these changelogs'. When the answer lives on one known",
			"page, firecrawl_scrape is cheaper and exact; when the pages are known and the shape is fixed,",
			"firecrawl_extract is cheaper still.",
			"",
			"Cost is bounded by `maxCredits` (default 2500 upstream). A run that hits that limit returns a",
			"partial result instead of failing; it is reported as partial on purpose. Long runs return a job id —",
			"call this tool again with `jobId` to collect the answer without paying twice.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				prompt: { type: "string", description: "What to find out, in plain language. Max 10000 characters." },
				schema: { type: "object", description: "JSON Schema the answer must follow." },
				urls: { type: "array", items: { type: "string" }, description: "Optional URLs to start from." },
				strictConstrainToURLs: {
					type: "boolean",
					description: "Only visit the URLs in `urls`, never anything else. Default false.",
				},
				maxCredits: { type: "number", description: "Credit budget for this run. Upstream defaults to 2500." },
				effort: { type: "string", enum: [...EFFORTS], description: "Reasoning budget: low, medium or high." },
				wait: { type: "boolean", description: "Wait for the run to finish before answering. Default true." },
				timeoutMs: { type: "number", description: "How long to wait, in milliseconds (default 300000)." },
				jobId: { type: "string", description: "Read a run started by an earlier call instead of starting a new one." },
			},
			required: ["prompt"],
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
				const prompt = readOptionalString(input, "prompt");
				if (!prompt) throw new ToolArgumentError('"prompt" is required to start an agent run');
				if (prompt.length > MAX_PROMPT_CHARS) throw new ToolArgumentError(`"prompt" is longer than ${MAX_PROMPT_CHARS} characters`);

				const body: Record<string, unknown> = { prompt };
				const urls = readStringArray(input, "urls", 10);
				if (urls.length > 0) {
					for (const url of urls) {
						try {
							const parsed = new URL(url);
							if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("protocol");
						} catch {
							throw new ToolArgumentError(`"urls" contains an invalid URL: ${url}`);
						}
					}
					body.urls = urls;
				}
				const schema = readJsonObject(input, "schema");
				if (schema) body.schema = schema;
				if (readBoolean(input, "strictConstrainToURLs", false)) body.strictConstrainToURLs = true;
				const maxCredits = readNumber(input, "maxCredits", { min: 1, max: 100_000, def: 0 });
				if (maxCredits > 0) body.maxCredits = maxCredits;
				const effort = readOptionalString(input, "effort");
				if (effort && (EFFORTS as readonly string[]).includes(effort)) body.effort = effort;

				const run = await client.agent.start(body);
				jobId = run.id;
				store.note("ok", `agent  job=${run.id}`);
				if (!readBoolean(input, "wait", true)) {
					return [
						"Agent run started.",
						`Job id: ${jobId}${run.threadId ? `  thread=${run.threadId}` : ""}`,
						`Call firecrawl_agent with jobId "${jobId}" once it finishes to collect the answer.`,
					].join("\n");
				}
			}

			const timeoutMs = readNumber(input, "timeoutMs", { min: 5_000, max: 300_000, def: 300_000 });
			const deadline = Date.now() + timeoutMs;
			let status: AgentStatus = await client.agent.status(jobId);
			while (!TERMINAL.includes(status.status) && Date.now() < deadline) {
				await new Promise((resolve) => setTimeout(resolve, 3_000));
				status = await client.agent.status(jobId);
			}

			const lines = [describeAgentStatus(status), "", `job=${jobId}`];
			if (!TERMINAL.includes(status.status)) {
				lines.push(`Still running upstream. Call firecrawl_agent with jobId "${jobId}" again later.`);
			}
			if (status.status === "failed") store.note("error", `agent  job=${jobId}  failed`);
			return lines.join("\n");
		},
	};
}

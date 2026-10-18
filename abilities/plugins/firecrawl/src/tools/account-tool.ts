/**
 * firecrawl_account — what the key may spend and what it is already running.
 *
 * Credits, queue depth and in-flight crawls are one question from a user's point
 * of view ("is anything of mine stuck, and can I afford the next crawl?"), so
 * they share one tool instead of three near-empty ones.
 */

import type { ToolDeps } from "./deps";
import { readEnum } from "./tool-arguments";

const OPERATIONS = ["usage", "queue", "active"] as const;

export function createAccountTool({ config, store }: ToolDeps) {
	return {
		id: "firecrawl_account",
		name: "firecrawl_account",
		label: "%tool.account.label%",
		description: [
			"Read the Firecrawl account behind the configured API key:",
			"",
			"- `usage` — remaining and plan credits plus the billing period.",
			"- `queue` — jobs upstream is holding, how many are running, and the concurrency ceiling.",
			"- `active` — crawl jobs still being worked on, with the id to pass to firecrawl_job_status.",
			"",
			"Use it before an expensive crawl (is there credit?), or when a job id was lost and a crawl may",
			"still be running upstream (do NOT start a second one). Reading these endpoints costs no credits.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				operation: {
					type: "string",
					enum: [...OPERATIONS],
					description: "What to read: usage, queue or active. Default usage.",
				},
			},
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"] as const,
		context: { conversation: "summary" },
		timeoutMs: 30_000,
		handler: async (context: { trigger: { input?: unknown } }) => {
			const input = context.trigger.input;
			const operation = readEnum(input, "operation", OPERATIONS, "usage");
			const client = await config.require();

			if (operation === "queue") {
				const queue = await client.queue();
				store.note("ok", `queue  ${queue.activeJobsInQueue}/${queue.maxConcurrency}`);
				return [
					"Firecrawl queue",
					`- jobs in queue: ${queue.jobsInQueue}`,
					`- running: ${queue.activeJobsInQueue}`,
					`- waiting: ${queue.waitingJobsInQueue}`,
					`- concurrency ceiling: ${queue.maxConcurrency}`,
					...(queue.mostRecentSuccess ? [`- most recent success: ${queue.mostRecentSuccess}`] : []),
				].join("\n");
			}

			if (operation === "active") {
				const crawls = await client.activeCrawls();
				store.note("ok", `active  ${crawls.length}`);
				if (crawls.length === 0) return "No crawl is running upstream for this API key.";
				const lines = [`${crawls.length} crawl${crawls.length === 1 ? "" : "s"} still running upstream:`];
				for (const crawl of crawls) {
					// No progress counter is exposed on this endpoint; showing one would invent it.
					const state = crawl.status ? `  ${crawl.status}` : "";
					const limit = crawl.limit ? `  limit=${crawl.limit}` : "";
					lines.push(`- ${crawl.id}${state}${limit}  ${crawl.url ?? ""}`.trimEnd());
				}
				lines.push("", "Read one with firecrawl_job_status { kind: \"crawl\", id }.");
				return lines.join("\n");
			}

			const usage = (await client.credits()) as Record<string, unknown>;
			const remaining = typeof usage.remainingCredits === "number" ? usage.remainingCredits : undefined;
			const plan = typeof usage.planCredits === "number" ? usage.planCredits : undefined;
			store.note("ok", `usage  ${remaining ?? "?"}/${plan ?? "?"}`);
			const lines = ["Firecrawl account"];
			if (remaining !== undefined && plan !== undefined) lines.push(`- credits: ${remaining} / ${plan} left`);
			else if (remaining !== undefined) lines.push(`- credits left: ${remaining}`);
			else lines.push("- credits: upstream did not report a balance");
			if (typeof usage.billingPeriodStart === "string") {
				lines.push(`- billing period: ${usage.billingPeriodStart} → ${String(usage.billingPeriodEnd ?? "?")}`);
			}
			const extras = Object.entries(usage).filter(
				([key]) => !["remainingCredits", "planCredits", "billingPeriodStart", "billingPeriodEnd"].includes(key),
			);
			if (extras.length > 0) lines.push(`- also reported: ${extras.map(([key]) => key).join(", ")}`);
			return lines.join("\n");
		},
	};
}

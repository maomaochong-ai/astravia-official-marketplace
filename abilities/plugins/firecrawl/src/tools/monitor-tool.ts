/**
 * firecrawl_monitor — scheduled re-checks of pages, crawls or searches.
 *
 * Upstream owns the scheduler: cron parsing, timezones, retries, retention and
 * the check history all live there, so this tool is a typed pass-through rather
 * than a second implementation of "a cron job that scrapes".
 */

import { readBoolean, readNumber, readOptionalString, readStringArray, requireUrl } from "./tool-arguments";
import type { UpstreamGate } from "../runtime/upstream";
import type { UpstreamMonitor } from "../domain/backend/types";

const OPERATIONS = ["create", "list", "get", "update", "delete", "run", "checks"] as const;
const TARGET_TYPES = ["scrape", "crawl", "search"] as const;
const STATUSES = ["active", "paused"] as const;
const TIMEZONES_HINT = "IANA name such as UTC, Europe/Berlin, Asia/Shanghai.";

export function createMonitorTool(gate: UpstreamGate, _store: unknown) {
	return {
		id: "firecrawl_monitor",
		name: "firecrawl_monitor",
		label: "%tool.monitor.label%",
		description: [
			"Scheduled monitoring: re-check chosen pages, a crawl, or search queries on a cron schedule and read",
			"the history of what changed. Upstream runs the scheduler, so this needs the Firecrawl API engine.",
			"",
			"Use it when the user asks to 'watch this page', 'tell me when it changes', 'check these docs daily'.",
			"For one-off reads use firecrawl_scrape or firecrawl_crawl instead.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				operation: { type: "string", enum: [...OPERATIONS], description: "create (default), list, get, update, delete, run or checks." },
				id: { type: "string", description: "Monitor id, required for get/update/delete/run/checks." },
				name: { type: "string", description: "Human name shown in the Firecrawl dashboard (1-256 chars)." },
				cron: { type: "string", description: "Cron expression, e.g. \"0 9 * * *\". Give cron or scheduleText." },
				scheduleText: { type: "string", description: "Plain-language schedule, e.g. \"every day at 9am\"." },
				timezone: { type: "string", description: TIMEZONES_HINT },
				targetType: { type: "string", enum: [...TARGET_TYPES], description: "scrape (urls), crawl (url) or search (queries)." },
				urls: { type: "array", items: { type: "string" }, description: "Pages to watch (scrape target)." },
				queries: { type: "array", items: { type: "string" }, description: "Search queries to run (search target)." },
				status: { type: "string", enum: [...STATUSES], description: "Pause or resume (update only)." },
				goal: { type: "string", description: "What counts as a relevant change, in one sentence." },
				retentionDays: { type: "number", description: "How long check history is kept (1-365, default 30)." },
				limit: { type: "number", description: "checks: how many records to read (1-100, default 20)." },
				wait: { type: "boolean", description: "run: wait for the check to finish (default false)." },
			},
			required: ["operation"],
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"] as const,
		timeoutMs: 180_000,
		handler: async (context: { trigger: { input?: unknown } }) => {
			const input = context.trigger.input;
			const client = await gate.require();
			const operation = readOptionalString(input, "operation") ?? "create";
			const id = readOptionalString(input, "id");

			if (operation === "list") {
				const monitors = await client.monitors.list();
				if (monitors.length === 0) return `No monitors on ${client.endpoint} yet.`;
				return [`${monitors.length} monitor(s) on ${client.endpoint}:`, ...monitors.map(formatMonitor)].join("\n\n");
			}

			if (!id && operation !== "create") {
				throw new Error(`"id" is required for operation "${operation}"`);
			}

			if (operation === "get" && id) return formatMonitor(await client.monitors.get(id));

			if (operation === "checks" && id) {
				const limit = readNumber(input, "limit", { min: 1, max: 100, def: 20 });
				const result = await client.monitors.checks(id, { limit });
				if (result.data.length === 0) return `No checks recorded for monitor ${id} yet.`;
				return [
					`${result.data.length} check(s) for monitor ${id}:`,
					...result.data.map((entry) => JSON.stringify(entry)),
				].join("\n");
			}

			if (operation === "delete" && id) {
				await client.monitors.remove(id);
				return `Deleted monitor ${id} on ${client.endpoint}.`;
			}

			if (operation === "run" && id) {
				const result = await client.monitors.run(id);
				return [
					`Triggered monitor ${id} on ${client.endpoint}.`,
					readBoolean(input, "wait", false) ? JSON.stringify(result, null, 2) : "The check runs in the background.",
				].join("\n");
			}

			if (operation === "update" && id) {
				const body: Record<string, unknown> = {};
				const name = readOptionalString(input, "name");
				if (name) body.name = name;
				const cron = readOptionalString(input, "cron");
				const scheduleText = readOptionalString(input, "scheduleText");
				const timezone = readOptionalString(input, "timezone");
				if (cron || scheduleText || timezone) {
					body.schedule = { ...(cron ? { cron } : {}), ...(scheduleText ? { text: scheduleText } : {}), ...(timezone ? { timezone } : {}) };
				}
				const status = readOptionalString(input, "status");
				if (status && (STATUSES as readonly string[]).includes(status)) body.status = status;
				const goal = readOptionalString(input, "goal");
				if (goal) body.goal = goal;
				const retentionDays = readNumber(input, "retentionDays", { min: 1, max: 365, def: 0 });
				if (retentionDays > 0) body.retentionDays = retentionDays;
				if (Object.keys(body).length === 0) throw new Error("update needs at least one field to change");
				return formatMonitor(await client.monitors.update(id, body));
			}

			if (operation !== "create") throw new Error(`Unsupported operation "${operation}"`);

			const targetType = readOptionalString(input, "targetType") ?? "scrape";
			const urls = readStringArray(input, "urls", 50).map((entry) => requireUrl({ url: entry }));
			const queries = readStringArray(input, "queries", 12).map((entry) => entry.trim()).filter(Boolean);
			const target =
				targetType === "search"
					? queries.length > 0
						? { type: "search", queries }
						: null
					: targetType === "crawl"
						? urls.length === 1
							? { type: "crawl", url: urls[0] }
							: null
						: urls.length > 0
							? { type: "scrape", urls }
							: null;
			if (!target) {
				throw new Error(
					targetType === "search"
						? "search monitor needs `queries`"
						: targetType === "crawl"
							? "crawl monitor needs exactly one URL in `urls`"
							: "scrape monitor needs at least one URL in `urls`",
				);
			}

			const cron = readOptionalString(input, "cron");
			const scheduleText = readOptionalString(input, "scheduleText");
			if (!cron && !scheduleText) throw new Error('a schedule is required: pass `cron` (e.g. "0 9 * * *") or `scheduleText`');
			const body: Record<string, unknown> = {
				name: readOptionalString(input, "name") ?? `Watch ${urls[0] ?? queries[0] ?? "target"}`,
				schedule: {
					...(cron ? { cron } : {}),
					...(scheduleText ? { text: scheduleText } : {}),
					timezone: readOptionalString(input, "timezone") ?? "UTC",
				},
				targets: [target],
			};
			const goal = readOptionalString(input, "goal");
			if (goal) body.goal = goal;
			const retentionDays = readNumber(input, "retentionDays", { min: 1, max: 365, def: 0 });
			if (retentionDays > 0) body.retentionDays = retentionDays;
			return formatMonitor(await client.monitors.create(body));
		},
	};
}

function formatMonitor(monitor: UpstreamMonitor): string {
	const record = (monitor ?? {}) as Record<string, unknown>;
	const schedule = (record.schedule ?? {}) as Record<string, unknown>;
	const targets = Array.isArray(record.targets) ? (record.targets as Array<Record<string, unknown>>) : [];
	const lines = [
		`${String(record.name ?? "(unnamed)")}  [${String(record.status ?? "?")}]`,
		`id: ${String(record.id ?? "?")}`,
		`schedule: ${String(schedule.cron ?? schedule.text ?? "?")} (${String(schedule.timezone ?? "UTC")})`,
	];
	if (record.nextRunAt) lines.push(`next run: ${String(record.nextRunAt)}`);
	if (record.lastRunAt) lines.push(`last run: ${String(record.lastRunAt)}`);
	if (record.goal) lines.push(`goal: ${String(record.goal)}`);
	for (const target of targets) {
		const urls = Array.isArray(target.urls) ? (target.urls as unknown[]).map(String) : [];
		const queries = Array.isArray(target.queries) ? (target.queries as unknown[]).map(String) : [];
		lines.push(
			`target ${String(target.type ?? "?")}: ${[...urls, ...queries].slice(0, 10).join(", ") || String(target.url ?? "")}`,
		);
	}
	return lines.join("\n");
}

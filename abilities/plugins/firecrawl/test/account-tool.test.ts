/**
 * `firecrawl_account` and the agent trace.
 *
 * Both read endpoints the console never surfaced before, and both have to
 * survive the upstream shapes being inconsistent: `/v2/crawl/active` documents
 * `crawls` but returns `data`, and a trace arrives ordered by nothing that can
 * be trusted at render time.
 */

import { describe, expect, it, vi } from "vitest";
import type { PluginContext } from "@astravia-org/plugin-sdk";
import { createClient } from "../src/domain/firecrawl/client";
import type { Transport, TransportRequest, TransportResponse } from "../src/domain/firecrawl/transport";
import type { FirecrawlConfig } from "../src/runtime/config";
import { createAccountTool } from "../src/tools/account-tool";
import { createAgentTool } from "../src/tools/agent-tool";

interface Call {
	url: string;
	method: string;
}

function harness(reply: (call: Call) => unknown) {
	const calls: Call[] = [];
	const transport: Transport = async (request: TransportRequest): Promise<TransportResponse> => {
		const call: Call = { url: request.url, method: request.method };
		calls.push(call);
		return { status: 200, ok: true, body: JSON.stringify({ success: true, ...(reply(call) as object) }) };
	};
	const client = createClient({ endpoint: "https://api.firecrawl.dev", apiKey: "fc-test", transport });
	const note = vi.fn();
	const deps = {
		ctx: {} as PluginContext,
		config: { require: async () => client } as unknown as FirecrawlConfig,
		store: { note } as never,
	};
	return { calls, deps, note };
}

describe("firecrawl_account", () => {
	it("reports the balance out of the `data` envelope", async () => {
		const { deps, calls } = harness(() => ({
			data: { remainingCredits: 480, planCredits: 500, billingPeriodStart: "2026-10-01", billingPeriodEnd: "2026-11-01" },
		}));
		const tool = createAccountTool(deps);

		const result = await tool.handler({ trigger: { input: {} } });

		expect(calls[0]?.url).toBe("https://api.firecrawl.dev/v2/team/credit-usage");
		expect(result).toContain("480 / 500");
		expect(result).toContain("2026-10-01");
	});

	it("says so when upstream reports no balance at all", async () => {
		const { deps } = harness(() => ({ data: {} }));
		const tool = createAccountTool(deps);

		expect(await tool.handler({ trigger: { input: { operation: "usage" } } })).toContain("did not report a balance");
	});

	it("coerces missing queue counters to zero instead of NaN", async () => {
		const { deps, note } = harness(() => ({ jobsInQueue: 4, activeJobsInQueue: 2 }));
		const tool = createAccountTool(deps);

		const result = await tool.handler({ trigger: { input: { operation: "queue" } } });

		expect(result).toContain("waiting: 0");
		expect(result).toContain("concurrency ceiling: 0");
		expect(note).toHaveBeenCalledWith("ok", "queue  2/0");
	});

	it("reads active crawls from `data` when `crawls` is absent", async () => {
		const { deps, calls } = harness(() => ({
			data: [{ id: "crawl_1", url: "https://example.com", status: "scraping", options: { scrapeOptions: { limit: 40 } } }],
		}));
		const tool = createAccountTool(deps);

		const result = await tool.handler({ trigger: { input: { operation: "active" } } });

		expect(calls[0]?.url).toBe("https://api.firecrawl.dev/v2/crawl/active");
		expect(result).toContain("crawl_1");
		expect(result).toContain("scraping");
		expect(result).toContain("limit=40");
	});

	it("calls an empty active list empty rather than broken", async () => {
		const { deps } = harness(() => ({}));
		const tool = createAccountTool(deps);

		expect(await tool.handler({ trigger: { input: { operation: "active" } } })).toContain("No crawl is running");
	});
});

describe("firecrawl_agent trace", () => {
	it("renders steps in producer order even when the response is shuffled", async () => {
		const { deps, calls } = harness((call) => {
			if (call.url.includes("/trace")) {
				return {
					events: [
						{ type: "search", producerSequence: 3, occurredAt: "2026-10-18T10:00:00Z" },
						{ type: "start", producerSequence: 1, occurredAt: "2026-10-18T10:00:02Z" },
						{ type: "scrape", producerSequence: 2, occurredAt: "2026-10-18T10:00:01Z" },
					],
				};
			}
			return {
				id: "agent_1",
				status: "completed",
				model: "spark-1-mini",
				effort: "medium",
				creditsUsed: 7,
				data: { answer: "Answer" },
			};
		});
		const tool = createAgentTool(deps);

		const result = await tool.handler({ trigger: { input: { jobId: "agent_1", trace: true } } });

		expect(calls.some((call) => call.url.includes("/v2/agent/agent_1/trace"))).toBe(true);
		const order = ["start", "scrape", "search"].map((type) => result.indexOf(type));
		expect(order.every((index) => index >= 0)).toBe(true);
		expect([...order].sort((left, right) => left - right)).toEqual(order);
	});

	it("keeps the answer when the trace endpoint fails", async () => {
		const callsSeen: string[] = [];
		const transport: Transport = async (request): Promise<TransportResponse> => {
			callsSeen.push(request.url);
			if (request.url.includes("/trace")) return { status: 500, ok: false, body: "boom" };
			return {
				status: 200,
				ok: true,
				body: JSON.stringify({ success: true, id: "agent_1", status: "completed", data: { answer: "Answer" } }),
			};
		};
		const client = createClient({ endpoint: "https://api.firecrawl.dev", apiKey: "fc-test", transport });
		const tool = createAgentTool({
			ctx: {} as PluginContext,
			config: { require: async () => client } as unknown as FirecrawlConfig,
			store: { note: vi.fn() } as never,
		});

		const result = await tool.handler({ trigger: { input: { jobId: "agent_1", trace: true } } });

		expect(result).toContain("Answer");
		expect(result).toContain("Trace unavailable");
		expect(callsSeen.some((url) => url.includes("/trace"))).toBe(true);
	});
});

/**
 * The three tools added with the interact/agent/index parity pass. Their inputs
 * reach upstream as request paths and bodies, so what matters here is the wire
 * shape — and that a session id cannot become a path segment of its own.
 */

import { describe, expect, it, vi } from "vitest";
import type { PluginContext } from "@astravia-org/plugin-sdk";
import { createClient } from "../src/domain/firecrawl/client";
import type { Transport, TransportRequest, TransportResponse } from "../src/domain/firecrawl/transport";
import type { FirecrawlConfig } from "../src/runtime/config";
import { createAgentTool } from "../src/tools/agent-tool";
import { createIndexSearchTool } from "../src/tools/index-search-tool";
import { createInteractTool } from "../src/tools/interact-tool";

interface Call {
	url: string;
	method: string;
	body: unknown;
}

function harness(reply: (call: Call) => unknown) {
	const calls: Call[] = [];
	const transport: Transport = async (request: TransportRequest): Promise<TransportResponse> => {
		const call: Call = { url: request.url, method: request.method, body: request.body };
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

describe("firecrawl_interact", () => {
	it("creates a session and reports its id without running anything locally", async () => {
		const { deps, calls } = harness(() => ({ id: "sess_1", expiresAt: "2026-10-18T12:00:00Z" }));
		const tool = createInteractTool(deps);

		const result = await tool.handler({ trigger: { input: {} } });

		expect(calls[0]?.url).toBe("https://api.firecrawl.dev/v2/interact");
		expect(calls[0]?.method).toBe("POST");
		expect(result).toContain("sess_1");
	});

	it("runs code in the named session and keeps it out of the console log", async () => {
		const { deps, calls, note } = harness(() => ({ stdout: "ok", exitCode: 0 }));
		const tool = createInteractTool(deps);

		const result = await tool.handler({
			trigger: { input: { action: "execute", sessionId: "sess_1", code: 'await page.goto("https://x.test")' } },
		});

		expect(calls[0]?.url).toBe("https://api.firecrawl.dev/v2/interact/sess_1/execute");
		expect((calls[0]?.body as { value: unknown }).value).toMatchObject({ language: "node" });
		expect(result).toContain("ok");
		for (const call of note.mock.calls) {
			for (const argument of call) expect(JSON.stringify(argument)).not.toContain("page.goto");
		}
	});

	it("refuses a session id that could escape the path", async () => {
		const { deps, calls } = harness(() => ({}));
		const tool = createInteractTool(deps);

		await expect(
			tool.handler({ trigger: { input: { action: "execute", sessionId: "../../team", code: "1" } } }),
		).rejects.toThrow(/not a valid session id/);
		expect(calls).toHaveLength(0);
	});

	it("requires code before calling upstream", async () => {
		const { deps, calls } = harness(() => ({}));
		const tool = createInteractTool(deps);

		await expect(tool.handler({ trigger: { input: { action: "execute", sessionId: "sess_1" } } })).rejects.toThrow(
			/"code" is required/,
		);
		expect(calls).toHaveLength(0);
	});

	it("stops a session with DELETE", async () => {
		const { deps, calls } = harness(() => ({}));
		const tool = createInteractTool(deps);

		const result = await tool.handler({ trigger: { input: { action: "stop", sessionId: "sess_1" } } });

		expect(calls[0]).toMatchObject({ method: "DELETE", url: "https://api.firecrawl.dev/v2/interact/sess_1" });
		expect(result).toContain("stopped");
	});
});

describe("firecrawl_agent", () => {
	it("starts a run, then polls until it completes", async () => {
		let statusCalls = 0;
		const { deps, calls } = harness((call) => {
			if (call.method === "POST") return { id: "job_1", threadId: "th_1" };
			statusCalls += 1;
			return statusCalls === 1
				? { status: "processing" }
				: { status: "completed", data: { answer: "42" }, creditsUsed: 12, model: "spark-2" };
		});
		const tool = createAgentTool(deps);

		const result = await tool.handler({ trigger: { input: { prompt: "How many?", timeoutMs: 20_000 } } });

		expect(calls[0]).toMatchObject({ method: "POST", url: "https://api.firecrawl.dev/v2/agent" });
		expect((calls[0]?.body as { value: unknown }).value).toMatchObject({ prompt: "How many?" });
		expect(result).toContain("completed");
		expect(result).toContain("42");
		expect(result).toContain("job_1");
	});

	it("labels a credit-capped run as partial instead of failed", async () => {
		const { deps } = harness((call) =>
			call.method === "POST"
				? { id: "job_2" }
				: { status: "completed", stopReason: "credit_limit_reached", partial: { answer: "half" }, partialSchemaValid: false },
		);
		const tool = createAgentTool(deps);

		const result = await tool.handler({ trigger: { input: { prompt: "Anything" } } });

		expect(result).toContain("Partial result");
		expect(result).toContain("maxCredits");
		expect(result).not.toContain("failed");
	});

	it("collects an existing run without starting another", async () => {
		const { deps, calls } = harness(() => ({ status: "completed", data: { ok: true } }));
		const tool = createAgentTool(deps);

		await tool.handler({ trigger: { input: { jobId: "job_3" } } });

		expect(calls).toHaveLength(1);
		expect(calls[0]).toMatchObject({ method: "GET", url: "https://api.firecrawl.dev/v2/agent/job_3" });
	});
});

describe("firecrawl_index_search", () => {
	it("sends the developer index body as POST /v2/search/developer", async () => {
		const { deps, calls } = harness(() => ({
			results: [{ id: "r1", type: "issue", url: "https://github.com/a/b/issues/1", title: "Bug", passages: [{ text: "boom" }] }],
		}));
		const tool = createIndexSearchTool(deps);

		const result = await tool.handler({
			trigger: { input: { index: "developer", query: "timeout", types: ["issue"], repos: ["a/b"], skillsOnly: true } },
		});

		expect(calls[0]).toMatchObject({ method: "POST", url: "https://api.firecrawl.dev/v2/search/developer" });
		expect((calls[0]?.body as { value: unknown }).value).toMatchObject({ query: "timeout", types: ["issue"], repos: ["a/b"], skills: "only" });
		expect(result).toContain("github.com/a/b/issues/1");
	});

	it("reads the gov index out of data.web", async () => {
		const { deps, calls } = harness(() => ({
			data: { web: [{ url: "https://agency.gov/rule", title: "Final rule", description: "Effective soon" }] },
		}));
		const tool = createIndexSearchTool(deps);

		const result = await tool.handler({ trigger: { input: { index: "gov", query: "rule" } } });

		expect(calls[0]?.url).toBe("https://api.firecrawl.dev/v2/search/gov");
		expect(result).toContain("agency.gov/rule");
	});

	it("fetches one paper by id", async () => {
		const { deps, calls } = harness(() => ({
			paper: { paperId: "p1", primaryId: "arxiv:2105.05233", title: "A paper", abstract: "Abstract text" },
		}));
		const tool = createIndexSearchTool(deps);

		const result = await tool.handler({ trigger: { input: { index: "research", paperId: "arxiv:2105.05233" } } });

		expect(calls[0]?.method).toBe("GET");
		expect(result).toContain("A paper");
	});

	it("requires intent when walking a citation graph", async () => {
		const { deps, calls } = harness(() => ({}));
		const tool = createIndexSearchTool(deps);

		await expect(tool.handler({ trigger: { input: { index: "research", similarTo: "p1" } } })).rejects.toThrow(
			/"intent"/,
		);
		expect(calls).toHaveLength(0);
	});
});

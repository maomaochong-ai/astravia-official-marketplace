import { describe, expect, it, vi } from "vitest";
import { createRestClient, normalizeEndpoint, pollUpstreamJob } from "../src/domain/backend/rest";
import { UpstreamError } from "../src/domain/backend/types";
import type { HttpClient, HttpRequestInit, HttpResponse } from "../src/domain/scrape/http";
import { UpstreamGate } from "../src/runtime/upstream";

interface Call {
	url: string;
	method: string;
	body: unknown;
	headers: Record<string, string>;
}

function fakeHttp(
	handler: (call: Call) => { status?: number; body: unknown },
): { client: HttpClient; calls: Call[] } {
	const calls: Call[] = [];
	const client: HttpClient = async (init: HttpRequestInit): Promise<HttpResponse> => {
		const call: Call = {
			url: init.url,
			method: init.method ?? "GET",
			body: init.body,
			headers: init.headers ?? {},
		};
		calls.push(call);
		const result = handler(call);
		const text = typeof result.body === "string" ? result.body : JSON.stringify(result.body);
		const status = result.status ?? 200;
		return {
			url: init.url,
			status,
			ok: status >= 200 && status < 300,
			headers: { "content-type": "application/json" },
			body: text,
			durationMs: 1,
			bytes: text.length,
		};
	};
	return { client, calls };
}

describe("rest client", () => {
	it("normalises endpoints", () => {
		expect(normalizeEndpoint("")).toBe("https://api.firecrawl.dev");
		expect(normalizeEndpoint(" http://localhost:3002/ ")).toBe("http://localhost:3002");
		expect(normalizeEndpoint("firecrawl.internal")).toBe("https://firecrawl.internal");
	});

	it("posts a scrape with the api key and unwraps data", async () => {
		const { client, calls } = fakeHttp(() => ({ body: { success: true, data: { markdown: "# hi", url: "https://a.test" } } }));
		const rest = createRestClient({ apiKey: "fc-test", client });
		const document = await rest.scrape({ url: "https://a.test", formats: ["markdown"] });
		expect(document.markdown).toBe("# hi");
		expect(calls[0].url).toBe("https://api.firecrawl.dev/v2/scrape");
		expect(calls[0].method).toBe("POST");
		expect(calls[0].headers.authorization).toBe("Bearer fc-test");
		expect((calls[0].body as Record<string, unknown>).url).toBe("https://a.test");
	});

	it("keeps the upstream error message and status", async () => {
		const { client } = fakeHttp(() => ({ status: 402, body: { error: "Insufficient credits" } }));
		const rest = createRestClient({ apiKey: "k", client });
		await expect(rest.scrape({ url: "https://a.test" })).rejects.toMatchObject({
			status: 402,
			message: expect.stringContaining("Insufficient credits") as unknown as string,
		});
	});

	it("retries a 5xx once, then succeeds", async () => {
		let attempt = 0;
		const { client, calls } = fakeHttp(() => {
			attempt += 1;
			if (attempt === 1) return { status: 503, body: { error: "unavailable" } };
			return { body: { data: { markdown: "ok" } } };
		});
		const rest = createRestClient({ apiKey: "k", client });
		const document = await rest.scrape({ url: "https://a.test" });
		expect(document.markdown).toBe("ok");
		expect(calls).toHaveLength(2);
	});

	it("routes batch and crawl jobs to their own endpoints", async () => {
		const { client, calls } = fakeHttp((call) => {
			if (call.method === "DELETE") return { body: { status: "cancelled" } };
			if (call.url.includes("/batch/scrape/")) return { body: { status: "completed", completed: 2, total: 2, data: [] } };
			return { body: { status: "scraping", completed: 1, total: 4, data: [{ markdown: "a" }] } };
		});
		const rest = createRestClient({ apiKey: "k", client });
		await rest.job("batch", "b-1");
		await rest.job("crawl", "c-1");
		await rest.cancel("crawl", "c-1");
		expect(calls[0].url).toBe("https://api.firecrawl.dev/v2/batch/scrape/b-1");
		expect(calls[1].url).toBe("https://api.firecrawl.dev/v2/crawl/c-1");
		expect(calls[2].method).toBe("DELETE");
	});

	it("rejects a submit without a job id", async () => {
		const { client } = fakeHttp(() => ({ body: { success: true } }));
		const rest = createRestClient({ apiKey: "k", client });
		await expect(rest.crawl({ url: "https://a.test" })).rejects.toBeInstanceOf(UpstreamError);
	});

	it("polls until the job completes", async () => {
		let polls = 0;
		const { client } = fakeHttp(() => {
			polls += 1;
			if (polls === 1) return { body: { id: "c-9" } };
			return polls < 3
				? { body: { status: "scraping", completed: polls, total: 3, data: [] } }
				: { body: { status: "completed", completed: 3, total: 3, data: [{ markdown: "done" }] } };
		});
		const rest = createRestClient({ apiKey: "k", client });
		const job = await rest.crawl({ url: "https://a.test" });
		const seen: string[] = [];
		const status = await pollUpstreamJob(rest, "crawl", job.id, {
			timeoutMs: 5_000,
			intervalMs: 5,
			onProgress: (progress) => seen.push(progress.status),
		});
		expect(status.status).toBe("completed");
		expect(status.data[0].markdown).toBe("done");
		expect(seen).toContain("scraping");
	});

	it("maps search results and map links", async () => {
		const { client } = fakeHttp((call) => {
			if (call.url.endsWith("/v2/map")) return { body: { success: true, links: ["https://a.test/1"], count: 1 } };
			return { body: { success: true, data: { web: [{ url: "https://a.test", title: "A" }] } } };
		});
		const rest = createRestClient({ apiKey: "k", client });
		expect((await rest.map({ url: "https://a.test" })).links).toEqual(["https://a.test/1"]);
		expect((await rest.search({ query: "x" })).results[0].url).toBe("https://a.test");
	});
});

function fakeContext(stored: Record<string, string>, secrets: Record<string, string>) {
	const notify = vi.fn();
	const ctx = {
		storage: {
			readFile: async (path: string) => stored[path] ?? null,
			writeFile: async (path: string, value: string) => {
				stored[path] = value;
			},
		},
		secrets: {
			get: async (key: string) => secrets[key],
			set: async (key: string, value: string) => {
				secrets[key] = value;
			},
			delete: async (key: string) => {
				delete secrets[key];
			},
		},
		ui: { notify },
	};
	return { ctx: ctx as unknown as ConstructorParameters<typeof UpstreamGate>[0], notify };
}

describe("upstream gate", () => {
	it("stays local until an endpoint or key exists", async () => {
		const stored: Record<string, string> = {};
		const secrets: Record<string, string> = {};
		const { client } = fakeHttp(() => ({ body: { data: { markdown: "x" } } }));
		const gate = new UpstreamGate(fakeContext(stored, secrets).ctx, client);
		await gate.load();
		expect(gate.state.configured).toBe(false);
		expect(gate.resolve()).toBe("local");
		await expect(gate.require()).rejects.toThrow(/Configure an endpoint or API key/);
	});

	it("persists settings to plugin storage and the key to secrets", async () => {
		const stored: Record<string, string> = {};
		const secrets: Record<string, string> = {};
		const { client, calls } = fakeHttp(() => ({ body: { data: { markdown: "x" } } }));
		const gate = new UpstreamGate(fakeContext(stored, secrets).ctx, client);
		await gate.load();
		await gate.configure({ endpoint: "http://localhost:3002/", apiKey: "fc-1" });

		expect(JSON.parse(stored["settings.json"])).toEqual({ engine: "auto", endpoint: "http://localhost:3002/" });
		expect(secrets["firecrawl.apiKey"]).toBe("fc-1");
		expect(stored["settings.json"]).not.toContain("fc-1");
		expect(gate.state.configured).toBe(true);
		expect(gate.resolve()).toBe("upstream");

		await gate.require().then((rest) => rest.scrape({ url: "https://a.test" }));
		expect(calls[0].url).toBe("http://localhost:3002/v2/scrape");
	});

	it("honours an explicit local choice and loads saved settings", async () => {
		const stored: Record<string, string> = {
			"settings.json": JSON.stringify({ engine: "local", endpoint: "https://api.firecrawl.dev" }),
		};
		const secrets: Record<string, string> = { "firecrawl.apiKey": "fc-2" };
		const { client } = fakeHttp(() => ({ body: {} }));
		const gate = new UpstreamGate(fakeContext(stored, secrets).ctx, client);
		await gate.load();
		expect(gate.state.settings.engine).toBe("local");
		expect(gate.resolve()).toBe("local");
		expect(gate.resolve("upstream")).toBe("upstream");
	});
});

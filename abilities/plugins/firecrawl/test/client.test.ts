/**
 * The REST client is the only thing between the plugin and Firecrawl, so these
 * tests pin the wire contract: endpoint normalisation, auth header, envelope
 * unwrapping, retry, and the paging cursor for large job results.
 */

import { describe, expect, it } from "vitest";
import { createClient, normalizeEndpoint, pollJob, readJobPages } from "../src/domain/firecrawl/client";
import type { Transport, TransportRequest, TransportResponse } from "../src/domain/firecrawl/transport";

interface Call {
	url: string;
	method: string;
	body: unknown;
	headers: Record<string, string>;
}

function fakeTransport(
	handler: (call: Call) => { status?: number; body: unknown },
): { transport: Transport; calls: Call[] } {
	const calls: Call[] = [];
	const transport: Transport = async (request: TransportRequest): Promise<TransportResponse> => {
		const call: Call = {
			url: request.url,
			method: request.method,
			body: request.body,
			headers: request.headers ?? {},
		};
		calls.push(call);
		const result = handler(call);
		const body = typeof result.body === "string" ? result.body : JSON.stringify(result.body);
		const status = result.status ?? 200;
		return { status, ok: status >= 200 && status < 300, body };
	};
	return { transport, calls };
}

describe("endpoint normalisation", () => {
	it("defaults to the hosted API and keeps self-hosted URLs", () => {
		expect(normalizeEndpoint("")).toBe("https://api.firecrawl.dev");
		expect(normalizeEndpoint(" http://localhost:3002/ ")).toBe("http://localhost:3002");
		expect(normalizeEndpoint("firecrawl.internal")).toBe("https://firecrawl.internal");
	});
});

describe("REST client", () => {
	it("signs a scrape and unwraps `data`", async () => {
		const { transport, calls } = fakeTransport(() => ({
			body: { success: true, data: { markdown: "# hi", url: "https://a.test" } },
		}));
		const client = createClient({ apiKey: "fc-test", transport });
		const document = await client.scrape({ url: "https://a.test", formats: ["markdown"] });

		expect(document.markdown).toBe("# hi");
		expect(calls[0].url).toBe("https://api.firecrawl.dev/v2/scrape");
		expect(calls[0].method).toBe("POST");
		expect(calls[0].headers.authorization).toBe("Bearer fc-test");
		expect((calls[0].body as { value: Record<string, unknown> }).value.url).toBe("https://a.test");
	});

	it("works keyless and omits the authorization header", async () => {
		const { transport, calls } = fakeTransport(() => ({ body: { data: { markdown: "x" } } }));
		const client = createClient({ transport });

		expect(client.hasKey).toBe(false);
		await client.scrape({ url: "https://a.test" });
		expect(calls[0].headers.authorization).toBeUndefined();
	});

	it("translates 402 into an actionable message and keeps the status", async () => {
		const { transport } = fakeTransport(() => ({ status: 402, body: { error: "Insufficient credits" } }));
		const client = createClient({ apiKey: "k", transport });

		await expect(client.scrape({ url: "https://a.test" })).rejects.toMatchObject({
			status: 402,
			message: expect.stringContaining("insufficient credits") as unknown as string,
		});
	});

	it("tells the user where to fix a rejected key", async () => {
		const { transport } = fakeTransport(() => ({ status: 401, body: { error: "Unauthorized" } }));
		const client = createClient({ apiKey: "bad", transport });

		await expect(client.scrape({ url: "https://a.test" })).rejects.toMatchObject({
			status: 401,
			message: expect.stringContaining("ability page") as unknown as string,
		});
	});

	it("passes the upstream 403 policy text through instead of blaming the key", async () => {
		const reason =
			"The ignoreRobotsTxt parameter is an enterprise feature. Contact support@firecrawl.com to explore whether it can be enabled for your team.";
		const { transport } = fakeTransport(() => ({ status: 403, body: { success: false, error: reason } }));
		const client = createClient({ apiKey: "k", transport });

		await expect(client.scrape({ url: "https://a.test" })).rejects.toMatchObject({
			status: 403,
			message: expect.stringContaining(reason) as unknown as string,
		});
	});

	it("retries a 5xx once, then succeeds", async () => {
		let attempt = 0;
		const { transport, calls } = fakeTransport(() => {
			attempt += 1;
			if (attempt === 1) return { status: 503, body: { error: "unavailable" } };
			return { body: { data: { markdown: "ok" } } };
		});
		const client = createClient({ apiKey: "k", transport });

		await expect(client.scrape({ url: "https://a.test" })).resolves.toMatchObject({ markdown: "ok" });
		expect(calls).toHaveLength(2);
	});

	it("routes batch and crawl jobs to their own endpoints", async () => {
		const { transport, calls } = fakeTransport((call) => {
			if (call.method === "DELETE") return { body: { status: "cancelled" } };
			if (call.url.includes("/batch/scrape/")) return { body: { status: "completed", completed: 2, total: 2, data: [] } };
			return { body: { status: "scraping", completed: 1, total: 4, data: [{ markdown: "a" }] } };
		});
		const client = createClient({ apiKey: "k", transport });

		await client.job("batch", "b-1");
		await client.job("crawl", "c-1");
		await client.cancel("crawl", "c-1");

		expect(calls[0].url).toBe("https://api.firecrawl.dev/v2/batch/scrape/b-1");
		expect(calls[1].url).toBe("https://api.firecrawl.dev/v2/crawl/c-1");
		expect(calls[2].method).toBe("DELETE");
	});

	it("rejects a submit that came back without a job id", async () => {
		const { transport } = fakeTransport(() => ({ body: { success: true } }));
		const client = createClient({ apiKey: "k", transport });

		await expect(client.crawl({ url: "https://a.test" })).rejects.toMatchObject({ code: "no_job_id" });
	});

	it("passes a multipart body through untouched for /v2/parse", async () => {
		const { transport, calls } = fakeTransport(() => ({ body: { data: { markdown: "pdf text" } } }));
		const client = createClient({ apiKey: "k", transport });

		const document = await client.upload({
			type: "multipart",
			fields: { options: '{"formats":["markdown"]}' },
			files: [{ fieldName: "file", fileName: "a.pdf", mimeType: "application/pdf", data: "JVBERi0=" }],
		});

		expect(document.markdown).toBe("pdf text");
		expect(calls[0].url).toBe("https://api.firecrawl.dev/v2/parse");
		expect(calls[0].headers["content-type"]).toBeUndefined();
		expect(calls[0].body).toMatchObject({ type: "multipart", fields: { options: '{"formats":["markdown"]}' } });
	});

	it("reads crawl errors separately from the page list", async () => {
		const { transport } = fakeTransport(() => ({
			body: { errors: [{ url: "https://a.test/private", error: "Blocked by robots.txt", code: "ROBOTS_BLOCKED" }] },
		}));
		const client = createClient({ apiKey: "k", transport });

		await expect(client.jobErrors("crawl", "c-1")).resolves.toEqual([
			{ url: "https://a.test/private", error: "Blocked by robots.txt", code: "ROBOTS_BLOCKED" },
		]);
	});
});

describe("job helpers", () => {
	it("polls until the job leaves `scraping`", async () => {
		let polls = 0;
		const { transport } = fakeTransport(() => {
			polls += 1;
			if (polls === 1) return { body: { id: "c-9" } };
			return polls < 3
				? { body: { status: "scraping", completed: polls, total: 3, data: [] } }
				: { body: { status: "completed", completed: 3, total: 3, data: [{ markdown: "done" }] } };
		});
		const client = createClient({ apiKey: "k", transport });
		const job = await client.crawl({ url: "https://a.test" });

		const seen: string[] = [];
		const status = await pollJob(client, "crawl", job.id, {
			timeoutMs: 5_000,
			intervalMs: 1,
			onProgress: (progress) => seen.push(progress.status),
		});

		expect(status.status).toBe("completed");
		expect(status.data[0].markdown).toBe("done");
		expect(seen).toContain("scraping");
	});

	it("walks the `next` cursor because one response caps at 10 MB", async () => {
		const { transport, calls } = fakeTransport((call) => {
			if (call.url.includes("cursor=2")) {
				return { body: { status: "completed", completed: 2, total: 2, next: null, data: [{ url: "https://a.test/2" }] } };
			}
			return {
				body: {
					status: "completed",
					completed: 2,
					total: 2,
					next: "https://api.firecrawl.dev/v2/crawl/c-1?cursor=2",
					data: [{ url: "https://a.test/1" }],
				},
			};
		});
		const client = createClient({ apiKey: "k", transport });

		const documents = await readJobPages(client, "crawl", "c-1");

		expect(documents.map((document) => document.url)).toEqual(["https://a.test/1", "https://a.test/2"]);
		expect(calls).toHaveLength(2);
	});
});

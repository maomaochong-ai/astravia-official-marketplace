/**
 * The console store describes an upstream crawl job. These tests pin the parts
 * that user-visible behaviour depends on: counters, page ingestion, the error
 * list becoming denials, and cancellation reaching the API.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import type { FirecrawlClient, FirecrawlDocument, JobStatus } from "../src/domain/firecrawl/types";
import { DEFAULT_CRAWL_JOB_OPTIONS } from "../src/domain/firecrawl/options";
import type { FirecrawlConfig } from "../src/runtime/config";
import { CrawlRunStore } from "../src/features/crawler-console/services/crawl-run-store";

const OPTIONS = { ...DEFAULT_CRAWL_JOB_OPTIONS, limit: 3, maxDiscoveryDepth: 2 };

function status(overrides: Partial<JobStatus> = {}): JobStatus {
	return { status: "completed", completed: 0, total: 0, data: [], next: null, ...overrides };
}

function page(url: string, markdown: string, extra: Partial<FirecrawlDocument> = {}): FirecrawlDocument {
	return { url, markdown, title: `title of ${url}`, ...extra } as FirecrawlDocument;
}

function fakeClient(overrides: Partial<FirecrawlClient> = {}) {
	const client = {
		endpoint: "https://api.firecrawl.dev",
		hasKey: false,
		scrape: vi.fn(),
		upload: vi.fn(),
		batchScrape: vi.fn(),
		crawl: vi.fn(async () => ({ id: "c-1" })),
		job: vi.fn(async () => status()),
		cancel: vi.fn(async () => undefined),
		jobErrors: vi.fn(async () => []),
		map: vi.fn(),
		search: vi.fn(),
		extract: vi.fn(),
		extractStatus: vi.fn(),
		monitors: {},
		credits: vi.fn(),
		...overrides,
	};
	return client as unknown as FirecrawlClient & { [K in keyof typeof client]: (typeof client)[K] };
}

function fakeConfig(client: FirecrawlClient): FirecrawlConfig {
	return { require: async () => client, maybeClient: client } as unknown as FirecrawlConfig;
}

afterEach(() => {
	vi.useRealTimers();
});

describe("crawl run store", () => {
	it("starts idle and takes a target only while idle", () => {
		const store = new CrawlRunStore(fakeConfig(fakeClient()));

		expect(store.getSnapshot().status).toBe("idle");
		expect(store.running).toBe(false);

		store.setTarget("https://a.test/docs", "conversation");
		expect(store.getSnapshot().target).toBe("https://a.test/docs");
		expect(store.getSnapshot().targetSource).toBe("conversation");
	});

	it("submits the crawl body, then paints pages and counters from the job", async () => {
		const client = fakeClient({
			job: vi.fn(async () =>
				status({
					completed: 2,
					total: 2,
					creditsUsed: 7,
					expiresAt: "2026-01-01T00:00:00.000Z",
					data: [page("https://a.test/docs", "# root docs"), page("https://a.test/docs/intro", "intro")],
				}),
			),
		});
		const store = new CrawlRunStore(fakeConfig(client));

		await store.start("https://a.test/docs", OPTIONS);

		expect(client.crawl).toHaveBeenCalledWith(
			expect.objectContaining({
				url: "https://a.test/docs",
				limit: 3,
				maxDiscoveryDepth: 2,
				ignoreQueryParameters: true,
			}),
		);

		const snapshot = store.getSnapshot();
		expect(snapshot.status).toBe("completed");
		expect(snapshot.jobId).toBe("c-1");
		expect(snapshot.counts).toMatchObject({ crawled: 2, queued: 0, fetching: 0, discovered: 2 });
		expect(snapshot.creditsUsed).toBe(7);
		expect(snapshot.expiresAt).toBe("2026-01-01T00:00:00.000Z");
		expect(snapshot.pages.map((entry) => entry.url)).toEqual(["https://a.test/docs", "https://a.test/docs/intro"]);
		expect(snapshot.pages[0].markdown).toBe("# root docs");

		const intro = snapshot.nodes.find((node) => node.url.endsWith("/intro"));
		expect(intro).toMatchObject({ depth: 1, state: "crawled", parentId: "https://a.test/docs" });
		expect(snapshot.lines.some((line) => line.kind === "run" && line.text.startsWith("run end"))).toBe(true);
	});

	it("marks the run failed when the submit is rejected", async () => {
		const client = fakeClient({
			crawl: vi.fn(async () => {
				throw new Error("Upstream rate limit reached.");
			}),
		});
		const store = new CrawlRunStore(fakeConfig(client));

		await expect(store.start("https://a.test", OPTIONS)).rejects.toThrow(/rate limit/);

		const snapshot = store.getSnapshot();
		expect(snapshot.status).toBe("failed");
		expect(snapshot.lastError).toMatch(/rate limit/);
		expect(snapshot.lines.some((line) => line.level === "error")).toBe(true);
	});

	it("adopts a crawl started by a tool instead of starting a second one", async () => {
		const client = fakeClient({
			job: vi.fn(async () => status({ completed: 1, total: 1, data: [page("https://a.test/p", "text")] })),
		});
		const store = new CrawlRunStore(fakeConfig(client));

		store.adopt("c-tool", "https://a.test");

		await vi.waitFor(() => expect(store.getSnapshot().status).toBe("completed"));
		expect(store.getSnapshot().targetSource).toBe("tool");
		expect(client.crawl).not.toHaveBeenCalled();
		expect(store.getSnapshot().pages).toHaveLength(1);
	});

	it("separates robots denials from hard failures using the errors endpoint", async () => {
		const client = fakeClient({
			job: vi.fn(async () => status({ completed: 1, total: 2 })),
			jobErrors: vi.fn(async () => [
				{ url: "https://a.test/private", error: "Blocked by robots.txt", code: "ROBOTS_BLOCKED" },
				{ url: "https://a.test/broken", error: "HTTP 500", statusCode: 500 },
			]),
		});
		const store = new CrawlRunStore(fakeConfig(client));

		await store.start("https://a.test", OPTIONS);

		const snapshot = store.getSnapshot();
		expect(snapshot.counts).toMatchObject({ denied: 1, failed: 1 });
		expect(snapshot.denialsByCode).toEqual({ ROBOTS_BLOCKED: 1 });
		expect(snapshot.nodes.find((node) => node.url.endsWith("/private"))?.state).toBe("denied");
		expect(snapshot.nodes.find((node) => node.url.endsWith("/broken"))?.state).toBe("failed");
		expect(snapshot.lines.some((line) => line.kind === "deny")).toBe(true);
		expect(snapshot.lines.some((line) => line.kind === "fail")).toBe(true);
	});

	it("counts a bare robots refusal as denied and an external skip as neither", async () => {
		const client = fakeClient({
			job: vi.fn(async () => status({ completed: 0, total: 0 })),
			jobErrors: vi.fn(async () => [
				{ url: "https://a.test/secret", robots: true },
				{ url: "https://other.test/", error: "External link skipped", code: "EXTERNAL_LINK" },
			]),
		});
		const store = new CrawlRunStore(fakeConfig(client));

		await store.start("https://a.test", OPTIONS);

		const snapshot = store.getSnapshot();
		expect(snapshot.counts).toMatchObject({ denied: 1, failed: 0 });
		expect(snapshot.nodes.find((node) => node.url.endsWith("/secret"))?.state).toBe("denied");
		expect(snapshot.nodes.some((node) => node.url.includes("other.test"))).toBe(false);
		expect(snapshot.lines.some((line) => line.kind === "deny" && /robots/i.test(line.text))).toBe(true);
		expect(snapshot.lines.some((line) => /external link/i.test(line.text))).toBe(true);
	});

	it("cancels the upstream job on stop and keeps what was already collected", async () => {
		vi.useFakeTimers();
		const client = fakeClient({
			job: vi.fn(async () => status({ status: "scraping", completed: 1, total: 5, data: [page("https://a.test/a", "a")] })),
		});
		const store = new CrawlRunStore(fakeConfig(client));

		const run = store.start("https://a.test", OPTIONS);
		await vi.advanceTimersByTimeAsync(0);
		expect(store.getSnapshot().status).toBe("running");
		expect(store.getSnapshot().counts.queued).toBe(4);

		store.stop();
		await vi.advanceTimersByTimeAsync(3_000);
		await run;

		expect(client.cancel).toHaveBeenCalledWith("crawl", "c-1");
		const snapshot = store.getSnapshot();
		expect(snapshot.status).toBe("stopped");
		expect(snapshot.counts.fetching).toBe(0);
		expect(snapshot.pages).toHaveLength(1);
	});

	it("survives a throttled poll and still shelves the pages it finishes with", async () => {
		vi.useFakeTimers();
		let polls = 0;
		const client = fakeClient({
			job: vi.fn(async () => {
				polls += 1;
				if (polls === 1) throw new Error("Upstream rate limit reached.");
				return status({ completed: 1, total: 1, data: [page("https://a.test/a", "a")] });
			}),
		});
		const store = new CrawlRunStore(fakeConfig(client));

		const run = store.start("https://a.test", OPTIONS);
		await vi.advanceTimersByTimeAsync(10_000);
		await run;

		const snapshot = store.getSnapshot();
		expect(snapshot.status).toBe("completed");
		expect(snapshot.pages).toHaveLength(1);
		expect(snapshot.counts.fetching).toBe(0);
		expect(snapshot.lines.some((line) => line.level === "warn" && line.text.includes("poll"))).toBe(true);
	});

	it("closes a run out when polling keeps failing instead of hanging on `running`", async () => {
		vi.useFakeTimers();
		const client = fakeClient({
			job: vi.fn(async () => {
				throw new Error("Upstream rate limit reached.");
			}),
		});
		const store = new CrawlRunStore(fakeConfig(client));

		const run = store.start("https://a.test", OPTIONS);
		await vi.advanceTimersByTimeAsync(20 * 60_000);
		await expect(run).resolves.toBeUndefined();

		const snapshot = store.getSnapshot();
		expect(snapshot.status).toBe("failed");
		expect(snapshot.lastError).toMatch(/rate limit/);
		expect(snapshot.counts.fetching).toBe(0);
		expect(snapshot.lines.some((line) => line.text.startsWith("run end"))).toBe(true);
	});

	it("writes console lines for work done outside a crawl", () => {
		const store = new CrawlRunStore(fakeConfig(fakeClient()));

		store.note("ok", "scrape  https://a.test  1.2 KB");

		expect(store.getSnapshot().lines).toEqual([
			expect.objectContaining({ level: "ok", kind: "note", text: "scrape  https://a.test  1.2 KB" }),
		]);
	});
});

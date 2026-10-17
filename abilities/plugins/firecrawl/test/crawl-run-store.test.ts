import { describe, expect, it } from "vitest";
import { CrawlRunStore } from "../src/features/crawler-console/services/crawl-run-store";
import type { CrawlEvent, CrawlPage, CrawlSummary } from "../src/domain/events";
import { DEFAULT_CRAWL_OPTIONS } from "../src/domain/events";

const OPTIONS = { ...DEFAULT_CRAWL_OPTIONS, limit: 3, maxDepth: 2 };
const START = "https://example.com/docs/";

function page(overrides: Partial<CrawlPage> = {}): CrawlPage {
	return {
		url: START,
		finalUrl: START,
		depth: 0,
		parent: null,
		title: "Docs",
		markdown: "# Docs",
		linkCount: 4,
		status: 200,
		engine: "fetch",
		bytes: 1200,
		chars: 900,
		durationMs: 80,
		warnings: 0,
		...overrides,
	};
}

function summary(overrides: Partial<CrawlSummary> = {}): CrawlSummary {
	return {
		startUrl: START,
		pages: [page()],
		denied: [{ url: "https://example.com/blog", code: "BACKWARD_CRAWLING", message: "outside /docs/", depth: 1 }],
		failed: [],
		status: "completed",
		durationMs: 1200,
		options: OPTIONS,
		...overrides,
	};
}

describe("CrawlRunStore", () => {
	it("starts idle and refuses overlapping runs", async () => {
		const gate: { release?: () => void } = {};
		const store = new CrawlRunStore(
			() =>
				new Promise<CrawlSummary>((resolve) => {
					gate.release = () => resolve(summary());
				}),
		);
		expect(store.getSnapshot().status).toBe("idle");

		const first = store.start(START, OPTIONS);
		await expect(store.start(START, OPTIONS)).rejects.toThrow(/already running/);

		gate.release?.();
		await first;
		expect(store.getSnapshot().status).toBe("completed");
	});

	it("tracks node states and counters from the event stream", async () => {
		const store = new CrawlRunStore(async (_target, _options, hooks) => {
			const events: CrawlEvent[] = [
				{ type: "queued", url: START, depth: 0, parent: null, via: "seed", at: 1 },
				{ type: "fetching", url: START, depth: 0, parent: null, at: 2 },
				{
					type: "crawled",
					url: START,
					depth: 0,
					parent: null,
					status: 200,
					engine: "fetch",
					bytes: 1200,
					chars: 900,
					links: 4,
					durationMs: 80,
					title: "Docs",
					at: 3,
				},
				{
					type: "denied",
					url: "https://example.com/blog",
					depth: 1,
					parent: START,
					code: "BACKWARD_CRAWLING",
					message: "outside /docs/",
					at: 4,
				},
				{
					type: "failed",
					url: "https://example.com/docs/gone",
					depth: 1,
					parent: START,
					message: "404",
					code: "http-status",
					status: 404,
					at: 5,
				},
			];
			for (const event of events) hooks.onEvent(event);
			return summary();
		});

		await store.start(START, OPTIONS);
		const snapshot = store.getSnapshot();
		expect(snapshot.counts).toMatchObject({ crawled: 1, denied: 1, failed: 1, fetching: 0 });
		expect(snapshot.bytes).toBe(1200);
		expect(snapshot.chars).toBe(900);
		expect(snapshot.denialsByCode.BACKWARD_CRAWLING).toBe(1);
		expect(snapshot.nodes.map((node) => node.state)).toEqual(["crawled", "denied", "failed"]);
		expect(snapshot.lines.length).toBeGreaterThan(2);
		expect(snapshot.pages).toHaveLength(1);
	});

	it("records a failure without losing the event history", async () => {
		const store = new CrawlRunStore(async () => {
			throw new Error("boom");
		});
		await expect(store.start(START, OPTIONS)).rejects.toThrow("boom");
		const snapshot = store.getSnapshot();
		expect(snapshot.status).toBe("failed");
		expect(snapshot.lastError).toBe("boom");
		expect(snapshot.lines.at(-1)?.level).toBe("error");
	});

	it("keeps non-crawl notes visible", () => {
		const store = new CrawlRunStore(async () => summary());
		store.note("ok", "scrape  https://example.com  1200 chars");
		expect(store.getSnapshot().lines[0]).toMatchObject({ level: "ok" });
	});

	it("stops through the abort signal handed to the runner", async () => {
		let signal: AbortSignal | null = null;
		const store = new CrawlRunStore(
			(_target, _options, hooks) =>
				new Promise<CrawlSummary>((resolve) => {
					signal = hooks.signal;
					hooks.signal.addEventListener("abort", () => resolve(summary({ status: "stopped" })));
				}),
		);
		const run = store.start(START, OPTIONS);
		expect(signal!.aborted).toBe(false);
		store.stop();
		await run;
		expect(signal!.aborted).toBe(true);
		expect(store.getSnapshot().status).toBe("stopped");
	});
});

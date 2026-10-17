import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CrawlConsoleTab } from "../src/features/crawler-console/components/crawl-console-tab";
import { CrawlRunStore } from "../src/features/crawler-console/services/crawl-run-store";
import { DEFAULT_CRAWL_OPTIONS } from "../src/domain/events";
import type { CrawlEvent, CrawlSummary } from "../src/domain/events";

const STRINGS: Record<string, string> = {
	"console.title": "Crawl console",
	"console.subtitle": "Live crawl",
	"console.status.idle": "idle",
	"console.status.running": "running",
	"console.status.completed": "completed",
	"console.status.stopped": "stopped",
	"console.status.failed": "failed",
	"console.unit.pages": "pages",
	"console.unit.hops": "hops",
	"spider.title": "Spider",
	"footer.text": "text",
	"console.start": "Start crawl",
	"console.stop": "Stop",
	"console.limit": "Pages",
	"console.depth": "Depth",
	"console.concurrency": "Concurrency",
	"console.tab.console": "Console",
	"console.tab.pages": "Pages",
	"console.advanced.show": "Advanced options",
	"console.advanced.hide": "Hide advanced options",
	"console.discovered": "discovered",
	"spider.empty": "No crawl yet",
	"console.empty": "Waiting for the first page",
	"console.pages.empty": "No pages captured",
	"console.target.placeholder": "https://example.com/docs",
	"metric.crawled": "crawled",
	"metric.fetching": "fetching",
	"metric.queued": "queued",
	"metric.denied": "refused",
	"metric.failed": "failed",
	"metric.downloaded": "downloaded",
};

vi.mock("../src/runtime/plugin-context", () => ({
	hasPluginContext: () => true,
	getPluginContext: () => ({
		i18n: {
			locale: "en",
			t: (key: string, params?: Record<string, string | number>) =>
				(params ? `${STRINGS[key] ?? key} ${JSON.stringify(params)}` : (STRINGS[key] ?? key)),
			onChange: () => ({ dispose: () => {} }),
		},
		ui: { notify: () => {} },
	}),
	setPluginContext: () => {},
}));

afterEach(cleanup);

function event(type: CrawlEvent["type"], extra: Record<string, unknown> = {}): CrawlEvent {
	return { type, at: 1, ...extra } as CrawlEvent;
}

const SUMMARY: CrawlSummary = {
	startUrl: "https://example.com/docs/",
	pages: [],
	denied: [],
	failed: [],
	status: "completed",
	durationMs: 1200,
	options: DEFAULT_CRAWL_OPTIONS,
};

describe("CrawlConsoleTab", () => {
	it("renders idle, then reflects a run started elsewhere", async () => {
		let release: (value: CrawlSummary) => void = () => {};
		const store = new CrawlRunStore(
			(_target, _options, hooks) =>
				new Promise<CrawlSummary>((resolve) => {
					release = resolve;
					hooks.onEvent?.(event("queued", { url: "https://example.com/docs/", depth: 0, parent: null, via: "seed" }));
					hooks.onEvent?.(event("fetching", { url: "https://example.com/docs/", depth: 0, parent: null }));
				}),
		);

		const view = render(<CrawlConsoleTab store={store} />);
		expect(view.getByText("No crawl yet")).toBeTruthy();
		expect(view.getByText("Waiting for the first page")).toBeTruthy();

		await act(async () => {
			void store.start("https://example.com/docs/", DEFAULT_CRAWL_OPTIONS);
		});

		// A run started by the tools (not by this form) still shows the target and progress.
		expect(view.getByText("https://example.com/docs/")).toBeTruthy();
		expect(view.getByText("Stop")).toBeTruthy();

		await act(async () => {
			store.ingest(event("crawled", {
				url: "https://example.com/docs/",
				depth: 0,
				parent: null,
				status: 200,
				engine: "fetch",
				bytes: 512,
				chars: 300,
				links: 4,
				durationMs: 40,
				title: "Docs home",
			}));
			store.ingest(event("denied", {
				url: "https://example.com/private",
				depth: 1,
				parent: "https://example.com/docs/",
				code: "BACKWARD_CRAWLING",
				message: "outside the start scope",
			}));
			release(SUMMARY);
		});

		expect(view.getByText(/BACKWARD_CRAWLING|outside the start scope/)).toBeTruthy();
	});

	it("switches to the pages list and back", async () => {
		const store = new CrawlRunStore(async () => SUMMARY);
		const view = render(<CrawlConsoleTab store={store} />);
		await act(async () => {
			store.ingest(event("crawled", {
				url: "https://example.com/docs/",
				depth: 0,
				parent: null,
				status: 200,
				engine: "fetch",
				bytes: 512,
				chars: 300,
				links: 0,
				durationMs: 40,
				title: "Docs home",
			}));
		});
		await act(async () => {
			// The control bar's page-limit label is also "Pages"; the tab is last.
			view.getAllByText("Pages").at(-1)!.click();
		});
		expect(view.getAllByText("Docs home").length).toBeGreaterThan(0);
	});
});

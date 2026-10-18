import { act, cleanup, render, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FirecrawlClient, FirecrawlDocument, JobStatus } from "../src/domain/firecrawl/types";
import { DEFAULT_CRAWL_JOB_OPTIONS } from "../src/domain/firecrawl/options";
import type { FirecrawlConfig } from "../src/runtime/config";
import { CrawlConsoleTab } from "../src/features/crawler-console/components/crawl-console-tab";
import { CrawlRunStore } from "../src/features/crawler-console/services/crawl-run-store";

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
	"metric.credits": "credits",
	"connection.keyed": "API key set",
	"connection.keyless": "keyless",
	"console.preview.back": "Back",
	"console.preview.pending": "text not captured",
	"console.preview.structure": "Structure",
	"console.preview.copy": "Copy",
	"console.preview.download": "Download",
	"console.preview.open": "Browser",
	"console.opt.sitemap": "Use sitemap",
	"console.opt.mainContent": "Main content only",
	"console.opt.external": "Follow external links",
	"console.opt.subdomains": "Include subdomains",
	"console.opt.entireDomain": "Crawl the whole domain",
	"console.opt.queryParams": "Ignore query parameters",
	"console.opt.ignoreRobots": "Ignore robots.txt",
	"console.delay": "Delay between requests",
	"spider.el.headings": "headings",
	"spider.el.paragraphs": "paragraphs",
	"spider.el.links": "links",
	"spider.el.images": "images",
	"spider.el.videos": "video",
	"spider.el.tables": "tables",
	"console.tab.artifacts": "Artifacts",
	"console.tab.history": "History",
	"console.tab.links": "Links",
	"console.tab.issues": "Issues",
	"console.links.count": "{{count}} links",
	"console.links.domains": "{{count}} domains",
	"console.links.empty": "No links captured",
	"console.links.search": "Filter links",
	"console.links.use": "Crawl",
	"console.issues.empty": "Nothing was refused",
	"console.issues.denied": "refused",
	"console.issues.failed": "failed",
	"console.issues.warning": "Warnings",
	"console.artifacts.all": "All",
	"console.artifacts.ask": "Ask the agent",
	"console.artifacts.empty": "Nothing captured yet",
	"console.artifacts.failed": "The run ended before any page was captured.",
	"console.history.empty": "No archived runs yet",
	"artifact.kind.markdown": "Markdown",
	"artifact.kind.links": "Links",
	"artifact.kind.images": "Images",
	"artifact.kind.media": "Media",
	"artifact.kind.json": "JSON",
	"artifact.kind.document": "Document",
};

vi.mock("../src/runtime/plugin-context", () => ({
	hasPluginContext: () => true,
	getPluginContext: () => ({
		i18n: {
			locale: "en",
			t: (key: string, params?: Record<string, string | number>) =>
				params ? `${STRINGS[key] ?? key} ${JSON.stringify(params)}` : (STRINGS[key] ?? key),
			onChange: () => ({ dispose: () => {} }),
		},
		ui: { notify: () => {} },
	}),
	setPluginContext: () => {},
}));

afterEach(cleanup);

function document(url: string, title: string, markdown: string): FirecrawlDocument {
	return { url, title, markdown, links: [], metadata: { statusCode: 200 } } as FirecrawlDocument;
}

/**
 * A completed crawl is enough for every view under test: the console renders
 * from the store snapshot, and the snapshot comes from one status response.
 */
function harness(documents: FirecrawlDocument[]) {
	const status: JobStatus = {
		status: "completed",
		completed: documents.length,
		total: documents.length,
		creditsUsed: 3,
		next: null,
		data: documents,
	};
	const client = {
		crawl: async () => ({ id: "c-1" }),
		job: async () => status,
		jobErrors: async () => [],
		cancel: async () => undefined,
	} as unknown as FirecrawlClient;
	const config = {
		state: { settings: { endpoint: "" }, endpoint: "https://api.firecrawl.dev", hasKey: false, reason: "" },
		subscribe: () => () => {},
		configure: async () => {},
		require: async () => client,
		maybeClient: client,
	} as unknown as FirecrawlConfig;
	return { store: new CrawlRunStore(config), config };
}

describe("CrawlConsoleTab", () => {
	it("renders idle, then reflects a run started by the console", async () => {
		const { store, config } = harness([document("https://example.com/docs/", "Docs home", "Hello.")]);
		const view = render(<CrawlConsoleTab store={store} config={config} />);

		expect(view.getByText("No crawl yet")).toBeTruthy();
		expect(view.getByText("Waiting for the first page")).toBeTruthy();

		await act(async () => {
			await store.start("https://example.com/docs/", DEFAULT_CRAWL_JOB_OPTIONS);
		});

		expect(view.getByDisplayValue("https://example.com/docs/")).toBeTruthy();
		expect(view.getByText("completed")).toBeTruthy();
		expect(view.getByText(/run end/)).toBeTruthy();
	});

	it("switches to the pages list and previews a captured page", async () => {
		const url = "https://example.com/docs/";
		const { store, config } = harness([document(url, "Docs home", "Hello from the captured page.")]);
		const view = render(<CrawlConsoleTab store={store} config={config} />);

		await act(async () => {
			await store.start(url, DEFAULT_CRAWL_JOB_OPTIONS);
		});

		await act(async () => {
			view.getAllByText("Pages").at(-1)!.click();
		});
		await act(async () => {
			within(view.getByRole("list", { name: "Pages" })).getByText("Docs home").click();
		});

		// The preview replaces the list in place; nothing leaves the panel rectangle.
		expect(view.getByText(/Hello from the captured page/)).toBeTruthy();
		expect(view.getByText(/Back/)).toBeTruthy();
	});

	it("keeps the log in view when a run fails, and the empty shelf names the reason", async () => {
		const failure: JobStatus = {
			status: "failed",
			completed: 0,
			total: 0,
			error: "Upstream rate limit reached.",
			next: null,
			data: [],
		};
		const client = {
			crawl: async () => ({ id: "c-1" }),
			job: async () => failure,
			jobErrors: async () => [],
			cancel: async () => undefined,
		} as unknown as FirecrawlClient;
		const config = {
			state: { settings: { endpoint: "" }, endpoint: "https://api.firecrawl.dev", hasKey: false, reason: "" },
			subscribe: () => () => {},
			configure: async () => {},
			require: async () => client,
			maybeClient: client,
		} as unknown as FirecrawlConfig;
		const store = new CrawlRunStore(config);
		const view = render(<CrawlConsoleTab store={store} config={config} />);

		await act(async () => {
			await store.start("https://example.com/docs/", DEFAULT_CRAWL_JOB_OPTIONS);
		});

		// The log is the only tab that explains a failed run, so it stays selected.
		const active = view.getAllByRole("tab").find((node) => node.getAttribute("aria-selected") === "true");
		expect(active?.textContent).toContain("Console");

		// The shelf sits behind =hidden=, but it still has to say why it is empty.
		expect(view.getByText("The run ended before any page was captured.")).toBeTruthy();
	});

	it("shows the keyless hint without blocking a start", () => {
		const { store, config } = harness([]);
		const view = render(<CrawlConsoleTab store={store} config={config} />);

		expect(view.getByText("keyless")).toBeTruthy();
		expect(view.getByText("Start crawl")).toBeTruthy();
	});

	it("shelves what was captured by type and leaves the history empty until a run is archived", async () => {
		const url = "https://example.com/docs/";
		const page = {
			url,
			title: "Docs home",
			markdown: "Read [the guide](/guide) and ![shot](/shot.png)",
			links: [],
			metadata: { statusCode: 200 },
		} as FirecrawlDocument;
		const { store, config } = harness([page]);
		const view = render(<CrawlConsoleTab store={store} config={config} />);

		await act(async () => {
			await store.start(url, DEFAULT_CRAWL_JOB_OPTIONS);
		});

		const shelf = view.getByRole("list", { name: "Artifacts" });
		// One page becomes typed products: the prose, its outbound links, its images.
		expect(view.getAllByText("Markdown").length).toBeGreaterThan(0);
		expect(view.getAllByText("Links").length).toBeGreaterThan(0);
		expect(within(shelf).getAllByText("Docs home").length).toBeGreaterThan(0);

		await act(async () => {
			within(shelf).getAllByText("Docs home")[0]!.click();
		});
		expect(view.getByText(/the guide/)).toBeTruthy();

		await act(async () => {
			view.getAllByText("History").at(-1)!.click();
		});
		expect(view.getByText("No archived runs yet")).toBeTruthy();
	});

	it("pools outbound links in their own tab and reports an empty issue list", async () => {
		const url = "https://example.com/docs/";
		const page = {
			url,
			title: "Docs home",
			markdown: "Read [the guide](/guide)",
			links: [],
			metadata: { statusCode: 200 },
		} as FirecrawlDocument;
		const { store, config } = harness([page]);
		const view = render(<CrawlConsoleTab store={store} config={config} />);

		await act(async () => {
			await store.start(url, DEFAULT_CRAWL_JOB_OPTIONS);
		});

		await act(async () => {
			view.getByRole("tab", { name: /Links/ }).click();
		});
		expect(view.getByText("/guide")).toBeTruthy();

		await act(async () => {
			view.getByRole("tab", { name: /Issues/ }).click();
		});
		expect(view.getByText("Nothing was refused")).toBeTruthy();
	});
});

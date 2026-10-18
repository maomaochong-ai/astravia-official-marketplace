import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PluginContext, PluginToolCallSlotProps } from "@astravia-org/plugin-sdk";
import { CrawlToolCall } from "../src/features/crawler-console/components/crawl-tool-call";
import { setConsoleDeps } from "../src/features/crawler-console/deps";
import type { CrawlRunSnapshot, CrawlRunStore } from "../src/features/crawler-console/services/crawl-run-store";
import { FIRECRAWL_TAB_ID } from "../src/tab-id";

const state = vi.hoisted(() => ({
	openActivityTab: vi.fn(),
	notify: vi.fn(),
	cwd: "/work/repo" as string | null,
}));

const STRINGS: Record<string, string> = {
	"toolCall.title": "Crawl",
	"toolCall.openConsole": "Console",
	"toolCall.pending": "Starting the crawl...",
	"toolCall.progress": "crawl progress",
	"toolCall.empty": "No output returned.",
};

vi.mock("@astravia-org/plugin-sdk", () => ({
	useActiveConversation: () => ({ id: "c-1", cwd: state.cwd, isStreaming: false }),
}));

vi.mock("../src/runtime/plugin-context", () => ({
	hasPluginContext: () => true,
	getPluginContext: () => ({
		i18n: {
			locale: "en",
			t: (key: string, params?: Record<string, string | number>) =>
				params ? `${STRINGS[key] ?? key} ${JSON.stringify(params)}` : (STRINGS[key] ?? key),
			onChange: () => ({ dispose: () => {} }),
		},
		ui: { notify: state.notify, openActivityTab: state.openActivityTab },
	}),
	setPluginContext: () => {},
}));

const URL = "https://example.com/docs/";

function call(status: PluginToolCallSlotProps["toolCall"]["status"], result?: string): PluginToolCallSlotProps {
	return {
		toolCall: { toolCallId: "t-1", toolName: "firecrawl_crawl", args: { url: URL }, status, result },
	};
}

/** The component only reads a handful of snapshot fields, so the store is faked. */
function store(snapshot: Partial<CrawlRunSnapshot> = {}): CrawlRunStore {
	const value = {
		status: "idle",
		target: "",
		counts: { crawled: 0, fetching: 0, queued: 0, denied: 0, failed: 0, discovered: 0 },
		artifacts: [],
		...snapshot,
	};
	return {
		getSnapshot: () => value,
		subscribe: () => () => {},
	} as unknown as CrawlRunStore;
}

function deps(run = store()) {
	return { ctx: { ui: { notify: state.notify, openActivityTab: state.openActivityTab } } as unknown as PluginContext, store: run };
}

afterEach(() => {
	cleanup();
	state.openActivityTab.mockReset();
	state.notify.mockReset();
	state.cwd = "/work/repo";
});

describe("CrawlToolCall", () => {
	it("still shows the tool result when the console has no runtime yet", () => {
		const view = render(<CrawlToolCall {...call("success", "Crawled 12 pages")} />);

		expect(view.getByText("Crawled 12 pages")).toBeTruthy();
		expect(view.getByText(URL)).toBeTruthy();
		expect(view.queryByText("Console")).toBeNull();
	});

	it("shows live progress for the run the agent started", () => {
		setConsoleDeps(
			deps(
				store({
					status: "running",
					target: URL,
					counts: { crawled: 3, fetching: 1, queued: 8, denied: 0, failed: 0, discovered: 12 },
					artifacts: [{ id: "markdown:x" } as never],
				}),
			),
		);

		const view = render(<CrawlToolCall {...call("pending")} />);

		expect(view.getByText("Crawl")).toBeTruthy();
		// Live counts come from the store, not from the tool call.
		expect(view.getByText("3 / 12")).toBeTruthy();
		expect(within(view.container).getByText(/crawl progress/)).toBeTruthy();
	});

	it("stays quiet while the tool has not started a matching run", () => {
		setConsoleDeps(deps(store({ status: "completed", target: "https://other.test/" })));

		const view = render(<CrawlToolCall {...call("pending")} />);

		expect(view.getByText("Starting the crawl...")).toBeTruthy();
	});

	it("opens the console anchored on the conversation directory", () => {
		setConsoleDeps(deps());

		const view = render(<CrawlToolCall {...call("success", "Crawled 1 page")} />);
		fireEvent.click(view.getByText("Console"));

		expect(state.openActivityTab).toHaveBeenCalledWith(FIRECRAWL_TAB_ID, { width: "max", cwd: "/work/repo" });
	});

	it("drops the cwd when the conversation has none, and reports a rejected jump", () => {
		state.cwd = null;
		state.openActivityTab.mockImplementation(() => {
			throw new Error("tab unavailable");
		});
		setConsoleDeps(deps());

		const view = render(<CrawlToolCall {...call("success", "Crawled 1 page")} />);
		fireEvent.click(view.getByText("Console"));

		expect(state.openActivityTab).toHaveBeenCalledWith(FIRECRAWL_TAB_ID, { width: "max", cwd: undefined });
		expect(state.notify).toHaveBeenCalledWith({ message: "tab unavailable", error: true });
	});
});

import { describe, expect, it, vi } from "vitest";
import type { PluginContext } from "@astravia-org/plugin-sdk";
import type { CrawlRunStore } from "../src/features/crawler-console/services/crawl-run-store";
import { extractUrl, watchConversation } from "../src/runtime/conversation-watch";

function fakeStore() {
	const setTarget = vi.fn();
	return { setTarget } as unknown as CrawlRunStore & { setTarget: ReturnType<typeof vi.fn> };
}

describe("extractUrl", () => {
	it("takes the first http(s) URL and trims sentence punctuation", () => {
		expect(extractUrl("read https://example.com/docs, then summarize")).toBe("https://example.com/docs");
		expect(extractUrl("see (http://localhost:3000/a).")).toBe("http://localhost:3000/a");
	});

	it("returns null when there is no URL", () => {
		expect(extractUrl("no link here")).toBeNull();
		expect(extractUrl("")).toBeNull();
	});
});

describe("watchConversation", () => {
	it("ignores assistant messages and unrelated tool calls", () => {
		const store = fakeStore();
		let captured: ((event: unknown) => void) | null = null;
		const ctx = {
			conversation: {
				on: (listener: (event: unknown) => void) => {
					captured = listener;
					return { dispose: () => {} };
				},
			},
		} as unknown as PluginContext;
		watchConversation(ctx, store);
		captured!({ type: "message-added", message: { id: "1", role: "assistant", text: "see https://x.dev" } });
		captured!({ type: "tool-call-args", toolCallId: "c1", toolName: "other_tool", args: { url: "https://y.dev" } });
		expect(store.setTarget).not.toHaveBeenCalled();

		captured!({ type: "message-added", message: { id: "2", role: "user", text: "crawl https://a.dev/start" } });
		expect(store.setTarget).toHaveBeenCalledWith("https://a.dev/start", "conversation");

		captured!({ type: "tool-call-start", toolCallId: "c2", toolName: "firecrawl_scrape", args: { url: "https://b.dev/p" } });
		expect(store.setTarget).toHaveBeenCalledWith("https://b.dev/p", "tool");
	});

	it("degrades to a no-op when the conversation API is denied", () => {
		const store = fakeStore();
		const ctx = {
			conversation: {
				on: () => {
					throw new Error("missing permission: agent.session.read");
				},
			},
		} as unknown as PluginContext;
		const watcher = watchConversation(ctx, store);
		expect(() => watcher.dispose()).not.toThrow();
		expect(store.setTarget).not.toHaveBeenCalled();
	});
});

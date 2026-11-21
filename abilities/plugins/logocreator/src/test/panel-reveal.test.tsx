import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PluginContext } from "@astravia-org/plugin-sdk";
import { __PluginI18nContext, __setPluginHostBridge } from "@astravia-org/plugin-sdk";
import { LogoCanvas } from "../features/canvas/components/logo-canvas";
import { normalizeSpec } from "../domain/spec";
import { getHistoryStore, setPluginContext } from "../plugin-context";
import { claimPendingDesignId, peekPendingDesignId, setPendingDesignId } from "../features/canvas/pending-design";

/**
 * The conversation → canvas reveal.
 *
 * A tool handler cannot call a React setter, so `logocreator_design` leaves the new
 * design id in `pending-design` and opens the tab. Without the panel claiming that
 * id, the tab opens onto an empty form (or the previous design) and the tool looks
 * like it did nothing — the exact failure the reference plugin's
 * `setPendingDesignPath` / `claimCanvasReveal` pair exists to prevent.
 */

const ROOT = process.cwd();
/** The conversation both the tool and the panel belong to in these tests. */
const CWD = "C:/repo/demo";
const locales = {
	en: JSON.parse(readFileSync(join(ROOT, "locales/en.json"), "utf8")),
	zh: JSON.parse(readFileSync(join(ROOT, "locales/zh.json"), "utf8")),
};

function record(id: string, brandName: string, createdAt: number) {
	return {
		id,
		spec: normalizeSpec({ brandName, type: "icon-name", style: "minimal", intent: "a leaf mark" }),
		engine: "local",
		subject: "leaf",
		createdAt,
		favorite: false,
	};
}

function fakeContext(items: unknown[]) {
	const files: Record<string, string> = {
		"designs.json": JSON.stringify({ schemaVersion: 1, items }),
	};
	const storage = {
		list: async () => Object.keys(files),
		readFile: async (path: string) => files[path] ?? null,
		writeFile: async (path: string, data: string) => {
			files[path] = data;
			return { revision: "r", changedPaths: [path] };
		},
		commit: async () => ({ revision: "r", changedPaths: [] }),
		readSnapshot: async (paths: string[]) => ({
			revision: "r",
			files: Object.fromEntries(paths.map((p) => [p, files[p] ?? null])),
		}),
		putBlob: async () => ({ id: "b", url: "u", mimeType: "image/png" }),
		putBlobFromFile: async () => ({ id: "b", url: "u", mimeType: "image/png" }),
		readBlob: async () => null,
		getBlobRef: async () => null,
		deleteBlob: async () => undefined,
	};

	return {
		plugin: { id: "logocreator", version: "0.0.0" },
		permissions: { has: () => true, require: () => undefined },
		ui: {
			notify: vi.fn(),
			openActivityTab: vi.fn(),
			setActivityTabVisible: vi.fn(),
			openExternal: vi.fn(),
			getSidebarState: () => ({ visible: true, collapsed: false, narrow: false }),
			onSidebarStateChanged: () => ({ dispose: () => undefined }),
		},
		storage,
		media: { listProviders: async () => [], submit: vi.fn(), registerProvider: vi.fn(), onProvidersChanged: vi.fn() },
		jobs: { wait: vi.fn(), get: vi.fn(), cancel: vi.fn() },
		artifacts: { persist: vi.fn(), release: vi.fn() },
		fs: {
			saveAs: vi.fn(async () => "/tmp/out.svg"),
			readFile: vi.fn(),
			writeFile: vi.fn(),
			readDir: vi.fn(async () => []),
			listFilesRecursive: vi.fn(async () => []),
			createDirectory: vi.fn(),
			stat: vi.fn(async () => null),
			delete: vi.fn(),
			rename: vi.fn(),
			move: vi.fn(),
			watchDirectory: () => ({ dispose: () => undefined }),
			readBinaryFile: vi.fn(),
		},
		agent: {
			registerTool: vi.fn(),
			registerSystemPromptProvider: vi.fn(),
			registerHook: vi.fn(),
			registerContinuationProvider: vi.fn(),
		},
		i18n: { locale: "en", t: (key: string) => key, onChange: () => ({ dispose: () => undefined }) },
		conversation: {
			sendPrompt: vi.fn(async () => ({ status: "queued" })),
			insertText: vi.fn(),
			createSession: vi.fn(),
			abort: vi.fn(),
			on: () => ({ dispose: () => undefined }),
		},
	} as unknown as PluginContext;
}

function renderPanel() {
	return render(
		<__PluginI18nContext.Provider value={{ locales, defaultLocale: "en" }}>
			<LogoCanvas />
		</__PluginI18nContext.Provider>,
	);
}

beforeEach(() => {
	__setPluginHostBridge({
		useLocale: () => "en",
		useActiveConversation: () => ({ id: "s1", cwd: CWD, sessionPath: null, model: null, isStreaming: false }) as never,
		useConversationMessages: () => [],
		usePromptAttachment: () => null,
		useSidebarState: () => ({ visible: true, collapsed: false, narrow: false }),
		conversation: {} as never,
	});
});

afterEach(cleanup);

describe("the conversation → canvas reveal", () => {
	it("opens on the design a tool just created", async () => {
		// Two stored designs; the tool created the *older* one a moment ago and left
		// its id behind. The panel must show that one, not the newest.
		const ctx = fakeContext([record("newest", "Vellum", 2_000), record("from-tool", "Fern & Field", 1_000)]);
		setPluginContext(ctx);
		setPendingDesignId(CWD, "from-tool");

		renderPanel();

		// The stage's title chip is what the user reads; the inspector field may be closed.
		await waitFor(() => expect(screen.getAllByText("Fern & Field").length).toBeGreaterThan(0));
	});

	it("falls back to the newest design when nothing is pending", async () => {
		const ctx = fakeContext([record("latest", "Kettle Lane", 5_000)]);
		setPluginContext(ctx);

		renderPanel();

		await waitFor(() => expect(screen.getAllByText("Kettle Lane").length).toBeGreaterThan(0));
	});

	it("keeps waiting when the record has not arrived yet", async () => {
		// The real sequence: the panel is already open on an older design, the agent starts
		// a run, the tool stores the new record and leaves the id — but the panel's first
		// claim can run before the store holds that record. Consuming the id there lost it,
		// and because the form already carried a brand name the "newest design" fallback did
		// not fire either, so the canvas stayed on the old design.
		const ctx = fakeContext([record("existing", "Old Brand", 1_000)]);
		setPluginContext(ctx);

		const view = renderPanel();
		await waitFor(() => expect(screen.getAllByText("Old Brand").length).toBeGreaterThan(0));

		// The tool leaves the id behind before the record exists.
		setPendingDesignId(CWD, "late");
		expect(peekPendingDesignId(CWD)).toBe("late");

		// Then it lands.
		await getHistoryStore().add({ id: "late", spec: normalizeSpec({ brandName: "Arrived" }), engine: "local", subject: "leaf" });

		await waitFor(() => expect(screen.getAllByText("Arrived").length).toBeGreaterThan(0));
		expect(claimPendingDesignId(CWD)).toBeNull();
		view.unmount();
	});

	it("claims a pending design only once", async () => {
		const ctx = fakeContext([record("one", "First", 1_000)]);
		setPluginContext(ctx);
		setPendingDesignId(CWD, "one");

		const first = renderPanel();
		await waitFor(() => expect(screen.getAllByText("First").length).toBeGreaterThan(0));
		first.unmount();

		// A remount with nothing pending keeps the form the user left behind, rather
		// than dragging it back to the same record.
		setPluginContext(ctx);
		renderPanel();
		await waitFor(() => expect(screen.getAllByText("First").length).toBeGreaterThan(0));
	});
});

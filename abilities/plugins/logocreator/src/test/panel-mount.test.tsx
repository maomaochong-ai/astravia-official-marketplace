import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PluginContext } from "@astravia-org/plugin-sdk";
import { __PluginI18nContext, __setPluginHostBridge } from "@astravia-org/plugin-sdk";
import { LogoCanvas } from "../features/canvas/components/logo-canvas";
import { setPluginContext } from "../plugin-context";

/**
 * "Does the studio actually open?" is the first thing a user judges, and a panel
 * that throws on mount leaves an empty tab with a console error nobody reads.
 *
 * This renders the real panel against a fake host context: no remote, no IPC, no
 * canvas. The copy asserted below is the real English catalog text (resolved
 * through the host's own `useTranslation`), so a broken catalog or a renamed key
 * turns this red rather than silently shipping a panel that reads `panel.title`.
 */

const ROOT = process.cwd();
const locales = {
	en: JSON.parse(readFileSync(join(ROOT, "locales/en.json"), "utf8")),
	zh: JSON.parse(readFileSync(join(ROOT, "locales/zh.json"), "utf8")),
};

function fakeContext() {
	const files: Record<string, string> = {};
	const notify = vi.fn();
	const storage = {
		files,
		list: async () => Object.keys(files),
		readFile: async (path: string) => files[path] ?? null,
		writeFile: async (path: string, data: string) => {
			files[path] = data;
			return { revision: `r${Object.keys(files).length}`, changedPaths: [path] };
		},
		commit: async (changes: { type: string; path: string; data?: string }[]) => {
			for (const change of changes) {
				if (change.type === "write") files[change.path] = change.data ?? "";
				else delete files[change.path];
			}
			return { revision: "r", changedPaths: changes.map((c) => c.path) };
		},
		readSnapshot: async (paths: string[]) => ({
			revision: "r",
			files: Object.fromEntries(paths.map((p) => [p, files[p] ?? null])),
		}),
		putBlob: async () => ({ id: "blob", url: "host://blob", mimeType: "image/png" }),
		putBlobFromFile: async () => ({ id: "blob", url: "host://blob", mimeType: "image/png" }),
		readBlob: async () => null,
		getBlobRef: async () => null,
		deleteBlob: async () => undefined,
	};

	const ctx = {
		plugin: { id: "logocreator", version: "0.0.0" },
		permissions: { has: () => true, require: () => undefined },
		ui: {
			notify,
			openActivityTab: vi.fn(),
			setActivityTabVisible: vi.fn(),
			openExternal: vi.fn(),
			getSidebarState: () => ({ visible: true, collapsed: false, narrow: false }),
			onSidebarStateChanged: () => ({ dispose: () => undefined }),
		},
		storage,
		// No image provider on this machine: the AI mode must degrade, not throw.
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

	return { ctx, storage, notify };
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
		useActiveConversation: () => ({}) as never,
		useConversationMessages: () => [],
		usePromptAttachment: () => null,
		useSidebarState: () => ({ visible: true, collapsed: false, narrow: false, width: 240 }),
	ModelPicker: () => null,
		conversation: {} as never,
	});
});

afterEach(() => {
	cleanup();
});

describe("the canvas mounts", () => {
	it("renders a stage with floating chrome instead of a scrolling form", async () => {
		const { ctx } = fakeContext();
		setPluginContext(ctx);
		renderPanel();

		// Stage chrome: the title chip (untitled), the dock, the action rail.
		expect(await screen.findByText("Untitled")).toBeTruthy();
		expect(screen.getByLabelText("Design settings")).toBeTruthy();
		// 备注与设置合并成一个入口（同一个 rail 的两个 tab），不再单独占一个按钮位。
		expect(screen.getByLabelText("Design versions")).toBeTruthy();
		// The form itself is not on the stage: it opens in the rail.
		expect(screen.queryByPlaceholderText("Fern & Field")).toBeNull();
	});

	it("opens the design rail from the dock", async () => {
		const { ctx } = fakeContext();
		setPluginContext(ctx);
		renderPanel();

		fireEvent.click(await screen.findByLabelText("Design settings"));
		expect(await screen.findByPlaceholderText("Fern & Field")).toBeTruthy();
		// Two tabs, one rail.
		expect(screen.getByRole("tab", { name: "Design" })).toBeTruthy();
		expect(screen.getByRole("tab", { name: "Notes" })).toBeTruthy();
	});

	it("degrades the AI mode when the host has no image provider", async () => {
		const { ctx } = fakeContext();
		setPluginContext(ctx);
		renderPanel();
		expect(notifyOf(ctx)).not.toHaveBeenCalled();
	});

	it("designs three vectors from the stage and stores them", async () => {
		const { ctx, storage } = fakeContext();
		setPluginContext(ctx);
		renderPanel();

		fireEvent.click(await screen.findByLabelText("Design settings"));
		const nameInput = (await screen.findByPlaceholderText("Fern & Field")) as HTMLInputElement;
		fireEvent.change(nameInput, { target: { value: "Fern & Field" } });
		const intent = (await screen.findByPlaceholderText("a minimal leaf mark, organic and calm")) as HTMLTextAreaElement;
		fireEvent.change(intent, { target: { value: "a leaf mark for a garden studio" } });
		fireEvent.click(screen.getByLabelText("Close the panel"));

		fireEvent.click(screen.getByLabelText("Design logos"));

		await waitFor(() => {
			expect(storage.files["designs.json"]).toBeTruthy();
		});
		const saved = JSON.parse(storage.files["designs.json"]);
		expect(saved.items).toHaveLength(3);
		expect(saved.items[0].spec.brandName).toBe("Fern & Field");
		// The brief was read as a leaf, which is the whole point of `intent`.
		expect(saved.items[0].subject).toBe("leaf");
	});

	it("refuses to design without a name, before the click", async () => {
		const { ctx, storage } = fakeContext();
		setPluginContext(ctx);
		renderPanel();

		// Disabled, with the reason in the control's own title/aria-label. No separate
		// hint line under the dock: that stray paragraph was the "extra text" the dock
		// stacked below itself.
		const button = (await screen.findByLabelText("Type a brand name first")) as HTMLButtonElement;
		expect(button.disabled).toBe(true);
		expect(button.getAttribute("title")).toBe("Type a brand name first");
		expect(storage.files["designs.json"]).toBeUndefined();
		expect(notifyOf(ctx)).not.toHaveBeenCalled();
	});
});

function notifyOf(ctx: PluginContext) {
	return (ctx.ui as unknown as { notify: ReturnType<typeof vi.fn> }).notify;
}

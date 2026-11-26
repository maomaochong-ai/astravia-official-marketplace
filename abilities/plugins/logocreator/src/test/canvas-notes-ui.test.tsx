import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PluginContext } from "@astravia-org/plugin-sdk";
import { __PluginI18nContext, __setPluginHostBridge } from "@astravia-org/plugin-sdk";
import { LogoCanvas } from "../features/canvas/components/logo-canvas";
import { normalizeSpec } from "../domain/spec";
import { setPluginContext } from "../plugin-context";

/**
 * "Pin a note, the host changes the logo."
 *
 * The canvas is the only place a user can point at *where* something is wrong, so
 * the note path has to survive a real interaction: click the artwork, type, pin it,
 * then hand the batch over. If any of those is broken the feature is decorative.
 */

const ROOT = process.cwd();
const locales = {
	en: JSON.parse(readFileSync(join(ROOT, "locales/en.json"), "utf8")),
	zh: JSON.parse(readFileSync(join(ROOT, "locales/zh.json"), "utf8")),
};
const en = locales.en as Record<string, string>;
/** Resolved copy for a catalog key — the DOM never contains the key itself. */
const copy = (key: string) => en[key];

function context() {
	const files: Record<string, string> = {};
	const sendPrompt = vi.fn(async (_text: string) => ({ status: "queued" as const }));

	const ctx = {
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
		storage: {
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
		},
		conversation: {
			sendPrompt,
			insertText: vi.fn(),
			createSession: vi.fn(),
			abort: vi.fn(),
			on: () => ({ dispose: () => undefined }),
		},
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
	} as unknown as PluginContext;

	return { ctx, files, sendPrompt };
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

afterEach(cleanup);

describe("canvas notes", () => {
	it("pins a note where the user clicked, and sends it as a turn", async () => {
		const { ctx, files, sendPrompt } = context();
		setPluginContext(ctx);
		render(
			<__PluginI18nContext.Provider value={{ locales, defaultLocale: "en" }}>
				<LogoCanvas />
			</__PluginI18nContext.Provider>,
		);

		// The brand field lives in the inspector rail; a user opens it from the dock.
		fireEvent.click(await screen.findByLabelText(copy("dock.inspector")));
		const nameInput = (await screen.findByPlaceholderText("Fern & Field")) as HTMLInputElement;
		fireEvent.change(nameInput, { target: { value: "Fern & Field" } });
		// Close the rail so the stage is clickable again (it overlaps the art).
		fireEvent.click(screen.getByLabelText(copy("inspector.close")));

		const surface = screen.getByLabelText(copy("notes.surface"));
		// jsdom reports a zero-size box; the layer falls back to the centre anchor.
		Object.defineProperty(surface, "getBoundingClientRect", {
			value: () => ({ left: 0, top: 0, width: 400, height: 400, right: 400, bottom: 400, x: 0, y: 0, toJSON: () => ({}) }),
		});
		// A press that does not move is the note gesture now (a drag pans).
		fireEvent.pointerDown(surface, { clientX: 100, clientY: 300, pointerId: 1, button: 0 });
		fireEvent.pointerUp(surface, { clientX: 100, clientY: 300, pointerId: 1, button: 0 });

		const box = (await screen.findByLabelText(copy("notes.placeholder"))) as HTMLTextAreaElement;
		fireEvent.change(box, { target: { value: "make the leaf wider" } });
		fireEvent.click(screen.getByText(copy("notes.add")));

		await waitFor(() => expect(files["notes.json"]).toBeTruthy());
		const saved = JSON.parse(files["notes.json"]);
		expect(saved.items[0].text).toBe("make the leaf wider");
		// 100/400 and 300/400 — the anchor is fractional, not pixels.
		expect(saved.items[0].x).toBeCloseTo(0.25, 1);
		expect(saved.items[0].y).toBeCloseTo(0.75, 1);

		// The hand-off lives in the notes rail now.
		// 备注与设置同一个入口：先开 rail，再切到备注 tab。
		fireEvent.click(screen.getByLabelText(copy("dock.inspector")));
		fireEvent.click(await screen.findByRole("tab", { name: copy("inspector.tabNotes") }));
		fireEvent.click(await screen.findByLabelText(copy("notes.handToAgent")));

		await waitFor(() => expect(sendPrompt).toHaveBeenCalledTimes(1));
		const prompt = String(sendPrompt.mock.calls[0]?.[0] ?? "");
		// The hand-off points at the ledger instead of pasting today's notes: a pasted
		// snapshot locks the agent to what existed at send time, so anything the user pins
		// while it works is invisible (the reference plugin learned this the hard way).
		expect(prompt).toContain("logocreator_notes");
		expect(prompt).toContain("resolve");
		expect(prompt).not.toContain("make the leaf wider");
		// Marked as handed over, so the debounce cannot send it twice.
		await waitFor(() => expect(JSON.parse(files["notes.json"]).items[0].dispatchedAt).toBeGreaterThan(0));
	});

	it("offers no hand-off control until something is pinned", async () => {
		const { ctx, sendPrompt } = context();
		setPluginContext(ctx);
		render(
			<__PluginI18nContext.Provider value={{ locales, defaultLocale: "en" }}>
				<LogoCanvas />
			</__PluginI18nContext.Provider>,
		);

		// The dock is the stage's permanent chrome, so this much renders immediately.
		// dock 是画布常驻的 chrome，这一层立刻就有。
		expect(await screen.findByLabelText(copy("dock.inspector"))).toBeTruthy();
		fireEvent.click(screen.getByLabelText(copy("dock.inspector")));
		fireEvent.click(await screen.findByRole("tab", { name: copy("inspector.tabNotes") }));
		// No pins → the notes rail has nothing to offer. A hand-off button that can
		// never be enabled reads as a broken feature; an absent one reads as "nothing
		// to send".
		expect(screen.queryByLabelText(copy("notes.handToAgent"))).toBeNull();
		expect(sendPrompt).not.toHaveBeenCalled();
	});
});

describe("the design the canvas starts from", () => {
	it("loads the spec it is given, with no spec keys left undefined", () => {
		const spec = normalizeSpec({ brandName: "Vellum", type: "monogram" });
		expect(Object.values(spec).every((value) => value !== undefined)).toBe(true);
	});
});

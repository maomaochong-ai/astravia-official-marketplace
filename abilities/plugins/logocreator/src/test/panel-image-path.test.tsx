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
 * "The host has an image service, so the panel should offer it and then show the
 * result." That is three links in a chain, and each one was broken at some point:
 * detection, the control, and the preview. This drives all three in one render.
 */

const ROOT = process.cwd();
const locales = {
	en: JSON.parse(readFileSync(join(ROOT, "locales/en.json"), "utf8")),
	zh: JSON.parse(readFileSync(join(ROOT, "locales/zh.json"), "utf8")),
};
const en = locales.en as Record<string, string>;

function host() {
	const files: Record<string, string> = {};
	const providers = [
		{
			id: "desktop-app:astravia",
			ownerId: "desktop-app",
			protocolVersion: 1,
			capabilities: [{ operation: "generate", kind: "image", modes: ["text-to-image", "image-to-image"] }],
		},
	];
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
			putBlob: async () => ({ id: "b", url: "blob:host/1", mimeType: "image/png" }),
			putBlobFromFile: async () => ({ id: "b", url: "blob:host/1", mimeType: "image/png" }),
			readBlob: async () => null,
			getBlobRef: async (id: string) => ({ id, url: `blob:host/${id}`, mimeType: "image/png" }),
			deleteBlob: async () => undefined,
		},
		media: {
			listProviders: vi.fn(async () => providers),
			submit: vi.fn(async () => ({ id: "job-1" })),
			registerProvider: vi.fn(),
			onProvidersChanged: vi.fn(),
		},
		jobs: {
			wait: vi.fn(async () => ({
				id: "job-1",
				status: "succeeded",
				artifacts: [{ id: "a1", mimeType: "image/png", sizeBytes: 10, lifetime: "temporary" }],
			})),
			get: vi.fn(),
			cancel: vi.fn(),
		},
		artifacts: { persist: vi.fn(async () => ({ type: "plugin-blob", blobId: "blob-9" })), release: vi.fn() },
		conversation: {
			sendPrompt: vi.fn(async () => ({ status: "queued" })),
			insertText: vi.fn(),
			createSession: vi.fn(),
			abort: vi.fn(),
			on: () => ({ dispose: () => undefined }),
		},
		fs: {
			saveAs: vi.fn(async () => null),
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
	return { ctx, files };
}

beforeEach(() => {
	__setPluginHostBridge({
		useLocale: () => "en",
		useActiveConversation: () => ({ id: "s1", cwd: "C:/repo/demo", sessionPath: null, model: null, isStreaming: false }) as never,
		useConversationMessages: () => [],
		usePromptAttachment: () => null,
		useSidebarState: () => ({ visible: true, collapsed: false, narrow: false, width: 240 }),
	ModelPicker: () => null,
		conversation: {} as never,
	});
});

afterEach(cleanup);

describe("the panel's image path", () => {
	it("offers the image control as soon as the host reports a provider", async () => {
		const { ctx } = host();
		setPluginContext(ctx);
		render(
			<__PluginI18nContext.Provider value={{ locales, defaultLocale: "en" }}>
				<LogoCanvas />
			</__PluginI18nContext.Provider>,
		);

		// 检测是异步的：有 provider 时主按钮不再处于「缺模型」态。
		await screen.findByLabelText(en["dock.inspector"]);
		await waitFor(() => expect(screen.queryByLabelText(en["dock.imageOff"])).toBeNull());
	});

	it("generates a raster record and shows it on the stage", async () => {
		const { ctx, files } = host();
		setPluginContext(ctx);
		render(
			<__PluginI18nContext.Provider value={{ locales, defaultLocale: "en" }}>
				<LogoCanvas />
			</__PluginI18nContext.Provider>,
		);

		// A brand name is required before either path will run.
		fireEvent.click(await screen.findByLabelText(en["dock.inspector"]));
		const nameInput = (await screen.findByPlaceholderText("Fern & Field")) as HTMLInputElement;
		fireEvent.change(nameInput, { target: { value: "Hootly" } });
		fireEvent.click(screen.getByLabelText(en["inspector.close"]));

		fireEvent.click(await screen.findByLabelText(en["action.generateAi"]));

		await waitFor(() => expect(files["designs.json"]).toBeTruthy());
		const saved = JSON.parse(files["designs.json"]);
		const ai = saved.items.filter((item: { engine: string }) => item.engine === "ai");
		expect(ai.length).toBeGreaterThan(0);
		expect(ai[0].blobId).toBe("blob-9");

		// The stage must draw the PNG, not a vector re-render of the spec.
		await waitFor(() => {
			const img = document.querySelector('img[src^="blob:host/"]');
			expect(img).toBeTruthy();
		});
	});

	it("says why when the image permission was refused", async () => {
		const { ctx } = host();
		(ctx.media.listProviders as unknown as ReturnType<typeof vi.fn>).mockImplementation(async () => {
			throw new Error("Plugin permission denied: media.generate");
		});
		setPluginContext(ctx);
		render(
			<__PluginI18nContext.Provider value={{ locales, defaultLocale: "en" }}>
				<LogoCanvas />
			</__PluginI18nContext.Provider>,
		);

		await screen.findByLabelText(en["dock.inspector"]);
		// 权限被拒 → 没有「Generate with AI」这一态：按钮要么是缺模型、要么是缺名字，
		// 都不会假装能生成。
		await screen.findByLabelText(en["dock.inspector"]);
		await waitFor(() => expect(screen.queryByLabelText(en["action.generateAi"])).toBeNull());
	});
});

describe("the plan the panel stores for a raster design", () => {
	it("keeps the brand name so the form is coherent next to the image", () => {
		const spec = normalizeSpec({ brandName: "Hootly", intent: "a plush owl" });
		expect(spec.brandName).toBe("Hootly");
	});
});

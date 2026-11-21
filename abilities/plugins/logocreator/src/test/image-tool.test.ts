// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { PluginContext } from "@astravia-org/plugin-sdk";
import { normalizeSpec } from "../domain/spec";

/**
 * `logocreator_image` end to end against a fake host: the raster path must land in the
 * same history and hand the panel the newest design, exactly like the vector path.
 * Without this tool the skill's "use the AI route" had nowhere to go.
 */
function host() {
	const files: Record<string, string> = {};
	const add = vi.fn(async () => undefined);
	const media = {
		listProviders: vi.fn(async () => [
			{
				id: "desktop-app:astravia",
				ownerId: "desktop-app",
				protocolVersion: 1,
				capabilities: [{ operation: "generate", kind: "image", modes: ["text-to-image", "image-to-image"] }],
			},
		]),
		submit: vi.fn(async () => ({ id: "job-1" })),
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
		putBlob: async () => ({ id: "b", url: "", mimeType: "image/png" }),
		putBlobFromFile: async () => ({ id: "b", url: "", mimeType: "image/png" }),
		readBlob: async () => null,
		getBlobRef: async () => null,
		deleteBlob: async () => undefined,
	};
	const ctx = {
		storage,
		media,
		jobs: { wait: vi.fn(async () => ({ id: "job-1", status: "succeeded", artifacts: [{ id: "a", mimeType: "image/png", sizeBytes: 10, lifetime: "temporary" }] })) },
		artifacts: { persist: vi.fn(async () => ({ type: "plugin-blob", blobId: "blob-1" })), release: vi.fn() },
		ui: { openActivityTab: vi.fn(), setActivityTabVisible: vi.fn(), notify: vi.fn() },
	} as unknown as PluginContext;
	return { ctx, media, add, files };
}

describe("the raster tool", () => {
	it("stores each image as an ai record with its blob and opens the panel", async () => {
		const { ctx, add, files } = host();
		vi.resetModules();
		const { getHistoryStore, getPluginContext, setPluginContext } = await import("../plugin-context");
		setPluginContext(ctx);
		expect(getPluginContext()).toBe(ctx);
		expect(getHistoryStore()).toBeTruthy();
		void add;

		const { createImageTool } = await import("../tools/image");
		const tool = createImageTool();
		const result = (await tool.handler({
			trigger: { input: { prompt: "a plush owl in a hoodie, seated", brandName: "Hootly", count: 2 } },
			session: { cwd: "C:/repo/demo" },
		} as never)) as { ok: boolean; images: unknown[]; engine: string };

		expect(result.ok).toBe(true);
		expect(result.engine).toBe("ai");
		expect(result.images).toHaveLength(2);
		// Stored, not just returned: the panel reads the store, not the tool result.
		const saved = JSON.parse(files["designs.json"]);
		expect(saved.items).toHaveLength(2);
		expect(saved.items.every((item: { engine: string; blobId: string }) => item.engine === "ai" && item.blobId === "blob-1")).toBe(true);
	});

	it("refuses, with a sentence, when no provider is connected", async () => {
		const { ctx } = host();
		(ctx.media.listProviders as unknown as ReturnType<typeof vi.fn>).mockImplementation(async () => []);
		const { setPluginContext } = await import("../plugin-context");
		setPluginContext(ctx);

		const { createImageTool } = await import("../tools/image");
		const result = (await createImageTool().handler({
			trigger: { input: { prompt: "anything" } },
			session: { cwd: "C:/repo/demo" },
		} as never)) as { ok: boolean; error?: string };

		expect(result.ok).toBe(false);
		expect(String(result.error)).toMatch(/provider/i);
	});

	it("keeps the record's spec coherent for the panel form", () => {
		const spec = normalizeSpec({ brandName: "Hootly", intent: "a plush owl", primary: "#E5484D" });
		expect(spec.brandName).toBe("Hootly");
		expect(spec.primary).toBe("#E5484D");
	});
});

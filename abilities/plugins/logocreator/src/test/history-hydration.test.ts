// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { PluginStorageApi } from "@astravia-org/plugin-sdk";
import { HistoryStore, HISTORY_LIMIT } from "../domain/history-store";
import { normalizeSpec } from "../domain/spec";

/**
 * `HistoryStore` rewrites `designs.json` whole, so the difference between "hydrated"
 * and "not hydrated" is the difference between appending and destroying.
 *
 * The agent tools add designs while the panel is closed — nothing has hydrated the
 * store in that activation. These tests pin the guard that makes that safe.
 */

function fakeStorage(seed: Record<string, string> = {}) {
	const files: Record<string, string> = { ...seed };
	let reads = 0;
	const storage: PluginStorageApi = {
		list: async () => Object.keys(files),
		readFile: async (path) => {
			reads += 1;
			return files[path] ?? null;
		},
		writeFile: async (path, data) => {
			files[path] = data;
			return { revision: "r", changedPaths: [path] };
		},
		commit: async (changes) => {
			for (const change of changes) {
				if (change.type === "write") files[change.path] = change.data;
				else delete files[change.path];
			}
			return { revision: "r", changedPaths: changes.map((c) => c.path) };
		},
		readSnapshot: async (paths) => ({
			revision: "r",
			files: Object.fromEntries(paths.map((p) => [p, files[p] ?? null])),
		}),
		putBlob: async () => ({ id: "b", url: "u", mimeType: "image/png" }),
		putBlobFromFile: async () => ({ id: "b", url: "u", mimeType: "image/png" }),
		readBlob: async () => null,
		getBlobRef: async () => null,
		deleteBlob: async () => undefined,
	};
	return { storage, files, reads: () => reads };
}

const stored = (ids: string[]) =>
	JSON.stringify({
		schemaVersion: 1,
		items: ids.map((id, index) => ({
			id,
			spec: normalizeSpec({ brandName: id }),
			engine: "local",
			subject: "leaf",
			// Fixture order is newest-first, matching what the store writes back.
			createdAt: 1_000 + (ids.length - index),
			favorite: false,
		})),
	});

const spec = (name: string) => normalizeSpec({ brandName: name });

describe("a mutation on an un-hydrated store", () => {
	it("appends instead of replacing the stored history", async () => {
		// The panel was never opened this activation, i.e. `hydrate()` never ran —
		// exactly what a tool call from the conversation looks like.
		const { storage, files } = fakeStorage({ "designs.json": stored(["old-1", "old-2"]) });
		const store = new HistoryStore(storage);

		await store.add({ id: "new", spec: spec("Fern"), engine: "local", subject: "leaf" });

		const saved = JSON.parse(files["designs.json"]);
		expect(saved.items.map((item: { id: string }) => item.id)).toEqual(["new", "old-1", "old-2"]);
	});

	it("does not delete an unrelated record when removing one", async () => {
		const { storage, files } = fakeStorage({ "designs.json": stored(["keep-1", "drop", "keep-2"]) });
		const store = new HistoryStore(storage);

		await store.remove("drop");

		const saved = JSON.parse(files["designs.json"]);
		expect(saved.items.map((item: { id: string }) => item.id).sort()).toEqual(["keep-1", "keep-2"]);
	});

	it("keeps the stored list when clearing, then writes an empty one", async () => {
		const { storage, files } = fakeStorage({ "designs.json": stored(["a", "b"]) });
		const store = new HistoryStore(storage);

		await store.clear();

		expect(JSON.parse(files["designs.json"]).items).toEqual([]);
	});

	it("lands both of two racing mutations, exactly once each", async () => {
		const { storage, files } = fakeStorage({ "designs.json": stored(["a"]) });
		const store = new HistoryStore(storage);

		await Promise.all([
			store.add({ id: "x", spec: spec("X"), engine: "local", subject: "leaf" }),
			store.add({ id: "y", spec: spec("Y"), engine: "local", subject: "leaf" }),
		]);

		// Persist re-reads before writing (that is what makes deletes stick), so the
		// old "one file read" count is no longer the property worth asserting.
		const saved = JSON.parse(files["designs.json"]);
		const ids = saved.items.map((item: { id: string }) => item.id);
		expect(ids).toContain("x");
		expect(ids).toContain("y");
		expect(ids).toContain("a");
		expect(new Set(ids).size).toBe(ids.length);
		expect(store.list()).toHaveLength(3);
	});

	it("still caps the list and keeps the newest", async () => {
		const ids = Array.from({ length: HISTORY_LIMIT }, (_, i) => `seed-${i}`);
		const { storage, files } = fakeStorage({ "designs.json": stored(ids) });
		const store = new HistoryStore(storage);

		await store.add({ id: "brand-new", spec: spec("New"), engine: "local", subject: "leaf" });

		const saved = JSON.parse(files["designs.json"]);
		expect(saved.items).toHaveLength(HISTORY_LIMIT);
		expect(saved.items[0].id).toBe("brand-new");
	});
});

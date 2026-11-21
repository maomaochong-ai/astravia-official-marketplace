import { describe, expect, it } from "vitest";
import type { PluginStorageApi } from "@astravia-org/plugin-sdk";
import { HistoryStore, HISTORY_LIMIT, displayLabel } from "../domain/history-store";
import { normalizeSpec } from "../domain/spec";

/** In-memory stand-in for host storage: files are strings, blobs are base64. */
function fakeStorage(seed: Record<string, string> = {}): PluginStorageApi & { files: Record<string, string>; deleted: string[] } {
	const files: Record<string, string> = { ...seed };
	const deleted: string[] = [];
	return {
		files,
		deleted,
		list: async (prefix?: string) => Object.keys(files).filter((key) => !prefix || key.startsWith(prefix)),
		readFile: async (path: string) => files[path] ?? null,
		writeFile: async (path: string, data: string) => {
			files[path] = data;
			return { revision: "r1", changedPaths: [path] };
		},
		commit: async (changes) => {
			for (const change of changes) {
				if (change.type === "write") files[change.path] = change.data;
				else delete files[change.path];
			}
			return { revision: "r2", changedPaths: changes.map((c) => c.path) };
		},
		readSnapshot: async (paths: string[]) => ({
			revision: "r1",
			files: Object.fromEntries(paths.map((path) => [path, files[path] ?? null])),
		}),
		putBlob: async ({ id }) => ({ id: id ?? "blob-1", url: "host://blob-1", mimeType: "image/png" }),
		putBlobFromFile: async () => ({ id: "blob-file", url: "host://blob-file", mimeType: "image/png" }),
		readBlob: async () => null,
		getBlobRef: async () => null,
		deleteBlob: async (id: string) => {
			deleted.push(id);
		},
	};
}

const spec = (name: string) => normalizeSpec({ brandName: name, style: "minimal" });

describe("history store", () => {
	it("starts empty and stores what it is given", async () => {
		const storage = fakeStorage();
		const store = new HistoryStore(storage);
		await store.hydrate();
		expect(store.list()).toEqual([]);

		const added = await store.add({ id: "a", spec: spec("Fern"), engine: "local", subject: "leaf" });
		expect(added.createdAt).toBeGreaterThan(0);
		expect(store.list()).toHaveLength(1);
		expect(JSON.parse(storage.files["designs.json"]).items).toHaveLength(1);
	});

	it("survives a reload", async () => {
		const storage = fakeStorage();
		const first = new HistoryStore(storage);
		await first.hydrate();
		await first.add({ id: "a", spec: spec("Fern"), engine: "local", subject: "leaf" });

		const second = new HistoryStore(storage);
		const items = await second.hydrate();
		expect(items).toHaveLength(1);
		expect(items[0].spec.brandName).toBe("Fern");
	});

	it("keeps the newest first", async () => {
		const store = new HistoryStore(fakeStorage());
		await store.hydrate();
		await store.add({ id: "a", spec: spec("A"), engine: "local", subject: "leaf" });
		await new Promise((resolve) => setTimeout(resolve, 2));
		await store.add({ id: "b", spec: spec("B"), engine: "local", subject: "leaf" });
		expect(store.list().map((item) => item.id)).toEqual(["b", "a"]);
	});

	it("caps the list without losing the newest", async () => {
		const store = new HistoryStore(fakeStorage());
		await store.hydrate();
		for (let i = 0; i < HISTORY_LIMIT + 5; i += 1) {
			await store.add({ id: `d${i}`, spec: spec(`B${i}`), engine: "local", subject: "leaf" });
		}
		expect(store.list()).toHaveLength(HISTORY_LIMIT);
		expect(store.list()[0].id).toBe(`d${HISTORY_LIMIT + 4}`);
	});

	it("updates favourites and names, and clears a name back to undefined", async () => {
		const store = new HistoryStore(fakeStorage());
		await store.hydrate();
		await store.add({ id: "a", spec: spec("Fern"), engine: "local", subject: "leaf" });
		await store.update("a", { favorite: true, name: "  Primary  " });
		expect(store.get("a")?.favorite).toBe(true);
		expect(store.get("a")?.name).toBe("Primary");
		await store.update("a", { name: "   " });
		expect(store.get("a")?.name).toBeUndefined();
	});

	it("deletes the blob that belongs to a removed design", async () => {
		const storage = fakeStorage();
		const store = new HistoryStore(storage);
		await store.hydrate();
		await store.add({ id: "a", spec: spec("Fern"), engine: "ai", subject: "flux", blobId: "blob-9" });
		await store.remove("a");
		expect(store.list()).toEqual([]);
		expect(storage.deleted).toContain("blob-9");
	});

	it("does not treat a corrupt file as a fatal error", async () => {
		const storage = fakeStorage({ "designs.json": "{not json" });
		const store = new HistoryStore(storage);
		await expect(store.hydrate()).resolves.toEqual([]);
		await store.add({ id: "a", spec: spec("Fern"), engine: "local", subject: "leaf" });
		expect(JSON.parse(storage.files["designs.json"]).items).toHaveLength(1);
	});

	it("drops records that have no id", async () => {
		const storage = fakeStorage({
			"designs.json": JSON.stringify({ schemaVersion: 1, items: [{ spec: { brandName: "X" } }, { id: "ok" }] }),
		});
		const store = new HistoryStore(storage);
		const items = await store.hydrate();
		expect(items.map((item) => item.id)).toEqual(["ok"]);
	});

	it("falls back to the brand name for a label", async () => {
		const store = new HistoryStore(fakeStorage());
		await store.hydrate();
		const record = await store.add({ id: "a", spec: spec("Fern"), engine: "local", subject: "leaf" });
		expect(displayLabel(record)).toBe("Fern");
		expect(displayLabel({ ...record, name: "Primary mark" })).toBe("Primary mark");
		expect(displayLabel({ ...record, spec: normalizeSpec({}) })).toBe("Untitled");
	});

	it("notifies subscribers on every mutation", async () => {
		const store = new HistoryStore(fakeStorage());
		await store.hydrate();
		let calls = 0;
		const unsubscribe = store.subscribe(() => {
			calls += 1;
		});
		await store.add({ id: "a", spec: spec("Fern"), engine: "local", subject: "leaf" });
		await store.update("a", { favorite: true });
		await store.remove("a");
		unsubscribe();
		await store.add({ id: "b", spec: spec("Moss"), engine: "local", subject: "leaf" });
		expect(calls).toBe(3);
	});
});

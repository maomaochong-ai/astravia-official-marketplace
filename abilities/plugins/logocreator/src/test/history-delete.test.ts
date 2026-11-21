// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { PluginStorageApi } from "@astravia-org/plugin-sdk";
import { HistoryStore, HISTORY_PATH } from "../domain/history-store";
import { normalizeSpec } from "../domain/spec";

/**
 * Deleting must survive a reopen.
 *
 * The reported symptom: delete the history in the panel, reopen it, everything is
 * back. Both possible causes are covered here — a write that never reached storage,
 * and a second store instance writing its stale list back over the file.
 */

function storage(seed: Record<string, string> = {}) {
	const files: Record<string, string> = { ...seed };
	let revision = 0;
	const api: PluginStorageApi = {
		list: async () => Object.keys(files),
		readFile: async (path) => files[path] ?? null,
		writeFile: async (path, data) => {
			files[path] = data;
			revision += 1;
			return { revision: String(revision), changedPaths: [path] };
		},
		commit: async (changes) => {
			for (const change of changes) {
				if (change.type === "write") files[change.path] = change.data;
				else delete files[change.path];
			}
			revision += 1;
			return { revision: String(revision), changedPaths: changes.map((c) => c.path) };
		},
		readSnapshot: async (paths) => ({
			revision: String(revision),
			files: Object.fromEntries(paths.map((p) => [p, files[p] ?? null])),
		}),
		putBlob: async () => ({ id: "b", url: "", mimeType: "image/png" }),
		putBlobFromFile: async () => ({ id: "b", url: "", mimeType: "image/png" }),
		readBlob: async () => null,
		getBlobRef: async () => null,
		deleteBlob: async () => undefined,
	};
	return { api, files };
}

const record = (id: string, ts: number) => ({
	id,
	spec: normalizeSpec({ brandName: id }),
	engine: "local" as const,
	subject: "leaf",
	createdAt: ts,
	favorite: false,
});

const seed = (ids: string[]) =>
	JSON.stringify({ schemaVersion: 1, items: ids.map((id, index) => record(id, 100 - index)) });

const idsIn = (files: Record<string, string>) =>
	(JSON.parse(files[HISTORY_PATH]).items as { id: string }[]).map((item) => item.id);

describe("deleting history", () => {
	it("reaches storage, not just memory", async () => {
		const { api, files } = storage({ [HISTORY_PATH]: seed(["a", "b"]) });
		const store = new HistoryStore(api);
		await store.hydrate();

		await store.remove("a");

		expect(idsIn(files)).toEqual(["b"]);
	});

	it("survives a fresh store on the same storage", async () => {
		const { api } = storage({ [HISTORY_PATH]: seed(["a", "b"]) });
		await new HistoryStore(api).hydrate();
		await new HistoryStore(api).remove("a");

		// This is "reopen the panel": a new store hydrating from storage.
		const reopened = await new HistoryStore(api).hydrate();
		expect(reopened.map((item) => item.id)).toEqual(["b"]);
	});

	it("stays deleted when a stale instance writes afterwards", async () => {
		// Two activations / two module instances can both hold a store. The stale one
		// must not resurrect what the other deleted.
		const { api, files } = storage({ [HISTORY_PATH]: seed(["a", "b", "c"]) });
		const fresh = new HistoryStore(api);
		const stale = new HistoryStore(api);
		await fresh.hydrate();
		await stale.hydrate();

		await fresh.remove("a");
		await stale.add({ id: "d", spec: normalizeSpec({ brandName: "d" }), engine: "local", subject: "leaf" });

		expect(idsIn(files)).not.toContain("a");
		expect(idsIn(files)).toContain("b");
		expect(idsIn(files)).toContain("d");
	});

	it("clears storage, not just the list", async () => {
		const { api, files } = storage({ [HISTORY_PATH]: seed(["a", "b"]) });
		const store = new HistoryStore(api);
		await store.hydrate();

		await store.clear();

		expect(idsIn(files)).toEqual([]);
		expect(await new HistoryStore(api).hydrate()).toEqual([]);
	});
});

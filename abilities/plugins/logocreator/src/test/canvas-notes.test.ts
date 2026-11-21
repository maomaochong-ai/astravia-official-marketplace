// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { PluginStorageApi } from "@astravia-org/plugin-sdk";
import { NoteStore, NOTES_PATH, notesPrompt } from "../domain/notes";

/**
 * Canvas notes are the user's checklist. Two properties matter more than the rest:
 * a note survives a restart, and it is not silently closed by a run that failed.
 */

function fakeStorage(seed: Record<string, string> = {}) {
	const files: Record<string, string> = { ...seed };
	const storage: PluginStorageApi = {
		list: async () => Object.keys(files),
		readFile: async (path) => files[path] ?? null,
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
	return { storage, files };
}

describe("canvas notes", () => {
	it("keeps the anchor inside the canvas no matter what the pointer reported", async () => {
		const { storage } = fakeStorage();
		const store = new NoteStore(storage);
		const note = await store.add({ designId: null, text: "widen the leaf", x: -3, y: 9 });
		expect(note.x).toBeGreaterThan(0);
		expect(note.x).toBeLessThanOrEqual(1);
		expect(note.y).toBeGreaterThan(0);
		expect(note.y).toBeLessThanOrEqual(1);
	});

	it("appends to the stored list instead of replacing it (no hydrate race)", async () => {
		const existing = JSON.stringify({
			schemaVersion: 1,
			items: [{ id: "old", designId: null, text: "older note", x: 0.4, y: 0.4, createdAt: 1, status: "pending" }],
		});
		const { storage, files } = fakeStorage({ [NOTES_PATH]: existing });
		const store = new NoteStore(storage);

		await store.add({ designId: "d1", text: "newer note", x: 0.5, y: 0.5 });

		const saved = JSON.parse(files[NOTES_PATH]);
		expect(saved.items.map((note: { id: string }) => note.id)).not.toContain(undefined);
		expect(saved.items).toHaveLength(2);
		expect(saved.items[1].text).toBe("older note");
	});

	it("survives a reload", async () => {
		const { storage } = fakeStorage();
		await new NoteStore(storage).add({ designId: "d1", text: "make it warmer", x: 0.5, y: 0.5 });

		const reloaded = await new NoteStore(storage).hydrate();
		expect(reloaded).toHaveLength(1);
		expect(reloaded[0].text).toBe("make it warmer");
		expect(reloaded[0].status).toBe("pending");
	});

	it("resolves only what it was given, and reports the count", async () => {
		const { storage } = fakeStorage();
		const store = new NoteStore(storage);
		const a = await store.add({ designId: null, text: "note a", x: 0.3, y: 0.3 });
		await store.add({ designId: null, text: "note b", x: 0.6, y: 0.6 });

		const resolved = await store.resolve([a.id]);

		expect(resolved).toBe(1);
		expect(store.pending()).toHaveLength(1);
		expect(store.pending()[0].text).toBe("note b");
	});

	it("does not double-count an already resolved note", async () => {
		const { storage } = fakeStorage();
		const store = new NoteStore(storage);
		const note = await store.add({ designId: null, text: "x", x: 0.5, y: 0.5 });

		expect(await store.resolve([note.id])).toBe(1);
		expect(await store.resolve([note.id])).toBe(0);
	});

	it("filters pending notes by design", async () => {
		const { storage } = fakeStorage();
		const store = new NoteStore(storage);
		await store.add({ designId: "d1", text: "a", x: 0.2, y: 0.2 });
		await store.add({ designId: "d2", text: "b", x: 0.8, y: 0.8 });

		expect(store.pending("d1").map((note) => note.text)).toEqual(["a"]);
		expect(store.pending()).toHaveLength(2);
	});

	it("drops a note with no text rather than storing an empty pin", async () => {
		const { storage } = fakeStorage();
		await expect(new NoteStore(storage).add({ designId: null, text: "   ", x: 0.5, y: 0.5 })).rejects.toThrow(/needs text/i);
	});

	it("drops unreadable records instead of failing the whole list", async () => {
		const { storage } = fakeStorage({
			[NOTES_PATH]: JSON.stringify({ schemaVersion: 1, items: [{ text: "no id" }, { id: "ok", text: "fine", x: 0.5, y: 0.5 }] }),
		});
		const notes = await new NoteStore(storage).hydrate();
		expect(notes.map((note) => note.id)).toEqual(["ok"]);
	});
});

describe("the prompt a batch of notes becomes", () => {
	it("numbers the notes, names the brand, and forbids a blind re-roll", () => {
		const prompt = notesPrompt(
			[
				{ id: "1", designId: null, text: "make the leaf wider", x: 0.5, y: 0.5, createdAt: 1, status: "pending" },
				{ id: "2", designId: null, text: "use the warmer green", x: 0.4, y: 0.4, createdAt: 2, status: "pending" },
			],
			"Fern & Field",
		);

		expect(prompt).toContain('"Fern & Field"');
		expect(prompt).toContain("1. make the leaf wider");
		expect(prompt).toContain("2. use the warmer green");
		expect(prompt).toMatch(/keep the seed/i);
		expect(prompt).toContain("logocreator_design");
	});
});

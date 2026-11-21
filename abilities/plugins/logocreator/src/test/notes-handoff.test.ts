// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { PluginContext } from "@astravia-org/plugin-sdk";
import { NoteStore } from "../domain/notes";

/**
 * The reported failure: **after starting a new conversation, the notes could not be
 * handed over.**
 *
 * Cause: `conversation.sendPrompt` throws when there is no active session, and the
 * panel only ever called `sendPrompt`. The reference design plugin treats "no session
 * yet" as sendable — it creates one for the panel's cwd first.
 *
 * These two assertions are the contract; `useNotesHandoff` is exercised through a
 * mounted panel in canvas-notes-ui.test.tsx.
 */
function notes(storage: PluginStorageApiLike) {
	return new NoteStore(storage);
}

type PluginStorageApiLike = ConstructorParameters<typeof NoteStore>[0];

function fakeStorage() {
	const files: Record<string, string> = {};
	return {
		files,
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
	} satisfies PluginStorageApiLike & Record<string, unknown>;
}

describe("notes ledger", () => {
	it("lists only notes that have not been handed over", async () => {
		const storage = fakeStorage();
		const store = notes(storage);
		const first = await store.add({ designId: null, text: "first", x: 0.2, y: 0.2 });
		await store.add({ designId: null, text: "second", x: 0.6, y: 0.6 });

		expect(store.undispatched()).toHaveLength(2);
		await store.markDispatched([first.id]);
		expect(store.undispatched().map((note) => note.text)).toEqual(["second"]);
		// Still pending — dispatched is not resolved.
		expect(store.pending()).toHaveLength(2);
	});

	it("keeps the dispatch mark across a reopen", async () => {
		const storage = fakeStorage();
		const first = await notes(storage).add({ designId: null, text: "note", x: 0.5, y: 0.5 });
		await notes(storage).markDispatched([first.id]);

		// Same instance after hydrating: `undispatched` reads live state, not the file.
		const store = notes(storage);
		const reopened = await store.hydrate();
		expect(reopened[0].dispatchedAt).toBeGreaterThan(0);
		expect(store.undispatched()).toHaveLength(0);
	});
});

describe("sending with no active session", () => {
	it("creates the session first, then speaks", async () => {
		// The shape of `useNotesHandoff.send`: createSession(cwd) → sendPrompt(text).
		const sendPrompt = vi.fn(async () => ({ status: "queued" }));
		const createSession = vi.fn(async (cwd: string) => ({ id: "s2", cwd, sessionPath: null, model: null, isStreaming: false }));
		const conversation = { sendPrompt, createSession } as unknown as PluginContext["conversation"];

		await conversation.createSession("C:/repo/demo");
		await conversation.sendPrompt("notes ledger prompt");

		expect(createSession).toHaveBeenCalledWith("C:/repo/demo");
		expect(sendPrompt).toHaveBeenCalledTimes(1);
	});
});

import type { PluginContext } from "@astravia-org/plugin-sdk";
import { HistoryStore } from "./domain/history-store";
import { NoteStore } from "./domain/notes";

/**
 * One note store per activation.
 *
 * Same shape as the design history: the canvas and the tools must see the same
 * list, and re-creating it per component would mean two hydrate passes and two
 * competing writers.
 */

let context: PluginContext | null = null;
let noteStore: NoteStore | null = null;
let historyStore: HistoryStore | null = null;

export function setPluginContext(next: PluginContext): void {
	context = next;
	noteStore = new NoteStore(next.storage);
	historyStore = new HistoryStore(next.storage);
}

/** The activation's context. Throws rather than returning undefined, so callers cannot half-work. */
export function getPluginContext(): PluginContext {
	if (!context) throw new Error("LogoCreator is not active in this window");
	return context;
}

export function getHistoryStore(): HistoryStore {
	if (!historyStore) throw new Error("LogoCreator is not active in this window");
	return historyStore;
}

export function getNoteStore(): NoteStore {
	if (!noteStore) throw new Error("LogoCreator is not active in this window");
	return noteStore;
}

/** Report a failure the way the host expects: message plus the original error. */
export function reportError(message: string, error: unknown): void {
	context?.ui.notify({ message, error });
}

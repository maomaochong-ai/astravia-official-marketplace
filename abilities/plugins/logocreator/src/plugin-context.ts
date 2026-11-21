import type { PluginContext } from "@astravia-org/plugin-sdk";
import { HistoryStore } from "./domain/history-store";

/**
 * The activation's context, captured once.
 *
 * React components do not receive `ctx`, and the brand kit / history need it for
 * storage, fs and notifications. Holding it here also gives us somewhere to keep
 * the one HistoryStore instance: the activity panel unmounts and remounts as the
 * user switches tabs, and re-hydrating the whole history on every remount would
 * make the gallery flicker for no reason.
 */

let context: PluginContext | null = null;
let historyStore: HistoryStore | null = null;

export function setPluginContext(next: PluginContext): void {
	context = next;
	historyStore = new HistoryStore(next.storage);
}

export function clearPluginContext(): void {
	context = null;
	historyStore = null;
}

export function getPluginContext(): PluginContext {
	if (!context) throw new Error("The LogoCreator plugin is not active in this window");
	return context;
}

export function getHistoryStore(): HistoryStore {
	if (!historyStore) throw new Error("The LogoCreator plugin is not active in this window");
	return historyStore;
}

/** Report a failure the way the host expects: message plus the original error. */
export function reportError(message: string, error: unknown): void {
	context?.ui.notify({ message, error });
}

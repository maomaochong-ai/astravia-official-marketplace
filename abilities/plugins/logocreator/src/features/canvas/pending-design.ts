import { scopeKey } from "../../shared/lib/scope-key";

/**
 * The "show this one" hand-off between a tool call and a panel — per conversation.
 *
 * A tool cannot call a React setter, so it leaves one id behind and the panel claims
 * it. That slot must be keyed by conversation: with two conversations open, a single
 * global slot lets whichever panel mounts first steal the other one's design, which
 * is exactly the "cross-session" symptom (the canvas jumps to a mark you never asked
 * for, in the wrong tab).
 *
 * The claim is also one-shot: a panel that remounts later (tab switch, window
 * reload) must not keep dragging the form back to an old design.
 */

const pending = new Map<string, string>();
const listeners = new Set<() => void>();

/** Called by a tool with its own `session.cwd`, right before it opens the tab. */
export function setPendingDesignId(cwd: string | null | undefined, id: string): void {
	pending.set(scopeKey(cwd), id);
	for (const listener of listeners) listener();
}

/** One-shot read: `null` once someone in this conversation has claimed it. */
export function claimPendingDesignId(cwd: string | null | undefined): string | null {
	const key = scopeKey(cwd);
	const id = pending.get(key) ?? null;
	pending.delete(key);
	return id;
}

/** Read without consuming — for a panel that is already mounted and re-rendered. */
export function peekPendingDesignId(cwd: string | null | undefined): string | null {
	return pending.get(scopeKey(cwd)) ?? null;
}

/** Cheap change signal so a mounted panel reacts to a tool that just ran. */
export function onPendingDesignChanged(listener: () => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

/** Test seam: drop every scope without touching listeners. */
export function clearPendingDesigns(): void {
	pending.clear();
}

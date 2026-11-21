
/**
 * The "show this one" hand-off between a tool call and the panel.
 *
 * The reference plugin does this with `setPendingDesignPath` + `claimCanvasReveal`:
 * a tool cannot call a React setter, so it leaves one id behind and the panel
 * claims it when it mounts or when it is already mounted. Same shape here, with
 * one extra rule learned from that code — **the claim is one-shot**: a panel that
 * remounts later (tab switch, window reload) must not keep dragging the form back
 * to an old design and throwing away whatever the user has typed since.
 */

let pending: string | null = null;
let claimCount = 0;

/** Called by a tool right before it opens the tab. */
export function setPendingDesignId(id: string): void {
	pending = id;
	claimCount += 1;
	for (const listener of listeners) listener();
}

/** One-shot read: `null` once someone has claimed it. */
export function claimPendingDesignId(): string | null {
	const id = pending;
	pending = null;
	return id;
}

/** Read without consuming — for a panel that is already mounted and just re-rendered. */
export function peekPendingDesignId(): string | null {
	return pending;
}

/** Cheap change signal so a mounted panel can react to a tool that just ran. */
export function onPendingDesignChanged(listener: () => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

const listeners = new Set<() => void>();

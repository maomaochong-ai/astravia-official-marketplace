/**
 * Whether the user has put Strix on the current turn — and where they put it on.
 *
 * Two readers, two questions:
 *
 *  - the panel asks "does this host turn belong to me" (`isStrixEngaged`) — the host's
 *    event stream is not per-conversation, so the panel filters with `belongsTo`;
 *  - the plugin asks "may I bring my tab to the front" (`hasPanelBeenSeen`). Bringing a
 *    panel up is intrusive in a way that drawing a row is not, so it needs one extra
 *    fact: this conversation has had the panel open at least once. Otherwise a capsule
 *    left on in conversation A would yank the panel over in conversation B, where the
 *    user never asked for it (1.0.6 review finding).
 *
 * Module scope on purpose: the tab mounts and unmounts, and the chip outlives it.
 */
let engaged = false;
const seenPanels = new Set<string>();

export function setStrixEngaged(next: boolean): void {
	engaged = next;
}

export function isStrixEngaged(): boolean {
	return engaged;
}

/** Called by the panel on mount: this conversation has shown the workbench. */
export function markPanelSeen(conversationId: string | null | undefined): void {
	if (conversationId) seenPanels.add(conversationId);
}

/**
 * An unknown id cannot contradict us — on a fresh-session page there is no conversation
 * yet, and refusing to open the tab there would be the very bug this flag guards.
 */
export function hasPanelBeenSeen(conversationId: string | null | undefined): boolean {
	return !conversationId || seenPanels.has(conversationId);
}

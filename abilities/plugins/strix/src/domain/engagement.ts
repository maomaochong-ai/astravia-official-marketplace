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
/**
 * 面板最后一次挂载所在的会话（id + cwd）。
 *
 * 为什么要记 cwd：团队会话的事件比插件的订阅更早到达时，activate 那条订阅可能还没有
 * 拿到 `conversation-changed`；此时唯一可信的来源是面板自己上一次的挂载位置。
 * 没有它就只能"不传 cwd"，而宿主在拿不到工作区时会静默跳过开面板。
 */
let lastSeen: { id: string | null; cwd: string | null } | null = null;

export function setStrixEngaged(next: boolean): void {
	engaged = next;
}

export function isStrixEngaged(): boolean {
	return engaged;
}

/** Called by the panel on mount: this conversation has shown the workbench. */
export function markPanelSeen(conversationId: string | null | undefined, cwd?: string | null): void {
	if (conversationId) seenPanels.add(conversationId);
	if (conversationId) lastSeen = { id: conversationId, cwd: cwd ?? null };
}

/** 面板上次所在会话：给"cwd 未知但必须开面板"的场合兜底。 */
export function lastSeenConversation(): { id: string | null; cwd: string | null } | null {
	return lastSeen;
}

/**
 * An unknown id cannot contradict us — on a fresh-session page there is no conversation
 * yet, and refusing to open the tab there would be the very bug this flag guards.
 */
export function hasPanelBeenSeen(conversationId: string | null | undefined): boolean {
	return !conversationId || seenPanels.has(conversationId);
}

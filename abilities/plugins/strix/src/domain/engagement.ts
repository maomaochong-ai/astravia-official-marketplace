/**
 * Whether the user has put Strix on a conversation's turn — **per conversation**.
 *
 * 曾经是一个模块级布尔：在 A 里开了胶囊，之后**每一次**打开任何会话，turn-start 都把
 * Strix 面板拽到前面。用户看到的是「每次打开宿主会话，strix 自动打开了」——胶囊是
 * 那个会话的决定，不是这台机器的偏好。
 *
 * 两个读者：
 *
 *  - index.tsx 在 turn-start 问「这一轮交给了 Strix 吗」（`isStrixEngaged(id)`）；
 *  - 面板问「这个会话的面板开过吗」（`hasPanelBeenSeen`）。
 *
 * 一个新会话页还没有 id：那次切换记成 pending，等 `conversation-changed` 拿到 id 时再
 * 归到它名下（`claimPendingEngagement`）。否则「在新会话页先开胶囊、再发第一句」会失效。
 */

const engagedIn = new Set<string>();
let pending: boolean | null = null;

export function setStrixEngaged(next: boolean, conversationId?: string | null): void {
	if (conversationId) {
		if (next) engagedIn.add(conversationId);
		else engagedIn.delete(conversationId);
		pending = null;
		return;
	}
	// 还不知道会话 id：先记着，等会话出现再归过去。
	pending = next;
}

/** 新会话浮出时把「在新会话页打开的胶囊」接过去。 */
export function claimPendingEngagement(conversationId: string | null | undefined): void {
	if (!conversationId || pending === null) return;
	if (pending) engagedIn.add(conversationId);
	else engagedIn.delete(conversationId);
	pending = null;
}

export function isStrixEngaged(conversationId?: string | null): boolean {
	if (conversationId) return engagedIn.has(conversationId);
	return pending === true;
}

/**
 * 插件重新激活时清空。
 *
 * 宿主在 reload 后把胶囊恢复成「未开」（`defaultActive` 为 false），而我们的集合还在：
 * 两边不一致的结果就是「用户没开胶囊，面板却自己跳出来」。清空即对齐。
 */
export function clearEngagement(): void {
	engagedIn.clear();
	pending = null;
}

/**
 * 面板最后一次挂载所在的会话（id + cwd）。
 *
 * 为什么要记 cwd：团队会话的事件比插件的订阅更早到达时，activate 那条订阅可能还没有
 * 拿到 `conversation-changed`；此时唯一可信的来源是面板自己上一次的挂载位置。
 * 没有它就只能"不传 cwd"，而宿主在拿不到工作区时会静默跳过开面板。
 */
let lastSeen: { id: string | null; cwd: string | null } | null = null;

const seenPanels = new Set<string>();

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

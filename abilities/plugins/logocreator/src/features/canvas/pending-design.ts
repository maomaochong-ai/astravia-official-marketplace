import { scopeKey } from "../../shared/lib/scope-key";

/**
 * The "show this" hand-off between a tool call and a panel — per conversation.
 *
 * A tool cannot call a React setter, so it leaves the ids behind and the panel claims
 * them. That slot must be keyed by conversation: with two conversations open, a single
 * global slot lets whichever panel mounts first steal the other one's design, which
 * is exactly the "cross-session" symptom (the canvas jumps to a mark you never asked
 * for, in the wrong tab).
 *
 * The claim is also one-shot: a panel that remounts later (tab switch, window
 * reload) must not keep dragging the form back to an old design.
 *
 * 一次工具调用可以产出多张（`count: 3`），画布需要把它们**都**渲染出来，而不是只留最后一张：
 * 之前只记一个 id，于是「对话里出了三张，画布上只有一张」，另外两张只能去历史面板里找。
 * 所以这里存的是有序 id 列表：第一项是主图，其余是同一批的其它张。
 */

const pending = new Map<string, string[]>();
const listeners = new Set<() => void>();

function write(cwd: string | null | undefined, ids: readonly string[]): void {
	const clean = ids.filter((id) => typeof id === "string" && id.length > 0);
	const key = scopeKey(cwd);
	if (clean.length === 0) pending.delete(key);
	else pending.set(key, [...clean]);
	for (const listener of listeners) listener();
}

/** Called by a tool with its own `session.cwd`, right before it opens the tab. */
export function setPendingDesignIds(cwd: string | null | undefined, ids: readonly string[]): void {
	write(cwd, ids);
}

/** 单张的旧入口：等价于只有一张的批次。 */
export function setPendingDesignId(cwd: string | null | undefined, id: string): void {
	write(cwd, [id]);
}

/** One-shot read: `[]` once someone in this conversation has claimed it. */
export function claimPendingDesignIds(cwd: string | null | undefined): string[] {
	const key = scopeKey(cwd);
	const ids = pending.get(key) ?? [];
	pending.delete(key);
	return ids;
}

/** 单张的旧入口：取批次第一项。 */
export function claimPendingDesignId(cwd: string | null | undefined): string | null {
	return claimPendingDesignIds(cwd)[0] ?? null;
}

/** Read without consuming — for a panel that is already mounted and re-rendered. */
export function peekPendingDesignIds(cwd: string | null | undefined): string[] {
	return pending.get(scopeKey(cwd)) ?? [];
}

export function peekPendingDesignId(cwd: string | null | undefined): string | null {
	return peekPendingDesignIds(cwd)[0] ?? null;
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

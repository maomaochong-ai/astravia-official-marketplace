/**
 * The trace list as a fold: one row in, one (possibly merged) list out.
 *
 * 为什么要有这一层：真机截图里 `preparing image` / `starting container` 各出现二十多次
 * （容器起不来时服务反复重试，每次两条 note），把面板刷成一堵重复的墙，真正的证据被挤出
 * 视野。合并规则必须是**纯函数**才能被可靠地钉住——写在 setState 回调里就只能靠 DOM 猜。
 *
 * 规则：
 *  - 相邻且**完全同文**的 `note` 合并成一条，`count` 递增；
 *  - 工具行合并会丢信息（两次调用是两件事），对话分隔行同理，它们都不参与；
 *  - 超过上限从头部丢弃。
 */

import type { TraceEntry } from "../runtime-contract";

export const TRACE_LIMIT = 400;

/** A row before it gets an id and a timestamp. */
export type TraceDraft = Omit<TraceEntry, "id" | "at">;

export interface FoldResult {
	entries: TraceEntry[];
	/** True when the row was merged into the previous one rather than appended. */
	merged: boolean;
}

export function foldTrace(
	previous: readonly TraceEntry[],
	draft: TraceDraft,
	next: { id: string; at: number },
	limit = TRACE_LIMIT,
): FoldResult {
	const last = previous[previous.length - 1];
	if (draft.kind === "note" && last?.kind === "note" && last.label === draft.label) {
		const entries = previous.slice();
		entries[entries.length - 1] = { ...last, count: (last.count ?? 1) + 1 };
		return { entries, merged: true };
	}
	const entries = [...previous, { ...draft, id: next.id, at: next.at }].slice(-limit);
	return { entries, merged: false };
}

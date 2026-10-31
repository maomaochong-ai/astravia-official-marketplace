import type { FeedEvent } from "../../application/live-feed/feed-types.js";
import type { ElapsedLabel } from "./workbench-model";

/** 最后一步落盘距今多久以内，才算「侧栏里还在写」。 */
export const WRITING_WINDOW_MS = 3 * 60_000;

/** ISO 时刻 → 11:05:52。运行台与书架的时刻列都只显示到秒。 */
export function clockOf(iso: string): string {
	const at = new Date(iso);
	if (Number.isNaN(at.getTime())) return "--:--:--";
	const pad = (value: number) => String(value).padStart(2, "0");
	return `${pad(at.getHours())}:${pad(at.getMinutes())}:${pad(at.getSeconds())}`;
}

/** 流水是追加的，界面要最新的在上面。 */
export function newestFirst(events: readonly FeedEvent[], limit?: number): FeedEvent[] {
	const ordered = [...events].reverse();
	return limit === undefined ? ordered : ordered.slice(0, limit);
}

/** 最近一次**真的做完了一步**的插件工具事件。运行中的那一步不算「刚落盘」。 */
export function lastLandedStudioEvent(events: readonly FeedEvent[]): FeedEvent | null {
	for (let index = events.length - 1; index >= 0; index -= 1) {
		const event = events[index];
		if (event && event.origin === "studio" && event.status === "done") return event;
	}
	return null;
}

/** 最近一次任何来源的事件（含团队派活）：开页时用来判断团队是不是刚动过。 */
export function lastEvent(events: readonly FeedEvent[]): FeedEvent | null {
	return events.length > 0 ? (events[events.length - 1] ?? null) : null;
}

export function isWriting(events: readonly FeedEvent[], nowMs: number): boolean {
	const landed = lastLandedStudioEvent(events);
	if (!landed) return false;
	const at = Date.parse(landed.at);
	return Number.isFinite(at) && nowMs - at <= WRITING_WINDOW_MS;
}

/** 相对时间的可读形态；键在 `time.*` 里，调用方给翻译函数。 */
export function elapsedText(
	elapsed: ElapsedLabel | null,
	t: (key: string, params?: Record<string, string | number>) => string,
): string {
	if (!elapsed) return "";
	return t(elapsed.key, { count: elapsed.count });
}

/** 最近一次事件用的模型；没有事件时返回 null，界面上就不出现这个 chip。 */
export function modelOf(events: readonly FeedEvent[]): string | null {
	const hit = lastEvent(events);
	return hit?.model ?? null;
}

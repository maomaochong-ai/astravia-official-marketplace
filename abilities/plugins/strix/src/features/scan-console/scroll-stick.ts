/**
 * Keeping the newest line in view.
 *
 * A run log grows downward, and a scroll container does not follow it: the scroll offset is
 * measured from the top, so appending rows leaves the viewport showing older rows and the
 * content appears to crawl *up* out of sight. That is the reported bug — the operator has to
 * chase the bottom of the panel while a scan is producing output.
 *
 * The rule is the one chat apps settled on:
 *
 *  - if the viewport is already at (or near) the bottom, stay pinned to the bottom as rows
 *    arrive — do not fight the reader;
 *  - if the reader scrolled up deliberately, **do not** yank them back; show how many rows
 *    arrived and let them choose.
 *
 * 谁在决定「要不要跟随」：**只有真实的输入手势能取消跟随**。曾经从滚动几何反推
 * （`isNearBottom`），那是错的：内容长高时浏览器会发 scroll 事件，而那一刻 scrollTop 还没变、
 * scrollHeight 已经变大，几何上就是「不在底部」——跟随被自己关掉，之后永远停在顶部。
 * 所以意图只从手势来（wheel / touchmove / 方向键），几何只用来回答“现在到底部了吗”。
 *
 * "Near" is not exact equality: sub-pixel scrolling, a resized pane and the browser's own
 * rounding all make `scrollHeight - scrollTop - clientHeight` a small non-zero number even
 * when the operator considers themselves at the bottom.
 */

/** 谁在决定“要不要跟随”：只有手势能取消。 */
export type FollowIntent = "wheel-up" | "wheel-down" | "touch" | "key-up" | "key-down" | "jump-to-end";

export function nextFollow(current: boolean, intent: FollowIntent, atBottom: boolean): boolean {
	switch (intent) {
		case "wheel-up":
		case "touch":
		case "key-up":
			return false;
		case "jump-to-end":
			return true;
		case "key-down":
			return atBottom;
		case "wheel-down":
			// 往下滚到过低才恢复跟随；滚了但没到底不算意图。
			return atBottom ? true : current;
	}
}

/** Slack before we decide the reader has left the bottom on purpose. */
export const STICK_SLACK_PX = 24;

export interface ScrollMetrics {
	readonly scrollTop: number;
	readonly scrollHeight: number;
	readonly clientHeight: number;
}

/** True when the viewport is close enough to the end that new rows should follow. */
export function isNearBottom(metrics: ScrollMetrics, slack = STICK_SLACK_PX): boolean {
	const distance = metrics.scrollHeight - metrics.scrollTop - metrics.clientHeight;
	return distance <= slack;
}

/**
 * Where the scroll offset should land after content grew.
 *
 * Pure so the rule can be asserted without a DOM: `follow` is the decision taken when the
 * last row arrived, and it is what keeps a pinned transcript pinned.
 */
export function nextScrollTop(input: {
	before: ScrollMetrics;
	after: ScrollMetrics;
	follow: boolean;
}): number {
	if (!input.follow) return input.before.scrollTop;
	return Math.max(0, input.after.scrollHeight - input.after.clientHeight);
}

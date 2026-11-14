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
 * "Near" is not exact equality: sub-pixel scrolling, a resized pane and the browser's own
 * rounding all make `scrollHeight - scrollTop - clientHeight` a small non-zero number even
 * when the operator considers themselves at the bottom.
 */

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

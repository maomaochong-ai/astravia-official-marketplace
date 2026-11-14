/**
 * The hook that keeps the run log pinned to its newest row.
 *
 * `scroll-stick.ts` decides; this only touches the element. Two details matter in practice:
 *
 *  - the decision is taken *before* the DOM grew (`follow`), because afterwards every
 *    container looks "not at the bottom" — the content just got taller;
 *  - a reader who scrolled up is never yanked back; the caller renders a "N new rows" pill
 *    from `pending` instead.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { isNearBottom, nextScrollTop, type ScrollMetrics } from "../scroll-stick";

export interface StickToBottom {
	/** Attach to the scrolling element. */
	ref: React.RefObject<HTMLDivElement | null>;
	/** Attach to the element whose size growth means "new content". */
	onScroll: () => void;
	/** Rows that arrived while the reader was scrolled up. */
	pending: number;
	/** Jump to the bottom and resume following. */
	jumpToBottom: () => void;
}

function metricsOf(element: HTMLElement): ScrollMetrics {
	return {
		scrollTop: element.scrollTop,
		scrollHeight: element.scrollHeight,
		clientHeight: element.clientHeight,
	};
}

/**
 * @param key changes whenever a row is added (or a row closed); the hook only scrolls then.
 */
export function useStickToBottom(key: unknown, rowCount: number): StickToBottom {
	const ref = useRef<HTMLDivElement | null>(null);
	// Follow by default: a fresh panel opens at the newest row, which is where a live run is.
	const follow = useRef(true);
	const seenRows = useRef(rowCount);
	const [pending, setPending] = useState(0);

	const onScroll = useCallback(() => {
		const element = ref.current;
		if (!element) return;
		follow.current = isNearBottom(metricsOf(element));
		if (follow.current) setPending(0);
	}, []);

	const jumpToBottom = useCallback(() => {
		const element = ref.current;
		if (!element) return;
		follow.current = true;
		setPending(0);
		element.scrollTop = element.scrollHeight;
	}, []);

	useEffect(() => {
		const element = ref.current;
		if (!element) return;
		const before = metricsOf(element);

		// Content is measured after layout so `scrollHeight` includes the row that just landed.
		const frame = requestAnimationFrame(() => {
			const after = metricsOf(element);
			const target = nextScrollTop({ before, after, follow: follow.current });
			if (follow.current) {
				element.scrollTop = target;
				return;
			}
			const grew = rowCount - seenRows.current;
			if (grew > 0) setPending((current) => current + grew);
		});
		seenRows.current = rowCount;
		return () => cancelAnimationFrame(frame);
	}, [key, rowCount]);

	// A panel that becomes taller (window resize, rail collapse) should still show the end.
	useEffect(() => {
		const element = ref.current;
		if (!element || typeof ResizeObserver === "undefined") return;
		const observer = new ResizeObserver(() => {
			if (!follow.current) return;
			element.scrollTop = element.scrollHeight;
		});
		observer.observe(element);
		return () => observer.disconnect();
	}, []);

	return { ref, onScroll, pending, jumpToBottom };
}

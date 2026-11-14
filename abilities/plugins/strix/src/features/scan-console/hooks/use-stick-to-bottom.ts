/**
 * The hook that keeps the run log pinned to its newest row.
 *
 * `scroll-stick.ts` decides; this only reads gestures and moves the element.
 *
 * 这一版修的是一个必现 bug：跟随状态曾从滚动几何反推，而内容长高时浏览器会发 scroll 事件，
 * 那一刻 scrollTop 还没动、scrollHeight 已经变大 → 几何上是「不在底部」→ 跟随被自己关掉，
 * 之后永远停在顶部（用户看到的一直是内容开头）。
 *
 * 现在的分工：
 *  - **谁取消跟随**：只有手势（wheel 向上、触摸、PageUp/↑/Home）。没有手势就永远跟随。
 *  - **几何只回答**“现在到底部了吗”，用来决定往下滚时要不要恢复跟随、以及清除待读计数。
 *  - `adjusting` 屏蔽我们自己设置 scrollTop 引起的那次 scroll 事件。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { isNearBottom, nextFollow, nextScrollTop, type FollowIntent, type ScrollMetrics } from "../scroll-stick";

export interface StickToBottom {
	/** Attach to the scrolling element. */
	ref: React.RefObject<HTMLDivElement | null>;
	/** Attach to the same element; used only to clear the pending count. */
	onScroll: () => void;
	/** Gesture handlers: these are what cancel following. */
	wheelProps: { onWheel: (event: React.WheelEvent<HTMLElement>) => void };
	touchProps: { onTouchStart: () => void; onTouchMove: () => void };
	keyProps: { onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void };
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
	/** True while we are the ones moving scrollTop. */
	const adjusting = useRef(false);
	const [pending, setPending] = useState(0);

	const applyIntent = useCallback((intent: FollowIntent) => {
		const element = ref.current;
		if (!element) return;
		const atBottom = isNearBottom(metricsOf(element));
		follow.current = nextFollow(follow.current, intent, atBottom);
		if (follow.current) {
			setPending(0);
			adjusting.current = true;
			element.scrollTop = Math.max(0, element.scrollHeight - element.clientHeight);
			// 下一帧再撤旗：scroll 事件总在布局之后到。
			requestAnimationFrame(() => {
				adjusting.current = false;
			});
		}
	}, []);

	const onWheel = useCallback(
		(event: React.WheelEvent<HTMLElement>) => {
			applyIntent(event.deltaY < 0 ? "wheel-up" : "wheel-down");
		},
		[applyIntent],
	);

	const onTouchStart = useCallback(() => applyIntent("touch"), [applyIntent]);
	const onTouchMove = useCallback(() => applyIntent("touch"), [applyIntent]);

	const onKeyDown = useCallback(
		(event: React.KeyboardEvent<HTMLElement>) => {
			if (event.key === "PageUp" || event.key === "ArrowUp" || event.key === "Home") applyIntent("key-up");
			else if (event.key === "PageDown" || event.key === "ArrowDown") applyIntent("key-down");
			else if (event.key === "End") applyIntent("jump-to-end");
		},
		[applyIntent],
	);

	/** 只用来清计数：滚到底了就没有“未读”了。绝不在这里改 follow。 */
	const onScroll = useCallback(() => {
		const element = ref.current;
		if (!element || adjusting.current) return;
		if (follow.current && isNearBottom(metricsOf(element)) && pending !== 0) setPending(0);
	}, [pending]);

	const jumpToBottom = useCallback(() => applyIntent("jump-to-end"), [applyIntent]);

	useEffect(() => {
		const element = ref.current;
		if (!element) return;
		const before = metricsOf(element);

		// Content is measured after layout so `scrollHeight` includes the row that just landed.
		// 必须先取旧值：seenRows 在同一个 effect 体里就会被改成新值，
		// 再在 rAF 里读它就是“新 - 新 = 0”——待读计数永远不会涨（这是一个真实的 bug）。
		const previousRows = seenRows.current;
		seenRows.current = rowCount;

		const frame = requestAnimationFrame(() => {
			const after = metricsOf(element);
			if (follow.current) {
				adjusting.current = true;
				element.scrollTop = nextScrollTop({ before, after, follow: true });
				requestAnimationFrame(() => {
					adjusting.current = false;
				});
				return;
			}
			const grew = rowCount - previousRows;
			if (grew > 0) setPending((current) => current + grew);
		});
		return () => cancelAnimationFrame(frame);
	}, [key, rowCount]);

	// A panel that becomes taller (window resize, rail collapse) should still show the end.
	useEffect(() => {
		const element = ref.current;
		if (!element || typeof ResizeObserver === "undefined") return;
		const observer = new ResizeObserver(() => {
			if (!follow.current) return;
			adjusting.current = true;
			element.scrollTop = Math.max(0, element.scrollHeight - element.clientHeight);
			requestAnimationFrame(() => {
				adjusting.current = false;
			});
		});
		observer.observe(element);
		return () => observer.disconnect();
	}, []);

	return {
		ref,
		onScroll,
		wheelProps: { onWheel },
		touchProps: { onTouchStart, onTouchMove },
		keyProps: { onKeyDown },
		pending,
		jumpToBottom,
	};
}

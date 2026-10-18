/**
 * use-element-width.ts — 观测元素实测宽度（px）。
 *
 * 布局策略（三栏 / 单栏 compact）不能靠媒体查询决定：宿主活动面板宽度由用户拖动决定，
 * 同一视口下可能是 260px 也可能是 1200px，只有容器自身宽度能作为判据。
 *
 * 首帧返回 0（还没量到）。调用方要把 0 当作「未知」而不是「很窄」，
 * 否则首屏会闪一下 compact 布局。
 */

import { useEffect, useState, type RefObject } from "react";

export function useElementWidth(ref: RefObject<HTMLElement | null>): number {
	const [width, setWidth] = useState(0);

	useEffect(() => {
		const el = ref.current;
		if (!el || typeof ResizeObserver === "undefined") return;
		const update = () => setWidth(el.getBoundingClientRect().width);
		update();
		const observer = new ResizeObserver(update);
		observer.observe(el);
		return () => observer.disconnect();
	}, [ref]);

	return width;
}

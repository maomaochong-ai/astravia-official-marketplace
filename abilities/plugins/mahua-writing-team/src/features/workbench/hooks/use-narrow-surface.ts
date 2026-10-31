import { useEffect, useState } from "react";

/** 低于这个宽度，竖栏就只剩图标列。与设计稿的 208px 竖栏 + 至少 200px 正文对得上。 */
export const NARROW_SURFACE_MAX = 640;

/**
 * 工作台**自己**拿到的宽度，而不是窗口宽度。
 *
 * 同一张工作台挂在两个宿主位置上：活动面板里的一张标签页（窄，跟着对话），以及一个工作区
 * 视图（宽，占满主内容区）。同一个窗口宽度下这两处的可用宽度差着一整条侧栏，用 `innerWidth`
 * 判断必然有一边是错的，所以只能在根节点上量。
 *
 * 交给 React 的是「是否窄」这一个布尔值，不是像素：拖拽时宽度每一帧都在变，布尔值只在跨过
 * 阈值时变一次，不会让整棵树跟着每一帧重画。宽度为 0（尚未布局、宿主里被隐藏）时不写状态，
 * 免得在首次挂载时闪一次图标列。
 */
export function useNarrowSurface(threshold = NARROW_SURFACE_MAX) {
	const [element, setElement] = useState<HTMLDivElement | null>(null);
	const [narrow, setNarrow] = useState(false);

	useEffect(() => {
		if (!element) return;
		const apply = (width: number) => {
			if (width > 0) setNarrow(width < threshold);
		};
		apply(element.getBoundingClientRect().width);
		const observer = new ResizeObserver((entries) => {
			const entry = entries[0];
			if (entry) apply(entry.contentRect.width);
		});
		observer.observe(element);
		return () => observer.disconnect();
	}, [element, threshold]);

	return { ref: setElement, narrow };
}

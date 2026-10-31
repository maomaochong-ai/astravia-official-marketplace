import { useEffect, useState } from "react";

/** 低于这个宽度，竖栏就只剩图标列。与设计稿的 208px 竖栏 + 至少 200px 正文对得上。 */
export const NARROW_SURFACE_MAX = 640;

/**
 * 工作台**自己**拿到的宽度，而不是窗口宽度。
 *
 * 宿主把同一张工作台放在活动面板里，面板宽度由分隔条决定，与窗口宽度无关；同一个窗口宽度下，
 * 面板可以是 260，也可以是窗口减掉 384。用 `innerWidth` 判断必然错，所以只能在根节点上量。
 *
 * 交给 React 的是「是否窄」这一个布尔值，不是像素：拖拽时宽度每一帧都在变，布尔值只在跨过
 * 阈值时变一次，不会让整棵树跟着每一帧重画。像素宽度只在需要它的地方读一次（展开前记下
 * 当前宽度，收回时还原），所以它走 ref 而不是每次都触发渲染。宽度为 0（尚未布局、宿主里被
 * 隐藏）时不写状态，免得在首次挂载时闪一次图标列。
 */
export function useNarrowSurface(threshold = NARROW_SURFACE_MAX) {
	const [element, setElement] = useState<HTMLDivElement | null>(null);
	const [narrow, setNarrow] = useState(false);
	const [width, setWidth] = useState(0);

	useEffect(() => {
		if (!element) return;
		const apply = (next: number) => {
			if (next <= 0) return;
			setNarrow(next < threshold);
			setWidth(next);
		};
		apply(element.getBoundingClientRect().width);
		const observer = new ResizeObserver((entries) => {
			const entry = entries[0];
			if (entry) apply(entry.contentRect.width);
		});
		observer.observe(element);
		return () => observer.disconnect();
	}, [element, threshold]);

	return { ref: setElement, narrow, width };
}

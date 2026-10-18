/**
 * tab 面板的「全屏 / 还原」。
 *
 * 宿主没有 tab 级 fullscreen API（只有 `ui.setActivityPanelWidth`），所以这里的全屏
 * 实际是**把活动面板宽度拉满**（`"max"` = 跟随窗口宽度），标签条的关闭按钮和拖拽把手
 * 仍在原位。还原时不能用默认宽度去猜：用户在拉满前可能已经拖过一个特定宽度，
 * 所以用 ResizeObserver 记住进入全屏前的真实内容宽度，退出时按这个像素还原。
 *
 * 内容宽度 = 面板宽度 − 2px（ActivityPanelFrame 左右各 1px 边框），这 2px 误差必然存在，
 * 面板不会谎称「回到完全一样的位置」。
 *
 * `setActivityPanelWidth` 改的是全局持久的面板宽度，会影响所有 tab，所以卸载时必须还原，
 * 不能把别人的面板留在拉满状态。
 */

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

export interface PanelFullscreen {
	readonly fullscreen: boolean;
	/** 宿主版本没有 `ui.setActivityPanelWidth` 时为 false，按钮据此隐藏。 */
	readonly available: boolean;
	toggle(): void;
}

export function usePanelFullscreen(
	root: RefObject<HTMLElement | null>,
	setWidth: ((width: number | "max") => void) | null,
): PanelFullscreen {
	const [fullscreen, setFullscreen] = useState(false);
	const fullscreenRef = useRef(false);
	const restoreWidth = useRef<number | null>(null);

	useEffect(() => {
		fullscreenRef.current = fullscreen;
	}, [fullscreen]);

	useEffect(() => {
		const element = root.current;
		if (element === null || typeof ResizeObserver === "undefined") return;
		const observer = new ResizeObserver((entries) => {
			// 全屏期间的宽度是「跟随窗口」的结果，不能覆盖进入前的宽度。
			if (fullscreenRef.current) return;
			const width = entries[0]?.contentRect.width ?? 0;
			if (width > 0) restoreWidth.current = width;
		});
		observer.observe(element);
		return () => observer.disconnect();
	}, [root]);

	useEffect(
		() => () => {
			// 卸载时把全局面板宽度还回去，否则别的 tab 会继承拉满的状态。
			if (!fullscreenRef.current || setWidth === null) return;
			const width = restoreWidth.current;
			if (width !== null) setWidth(Math.round(width));
		},
		[setWidth],
	);

	const toggle = useCallback(() => {
		if (setWidth === null) return;
		if (!fullscreenRef.current) {
			setWidth("max");
			setFullscreen(true);
			return;
		}
		const width = restoreWidth.current;
		setWidth(width === null ? "max" : Math.round(width));
		setFullscreen(false);
	}, [setWidth]);

	return { fullscreen, available: setWidth !== null, toggle };
}

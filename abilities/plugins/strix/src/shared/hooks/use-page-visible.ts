/**
 * 页面是否在前台。
 *
 * 为什么需要：面板的背景有三层动画（雨、极光、扫光、环）。宿主把标签页切走之后，
 * 这些动画仍然在跑——Chromium 会降频但不会停，而"用久了宿主很卡"正是这么攒出来的。
 * 切到后台就停下来，回来再继续；这是最便宜的一档性能优化。
 */
import { useEffect, useState } from "react";

export function usePageVisible(): boolean {
	const [visible, setVisible] = useState(() => {
		if (typeof document === "undefined") return true;
		return document.visibilityState !== "hidden";
	});

	useEffect(() => {
		if (typeof document === "undefined") return;
		const onChange = (): void => setVisible(document.visibilityState !== "hidden");
		document.addEventListener("visibilitychange", onChange);
		return () => document.removeEventListener("visibilitychange", onChange);
	}, []);

	return visible;
}

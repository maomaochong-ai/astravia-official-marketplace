/**
 * 检测插件根当前处于浅色还是深色主题。
 *
 * 宿主可能强制主题（与系统外观无关），所以不看 prefers-color-scheme，
 * 直接读插件根背景色亮度判定；CodeMirror 配色、执行按钮等无主题变量可用的
 * 第三方区域据此切换。
 */

import { useEffect, useState } from "react";

export type DetectedTheme = "light" | "dark";

function readRootBackgroundLuminance(): number | null {
	const root = document.querySelector('[data-astravia-plugin-root="dbx-pro"]');
	if (!root) return null;
	const bg = getComputedStyle(root).backgroundColor;
	const m = bg.match(/\d+(?:\.\d+)?/g);
	if (!m || m.length < 3) return null;
	const [r, g, b] = m.slice(0, 3).map(Number);
	return 0.299 * r + 0.587 * g + 0.114 * b;
}

function detectTheme(): DetectedTheme {
	const lum = readRootBackgroundLuminance();
	// 判空：拿不到背景（透明）时默认深色（插件长期以深色为主）。
	return lum === null || lum < 128 ? "dark" : "light";
}

/** 当前检测到的主题。挂载后读一次，并用轻量轮询兜底宿主运行期切主题。 */
export function useDetectedTheme(): DetectedTheme {
	const [theme, setTheme] = useState<DetectedTheme>(() =>
		typeof document === "undefined" ? "dark" : detectTheme(),
	);

	useEffect(() => {
		setTheme(detectTheme());
		const timer = setInterval(() => setTheme((prev) => {
			const next = detectTheme();
			return next === prev ? prev : next;
		}), 1500);
		return () => clearInterval(timer);
	}, []);

	return theme;
}

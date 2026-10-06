/**
 * 检测插件根当前处于浅色还是深色主题。
 *
 * 宿主可能强制主题（与系统外观无关），所以不看 prefers-color-scheme：
 * 1. 优先解析宿主 / 插件的 --background 设计令牌（宿主永远会定义）；
 * 2. 令牌透明时，沿 DOM 祖先找第一个不透明背景色；
 * 3. 都拿不到再回退深色（插件长期以深色为主）。
 * CodeMirror 配色、执行按钮等没有主题变量可用的区域据此切换。
 */

import { useEffect, useState } from "react";

export type DetectedTheme = "light" | "dark";

/**
 * 从任意 CSS 颜色串解析 rgb 分量。
 * 直接匹配 rgb()/rgba()/#hex；oklch()/hsl()/具名色等交给浏览器
 * （临时元素赋值后读计算样式，浏览器会归一化成 rgb）。
 * 返回裸通道串（如 "240 5% 96%"）时视为无效，交给上层 DOM 遍历兜底。
 */
function parseColorChannels(value: string): [number, number, number] | null {
	const v = value.trim().toLowerCase();
	if (!v || v === "transparent") return null;
	const m = v.match(/rgba?\(([^)]+)\)/);
	if (m) {
		const parts = m[1].split(/[ ,/]+/).map((s) => s.trim()).filter(Boolean);
		const r = Number(parts[0]);
		const g = Number(parts[1]);
		const b = Number(parts[2]);
		if ([r, g, b].every((n) => Number.isFinite(n))) return [r, g, b];
	}
	if (v.startsWith("#")) {
		let hex = v.slice(1);
		if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
		if (hex.length >= 6) {
			return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
		}
	}
	// oklch / hsl / 具名色等：浏览器能吃掉的合法颜色都会被计算样式归一化为 rgb。
	try {
		const probe = document.createElement("div");
		probe.style.display = "none";
		probe.style.color = "";
		probe.style.color = v;
		document.body.appendChild(probe);
		const resolved = getComputedStyle(probe).color;
		probe.remove();
		const rm = resolved.match(/rgba?\(([^)]+)\)/);
		if (rm) {
			const parts = rm[1].split(/[ ,/]+/).map((s) => s.trim()).filter(Boolean);
			const r = Number(parts[0]);
			const g = Number(parts[1]);
			const b = Number(parts[2]);
			if ([r, g, b].every((n) => Number.isFinite(n))) return [r, g, b];
		}
	} catch {
		// 无 DOM 环境（单测）或赋值失败：忽略
	}
	return null;
}

/** 颜色是否近似不透明（rgb 字符串的 alpha 通道）。 */
function isOpaqueColor(value: string): boolean {
	const m = value.trim().match(/rgba?\(([^)]+)\)/);
	if (!m) return true; // hex / 具名色视为不透明
	const parts = m[1].split(/[ ,/]+/).map((s) => s.trim()).filter(Boolean);
	const alpha = parts.length === 4 ? Number(parts[3]) : 1;
	return !Number.isFinite(alpha) || alpha >= 0.999;
}

function luminanceOf([r, g, b]: [number, number, number]): number {
	return 0.299 * r + 0.587 * g + 0.114 * b;
}

function detectTheme(): DetectedTheme {
	if (typeof document === "undefined") return "dark";
	const root = document.querySelector('[data-astravia-plugin-root="dbx-pro"]') as HTMLElement | null;
	if (!root) return "dark";

	// 1) 宿主设计令牌 --background（color-mix 解析不到时降级）
	const styles = getComputedStyle(root);
	const token = styles.getPropertyValue("--background").trim();
	if (token) {
		const channels = parseColorChannels(token);
		if (channels && isOpaqueColor(token)) {
			return luminanceOf(channels) >= 128 ? "light" : "dark";
		}
	}

	// 2) 根自身背景
	let el: HTMLElement | null = root;
	while (el) {
		const bg = getComputedStyle(el).backgroundColor;
		if (bg && bg !== "transparent" && isOpaqueColor(bg)) {
			const channels = parseColorChannels(bg);
			if (channels) return luminanceOf(channels) >= 128 ? "light" : "dark";
		}
		el = el.parentElement;
	}

	return "dark";
}

/** 当前检测到的主题。挂载后读一次，轻量轮询兜底宿主运行期切主题。 */
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

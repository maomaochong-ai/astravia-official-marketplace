/**
 * chart-runtime-browser — UI 内渲染用的 ECharts 运行时。
 *
 * 渲染引擎已从 Chart.js 切换为 ECharts（ADR-0010b）。
 * ECharts 通过 CDN script 注入（chart-shell.ts ECHARTS_CDN），
 * 此处提供浏览器端的 ECharts.init + setOption 包装。
 *
 * 与导出产物（dbx-chart-collection → chart-shell.ts → ECHARTS_CDN）共用同一个 CDN，
 * 保证 UI 内渲染与导出 HTML 视觉一致（ADR-0009 §10 验收 ⑤）。
 */

import type { ECharts } from "echarts";

export interface EChartsInstance {
	dispose(): void;
	resize(): void;
	setOption(option: Record<string, unknown>): void;
}

interface EChartsGlobals {
	echarts?: {
		init(dom: HTMLElement, theme?: string | object): ECharts;
		registerTheme(name: string, theme: object): void;
	};
}

let echartsLoaded = false;
let dbxThemeRegistered = false;

/** 运行时脚本挂在 `window` 上；测试环境里 globalThis !== window，两个都要查。 */
function host(): EChartsGlobals {
	const scope = globalThis as unknown as { window?: unknown };
	return (typeof scope.window === "object" && scope.window !== null ? scope.window : globalThis) as EChartsGlobals;
}

/** 加载 ECharts CDN script（首次调用时注入 script 标签）。 */
function ensureEChartsLoaded(): Promise<void> {
	if (echartsLoaded) return Promise.resolve();
	return new Promise((resolve, reject) => {
		const existing = host().echarts;
		if (existing) { echartsLoaded = true; resolve(); return; }

		const script = document.createElement("script");
		script.src = "https://cdn.jsdelivr.net/npm/echarts@5.6.0/dist/echarts.min.js";
		script.onload = () => { echartsLoaded = true; resolve(); };
		script.onerror = () => reject(new Error("ECharts CDN 加载失败"));
		document.head.appendChild(script);
	});
}

/** 注册 dbx 自定义 theme（与 chart-defaults.ts 的 iframe 注入脚本一致）。 */
function registerDbxThemes(): void {
	const e = host().echarts;
	if (!e) return;
	if (dbxThemeRegistered) return;

	e.registerTheme("dbx-dark", {
		backgroundColor: "transparent",
		textStyle: { color: "#d4e8ff" },
		title: { textStyle: { color: "#f0c040", fontSize: 16 }, subtextStyle: { color: "#00d4ff", fontSize: 13 } },
		legend: { textStyle: { color: "#8ab8d0" } },
		tooltip: { backgroundColor: "rgba(11,30,58,0.85)", borderColor: "#1a3a5a", textStyle: { color: "#e0f0ff" } },
		categoryAxis: { axisLine: { lineStyle: { color: "#1a3a5a" } }, axisLabel: { color: "#8ab8d0" }, splitLine: { lineStyle: { color: "rgba(26,58,90,0.33)" } } },
		valueAxis: { axisLine: { lineStyle: { color: "#1a3a5a" } }, axisLabel: { color: "#8ab8d0" }, splitLine: { lineStyle: { color: "rgba(26,58,90,0.33)" } } },
		color: ["#00d4ff", "#f0c040", "#ff6b6b", "#7ee8a2", "#ffa726", "#8ab8d0", "#00ffc8", "#d4a6ff"],
	});

	e.registerTheme("dbx-light", {
		backgroundColor: "transparent",
		textStyle: { color: "#374151" },
		title: { textStyle: { color: "#1f2937", fontSize: 16 } },
		legend: { textStyle: { color: "#4b5563" } },
		tooltip: { backgroundColor: "rgba(255,255,255,0.95)", borderColor: "#e5e7eb", textStyle: { color: "#1f2937" } },
		categoryAxis: { axisLine: { lineStyle: { color: "#d1d5db" } }, axisLabel: { color: "#6b7280" }, splitLine: { lineStyle: { color: "#f3f4f6" } } },
		valueAxis: { axisLine: { lineStyle: { color: "#d1d5db" } }, axisLabel: { color: "#6b7280" }, splitLine: { lineStyle: { color: "#f3f4f6" } } },
		color: ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"],
	});

	dbxThemeRegistered = true;
}

/** 获取 ECharts 实例包装器（UI 内渲染入口）。 */
export function createEChartsInstance(dom: HTMLElement, isScreen: boolean): EChartsInstance | null {
	try {
		const e = host().echarts;
		if (!e) return null;
		registerDbxThemes();
		const theme = isScreen ? "dbx-dark" : "dbx-light";
		const instance = e.init(dom, theme);
		return {
			dispose: () => instance.dispose(),
			resize: () => instance.resize(),
			setOption: (opt) => instance.setOption(opt),
		};
	} catch (error) {
		console.warn("[dbx-pro] ECharts 实例创建失败", error);
		return null;
	}
}

/** 确保 ECharts 运行时已就绪（返回 false 则 UI 显示降级提示）。 */
export async function ensureEChartsRuntime(isScreen: boolean): Promise<boolean> {
	try {
		await ensureEChartsLoaded();
		registerDbxThemes();
		return typeof host().echarts?.init === "function";
	} catch (error) {
		console.warn("[dbx-pro] ECharts 运行时加载失败", error);
		return false;
	}
}

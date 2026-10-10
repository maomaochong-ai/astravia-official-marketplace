/**
 * chart-runtime-browser — UI 内渲染用的 Chart.js 运行时。
 *
 * 与导出产物共用同一份实现（ADR-0009 §10 验收第 5 条：UI 内与导出视觉一致）：
 * 同一份 vendor/chart.umd.js，同一份 chart-defaults 主题脚本。
 * 区别只是这里用 new Function 在当前 document 里执行一次，
 * 而不是把源码写进导出的 HTML。
 *
 * 加载是惰性的，且 UMD 只跑一次：Chart.js 的解析成本只在这条路径第一次画图时付一次。
 * defaults 按主题重跑（dashboard / screen 是两份不同的 defaults，且都是幂等赋值）。
 */

import chartUmd from "../../shared/vendor/chart.umd.js?raw";
import { getChartDefaultsScript } from "./chart-defaults";

export interface ChartInstance {
	destroy(): void;
}

export type ChartConstructor = new (canvas: HTMLCanvasElement, config: Record<string, unknown>) => ChartInstance;

interface ChartGlobals {
	Chart?: ChartConstructor;
	__dbxMergeOpts?: (options: Record<string, unknown>) => Record<string, unknown>;
}

let umdLoaded = false;
let defaultsTheme: "dashboard" | "screen" | null = null;

/**
 * 运行时脚本挂在 `window` 上（defaults 脚本显式写 `window.__dbxMergeOpts`），
 * 而测试环境里 `globalThis !== window`，所以两个环境都要读对对象。
 */
function host(): ChartGlobals {
	const scope = globalThis as unknown as { window?: unknown };
	return (typeof scope.window === "object" && scope.window !== null ? scope.window : globalThis) as ChartGlobals;
}

function run(source: string): void {
	// new Function 的 body 看不到模块作用域，UMD 取不到 exports / module，会挂到全局 Chart
	new Function(source).call(globalThis);
}

/** 加载 UMD 并应用主题 defaults；失败返回 false，由调用方降级为可见提示。 */
function ensureChartRuntime(isScreen: boolean): boolean {
	try {
		if (!umdLoaded) {
			run(chartUmd);
			umdLoaded = true;
		}
		const theme = isScreen ? "screen" : "dashboard";
		if (defaultsTheme !== theme) {
			run(getChartDefaultsScript(isScreen));
			defaultsTheme = theme;
		}
		return typeof host().Chart === "function";
	} catch (error) {
		console.warn("[dbx-pro] Chart.js 运行时加载失败", error);
		return false;
	}
}

/** 取 Chart 构造器（同时保证主题 defaults 已就绪）；运行时不可用时返回 undefined。 */
export function getChartRuntime(isScreen: boolean): ChartConstructor | undefined {
	return ensureChartRuntime(isScreen) ? host().Chart : undefined;
}

/** 套用与导出路径同一份 defaults 合并逻辑。 */
export function mergeChartOptions(options: Record<string, unknown> | undefined): Record<string, unknown> {
	const user = options ?? {};
	const merge = host().__dbxMergeOpts;
	return merge ? merge(user) : user;
}

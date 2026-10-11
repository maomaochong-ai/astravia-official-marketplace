/**
 * ECharts defaults —— 注入 iframe <script>。
 *
 * 渲染引擎已从 Chart.js 切换为 ECharts（ADR-0010b）。
 * ECharts 内置 dark theme，可直接用；自定义 theme 在此注册。
 *
 * iframe 是独立 document，需要：
 *   1. 运行时存在性检查（echarts 未加载时显式报错）
 *   2. 注册 dbx 自定义 theme（深色屏幕主题 / 浅色看板主题）
 *   3. 通用 option 默认值（响应式 + grid 边距 + tooltip）
 */

/** 运行时缺失时的可见报错 + 抛出中断。 */
const ECHARTS_RUNTIME_GUARD = `if (typeof echarts === "undefined") {
  var __dbxBox = document.createElement("div");
  __dbxBox.textContent = "图表库 ECharts 未加载，无法渲染图表。";
  __dbxBox.style.cssText = "max-width:1600px;margin:24px auto;padding:16px;border-radius:8px;background:#fee2e2;color:#991b1b;font:14px/1.6 system-ui,sans-serif;text-align:center";
  document.body.appendChild(__dbxBox);
  throw new Error("ECharts runtime missing");
}
`;

/** dbx 深色大屏 theme（ECharts registerTheme 格式）。 */
const DBX_DARK_THEME = `
echarts.registerTheme('dbx-dark', {
  backgroundColor: 'transparent',
  textStyle: { color: '#d4e8ff' },
  title: { textStyle: { color: '#f0c040', fontSize: 16 }, subtextStyle: { color: '#00d4ff', fontSize: 13 } },
  legend: { textStyle: { color: '#8ab8d0' } },
  tooltip: { backgroundColor: 'rgba(11,30,58,0.85)', borderColor: '#1a3a5a', textStyle: { color: '#e0f0ff' } },
  grid: { left: 50, right: 20, top: 30, bottom: 30, containLabel: true },
  categoryAxis: { axisLine: { lineStyle: { color: '#1a3a5a' } }, axisLabel: { color: '#8ab8d0' }, splitLine: { lineStyle: { color: 'rgba(26,58,90,0.33)' } } },
  valueAxis: { axisLine: { lineStyle: { color: '#1a3a5a' } }, axisLabel: { color: '#8ab8d0' }, splitLine: { lineStyle: { color: 'rgba(26,58,90,0.33)' } } },
  color: ['#00d4ff', '#f0c040', '#ff6b6b', '#7ee8a2', '#ffa726', '#8ab8d0', '#00ffc8', '#d4a6ff'],
});
`;

/** dbx 浅色看板 theme。 */
const DBX_LIGHT_THEME = `
echarts.registerTheme('dbx-light', {
  backgroundColor: 'transparent',
  textStyle: { color: '#374151' },
  title: { textStyle: { color: '#1f2937', fontSize: 16 } },
  legend: { textStyle: { color: '#4b5563' } },
  tooltip: { backgroundColor: 'rgba(255,255,255,0.95)', borderColor: '#e5e7eb', textStyle: { color: '#1f2937' } },
  grid: { left: 50, right: 20, top: 30, bottom: 30, containLabel: true },
  categoryAxis: { axisLine: { lineStyle: { color: '#d1d5db' } }, axisLabel: { color: '#6b7280' }, splitLine: { lineStyle: { color: '#f3f4f6' } } },
  valueAxis: { axisLine: { lineStyle: { color: '#d1d5db' } }, axisLabel: { color: '#6b7280' }, splitLine: { lineStyle: { color: '#f3f4f6' } } },
  color: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'],
});
`;

/**
 * 通用 ECharts option 默认值 —— 注入 iframe <script> 作为 window.__dbxEChartsMergeOpts。
 * 图表渲染时 `echarts.init(dom, theme).setOption(window.__dbxEChartsMergeOpts(userOption))`
 * 确保每个图表都有合理的 grid/tooltip/legend 基础值。
 */
const MERGE_OPTS_FN = `
window.__dbxEChartsMergeOpts = function(userOpts) {
  const base = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 50, right: 20, top: 30, bottom: 30, containLabel: true },
    legend: { top: 8, right: 10 },
    animationDuration: 600,
    animationEasing: 'cubicOut',
  };
  return Object.assign({}, base, userOpts || {});
};
`;

/** 返回注入 iframe 的 ECharts defaults 代码：运行时检查 + theme 注册 + mergeOpts 函数。 */
export function getChartDefaultsScript(isScreen: boolean): string {
	const themeCode = DBX_DARK_THEME + DBX_LIGHT_THEME;
	const selectedTheme = isScreen ? "'dbx-dark'" : "'dbx-light'";
	// 默认 theme 注册后，echarts.init(dom, 'dark') 会用 ECharts 内置 dark，
	// 但 dbx 自定义 theme 颜色更精准。让渲染代码 echarts.init(dom, dbxTheme) 来选。
	const INIT_NOTE = `window.__dbxEChartsDefaultTheme = ${selectedTheme}; // 渲染时 echarts.init(dom, window.__dbxEChartsDefaultTheme)`;
	return `${ECHARTS_RUNTIME_GUARD}${themeCode}${MERGE_OPTS_FN}${INIT_NOTE}\n`;
}

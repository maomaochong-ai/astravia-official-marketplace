/**
 * 看板/大屏 HTML shell —— iframe srcDoc 用。
 *
 * CSS 在 themes/dashboard.css / themes/screen.css（?raw 内联），
 * 本文件只负责 import + 拼装 <head> 开头。
 *
 * 渲染引擎已切换为 ECharts（ADR-0010b），不再加载 Chart.js。
 */

import dashboardCss from "./themes/dashboard.css?raw";
import screenCss from "./themes/screen.css?raw";

/** ECharts CDN —— 带 dark 内置 theme。 */
export const ECHARTS_CDN = "https://cdn.jsdelivr.net/npm/echarts@5.6.0/dist/echarts.min.js";

/** 返回主题 CSS 字符串（iframe <style> 内联）。 */
export function getShellCss(isScreen: boolean): string {
	return isScreen ? screenCss : dashboardCss;
}

/** 拼装 HTML <head> + <body> 开头（不含图表区域和 script）。 */
export function buildHtmlHead(options: {
	title: string;
	isScreen: boolean;
}): string {
	const { title, isScreen } = options;
	const css = getShellCss(isScreen);
	return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<script src="${ECHARTS_CDN}"></script>
<style>${css}</style>
</head>
<body>
<div class="header">
  <h1>${title}</h1>
  <p>${isScreen ? "数据大屏 · ECharts + Auto Layout" : "企业看板 · ECharts + Auto Layout"}</p>
</div>`;
}

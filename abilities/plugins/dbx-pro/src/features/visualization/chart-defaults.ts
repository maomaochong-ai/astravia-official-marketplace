/**
 * Chart.js defaults —— 注入 iframe <script>。
 *
 * 两个独立 JS 文件（?raw 内联）：
 *   themes/chart-defaults-dashboard.js  看板浅 QuickBI 风
 *   themes/chart-defaults-screen.js     大屏深 DataV 风
 *
 * 为什么需要这套？iframe 是独立 document，Chart.js 用默认值
 * （borderWidth=1, borderColor="#000"），不继承宿主 React 里的 defaults。
 *
 * 同时前置一段运行时存在性检查：产物 HTML 在离线 / 运行时缺失时，
 * 若直接跑 defaults 会整体抛错、画布全部空白且无任何提示，这里改成显式报错。
 */

import dashboardDefaults from "./themes/chart-defaults-dashboard.js?raw";
import screenDefaults from "./themes/chart-defaults-screen.js?raw";

/**
 * 运行时缺失时的可见报错：先在页面上挂一块提示，再抛出中断后续脚本，
 * 避免留下「一片空白画布 + 控制台无信息」。
 */
const CHART_RUNTIME_GUARD = `if (typeof Chart === "undefined") {
  var __dbxBox = document.createElement("div");
  __dbxBox.textContent = "图表库 Chart.js 未加载，无法渲染图表。";
  __dbxBox.style.cssText = "max-width:1600px;margin:24px auto;padding:16px;border-radius:8px;background:#fee2e2;color:#991b1b;font:14px/1.6 system-ui,sans-serif;text-align:center";
  document.body.appendChild(__dbxBox);
  throw new Error("Chart.js runtime missing");
}
`;

/** 返回注入 iframe 的 Chart.js defaults 代码：运行时检查 + 主题 defaults IIFE。 */
export function getChartDefaultsScript(isScreen: boolean): string {
	return `${CHART_RUNTIME_GUARD}${isScreen ? screenDefaults : dashboardDefaults}`;
}

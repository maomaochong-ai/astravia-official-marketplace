/**
 * Chart.js defaults —— 注入 iframe <script>。
 *
 * 两个独立 JS 文件（?raw 内联）：
 *   themes/chart-defaults-dashboard.js  看板浅 QuickBI 风
 *   themes/chart-defaults-screen.js     大屏深 DataV 风
 *
 * 为什么需要这套？iframe 是独立 document，CDN Chart.js 用默认值
 * （borderWidth=1, borderColor="#000"），不继承宿主 React 里的 defaults。
 */

import dashboardDefaults from "./themes/chart-defaults-dashboard.js?raw";
import screenDefaults from "./themes/chart-defaults-screen.js?raw";

/** 返回注入 iframe 的 Chart.js defaults IIFE 代码字符串。 */
export function getChartDefaultsScript(isScreen: boolean): string {
	return isScreen ? screenDefaults : dashboardDefaults;
}

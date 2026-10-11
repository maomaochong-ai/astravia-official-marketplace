/**
 * chart-runtime — 把 BI 产物 HTML 里的 Chart.js CDN 引用替换为内联运行时。
 *
 * 产物 HTML 会以三种方式离开插件：下载文件、外部浏览器打开、iframe srcDoc 预览。
 * 只要它还引用 CDN，离线 / 内网 / CDN 不可达时 `Chart` 未定义，产物里唯一的
 * `<script>` 会在 defaults 第一行抛错，所有画布空白且没有任何提示。
 * 所以在消费端统一内联：历史产物（HTML 里仍带 CDN 标签）也会随之修复，无需迁移数据。
 *
 * 库源码与升级方式见 ../vendor/README.md。
 */

import chartUmd from "../vendor/chart.umd.js?raw";

/** 产物里唯一的 Chart.js 运行库引用：<script src="https://…/chart.umd(.min)?.js"></script> */
const CHART_CDN_SCRIPT = /<script\s+src="https:\/\/[^"]*\/chart\.umd(?:\.min)?\.js"[^>]*>\s*<\/script>/;

const SCRIPT_OPEN = "<script>";
const SCRIPT_CLOSE = "</script>";

/** 内联前拆开 `</script`，避免库源码提前闭合标签（当前版本不含该序列，防御后续升级）。 */
export function escapeScriptContent(source: string): string {
	return source.replace(/<\/script/gi, (match) => `<\\/${match.slice(2)}`);
}

/**
 * 把 `chartUmdSource` 内联进 html：替换 CDN 引用，其余内容原样保留。
 * 没有 CDN 引用时返回原字符串，因此可重复调用（幂等）。
 */
export function embedChartJs(html: string, chartUmdSource: string): string {
	return html.replace(
		CHART_CDN_SCRIPT,
		() => `${SCRIPT_OPEN}\n${escapeScriptContent(chartUmdSource)}\n${SCRIPT_CLOSE}`,
	);
}

/** 用随插件打包的 Chart.js 运行时生成独立 HTML。 */
export function withEmbeddedChartJs(html: string): string {
	return embedChartJs(html, chartUmd);
}

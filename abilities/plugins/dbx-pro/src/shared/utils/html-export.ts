/**
 * HTML 导出 / 外部打开工具 —— 共享自 visualization-tab.tsx 和 visualization-gallery.tsx。
 *
 * 为什么用 Data URL 而非 Blob URL？
 *   Blob URL 生命周期依赖 document；window.open("_blank") 是异步的，
 *   浏览器 popup blocker 可能拦截 + Blob 被父页面卸载时回收 → 白屏。
 *   Data URL 自包含（base64 + inline data），不依赖 Blob 生命周期，可靠。
 */

/** 文件名安全化（替换非字母/数字/中文为下划线）。 */
function safeFilename(raw: string): string {
	return raw.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, "_");
}

/** HTML → Data URL（text/html;charset=utf-8）。 */
export function htmlToDataUrl(html: string): string {
	return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

/** 触发浏览器下载 HTML 为 .html 文件。 */
export function downloadHtml(html: string, title: string): void {
	const a = document.createElement("a");
	a.href = htmlToDataUrl(html);
	a.download = `${safeFilename(title)}.html`;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
}

/** 在新浏览器 tab 打开 HTML（不依赖 Blob 生命周期）。 */
export function openHtmlInNewTab(html: string): void {
	window.open(htmlToDataUrl(html), "_blank", "noopener,noreferrer");
}

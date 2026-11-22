/**
 * 面板内的下载：交给浏览器，不经过宿主。
 *
 * 所以它不需要 `fs.write` 之外的任何权限，也不该顺手写成「导出到某个固定目录」——
 * 用户在哪里接住文件由浏览器/宿主的下载设置决定，面板不猜。
 *
 * 面板与下载都在渲染进程里，URL 用完立即回收（一份语料拼起来可能几 MB）。
 */

/**
 * 文件名净化。
 *
 * 语料 id 形如 `kb/ctf-website/README`、先例是 `cases/<slug>/docs/method` 这类带斜杠的路径。
 * 直接当 `download` 属性会给出一串被浏览器替换成下划线的名字，用户看不出导的是哪一份。
 * 这里统一换成 `-`，并把 Windows 不接受的字符（`: * ? " < > |`）也换掉。
 */
export function safeFileName(name: string, extension: string): string {
	const base = name
		.trim()
		.replace(/^[\\/]+/, "")
		.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "-")
		.replace(/-{2,}/g, "-")
		.replace(/^-|-$/g, "");
	const stem = base.length > 0 ? base.slice(0, 120) : "export";
	return stem.toLowerCase().endsWith(`.${extension}`) ? stem : `${stem}.${extension}`;
}

export function downloadText(fileName: string, text: string, mime = "text/plain;charset=utf-8"): void {
	const blob = new Blob([text], { type: mime });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = fileName;
	anchor.rel = "noopener";
	anchor.click();
	// 某些 WebView 在 click 返回前还没开始读 blob：推后一拍回收，避免空文件。
	window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function downloadMarkdown(fileName: string, text: string): void {
	downloadText(fileName, text, "text/markdown;charset=utf-8");
}

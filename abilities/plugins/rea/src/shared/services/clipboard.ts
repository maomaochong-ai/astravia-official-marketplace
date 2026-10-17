/**
 * 复制到剪贴板。
 *
 * 插件面板跑在宿主 renderer 里，`navigator.clipboard` 在部分窗口焦点状态下会拒绝，
 * 所以保留 textarea + execCommand 兜底，两条都失败才返回 false —— 调用方据此显示
 * 「复制失败」，不假装成功。
 */

export async function copyText(text: string): Promise<boolean> {
	if (text.length === 0) return false;
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		// 落到下面的兜底路径。
	}
	try {
		const area = document.createElement("textarea");
		area.value = text;
		area.setAttribute("readonly", "");
		area.style.position = "fixed";
		area.style.opacity = "0";
		document.body.appendChild(area);
		area.select();
		const ok = document.execCommand("copy");
		document.body.removeChild(area);
		return ok;
	} catch {
		return false;
	}
}

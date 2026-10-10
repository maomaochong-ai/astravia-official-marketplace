/**
 * figure-text — figure 片段的文本处理：转义、数值格式化、提示块。
 *
 * 片段最终是 innerHTML 字符串。图表的 label / series 名可能来自 AI 或数据库
 * 里的用户数据，一律经过 escapeHtml 再拼进片段。
 */

import type { FigurePalette } from "./figure-palette";

const HTML_ESCAPES: Record<string, string> = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': "&quot;",
	"'": "&#39;",
};

export function escapeHtml(text: unknown): string {
	return String(text ?? "").replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

/** 转成有限数字。非数字、空串、null 一律返回 null —— 渲染时显示占位符，不显示 NaN。 */
export function toFiniteNumber(value: unknown): number | null {
	if (typeof value === "number") return Number.isFinite(value) ? value : null;
	if (typeof value === "string" && value.trim() !== "") {
		const n = Number(value);
		return Number.isFinite(n) ? n : null;
	}
	return null;
}

/**
 * 千分位 + 小数位。
 * digits 未给时不补零（最多 2 位），给了就固定位数。
 */
export function formatFigureNumber(value: number, digits?: number): string {
	const options =
		digits === undefined
			? { maximumFractionDigits: 2 }
			: { minimumFractionDigits: digits, maximumFractionDigits: digits };
	try {
		return value.toLocaleString("zh-CN", options);
	} catch {
		return String(value);
	}
}

/**
 * 统一的提示块 —— 数据不足、类型未注册时用它，避免留下一块看不懂的空白。
 */
export function figureNoticeHtml(
	palette: FigurePalette,
	message: string,
	options: { detail?: string; height?: number } = {},
): string {
	const height = options.height ? `height:${options.height}px;` : "";
	return (
		`<div class="dbx-figure-notice" style="` +
		`${height}display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;` +
		`padding:18px 16px;box-sizing:border-box;text-align:center;` +
		`border:1px dashed ${palette.surfaceBorder};border-radius:8px;background:${palette.surface};` +
		`">` +
		`<span style="font-size:12px;font-weight:600;color:${palette.text}">${escapeHtml(message)}</span>` +
		(options.detail ? `<span style="font-size:11px;color:${palette.muted}">${escapeHtml(options.detail)}</span>` : "") +
		`</div>`
	);
}

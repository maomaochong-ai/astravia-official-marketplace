import { createElement, type ReactNode } from "react";

/**
 * 自带一份品牌图标，不依赖宿主把 `plugin.json#icon` 解析成 URL。
 *
 * 背景：活动标签、行内条目、胶囊三处的图标都先从 `contribution.icon` 取，取不到才回落到
 * `ctx.plugin.iconUrl`。`iconUrl` 由宿主按 manifest 的 `icon` 字段拼出，一旦它是
 * undefined（旧安装包、dev 链接、清单字段缺失），回落链断掉，三处就各自渲染成主题的
 * 默认单色图标——这就是「dbx 标签页显示黑白图标」的实际成因。
 *
 * 所以这里内联一份同色系矢量图作兜底：`iconUrl` 在就用官方的，不在也有颜色。
 * 用 SVG data URI 而不是再拷一份 PNG：体积小、任意尺寸不糊、不需要打包器处理图片导入。
 */
const MARK_SVG = [
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">',
	"<defs>",
	'<linearGradient id="body" x1="0" y1="0" x2="0.9" y2="1">',
	'<stop offset="0" stop-color="#38bdf8"/>',
	'<stop offset="0.55" stop-color="#2563eb"/>',
	'<stop offset="1" stop-color="#7c3aed"/>',
	"</linearGradient>",
	'<linearGradient id="cap" x1="0" y1="0" x2="0.4" y2="1">',
	'<stop offset="0" stop-color="#60c8fb"/>',
	'<stop offset="1" stop-color="#2a7ef0"/>',
	"</linearGradient>",
	"</defs>",
	'<path d="M5 8.5v15c0 2.5 4.9 4.5 11 4.5s11-2 11-4.5v-15z" fill="url(#body)"/>',
	'<ellipse cx="16" cy="8.5" rx="11" ry="4.5" fill="url(#cap)"/>',
	'<path d="M5 14.6c0 2.5 4.9 4.5 11 4.5s11-2 11-4.5" fill="none" stroke="#ffffff" stroke-opacity="0.9" stroke-width="1.7"/>',
	'<path d="M5 21.2c0 2.5 4.9 4.5 11 4.5s11-2 11-4.5" fill="none" stroke="#ffffff" stroke-opacity="0.9" stroke-width="1.7"/>',
	"</svg>",
].join("");

export const DBX_BRAND_FALLBACK = `data:image/svg+xml,${encodeURIComponent(MARK_SVG)}`;

/** 彩色品牌图标节点；`iconUrl` 可用时优先用它，否则用内联矢量图。 */
export function dbxBrandIcon(iconUrl: string | undefined, className = "h-4 w-4"): ReactNode {
	return createElement("img", {
		src: iconUrl ?? DBX_BRAND_FALLBACK,
		alt: "",
		"aria-hidden": true,
		draggable: false,
		className: `${className} shrink-0 object-contain`,
	});
}

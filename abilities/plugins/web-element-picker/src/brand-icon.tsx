import { createElement, type ReactNode } from "react";

/**
 * 网页元素选择器的品牌图标节点。
 *
 * 为什么要显式给：活动标签、行内条目、胶囊三处都先看 `contribution.icon`，只有它是
 * `undefined` 才回落到 `ctx.plugin.iconUrl`。`iconUrl` 由宿主按 `plugin.json#icon`
 * 拼出，一旦它是 undefined（旧安装包 / dev 链接 / 清单字段缺失），回落链就断了，
 * 三处各画一枚主题默认的单色图标——「图标不是彩色」的实际表现就是这个。
 *
 * 所以这里自带一份同款矢量图（与 `assets/icon.svg` 同一套几何与配色）作兜底：
 * `iconUrl` 在就用官方资源，不在也有颜色。`iconUrl` 缺失时三处仍然一致。
 */
const MARK_SVG = [
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">',
	"<defs>",
	'<linearGradient id="t" x1="0" y1="0" x2="1" y2="1">',
	'<stop offset="0" stop-color="#38bdf8"/><stop offset="0.55" stop-color="#2563eb"/><stop offset="1" stop-color="#7c3aed"/>',
	"</linearGradient>",
	'<linearGradient id="a" x1="0.2" y1="0" x2="0.8" y2="1">',
	'<stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#dbeafe"/>',
	"</linearGradient>",
	"</defs>",
	'<rect x="16" y="16" width="224" height="224" rx="56" fill="url(#t)"/>',
	'<rect x="46" y="46" width="164" height="164" rx="20" fill="#ffffff" fill-opacity="0.14" stroke="#ffffff" stroke-opacity="0.9" stroke-width="9" stroke-dasharray="22 16" stroke-linecap="round"/>',
	'<path d="M117.4 72.8c-1.5 0-2.8.9-3.4 2.2L83.6 144.8c-.6 1.6-.3 3.4.9 4.6c1.2 1.2 3.1 1.6 4.6.9l21.4-9.9l12.4 26.7c.6 1.2 1.9 2.2 3.4 2.2c.3 0 .6 0 .9-.3l11.2-4.7c1.9-.9 2.8-3.1 1.9-5l-12.1-26l23.6-2.2c1.6 0 3.1-1.2 3.4-2.8c.3-1.6-.3-3.4-1.6-4.3L121.1 74c-.9-.9-2.5-1.2-3.7-1.2Z" fill="url(#a)" stroke="#1e3a8a" stroke-width="4.6" stroke-linejoin="round"/>',
	"</svg>",
].join("");

export const PICKER_BRAND_FALLBACK = `data:image/svg+xml,${encodeURIComponent(MARK_SVG)}`;

/** 彩色品牌图标节点；`iconUrl` 可用时优先用它，否则用内联矢量图。 */
export function pickerBrandIcon(iconUrl: string | undefined, className = "h-4 w-4"): ReactNode {
	return createElement("img", {
		src: iconUrl ?? PICKER_BRAND_FALLBACK,
		alt: "",
		"aria-hidden": true,
		draggable: false,
		className: `${className} shrink-0 object-contain`,
	});
}

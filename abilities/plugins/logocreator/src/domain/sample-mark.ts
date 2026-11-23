import { renderLogo } from "./engine/compose";
import { normalizeSpec, type LogoSpec, type StyleId } from "./spec";

/**
 * 风格样张与空态封面用的**同一枚中性徽标**。
 *
 * 为什么不用「猫/毛毛虫」那类形象：引擎的形象母题是为真实 brief 画的，
 * 拿它当占位图会被读成「这个插件只会画卡通猫」，而且八个风格各画一只动物，
 * 差异来自画得好不好，而不是风格本身 —— 这正是「看起来像手绘」的来源。
 *
 * 这里换成一个刻意中性的标志（圆环 + 竖向胶囊 + 底部字标），
 * 于是同一枚图形经过八种风格配方时，差别只体现在笔画重量、圆角、渐变与阴影上，
 * 恰好是用户在选的东西。
 */
const EMBLEM: Omit<LogoSpec, "style"> = normalizeSpec({
	brandName: "Aurora",
	type: "icon-name",
	style: "minimal",
	detail: "balanced",
	primary: "auto",
	seed: 7,
	surface: "transparent",
});

/** 一枚徽标在某个风格下的 SVG。 */
export function styleSampleSvg(style: StyleId): string {
	const spec = normalizeSpec({ ...EMBLEM, style });
	return renderLogo(spec, { markOnly: true, idSalt: `style-sample-${style}` }).svg;
}

/** data URL，给 <img> 直接用；与画布预览走同一条渲染路径，不会出现两种画法。 */
export function styleSampleUrl(style: StyleId): string {
	const svg = styleSampleSvg(style);
	// encodeURIComponent 而不是 base64：调试时把 URL 解开就能读 SVG。
	return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** 空态封面用的那枚：取最中性的 minimal，并带上完整构图（含字标）。 */
export function coverSampleSvg(): string {
	return renderLogo(normalizeSpec({ ...EMBLEM, brandName: "Aurora", style: "minimal", surface: "light" }), {
		idSalt: "cover",
	}).svg;
}

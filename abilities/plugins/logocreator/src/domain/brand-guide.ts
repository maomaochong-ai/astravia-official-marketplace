import { contrastRatio, hexToRgb } from "./palette";
import type { BrandPalette } from "./color-plan";
import type { LogoSpec } from "./spec";
import { FONT_STACKS, recipeFor } from "./engine/style-recipes";
import { CANVAS } from "./engine/compose";

/**
 * The brand guide, as one self-contained HTML file.
 *
 * Upstream ships a PDF built with jsPDF. That needs a 300 KB dependency and can
 * only use jsPDF's built-in fonts, so the typography in the guide never matches
 * the brand. This is an A4 print stylesheet instead: every browser can "Print →
 * Save as PDF", the SVG logos stay vector, and the guide can use the same font
 * stacks as the mark. The kit also carries a PNG brand board for people who want
 * an image rather than a document.
 */

export interface GuideAssets {
	spec: LogoSpec;
	palette: BrandPalette;
	subject: string;
	logo: string;
	markSvg: string;
	onLight: string;
	onDark: string;
	onTransparent: string;
	mono: string;
}

const INK = "#15140f";
const MUTED = "#74726b";
const LINE = "#e3e2dc";
const PAPER = "#faf9f6";

function esc(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function svgBlock(svg: string, className = "art"): string {
	return `<div class="${className}">${svg}</div>`;
}

function swatchRow(hex: string, label: string, role: string): string {
	const { r, g, b } = hexToRgb(hex);
	const textOnSwatch = contrastRatio(hex, "#FFFFFF") > 4.5 ? "#FFFFFF" : INK;
	return `<div class="swatch">
		<div class="chip" style="background:${hex};color:${textOnSwatch}"><span>${role}</span></div>
		<div class="swatch-meta">
			<strong>${hex}</strong>
			<span>${label}</span>
			<span>RGB ${r}, ${g}, ${b}</span>
			<span class="mono">--brand-${role.toLowerCase().replace(/\s+/g, "-")}</span>
		</div>
	</div>`;
}

function page(inner: string, footer: string): string {
	return `<section class="page">${inner}<div class="footer"><span>${esc(footer)}</span><span class="page-number"></span></div></section>`;
}

export function buildBrandGuide(assets: GuideAssets): string {
	const { spec, palette, subject } = assets;
	const company = spec.brandName || "Your brand";
	const recipe = recipeFor(spec.style);
	const family = FONT_STACKS[recipe.font];
	const roles: { hex: string; label: string; role: string }[] = [
		{ hex: palette.primary, label: "Primary mark colour", role: "Primary" },
		{ hex: palette.secondary, label: "Structure and secondary shapes", role: "Secondary" },
		{ hex: palette.accent, label: "Highlights and small accents", role: "Accent" },
		{ hex: palette.ink, label: "Wordmark and body text", role: "Ink" },
	];

	const cover = page(
		`<div class="cover-band"></div>
		<div class="cover-card">${svgBlock(assets.logo)}</div>
		<div class="cover-title">
			<span class="eyebrow">Brand guidelines</span>
			<h1>${esc(company)}</h1>
			<p>${esc(spec.tagline || `A ${spec.style} ${spec.type.replace("-", " + ")} identity.`)}</p>
		</div>
		<div class="cover-meta">
			<span>Mark: ${esc(subject.replace("abstract:", "abstract "))}</span>
			<span>Type: ${esc(spec.type)}</span>
			<span>Style: ${esc(spec.style)}</span>
		</div>`,
		`${company} · Brand guidelines`,
	);

	const clearSpace = page(
		`<header><span class="eyebrow">The logo</span><h2>Logo &amp; clear space</h2></header>
		<div class="split">
			<div class="clearspace">
				<div class="clearspace-frame">
					${svgBlock(assets.onLight, "art-inner")}
					<div class="clearspace-guide"></div>
				</div>
				<span class="caption">Dashed line: minimum clear space (25% of the mark height).</span>
			</div>
			<div class="rules">
				<h3>Clear space</h3>
				<p>Keep a margin of at least 25% of the mark's height on every side. No other logo, type or busy imagery may enter that zone.</p>
				<h3>Minimum size</h3>
				<p>Never reproduce the full lockup below 24&nbsp;px tall on screen or 10&nbsp;mm in print. Below that, use the mark on its own.</p>
				<h3>Placement</h3>
				<p>Give the logo a calm background. On photography or colour, switch to the on-dark or on-light variant so the mark always reads.</p>
			</div>
		</div>`,
		`${company} · Brand guidelines`,
	);

	const variants = page(
		`<header><span class="eyebrow">Usage</span><h2>Logo variants</h2></header>
		<div class="variant-grid">
			<figure class="variant on-light">${svgBlock(assets.onLight)}<figcaption><strong>On light</strong><span>Default. White or paper backgrounds.</span></figcaption></figure>
			<figure class="variant on-dark">${svgBlock(assets.onDark)}<figcaption><strong>On dark</strong><span>Dark or photographic backgrounds.</span></figcaption></figure>
			<figure class="variant on-paper">${svgBlock(assets.onTransparent)}<figcaption><strong>Transparent</strong><span>Overlays, merch printing, watermarks.</span></figcaption></figure>
			<figure class="variant on-paper">${svgBlock(assets.mono)}<figcaption><strong>Monochrome</strong><span>One colour only: stamps, embossing, faxes.</span></figcaption></figure>
		</div>`,
		`${company} · Brand guidelines`,
	);

	const colour = page(
		`<header><span class="eyebrow">Colour</span><h2>Palette</h2></header>
		<div class="swatches">${roles.map((r) => swatchRow(r.hex, r.label, r.role)).join("")}</div>
		<p class="note">These values ship as <span class="mono">brand-colors.css</span> and <span class="mono">brand-colors.json</span> in this kit. Use the primary for key actions and accents; keep large surfaces neutral.</p>`,
		`${company} · Brand guidelines`,
	);

	const type = page(
		`<header><span class="eyebrow">Type &amp; usage</span><h2>Typography</h2></header>
		<div class="specimen" style='font-family:${family}'>Aa</div>

		<!-- The stack contains double quotes, so any attribute carrying it must be
		     single-quoted; a double-quoted one ends at "Segoe UI" and breaks parsing. -->
		<p class="note">The wordmark is set in <strong>${esc(fontLabel(recipe.font))}</strong> at weight ${recipe.weight}${recipe.uppercase ? ", uppercase" : ""}${recipe.tracking ? `, letter-spacing ${(recipe.tracking * 1000).toFixed(0)}/1000 em` : ""}. Pair it with the same family for headings and a neutral sans for body copy.</p>
		<div class="split lists">
			<div>
				<h3 class="do">Do</h3>
				<ul>
					<li>Keep the clear space and minimum size.</li>
					<li>Use the supplied colour and mono variants.</li>
					<li>Scale proportionally, from the SVG.</li>
					<li>Pick the variant that contrasts with the background.</li>
				</ul>
			</div>
			<div>
				<h3 class="dont">Don't</h3>
				<ul>
					<li>Stretch, squash, rotate or outline the logo.</li>
					<li>Recolour it outside this palette.</li>
					<li>Add shadows, glows or other effects.</li>
					<li>Place it on a busy background with no contrast.</li>
				</ul>
			</div>
		</div>`,
		`${company} · Brand guidelines`,
	);

	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(company)} · Brand guidelines</title>
<style>
	@page { size: A4 portrait; margin: 0; }
	* { box-sizing: border-box; }
	html, body { margin: 0; padding: 0; }
	body { background: #e9e8e3; color: ${INK}; font-family: ${FONT_STACKS.sans}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
	.page { position: relative; width: 210mm; min-height: 297mm; margin: 0 auto 10mm; background: ${PAPER}; padding: 18mm 18mm 22mm; overflow: hidden; page-break-after: always; }
	.page:last-child { page-break-after: auto; margin-bottom: 0; }
	.eyebrow { display: block; font-size: 8.5pt; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: ${"#6b6a64"}; }
	header { border-bottom: 1px solid ${LINE}; padding-bottom: 6mm; margin-bottom: 9mm; }
	h1 { font-size: 30pt; margin: 4mm 0 0; letter-spacing: -0.01em; }
	h2 { font-size: 20pt; margin: 3mm 0 0; }
	h3 { font-size: 11pt; margin: 0 0 2mm; }
	p { font-size: 10pt; line-height: 1.55; color: #3b3a35; margin: 0 0 5mm; }
	ul { margin: 0; padding-left: 5mm; }
	li { font-size: 9.5pt; line-height: 1.6; color: #3b3a35; margin-bottom: 1.5mm; }
	.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 8.5pt; }
	.art { width: 100%; }
	.art svg, .art-inner svg { display: block; width: 100%; height: auto; }
	.cover-band { position: absolute; inset: 0 0 auto 0; height: 5mm; background: ${palette.primary}; }
	.cover-card { margin-top: 26mm; background: #fff; border: 1px solid ${LINE}; border-radius: 4mm; padding: 14mm; }
	.cover-card .art { width: 82%; margin: 0 auto; }
	.cover-title { text-align: center; margin-top: 16mm; }
	.cover-title p { color: ${MUTED}; margin-top: 3mm; }
	.cover-meta { position: absolute; left: 18mm; right: 18mm; bottom: 26mm; display: flex; gap: 6mm; justify-content: center; font-size: 8pt; color: ${MUTED}; text-transform: uppercase; letter-spacing: 0.08em; }
	.split { display: grid; grid-template-columns: 1fr 1fr; gap: 10mm; align-items: start; }
	.split.lists { margin-top: 8mm; }
	.clearspace-frame { position: relative; border: 1px solid ${LINE}; background: #fff; padding: 22%; }
	.clearspace-guide { position: absolute; inset: 22%; border: 1px dashed ${palette.primary}; opacity: 0.6; }
	.caption { display: block; margin-top: 3mm; font-size: 8pt; color: ${MUTED}; }
	.variant-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 7mm; }
	.variant { margin: 0; border: 1px solid ${LINE}; border-radius: 3mm; overflow: hidden; }
	.variant .art { padding: 8mm; }
	.variant.on-dark { background: #12120f; border-color: #12120f; }
	.variant.on-light { background: #fff; }
	.variant.on-paper { background: #f3f2ee; }
	.variant figcaption { display: flex; flex-direction: column; gap: 1mm; padding: 3mm 4mm; font-size: 8.5pt; background: #fff; border-top: 1px solid ${LINE}; }
	.variant figcaption span { color: ${MUTED}; }
	.swatches { display: flex; flex-direction: column; gap: 5mm; }
	.swatch { display: flex; gap: 6mm; align-items: stretch; }
	.chip { width: 46mm; height: 26mm; border-radius: 2mm; display: flex; align-items: flex-start; padding: 3mm; font-size: 7.5pt; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
	.swatch-meta { display: flex; flex-direction: column; justify-content: center; gap: 1mm; font-size: 9pt; }
	.swatch-meta strong { font-size: 12pt; }
	.swatch-meta span { color: ${MUTED}; font-size: 8.5pt; }
	.specimen { font-size: 96pt; line-height: 1; margin: 4mm 0 6mm; }
	.note { margin-top: 6mm; }
	h3.do { color: #2e7d54; }
	h3.dont { color: #b3402e; }
	.footer { position: absolute; left: 18mm; right: 18mm; bottom: 10mm; display: flex; justify-content: space-between; border-top: 1px solid ${LINE}; padding-top: 3mm; font-size: 8pt; color: ${MUTED}; }
	@media print { body { background: #fff; } .page { margin: 0; box-shadow: none; } }
</style>
</head>
<body>
${cover}
${clearSpace}
${variants}
${colour}
${type}
</body>
</html>`;
}

function fontLabel(key: keyof typeof FONT_STACKS): string {
	switch (key) {
		case "serif":
			return "an editorial serif";
		case "hand":
			return "a handwritten face";
		case "grotesk":
			return "a neo-grotesque sans";
		default:
			return "a geometric sans";
	}
}

/** Brand board: one PNG that shows the mark, the lockup and the palette. */
export function buildBrandBoard(assets: GuideAssets): string {
	const { spec, palette, subject } = assets;
	const W = 1600;
	const H = 1000;
	const company = esc(spec.brandName || "Your brand");
	const strip = (svg: string, x: number, y: number, size: number) =>
		`<g transform="translate(${x} ${y}) scale(${(size / CANVAS).toFixed(4)})">${svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "")}</g>`;
	const chips = [palette.primary, palette.secondary, palette.accent, palette.ink]
		.map(
			(hex, i) =>
				`<g transform="translate(${1120 + i * 112} 720)"><rect width="92" height="92" rx="10" fill="${hex}"/><text x="0" y="116" font-family='${FONT_STACKS.sans}' font-size="15" fill="#8b8a84">${hex}</text></g>`,
		)
		.join("");

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
		<rect width="${W}" height="${H}" fill="#faf9f6"/>
		<rect width="${W}" height="10" fill="${palette.primary}"/>
		<rect x="72" y="86" width="720" height="720" rx="22" fill="#ffffff" stroke="#e3e2dc"/>
		${strip(assets.logo, 132, 146, 600)}
		<text x="880" y="150" font-family='${FONT_STACKS.sans}' font-size="17" letter-spacing="3" fill="#8b8a84">BRAND BOARD</text>
		<text x="880" y="238" font-family='${FONT_STACKS.sans}' font-size="66" font-weight="700" fill="#15140f">${company}</text>
		<text x="880" y="286" font-family='${FONT_STACKS.sans}' font-size="20" fill="#74726b">${esc(spec.tagline || `${spec.style} · ${spec.type.replace("-", " + ")} · ${subject.replace("abstract:", "abstract ")}`)}</text>
		<rect x="880" y="330" width="120" height="3" fill="${palette.primary}"/>
		${strip(assets.markSvg, 1080, 400, 260)}
		${chips}
		<text x="72" y="900" font-family='${FONT_STACKS.sans}' font-size="16" fill="#8b8a84">Generated with LogoCreator · SVG and PNG exports in this kit</text>
	</svg>`;
}

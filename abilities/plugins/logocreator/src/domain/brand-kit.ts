import { strToU8, zipSync } from "fflate";
import { resolvePalette, type BrandPalette } from "./color-plan";
import { renderLogo } from "./engine/compose";
import { buildBrandBoard, buildBrandGuide } from "./brand-guide";
import { rasterizeSvg, svgToPngBytes } from "./render-png";
import type { LogoSpec } from "./spec";

/**
 * The brand kit: everything a designer needs to actually use the mark.
 *
 * The four variants are not the same SVG on four backgrounds — each is composed
 * for its own surface, so the on-dark version uses a palette tuned for dark and
 * its knockout shapes are dark rather than white. That is the difference between
 * a kit someone can ship and a folder of screenshots.
 */

export interface KitFile {
	path: string;
	bytes: Uint8Array;
}

export interface KitVariantSvg {
	onLight: string;
	onDark: string;
	transparent: string;
	mono: string;
	mark: string;
}

export interface BrandKit {
	folder: string;
	palette: BrandPalette;
	subject: string;
	variants: KitVariantSvg;
	files: KitFile[];
	zip: Blob;
}

export interface KitOptions {
	/** Called with a short label as each stage completes, for the progress line. */
	onStage?: (stage: string) => void;
}

const DARK_SURFACE = "#121210";

export function kitSlug(spec: { brandName: string }): string {
	const base = (spec.brandName || "brand")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return base || "brand";
}

export function paletteCss(palette: BrandPalette): string {
	const roles: [string, string][] = [
		["primary", palette.primary],
		["secondary", palette.secondary],
		["accent", palette.accent],
		["ink", palette.ink],
		["muted", palette.muted],
	];
	return `:root {\n${roles.map(([name, hex]) => `\t--brand-${name}: ${hex};`).join("\n")}\n}\n`;
}

export function paletteJson(palette: BrandPalette, brandName: string): string {
	const entries = [
		{ name: "primary", role: "Primary mark colour", hex: palette.primary },
		{ name: "secondary", role: "Structure and secondary shapes", hex: palette.secondary },
		{ name: "accent", role: "Highlights and small accents", hex: palette.accent },
		{ name: "ink", role: "Wordmark and body text", hex: palette.ink },
		{ name: "muted", role: "Supporting text", hex: palette.muted },
	];
	return `${JSON.stringify({ brand: brandName, colors: palette, roles: entries }, null, 2)}\n`;
}

function readme(spec: LogoSpec, subject: string): string {
	const name = spec.brandName || "Your brand";
	return `${name} — brand kit

What is in here
---------------
logo.svg               The full lockup as vector art. Use this whenever you can.
logo-mark.svg          The mark alone, for tight spaces and app icons.
logo-on-light.svg      Composed for white or paper backgrounds.
logo-on-dark.svg       Composed for dark backgrounds.
logo-transparent.svg   No background; place it yourself.
logo-mono.svg          One colour only, for stamps and embossing.

logo-{512,1024,2048}.png   Raster sizes of the lockup, transparent background.
logo-on-light.png           1024 px preview on white.
logo-on-dark.png            1024 px preview on dark.
favicon-32.png              Browser tab.
favicon-64.png              Retina browser tab.
apple-touch-icon-180.png    iOS home screen.

brand-colors.css / .json    The palette as variables and as data.
brand-guide.html            This brand's guidelines. Open it, then Print → Save as PDF.
brand-board.png             One image with the mark, the lockup and the palette.

How it was made
---------------
Mark:  ${subject.replace("abstract:", "abstract ")}
Type:  ${spec.type} · ${spec.style} · ${spec.detail} detail
Seed:  ${spec.seed}

The SVG files are self-contained: no external fonts, no linked images. Text is
set in system font stacks, so the wordmark renders with whatever similar typeface
the viewer has. For pixel-exact typography, convert the wordmark to outlines in a
vector editor.

Generated with LogoCreator inside Astravia.
`;
}

export async function buildBrandKit(spec: LogoSpec, options: KitOptions = {}): Promise<BrandKit> {
	const stage = (label: string) => options.onStage?.(label);
	const folder = `${kitSlug(spec)}-brand-kit`;

	const light = renderLogo({ ...spec, surface: "light" }, { idSalt: "kit-light" });
	const dark = renderLogo({ ...spec, surface: "dark" }, { idSalt: "kit-dark" });
	const transparent = renderLogo({ ...spec, surface: "transparent" }, { idSalt: "kit-clear" });
	const monoPalette = resolvePalette({ ...spec, surface: "light", monochrome: true });
	const mono = renderLogo(
		{ ...spec, surface: "light", monochrome: true },
		{ idSalt: "kit-mono", monoInk: monoPalette.primary },
	);
	const mark = renderLogo({ ...spec, surface: "transparent" }, { idSalt: "kit-mark", markOnly: true });

	stage("variant-svgs");

	const files: KitFile[] = [
		{ path: "logo.svg", bytes: strToU8(transparent.svg) },
		{ path: "logo-mark.svg", bytes: strToU8(mark.svg) },
		{ path: "logo-on-light.svg", bytes: strToU8(light.svg) },
		{ path: "logo-on-dark.svg", bytes: strToU8(dark.svg) },
		{ path: "logo-transparent.svg", bytes: strToU8(transparent.svg) },
		{ path: "logo-mono.svg", bytes: strToU8(mono.svg) },
	];

	for (const size of [512, 1024, 2048]) {
		files.push({ path: `logo-${size}.png`, bytes: await svgToPngBytes(transparent.svg, size) });
		stage(`png-${size}`);
	}
	for (const size of [32, 64]) {
		files.push({ path: `favicon-${size}.png`, bytes: await svgToPngBytes(mark.svg, size) });
	}
	files.push({ path: "apple-touch-icon-180.png", bytes: await svgToPngBytes(light.svg, 180) });
	files.push({ path: "logo-on-light.png", bytes: await svgToPngBytes(light.svg, 1024) });
	files.push({ path: "logo-on-dark.png", bytes: await svgToPngBytes(dark.svg, 1024) });
	stage("png-variants");

	const palette = light.palette;
	files.push({ path: "brand-colors.css", bytes: strToU8(paletteCss(palette)) });
	files.push({ path: "brand-colors.json", bytes: strToU8(paletteJson(palette, spec.brandName)) });

	const assets = {
		spec,
		palette,
		subject: light.subject,
		logo: light.svg,
		markSvg: mark.svg,
		onLight: light.svg,
		onDark: dark.svg,
		onTransparent: transparent.svg,
		mono: mono.svg,
	};
	files.push({ path: "brand-guide.html", bytes: strToU8(buildBrandGuide(assets)) });

	const board = buildBrandBoard(assets);
	files.push({ path: "brand-board.svg", bytes: strToU8(board) });
	const boardPng = await rasterizeSvg(board, 1600, 1000);
	files.push({ path: "brand-board.png", bytes: new Uint8Array(await boardPng.arrayBuffer()) });
	stage("brand-board");

	files.push({ path: "README.txt", bytes: strToU8(readme(spec, light.subject)) });

	const archive: Record<string, Uint8Array> = {};
	for (const file of files) archive[`${folder}/${file.path}`] = file.bytes;
	const zipped = zipSync(archive, { level: 6 });
	stage("zip");

	const blob = new Blob([new Uint8Array(zipped)], { type: "application/zip" });
	return {
		folder,
		palette,
		subject: light.subject,
		variants: {
			onLight: light.svg,
			onDark: dark.svg,
			transparent: transparent.svg,
			mono: mono.svg,
			mark: mark.svg,
		},
		files,
		zip: blob,
	};
}

/** Copy-to-clipboard-friendly colour list. */
export function paletteLines(palette: BrandPalette): string[] {
	return [palette.primary, palette.secondary, palette.accent, palette.ink, palette.muted];
}

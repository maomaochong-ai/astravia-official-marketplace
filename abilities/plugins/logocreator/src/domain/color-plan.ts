import { normalizeHex, isHexColor, mixHex, shiftHue, bestTextColor, ensureContrast, rgbToHsl, hexToRgb, hslToHex, contrastRatio } from "./palette";
import { hashSeed } from "./prng";
import { SUBJECT_KEYWORDS } from "./catalog";
import { AUTO, type LogoSpec } from "./spec";

/**
 * Turning a spec into the five colours a mark is actually drawn with.
 *
 * Two rules drive all of it:
 *  - the same spec must always produce the same palette, so the hue for "auto"
 *    is hashed from the brand name plus the brief, never sampled randomly;
 *  - text has to clear a contrast floor against the surface it sits on, because
 *    a beautiful mark with an unreadable wordmark is not a logo.
 */

export interface BrandPalette {
	/** The mark's own colour. */
	primary: string;
	/** Structuring colour: rings, secondary shapes, gradient end. */
	secondary: string;
	/** Small accents only — dots, highlights, hairlines. */
	accent: string;
	/** Wordmark / tagline colour on `surface`. */
	ink: string;
	/** Background fill; empty string when the surface is transparent. */
	surface: string;
	/** Muted ink for taglines and rules. */
	muted: string;
	isDark: boolean;
}

/**
 * Industry-ish hue anchors, keyed by the same subjects the mark library uses.
 * A teahouse that lands on hue 22 renders warm no matter which seed it gets;
 * without this the "auto" colour for a coffee brand could come out cyan.
 */
const SUBJECT_HUES: Record<string, number> = {
	cup: 24,
	flame: 16,
	leaf: 142,
	wave: 198,
	mountain: 212,
	sun: 42,
	moon: 236,
	house: 208,
	pillar: 222,
	cross: 186,
	note: 286,
	aperture: 214,
	wing: 200,
	paw: 30,
	creature: 34,
	hex: 226,
	shield: 218,
	spark: 48,
	droplet: 190,
	book: 10,
	compass: 206,
	gear: 214,
	heart: 350,
	orbit: 250,
	link: 232,
	knot: 268,
};

export function subjectFor(text: string): string | null {
	let best: { index: number; subject: string } | null = null;
	for (const [pattern, subject] of SUBJECT_KEYWORDS) {
		// A fresh regex per call: `test()` on a shared /g/ pattern keeps state.
		const match = new RegExp(pattern.source, pattern.flags).exec(text);
		if (!match) continue;
		if (!best || match.index < best.index) best = { index: match.index, subject };
	}
	return best?.subject ?? null;
}

function autoHue(spec: LogoSpec): number {
	const subject = subjectFor(`${spec.brandName} ${spec.intent}`);
	const anchor = subject ? SUBJECT_HUES[subject] : undefined;
	// The hash keeps two brands in the same industry apart; the anchor keeps both
	// inside the range that industry reads as.
	const jitter = (hashSeed(`${spec.brandName}|${spec.intent}`) % 46) - 23;
	return (anchor ?? hashSeed(spec.brandName || "brand") % 360) + jitter;
}

function surfaceFor(spec: LogoSpec): { fill: string; isDark: boolean } {
	if (spec.surface === "dark") return { fill: "#121210", isDark: true };
	// Transparent is composed for light placement: it is the common case, and the
	// brand kit also ships an on-dark variant built from the same mark.
	return { fill: "#FFFFFF", isDark: false };
}

export function resolvePalette(spec: LogoSpec): BrandPalette {
	const { fill, isDark } = surfaceFor(spec);

	let primary: string;
	if (spec.monochrome) {
		primary = ensureContrast(isDark ? "#F5F4F0" : "#14130F", fill, 7);
	} else if (isHexColor(spec.primary)) {
		primary = normalizeHex(spec.primary);
	} else {
		const hue = autoHue(spec);
		const luxury = spec.style === "luxury";
		const saturation = luxury ? 34 : spec.style === "retro" ? 62 : spec.style === "minimal" ? 58 : 70;
		const lightness = isDark ? 62 : luxury ? 42 : 46;
		primary = hslToHex({ h: hue, s: saturation, l: lightness });
	}

	if (spec.monochrome) {
		const secondary = mixHex(primary, fill, 0.42);
		return {
			primary,
			secondary,
			accent: mixHex(primary, fill, 0.68),
			ink: ensureContrast(primary, fill, 7),
			surface: spec.surface === "transparent" ? "" : fill,
			muted: mixHex(primary, fill, 0.5),
			isDark,
		};
	}

	// Luxury reads as gold-on-charcoal far more often than as a bright primary,
	// so it leans on a warm metallic secondary instead of a hue rotation.
	const secondary =
		spec.style === "luxury"
			? hslToHex({ h: 38, s: 38, l: isDark ? 66 : 48 })
			: shiftHue(primary, isDark ? 28 : -26, clampLightness(rgbToHsl(hexToRgb(primary)).l + (isDark ? 10 : -12)));

	const accentHue = rgbToHsl(hexToRgb(primary)).h + (isDark ? 168 : 196);
	const accent = spec.style === "luxury" ? hslToHex({ h: accentHue, s: 26, l: isDark ? 74 : 40 }) : hslToHex({ h: accentHue, s: 62, l: isDark ? 68 : 44 });

	const inkBase = bestTextColor(fill);
	// A hair of the brand hue in the ink ties text to the mark without making it
	// look tinted; full-black text on a saturated mark looks pasted on.
	const ink = ensureContrast(mixHex(inkBase, primary, 0.1), fill, 8);

	return {
		primary,
		secondary,
		accent,
		ink,
		surface: spec.surface === "transparent" ? "" : fill,
		muted: ensureContrast(mixHex(ink, fill, 0.42), fill, 4.2),
		isDark,
	};
}

function clampLightness(value: number): number {
	return Math.max(12, Math.min(88, value));
}

/**
 * Pick usable brand colours out of an uploaded image.
 *
 * Bins the sample by hue and keeps the most populated saturated bin, then a
 * second bin far enough away to be a real secondary. Grey/near-white samples
 * are skipped: a logo photographed on paper would otherwise return the paper.
 */
export function extractPalette(pixels: Uint8ClampedArray, sampleStep = 4): string[] {
	const bins = new Map<number, { count: number; s: number; l: number }>();
	const step = Math.max(1, Math.floor(sampleStep));
	for (let i = 0; i < pixels.length; i += 4 * step) {
		const alpha = pixels[i + 3];
		if (alpha < 160) continue;
		const { h, s, l } = rgbToHsl({ r: pixels[i], g: pixels[i + 1], b: pixels[i + 2] });
		if (s < 18 || l < 8 || l > 94) continue;
		const bin = Math.round(h / 12) * 12;
		const entry = bins.get(bin) ?? { count: 0, s: 0, l: 0 };
		entry.count += 1;
		entry.s += s;
		entry.l += l;
		bins.set(bin, entry);
	}
	const ranked = [...bins.entries()]
		.map(([hue, entry]) => ({
			hue,
			count: entry.count,
			s: entry.s / entry.count,
			l: entry.l / entry.count,
		}))
		.sort((a, b) => b.count - a.count);
	if (ranked.length === 0) return [];

	const picked: string[] = [];
	for (const bin of ranked) {
		const hex = hslToHex({ h: bin.hue, s: Math.max(38, Math.min(88, bin.s)), l: Math.max(34, Math.min(60, bin.l)) });
		if (picked.every((existing) => contrastRatio(existing, hex) > 1.06)) picked.push(hex);
		if (picked.length === 3) break;
	}
	return picked;
}

/** Ensure a spec's explicit colour never disappears into its surface. */
export function primaryFor(spec: LogoSpec): string {
	const palette = resolvePalette(spec);
	if (!spec.monochrome && isHexColor(spec.primary) && spec.primary.trim() !== AUTO) {
		const floor = spec.surface === "dark" ? 2.2 : 2.6;
		if (contrastRatio(palette.primary, palette.surface || "#FFFFFF") < floor) {
			return ensureContrast(palette.primary, palette.surface || "#FFFFFF", floor);
		}
	}
	return palette.primary;
}

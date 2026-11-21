/**
 * Colour maths and palette construction.
 *
 * A logo needs a palette that is *usable*, not just pleasant: the wordmark has
 * to stay legible on the surface it ships on, and the accent has to be
 * distinguishable from the primary at small sizes. Everything below is plain
 * sRGB maths so the result can be reasoned about rather than eyeballed.
 */

export interface Rgb {
	r: number;
	g: number;
	b: number;
}

export interface Hsl {
	h: number;
	s: number;
	l: number;
}

const HEX_PATTERN = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isHexColor(value: unknown): value is string {
	return typeof value === "string" && HEX_PATTERN.test(value.trim());
}

export function normalizeHex(value: string): string {
	const raw = value.trim().replace("#", "");
	const full =
		raw.length === 3
			? raw
					.split("")
					.map((c) => c + c)
					.join("")
			: raw;
	return `#${full.toUpperCase()}`;
}

export function hexToRgb(hex: string): Rgb {
	const raw = normalizeHex(hex).slice(1);
	return {
		r: Number.parseInt(raw.slice(0, 2), 16),
		g: Number.parseInt(raw.slice(2, 4), 16),
		b: Number.parseInt(raw.slice(4, 6), 16),
	};
}

export function rgbToHex({ r, g, b }: Rgb): string {
	const channel = (v: number) =>
		Math.max(0, Math.min(255, Math.round(v)))
			.toString(16)
			.padStart(2, "0")
			.toUpperCase();
	return `#${channel(r)}${channel(g)}${channel(b)}`;
}

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
	const rn = r / 255;
	const gn = g / 255;
	const bn = b / 255;
	const max = Math.max(rn, gn, bn);
	const min = Math.min(rn, gn, bn);
	const l = (max + min) / 2;
	if (max === min) return { h: 0, s: 0, l: l * 100 };
	const d = max - min;
	const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
	let h: number;
	if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
	else if (max === gn) h = ((bn - rn) / d + 2) / 6;
	else h = ((rn - gn) / d + 4) / 6;
	return { h: h * 360, s: s * 100, l: l * 100 };
}

export function hslToHex(hsl: Hsl): string {
	const h = ((hsl.h % 360) + 360) % 360;
	const s = Math.max(0, Math.min(100, hsl.s)) / 100;
	const l = Math.max(0, Math.min(100, hsl.l)) / 100;
	if (s === 0) {
		const v = l * 255;
		return rgbToHex({ r: v, g: v, b: v });
	}
	const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
	const p = 2 * l - q;
	const channel = (t: number) => {
		let tt = t;
		if (tt < 0) tt += 1;
		if (tt > 1) tt -= 1;
		if (tt < 1 / 6) return p + (q - p) * 6 * tt;
		if (tt < 1 / 2) return q;
		if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
		return p;
	};
	const hk = h / 360;
	return rgbToHex({
		r: channel(hk + 1 / 3) * 255,
		g: channel(hk) * 255,
		b: channel(hk - 1 / 3) * 255,
	});
}

/** WCAG relative luminance. */
export function luminance(hex: string): number {
	const { r, g, b } = hexToRgb(hex);
	const channel = (v: number) => {
		const c = v / 255;
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
	const la = luminance(a);
	const lb = luminance(b);
	return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Ink that reads on `background` — pure black/white, so no hue casts onto text. */
export function bestTextColor(background: string): string {
	return luminance(background) > 0.42 ? "#101010" : "#FFFFFF";
}

/** Push `hex` away from `against` until the pair clears `target` contrast. */
export function ensureContrast(hex: string, against: string, target = 4.5): string {
	if (contrastRatio(hex, against) >= target) return hex;
	const hsl = rgbToHsl(hexToRgb(hex));
	const towardsLight = luminance(against) < 0.4;
	let best = hex;
	for (let step = 1; step <= 20; step += 1) {
		const l = towardsLight ? hsl.l + step * 3 : hsl.l - step * 3;
		const candidate = hslToHex({ h: hsl.h, s: hsl.s, l });
		best = candidate;
		if (contrastRatio(candidate, against) >= target) return candidate;
	}
	return best;
}

export function mixHex(a: string, b: string, weight = 0.5): string {
	const ca = hexToRgb(a);
	const cb = hexToRgb(b);
	const w = Math.max(0, Math.min(1, weight));
	return rgbToHex({
		r: ca.r + (cb.r - ca.r) * w,
		g: ca.g + (cb.g - ca.g) * w,
		b: ca.b + (cb.b - ca.b) * w,
	});
}

export function shiftHue(hex: string, degrees: number, lightness?: number): string {
	const hsl = rgbToHsl(hexToRgb(hex));
	return hslToHex({
		h: hsl.h + degrees,
		s: hsl.s,
		l: lightness ?? hsl.l,
	});
}

import type { LogoSpec } from "./spec";

/**
 * Which part of the logo a note is about.
 *
 * A logo has four places a reviewer points at, and none of them is "x=0.42". The
 * reference design plugin resolves a note to a DOM element; we cannot, because the
 * mark is one SVG — but we *do* own the layout, so the anchor can be resolved to a
 * structural part instead of a pixel. That is the precise version of the same idea:
 * a note says "the wordmark", not "somewhere in the lower third".
 */
export const LOGO_PARTS = ["mark", "wordmark", "tagline", "background"] as const;
export type LogoPart = (typeof LOGO_PARTS)[number];

interface Zone {
	part: LogoPart;
	/** Fractional band on the canvas, top-left origin. */
	from: number;
	to: number;
}

/**
 * Bands mirror `renderLogo`'s layout: mark around y≈0.10–0.66 for the stacked
 * lockups, wordmark under it, tagline last. `mark` and `wordmark`-only layouts put
 * their content in the middle, so anything off the text baseline is the mark.
 */
const ZONES: Record<string, Zone[]> = {
	"icon-name": [
		{ part: "mark", from: 0, to: 0.66 },
		{ part: "wordmark", from: 0.66, to: 0.88 },
		{ part: "tagline", from: 0.88, to: 1 },
	],
	monogram: [
		{ part: "mark", from: 0, to: 0.66 },
		{ part: "wordmark", from: 0.66, to: 0.88 },
		{ part: "tagline", from: 0.88, to: 1 },
	],
	abstract: [
		{ part: "mark", from: 0, to: 0.66 },
		{ part: "wordmark", from: 0.66, to: 0.88 },
		{ part: "tagline", from: 0.88, to: 1 },
	],
	icon: [{ part: "mark", from: 0, to: 1 }],
	wordmark: [
		{ part: "wordmark", from: 0, to: 0.82 },
		{ part: "tagline", from: 0.82, to: 1 },
	],
	emblem: [{ part: "mark", from: 0, to: 1 }],
};

export function partAt(spec: Pick<LogoSpec, "type">, y: number): LogoPart {
	const zones = ZONES[spec.type] ?? ZONES["icon-name"];
	const clamped = Math.min(0.999, Math.max(0, y));
	for (const zone of zones) {
		if (clamped >= zone.from && clamped < zone.to) return zone.part;
	}
	return zones[zones.length - 1].part;
}

/** Human phrasing for the prompt: the model should know *where*, not just what. */
export function describePart(part: LogoPart | null): string {
	switch (part) {
		case "mark":
			return "the pictorial mark";
		case "wordmark":
			return "the wordmark";
		case "tagline":
			return "the tagline";
		case "background":
			return "the background / surface";
		default:
			return "the whole lockup";
	}
}

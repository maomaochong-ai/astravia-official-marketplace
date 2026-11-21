import type { StyleId } from "../spec";

/** Wordmark stack keys. System faces only — the export must not need a font file. */
export const FONT_STACKS = {
	sans: 'ui-sans-serif,-apple-system,"Segoe UI",Inter,"Helvetica Neue",Arial,sans-serif',
	grotesk: '"Helvetica Neue",Helvetica,Arial,sans-serif',
	serif: '"Iowan Old Style","Palatino Linotype",Palatino,Georgia,"Times New Roman",serif',
	hand: '"Segoe Print","Bradley Hand","Comic Sans MS","Chalkboard SE",cursive',
} as const;

export type FontStackKey = keyof typeof FONT_STACKS;

/**
 * Per-style drawing knobs.
 *
 * These are the only differences between the eight styles at the geometry level.
 * Keeping them in one table means "what makes Luxury look luxury" is answerable
 * in one place instead of smeared across eight motif branches.
 */
export interface StyleRecipe {
	id: StyleId;
	/** Stroke width inside the 100-unit mark box. */
	stroke: number;
	/** Corner softening, 0 (hard) … 1 (fully rounded). */
	corner: number;
	gradient: boolean;
	gradientAngle: number;
	texture: "none" | "grain" | "hatch" | "halftone";
	/** Extrusion depth for the 3D style, in mark-box units. */
	extrusion: number;
	/** Hand-drawn displacement amplitude, in mark-box units. */
	wobble: number;
	ornament: "none" | "ring" | "double-ring" | "laurel" | "rays";
	/** Wordmark letter-spacing in em. */
	tracking: number;
	weight: number;
	font: FontStackKey;
	uppercase: boolean;
	/** Retro prints the wordmark twice, offset — this is the offset in units. */
	outline: number;
}

const BASE: StyleRecipe = {
	id: "minimal",
	stroke: 7,
	corner: 0.35,
	gradient: false,
	gradientAngle: 45,
	texture: "none",
	extrusion: 0,
	wobble: 0,
	ornament: "none",
	tracking: -0.01,
	weight: 600,
	font: "sans",
	uppercase: false,
	outline: 0,
};

export const STYLE_RECIPES: Record<StyleId, StyleRecipe> = {
	minimal: { ...BASE, id: "minimal", stroke: 8, corner: 0.5, weight: 600, tracking: -0.02 },
	geometric: {
		...BASE,
		id: "geometric",
		stroke: 6,
		corner: 0.05,
		// No construction grid: behind a finished mark it reads as an unfinished
		// blueprint. Geometric earns its difference from sharp corners, a heavier
		// weight and uppercase tracking.
		ornament: "none",
		weight: 700,
		tracking: 0.02,
		uppercase: true,
		font: "grotesk",
	},
	gradient: { ...BASE, id: "gradient", stroke: 7, gradient: true, gradientAngle: 52, weight: 600 },
	mascot: { ...BASE, id: "mascot", stroke: 5, corner: 0.85, ornament: "ring", weight: 700, tracking: 0 },
	"hand-drawn": {
		...BASE,
		id: "hand-drawn",
		stroke: 6,
		corner: 0.7,
		wobble: 2.4,
		texture: "grain",
		font: "hand",
		weight: 500,
		tracking: 0.01,
	},
	luxury: {
		...BASE,
		id: "luxury",
		stroke: 4,
		corner: 0.15,
		ornament: "double-ring",
		font: "serif",
		weight: 400,
		tracking: 0.16,
		uppercase: true,
	},
	retro: {
		...BASE,
		id: "retro",
		stroke: 7,
		corner: 0.3,
		ornament: "rays",
		texture: "halftone",
		font: "serif",
		weight: 700,
		tracking: 0.04,
		uppercase: true,
		outline: 3.2,
	},
	"3d": {
		...BASE,
		id: "3d",
		stroke: 8,
		corner: 0.6,
		gradient: true,
		gradientAngle: 62,
		extrusion: 9,
		weight: 800,
		tracking: 0,
	},
};

export function recipeFor(style: StyleId): StyleRecipe {
	return STYLE_RECIPES[style] ?? STYLE_RECIPES.minimal;
}

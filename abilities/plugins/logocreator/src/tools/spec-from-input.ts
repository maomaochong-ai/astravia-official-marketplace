import { DETAIL_LEVELS, LOGO_TYPES, STYLE_IDS, normalizeSpec, type LogoSpec } from "../domain/spec";

/**
 * The agent-facing shape of a spec.
 *
 * Tools receive JSON from a model, so every field is optional and every unknown
 * value has to fall back rather than throw — a slightly wrong style should still
 * produce a logo. `normalizeSpec` owns the actual coercion; this only renames the
 * two fields where the model's natural word differs from ours.
 */
export interface DesignToolInput {
	brandName?: string;
	tagline?: string;
	type?: string;
	style?: string;
	detail?: string;
	/** Hex, or "auto". */
	colour?: string;
	primary?: string;
	surface?: string;
	monochrome?: boolean;
	intent?: string;
	seed?: number;
}

export interface DesignToolPayload extends DesignToolInput {
	count?: number;
	directory?: string;
}

export function specFromInput(input: DesignToolInput): LogoSpec {
	return normalizeSpec({
		brandName: input.brandName,
		tagline: input.tagline,
		type: input.type as LogoSpec["type"],
		style: input.style as LogoSpec["style"],
		detail: input.detail as LogoSpec["detail"],
		primary: input.primary ?? input.colour,
		surface: input.surface as LogoSpec["surface"],
		monochrome: input.monochrome,
		intent: input.intent,
		seed: input.seed,
	});
}

/** JSON-schema fragment shared by the two generative tools. */
export const DESIGN_PROPERTIES = {
	brandName: { type: "string", description: "The brand or company name, 1–48 characters." },
	tagline: { type: "string", description: "Optional second line, at most 64 characters." },
	type: {
		type: "string",
		enum: [...LOGO_TYPES],
		description:
			"icon-name (mark above the wordmark), icon (mark only), wordmark (type only), monogram (initials), emblem (badge with the name on an arc), abstract (pure geometry).",
	},
	style: {
		type: "string",
		enum: [...STYLE_IDS],
		description: "minimal, geometric, gradient, mascot, hand-drawn, luxury, retro, 3d.",
	},
	detail: { type: "string", enum: [...DETAIL_LEVELS], description: "How much ornament the mark carries." },
	colour: {
		type: "string",
		description: "A 6-digit hex such as #2F6FF5, or \"auto\" to let the engine pick a fitting palette from the brief.",
	},
	surface: {
		type: "string",
		enum: ["light", "dark", "transparent"],
		description: "Background the default export is composed on.",
	},
	monochrome: { type: "boolean", description: "Draw the mark in a single ink." },
	intent: {
		type: "string",
		description:
			"Freeform brief. Plain nouns work best: \"a leaf mark for a plant nursery\", \"a cup for a roastery\". The engine matches the first subject word it recognises (leaf, cup, wave, mountain, flame, aperture, orbit, shield, gear, book, paw, creature, sun, moon, spark, droplet, house, pillar, cross, note, wing, compass, heart, hex, link, knot).",
	},
	seed: { type: "integer", minimum: 0, description: "Pin the variation. Same seed + same fields = same logo, byte for byte." },
	count: { type: "integer", minimum: 1, maximum: 8, description: "How many variations to write (default 3)." },
	directory: {
		type: "string",
		description: "Folder inside the workspace. Defaults to \"logos\" under the session working directory.",
	},
} as const;

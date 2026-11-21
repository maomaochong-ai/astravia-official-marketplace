/**
 * The one value a saved logo is built from.
 *
 * A design is a *spec*, never a picture: `renderLogo(spec)` is a pure function,
 * so the history store keeps kilobytes and the exports can be regenerated at any
 * size without keeping the bitmap around. Anything that cannot be re-derived
 * from these fields does not belong in a spec.
 */

export const LOGO_TYPES = ["icon-name", "icon", "wordmark", "monogram", "emblem", "abstract"] as const;
export type LogoType = (typeof LOGO_TYPES)[number];

export const STYLE_IDS = ["minimal", "geometric", "gradient", "mascot", "hand-drawn", "luxury", "retro", "3d"] as const;
export type StyleId = (typeof STYLE_IDS)[number];

export const DETAIL_LEVELS = ["minimal", "balanced", "detailed"] as const;
export type DetailLevel = (typeof DETAIL_LEVELS)[number];

/** The surface the exported default is composed on. */
export const SURFACES = ["light", "dark", "transparent"] as const;
export type Surface = (typeof SURFACES)[number];

/** Sentinel for "let the engine choose". */
export const AUTO = "auto";

export interface LogoSpec {
	/** 1–48 characters; longer input is truncated by `normalizeSpec`. */
	brandName: string;
	/** Optional second line under the wordmark — empty when unset. */
	tagline: string;
	type: LogoType;
	style: StyleId;
	detail: DetailLevel;
	/** `AUTO` or a 6-digit hex. */
	primary: string;
	surface: Surface;
	monochrome: boolean;
	/** Freeform brief. Biases motif choice and the AI prompt; never rendered. */
	intent: string;
	/** 32-bit; the only source of variation between marks of one spec. */
	seed: number;
}

export const MAX_NAME_LENGTH = 48;
export const MAX_TAGLINE_LENGTH = 64;
export const MAX_INTENT_LENGTH = 400;

export const DEFAULT_SPEC: LogoSpec = {
	brandName: "",
	tagline: "",
	type: "icon-name",
	style: "minimal",
	detail: "balanced",
	primary: AUTO,
	surface: "light",
	monochrome: false,
	intent: "",
	seed: 1,
};

function clip(value: unknown, max: number): string {
	if (typeof value !== "string") return "";
	return value.trim().slice(0, max);
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
	return allowed.includes(value as T) ? (value as T) : fallback;
}

/**
 * Coerce anything (a restored history record, an agent tool's JSON, a form) into
 * a valid spec. Out-of-range values fall back to the default rather than throw:
 * a slightly wrong spec still renders a usable mark, a thrown error leaves the
 * user with an empty panel.
 */
export function normalizeSpec(input: Partial<LogoSpec> | null | undefined): LogoSpec {
	const source = input ?? {};
	const seed = Number(source.seed);
	return {
		brandName: clip(source.brandName, MAX_NAME_LENGTH),
		tagline: clip(source.tagline, MAX_TAGLINE_LENGTH),
		type: oneOf(source.type, LOGO_TYPES, DEFAULT_SPEC.type),
		style: oneOf(source.style, STYLE_IDS, DEFAULT_SPEC.style),
		detail: oneOf(source.detail, DETAIL_LEVELS, DEFAULT_SPEC.detail),
		primary: typeof source.primary === "string" && source.primary.trim() ? source.primary.trim() : AUTO,
		surface: oneOf(source.surface, SURFACES, DEFAULT_SPEC.surface),
		monochrome: source.monochrome === true,
		intent: clip(source.intent, MAX_INTENT_LENGTH),
		seed: Number.isFinite(seed) ? Math.abs(Math.trunc(seed)) >>> 0 : DEFAULT_SPEC.seed,
	};
}

/** The label a design is listed under. Never empty, so the gallery has a name. */
export function displayName(spec: LogoSpec): string {
	return spec.brandName || "Untitled";
}

/** Stable cache key: two specs that render identically share a key. */
export function specKey(spec: LogoSpec): string {
	const normalized = normalizeSpec(spec);
	return [
		normalized.brandName,
		normalized.tagline,
		normalized.type,
		normalized.style,
		normalized.detail,
		normalized.primary,
		normalized.surface,
		normalized.monochrome ? "mono" : "colour",
		normalized.intent,
		normalized.seed,
	].join("|");
}

/** Derive a sibling spec — same brand, different number. Used for variations. */
export function respin(spec: LogoSpec, seed: number): LogoSpec {
	return { ...spec, seed: Math.abs(Math.trunc(seed)) >>> 0 };
}

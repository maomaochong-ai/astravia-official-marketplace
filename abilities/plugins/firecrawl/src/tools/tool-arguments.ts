/**
 * Tool argument coercion.
 *
 * Tool input crosses a JSON boundary from the model, so every field is treated
 * as untrusted: numbers get clamped to a documented range, arrays are trimmed,
 * and URLs must be absolute http(s). The same bounds are mirrored in the JSON
 * schema descriptions so the model sees them.
 */

export class ToolArgumentError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ToolArgumentError";
	}
}

export interface Bounds {
	min: number;
	max: number;
	def: number;
}

export function readString(input: unknown, key: string): string | undefined {
	if (!input || typeof input !== "object") return undefined;
	const value = (input as Record<string, unknown>)[key];
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim();
	return trimmed ? trimmed : undefined;
}

export function requireUrl(input: unknown, key = "url"): string {
	const raw = readString(input, key);
	if (!raw) throw new ToolArgumentError(`"${key}" is required (absolute http/https URL)`);
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		throw new ToolArgumentError(`"${key}" must be an absolute URL, got "${raw}"`);
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") {
		throw new ToolArgumentError(`"${key}" must use http or https, got "${url.protocol}"`);
	}
	url.hash = "";
	return url.toString();
}

export function readNumber(input: unknown, key: string, bounds: Bounds): number {
	if (!input || typeof input !== "object") return bounds.def;
	const value = (input as Record<string, unknown>)[key];
	if (value === undefined || value === null) return bounds.def;
	const numeric = typeof value === "number" ? value : Number(value);
	if (!Number.isFinite(numeric)) {
		throw new ToolArgumentError(`"${key}" must be a number between ${bounds.min} and ${bounds.max}`);
	}
	return Math.min(bounds.max, Math.max(bounds.min, Math.round(numeric)));
}

export function readBoolean(input: unknown, key: string, def: boolean): boolean {
	if (!input || typeof input !== "object") return def;
	const value = (input as Record<string, unknown>)[key];
	return typeof value === "boolean" ? value : def;
}

export function readStringArray(input: unknown, key: string, max = 20): string[] {
	if (!input || typeof input !== "object") return [];
	const value = (input as Record<string, unknown>)[key];
	if (!Array.isArray(value)) return [];
	return value
		.filter((entry): entry is string => typeof entry === "string")
		.map((entry) => entry.trim())
		.filter(Boolean)
		.slice(0, max);
}

/** Rejects patterns that would throw inside the matcher, with a readable message. */
export function compilePatterns(patterns: readonly string[]): RegExp[] {
	return patterns.map((pattern) => {
		try {
			return new RegExp(pattern);
		} catch (error) {
			throw new ToolArgumentError(
				`Invalid path pattern "${pattern}": ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	});
}

export function clip(value: string, max: number): string {
	if (value.length <= max) return value;
	return `${value.slice(0, max)}\n\n[... truncated ${value.length - max} characters]`;
}

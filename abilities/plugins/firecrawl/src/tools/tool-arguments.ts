/**
 * Tool argument coercion.
 *
 * Tool input crosses a JSON boundary from the model, so every field is treated
 * as untrusted: numbers get clamped to a documented range, arrays are trimmed,
 * and URLs must be absolute http(s). The same bounds are mirrored in the JSON
 * schema descriptions so the model sees them.
 */

import type { BrowserAction } from "../domain/render/types";

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

/** Raw `attributes` argument: a selector list, or `"a@href,h2"`. */
export function readAttributesInput(input: unknown): unknown {
	if (!input || typeof input !== "object") return undefined;
	return (input as Record<string, unknown>).attributes;
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

export function readOptionalString(input: unknown, key: string): string | null {
	return readString(input, key) ?? null;
}

const HEADER_NAME = /^[A-Za-z0-9!#$%&'*+.^_`|~-]{1,64}$/;
const MAX_HEADER_VALUE = 2_000;

/**
 * Request headers from either an object or a JSON string.
 *
 * Rejects anything the host transport would refuse later, and rejects header
 * values containing CR/LF so a caller cannot smuggle a second request.
 */
export function readHeaders(input: unknown, key = "headers", max = 20): Record<string, string> {
	if (!input || typeof input !== "object") return {};
	const raw = (input as Record<string, unknown>)[key];
	if (raw === undefined || raw === null || raw === "") return {};

	let source: unknown = raw;
	if (typeof raw === "string") {
		try {
			source = JSON.parse(raw);
		} catch {
			throw new ToolArgumentError(`"${key}" must be an object or a JSON object string`);
		}
	}
	if (!source || typeof source !== "object" || Array.isArray(source)) {
		throw new ToolArgumentError(`"${key}" must be an object of header name → string value`);
	}

	const entries = Object.entries(source as Record<string, unknown>);
	if (entries.length > max) throw new ToolArgumentError(`"${key}" accepts at most ${max} headers`);

	const headers: Record<string, string> = {};
	for (const [name, value] of entries) {
		if (!HEADER_NAME.test(name)) throw new ToolArgumentError(`Invalid header name "${name}"`);
		const text = typeof value === "string" ? value : typeof value === "number" ? String(value) : null;
		if (text === null) throw new ToolArgumentError(`Header "${name}" must have a string value`);
		if (/[\r\n]/.test(text)) throw new ToolArgumentError(`Header "${name}" must not contain line breaks`);
		if (text.length > MAX_HEADER_VALUE) throw new ToolArgumentError(`Header "${name}" is longer than ${MAX_HEADER_VALUE} characters`);
		headers[name] = text;
	}
	return headers;
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

/** Reads one of a fixed vocabulary, ignoring unknown values (the model sees the enum). */
export function readEnum<T extends string>(input: unknown, key: string, allowed: readonly T[], def: T): T {
	const value = readString(input, key);
	if (!value) return def;
	return (allowed as readonly string[]).includes(value) ? (value as T) : def;
}

export function readEnumArray<T extends string>(input: unknown, key: string, allowed: readonly T[], max = 8): T[] {
	const raw = readStringArray(input, key, max);
	const values: T[] = [];
	for (const entry of raw) {
		if ((allowed as readonly string[]).includes(entry) && !values.includes(entry as T)) values.push(entry as T);
	}
	return values;
}

/** A JSON object argument coming from the model (JSON Schema, extracted shape). */
export function readJsonObject(input: unknown, key: string): Record<string, unknown> | undefined {
	if (!input || typeof input !== "object") return undefined;
	const value = (input as Record<string, unknown>)[key];
	if (value === undefined || value === null) return undefined;
	if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
	if (typeof value === "string") {
		try {
			const parsed: unknown = JSON.parse(value);
			if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
		} catch {
			// fall through to the readable error below
		}
	}
	throw new ToolArgumentError(`"${key}" must be a JSON object`);
}

const MAX_ACTIONS = 10;

/**
 * Validates firecrawl-style `actions[]`.
 *
 * The host browser's `act()` accepts a closed vocabulary; anything unknown is a
 * caller mistake we must catch here, with the action index, not a runtime throw
 * halfway through a page interaction.
 */
export function readActions(input: unknown, key = "actions"): BrowserAction[] {
	if (!input || typeof input !== "object") return [];
	const value = (input as Record<string, unknown>)[key];
	if (value === undefined || value === null) return [];
	if (!Array.isArray(value)) throw new ToolArgumentError(`"${key}" must be an array of action objects`);
	const actions: BrowserAction[] = [];
	for (const [index, entry] of value.slice(0, MAX_ACTIONS).entries()) {
		if (!entry || typeof entry !== "object") throw new ToolArgumentError(`"${key}[${index}]" must be an object`);
		const record = entry as Record<string, unknown>;
		const type = typeof record.type === "string" ? record.type : "";
		const target = typeof record.target === "string" ? record.target.trim() : "";
		const text = typeof record.value === "string" ? record.value : "";
		switch (type) {
			case "click":
				if (!target) throw new ToolArgumentError(`"${key}[${index}].target" is required for click`);
				actions.push({ type: "click", target });
				break;
			case "fill":
			case "type":
			case "select":
				if (!target) throw new ToolArgumentError(`"${key}[${index}].target" is required for ${type}`);
				actions.push({ type, target, value: text });
				break;
			case "check":
				actions.push({ type: "check", target, checked: record.checked !== false });
				break;
			case "press": {
				const combo = target || text || (typeof record.key === "string" ? record.key : "");
				if (!combo) throw new ToolArgumentError(`"${key}[${index}].key" is required for press`);
				actions.push({ type: "press", key: combo });
				break;
			}
			case "scroll": {
				const direction = record.direction === "up" || record.direction === "left" || record.direction === "right" ? record.direction : "down";
				const amount = typeof record.amount === "number" && Number.isFinite(record.amount) ? Math.min(10, Math.max(1, Math.round(record.amount))) : undefined;
				actions.push({ type: "scroll", direction, amount });
				break;
			}
			case "wait": {
				const milliseconds = typeof record.milliseconds === "number" && Number.isFinite(record.milliseconds)
					? Math.min(60_000, Math.max(0, Math.round(record.milliseconds)))
					: undefined;
				actions.push({ type: "wait", milliseconds, target: target || undefined });
				break;
			}
			case "back":
				actions.push({ type: "back" });
				break;
			case "reload":
				actions.push({ type: "reload" });
				break;
			default:
				throw new ToolArgumentError(
					`"${key}[${index}].type" must be one of click, fill, type, select, check, press, scroll, wait, back, reload`,
				);
		}
	}
	return actions;
}

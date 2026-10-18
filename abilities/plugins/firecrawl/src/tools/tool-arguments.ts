/**
 * Tool argument coercion.
 *
 * Tool input crosses a JSON boundary from the model, so every field is treated
 * as untrusted: numbers get clamped to a documented range, arrays are trimmed,
 * and URLs must be absolute http(s). The same bounds are mirrored in the JSON
 * schema descriptions so the model sees them.
 */

export type ScrapeAction =
	| { type: "click"; selector: string; all?: boolean }
	| { type: "write"; text: string }
	| { type: "press"; key: string }
	| { type: "scroll"; direction?: "up" | "down" | "left" | "right"; selector?: string }
	| { type: "wait"; milliseconds: number }
	| { type: "wait"; selector: string }
	| { type: "screenshot"; fullPage?: boolean; quality?: number; viewport?: { width: number; height: number } }
	| { type: "scrape" }
	| { type: "executeJavascript"; script: string }
	| { type: "pdf"; format?: string; landscape?: boolean; scale?: number };

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

/** Distinguishes "not set" from "explicitly false" for options whose upstream default is true. */
export function readOptionalBoolean(input: unknown, key: string): boolean | undefined {
	if (!input || typeof input !== "object") return undefined;
	const value = (input as Record<string, unknown>)[key];
	return typeof value === "boolean" ? value : undefined;
}

/** Raw `attributes` argument: a selector list, or `"a@href,h2"`. */
export function readAttributesInput(input: unknown): unknown {
	if (!input || typeof input !== "object") return undefined;
	return (input as Record<string, unknown>).attributes;
}

const MAX_SELECTORS = 20;

/**
 * Normalises the `attributes` argument into upstream's selector objects.
 *
 * Accepts `"h1, a@href"`, `["h1", "a@href"]` and `[{ selector, attribute }]`.
 */
export function readAttributeSelectors(input: unknown): Array<{ selector: string; attribute: string }> {
	const raw = readAttributesInput(input);
	if (raw === undefined || raw === null) return [];
	const selectors: Array<{ selector: string; attribute: string }> = [];
	const push = (selector: string, attribute: string): void => {
		const cleanSelector = selector.trim();
		if (!cleanSelector || selectors.length >= MAX_SELECTORS) return;
		const cleanAttribute = attribute.trim() || "text";
		if (selectors.some((entry) => entry.selector === cleanSelector && entry.attribute === cleanAttribute)) return;
		selectors.push({ selector: cleanSelector, attribute: cleanAttribute });
	};
	const fromString = (value: string): void => {
		for (const part of value.split(",")) {
			const trimmed = part.trim();
			if (!trimmed) continue;
			const at = trimmed.lastIndexOf("@");
			if (at > 0) push(trimmed.slice(0, at), trimmed.slice(at + 1));
			else push(trimmed, "text");
		}
	};
	if (typeof raw === "string") fromString(raw);
	else if (Array.isArray(raw)) {
		for (const entry of raw) {
			if (typeof entry === "string") fromString(entry);
			else if (entry && typeof entry === "object") {
				const record = entry as Record<string, unknown>;
				if (typeof record.selector === "string") {
					push(record.selector, typeof record.attribute === "string" ? record.attribute : "text");
				}
			}
		}
	} else if (raw && typeof raw === "object") {
		const record = raw as Record<string, unknown>;
		if (typeof record.selector === "string") {
			push(record.selector, typeof record.attribute === "string" ? record.attribute : "text");
		}
	}
	return selectors;
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
const MAX_SCRIPT_CHARS = 20_000;
const ACTION_TYPES = "click, write, press, scroll, wait, screenshot, scrape, executeJavascript, pdf";

function actionText(record: Record<string, unknown>, ...keys: string[]): string {
	for (const key of keys) {
		const value = record[key];
		if (typeof value === "string" && value.trim()) return value.trim();
	}
	return "";
}

function actionString(record: Record<string, unknown>, key: string): string | undefined {
	const value = record[key];
	return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/**
 * Validates `actions[]` against the upstream action union.
 *
 * Upstream's vocabulary is the contract: click / write / press / scroll / wait /
 * screenshot / scrape / executeJavascript / pdf, all keyed on `selector` and
 * `text`. Older callers in this plugin's own history used `target`, `fill` and
 * `check`; `target` and `fill`/`type` are accepted as aliases, while actions
 * upstream cannot express (select, check, back, reload) fail loudly instead of
 * being silently dropped by the API.
 */
export function readActions(input: unknown, key = "actions"): ScrapeAction[] {
	if (!input || typeof input !== "object") return [];
	const value = (input as Record<string, unknown>)[key];
	if (value === undefined || value === null) return [];
	if (!Array.isArray(value)) throw new ToolArgumentError(`"${key}" must be an array of action objects`);
	const actions: ScrapeAction[] = [];
	for (const [index, entry] of value.slice(0, MAX_ACTIONS).entries()) {
		const prefix = `"${key}[${index}]"`;
		if (!entry || typeof entry !== "object") throw new ToolArgumentError(`${prefix} must be an object`);
		const record = entry as Record<string, unknown>;
		const type = typeof record.type === "string" ? record.type.trim() : "";
		const selector = actionText(record, "selector", "target");
		const text = actionText(record, "text", "value");
		switch (type) {
			case "click":
				if (!selector) throw new ToolArgumentError(`${prefix}.selector is required for click`);
				actions.push({ type: "click", selector, ...(record.all === true ? { all: true } : {}) });
				break;
			case "write":
			case "fill":
			case "type": {
				if (!text) throw new ToolArgumentError(`${prefix}.text is required for ${type}`);
				// Upstream writes into the focused element, so a targeted write is a
				// click followed by a write. Expand it here rather than dropping
				// either half of the caller's intent.
				if (selector && actions.length + 2 <= MAX_ACTIONS) {
					actions.push({ type: "click", selector }, { type: "write", text });
				} else if (selector) {
					throw new ToolArgumentError(`${prefix} needs a click before the write and would exceed ${MAX_ACTIONS} actions`);
				} else {
					actions.push({ type: "write", text });
				}
				break;
			}
			case "press": {
				const combo = actionText(record, "key", "text", "value") || selector;
				if (!combo) throw new ToolArgumentError(`${prefix}.key is required for press`);
				actions.push({ type: "press", key: combo });
				break;
			}
			case "scroll": {
				const direction =
					record.direction === "up" || record.direction === "left" || record.direction === "right" || record.direction === "down"
						? record.direction
						: undefined;
				const target = actionString(record, "selector") ?? actionString(record, "target");
				actions.push({ type: "scroll", ...(direction ? { direction } : {}), ...(target ? { selector: target } : {}) });
				break;
			}
			case "wait": {
				if (selector) {
					actions.push({ type: "wait", selector });
					break;
				}
				const milliseconds = typeof record.milliseconds === "number" && Number.isFinite(record.milliseconds) ? Math.round(record.milliseconds) : NaN;
				if (!Number.isFinite(milliseconds) || milliseconds < 1) {
					throw new ToolArgumentError(`${prefix} needs either "selector" or a positive "milliseconds"`);
				}
				actions.push({ type: "wait", milliseconds: Math.min(60_000, milliseconds) });
				break;
			}
			case "screenshot": {
				const quality =
					typeof record.quality === "number" && Number.isFinite(record.quality)
						? Math.min(100, Math.max(1, Math.round(record.quality)))
						: undefined;
				const rawViewport = record.viewport;
				const viewport =
					rawViewport && typeof rawViewport === "object" && typeof (rawViewport as Record<string, unknown>).width === "number" && typeof (rawViewport as Record<string, unknown>).height === "number"
						? {
								width: Math.max(1, Math.round((rawViewport as Record<string, number>).width)),
								height: Math.max(1, Math.round((rawViewport as Record<string, number>).height)),
							}
						: undefined;
				actions.push({
					type: "screenshot",
					...(record.fullPage === true ? { fullPage: true } : {}),
					...(quality !== undefined ? { quality } : {}),
					...(viewport ? { viewport } : {}),
				});
				break;
			}
			case "scrape":
				actions.push({ type: "scrape" });
				break;
			case "executeJavascript": {
				const script = actionText(record, "script");
				if (!script) throw new ToolArgumentError(`${prefix}.script is required for executeJavascript`);
				if (script.length > MAX_SCRIPT_CHARS) {
					throw new ToolArgumentError(`${prefix}.script is longer than ${MAX_SCRIPT_CHARS} characters`);
				}
				actions.push({ type: "executeJavascript", script });
				break;
			}
			case "pdf": {
				const format = actionString(record, "format");
				const scale = typeof record.scale === "number" && Number.isFinite(record.scale) ? Math.min(2, Math.max(0.1, record.scale)) : undefined;
				actions.push({
					type: "pdf",
					...(format ? { format } : {}),
					...(record.landscape === true ? { landscape: true } : {}),
					...(scale !== undefined ? { scale } : {}),
				});
				break;
			}
			case "":
				throw new ToolArgumentError(`${prefix}.type is required; one of ${ACTION_TYPES}`);
			default:
				throw new ToolArgumentError(
					`${prefix}.type "${type}" is not an upstream action; use one of ${ACTION_TYPES}. Selects, checkboxes, back and reload have no upstream action — use {"type":"executeJavascript","script":"…"} instead.`,
				);
		}
	}
	return actions;
}

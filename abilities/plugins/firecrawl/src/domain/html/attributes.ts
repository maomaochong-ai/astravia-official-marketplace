/**
 * `attributes` format: pull specific attributes out of matching elements.
 *
 * Upstream accepts `{ type: "attributes", selectors: [{selector, attribute}] }`
 * and returns `{ selector, attribute, values }[]`. The host renderer already
 * gives us a real `DOMParser`, so this is a direct `querySelectorAll` and needs
 * no extra dependency.
 */

import { parseHtml } from "./document";

export interface AttributeSelector {
	selector: string;
	/** `text` returns the trimmed text content; otherwise the attribute value. */
	attribute: string;
}

export interface AttributeResult {
	selector: string;
	attribute: string;
	values: string[];
}

const MAX_VALUES = 200;

/** Accepts `"a@href"`, `{selector, attribute}`, or a bare selector (text). */
export function coerceSelectors(raw: unknown, max = 20): AttributeSelector[] {
	if (raw === undefined || raw === null) return [];
	const list: AttributeSelector[] = [];
	const push = (selector: string, attribute: string): void => {
		if (selector.length === 0 || list.length >= max) return;
		if (list.some((entry) => entry.selector === selector && entry.attribute === attribute)) return;
		list.push({ selector, attribute: attribute.length > 0 ? attribute : "text" });
	};

	if (typeof raw === "string") {
		for (const part of raw.split(",")) {
			const trimmed = part.trim();
			if (trimmed.length === 0) continue;
			const at = trimmed.lastIndexOf("@");
			if (at > 0) push(trimmed.slice(0, at).trim(), trimmed.slice(at + 1).trim());
			else push(trimmed, "text");
		}
		return list;
	}

	if (Array.isArray(raw)) {
		for (const entry of raw) {
			if (typeof entry === "string") {
				const at = entry.lastIndexOf("@");
				if (at > 0) push(entry.slice(0, at).trim(), entry.slice(at + 1).trim());
				else push(entry.trim(), "text");
				continue;
			}
			if (entry && typeof entry === "object") {
				const record = entry as Record<string, unknown>;
				const selector = typeof record.selector === "string" ? record.selector.trim() : "";
				const attribute = typeof record.attribute === "string" ? record.attribute.trim() : "text";
				push(selector, attribute);
			}
		}
	}
	return list;
}

export function extractAttributes(
	html: string,
	baseUrl: string,
	selectors: readonly AttributeSelector[],
): AttributeResult[] {
	if (selectors.length === 0 || html.trim().length === 0) return [];
	const document = parseHtml(html, baseUrl);
	const results: AttributeResult[] = [];
	for (const { selector, attribute } of selectors) {
		let nodes: Element[];
		try {
			nodes = Array.from(document.querySelectorAll(selector));
		} catch {
			continue;
		}
		const values: string[] = [];
		for (const node of nodes) {
			const value =
				attribute === "text"
					? (node.textContent ?? "").trim()
					: attribute === "href" || attribute === "src"
						? resolve(node.getAttribute(attribute), baseUrl)
						: node.getAttribute(attribute);
			if (value === null || value === undefined) continue;
			const normalised = value.trim();
			if (normalised.length === 0 || values.includes(normalised)) continue;
			values.push(normalised);
			if (values.length >= MAX_VALUES) break;
		}
		results.push({ selector, attribute, values });
	}
	return results;
}

function resolve(raw: string | null, baseUrl: string): string | null {
	if (raw === null) return null;
	if (raw.length === 0) return raw;
	try {
		return new URL(raw, baseUrl).toString();
	} catch {
		return raw;
	}
}

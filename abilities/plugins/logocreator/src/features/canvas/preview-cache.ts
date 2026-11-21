import { renderLogo, type RenderOptions } from "../../domain/engine/compose";
import { previewUrl } from "../../domain/render-png";
import { normalizeSpec, type LogoSpec } from "../../domain/spec";

/**
 * Rendered-preview cache.
 *
 * Two places render the same spec repeatedly: the stage (on every edit) and the
 * result rail (once per stored design, on every store change). Each render is an SVG
 * string plus `encodeURIComponent` of that string — tens of kilobytes per tile — which
 * is where "宿主很卡" comes from once a few designs exist.
 *
 * Keyed by the whole spec plus the render options, so a cache hit is byte-identical to
 * a fresh render. Bounded, because the panel can be open for hours.
 */

const MAX_ENTRIES = 48;
const cache = new Map<string, { svg: string; url: string }>();

function keyOf(spec: LogoSpec, options: RenderOptions): string {
	const normalized = normalizeSpec(spec);
	const salt = options.idSalt ?? "";
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
		options.markOnly ? "mark" : "lockup",
		options.monoInk ?? "",
		salt,
	].join("|");
}

export function cachedRender(spec: LogoSpec, options: RenderOptions = {}): { svg: string; url: string } {
	const key = keyOf(spec, options);
	const hit = cache.get(key);
	if (hit) return hit;

	const svg = renderLogo(spec, options).svg;
	const entry = { svg, url: previewUrl(svg) };
	// Oldest-first eviction: Map preserves insertion order.
	if (cache.size >= MAX_ENTRIES) {
		const oldest = cache.keys().next().value;
		if (oldest !== undefined) cache.delete(oldest);
	}
	cache.set(key, entry);
	return entry;
}


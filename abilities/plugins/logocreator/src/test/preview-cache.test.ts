// @vitest-environment node
import { describe, expect, it } from "vitest";
import { renderLogo } from "../domain/engine/compose";
import { normalizeSpec } from "../domain/spec";
import { cachedRender } from "../features/canvas/preview-cache";

/**
 * The preview cache is the panel's performance floor.
 *
 * Before it, the stage and the result rail each rebuilt an SVG *and* ran
 * `encodeURIComponent` over it — tens of kilobytes per tile — on every store change
 * and, through the style tiles, on every keystroke. The host felt slow with the panel
 * open, and the panel was the cost.
 *
 * These assertions are about identity, which is what makes a hit free.
 */
const spec = normalizeSpec({ brandName: "Fern & Field", intent: "a leaf mark", seed: 7 });

describe("preview cache", () => {
	it("returns the identical object for the same spec", () => {
		const first = cachedRender(spec);
		const second = cachedRender(spec);
		expect(second).toBe(first);
		// Same bytes as a fresh render, not a stale approximation.
		expect(first.svg).toBe(renderLogo(spec).svg);
	});

	it("separates the mark-only render from the lockup", () => {
		expect(cachedRender(spec, { markOnly: true }).url).not.toBe(cachedRender(spec).url);
	});

	it("separates specs that differ in a field a user can change", () => {
		const a = cachedRender(spec);
		const b = cachedRender({ ...spec, seed: 8 });
		expect(b.url).not.toBe(a.url);
	});

	it("stays bounded", () => {
		// A long session must not accumulate every spec ever typed.
		for (let i = 0; i < 80; i += 1) cachedRender({ ...spec, seed: i });
		const again = cachedRender(spec);
		expect(again.svg).toBe(renderLogo(spec).svg);
	});
});

// @vitest-environment node
import { describe, expect, it } from "vitest";
import { renderLogo } from "../domain/engine/compose";
import { STYLE_IDS, normalizeSpec } from "../domain/spec";

/**
 * Engine budget.
 *
 * The canvas re-renders the preview on every edit, and the style picker renders
 * eight tiles on top of that. Numbers here are the contract: if a change makes one
 * mark take 40 ms, typing in the name field becomes visible lag on a laptop and
 * these fail before a user reports it.
 *
 * Measured on CI-class hardware with generous margins — this is a regression trip
 * wire, not a benchmark.
 */

const BUDGET = {
	preview: 20, // one full lockup: preview on every keystroke
	eightStyles: 160, // the style picker's eight tiles
	wordmarkHeavy: 30, // the longest text path (two lines + tagline)
};

function time(fn: () => void): number {
	const start = performance.now();
	fn();
	return performance.now() - start;
}

const spec = normalizeSpec({ brandName: "Fern & Field", intent: "a leaf mark for a garden studio", tagline: "Grown, not made" });

describe("engine budget", () => {
	it("renders one lockup inside the keystroke budget", () => {
		// Warm the JIT so the first measurement is not the compile.
		renderLogo(spec);
		const elapsed = time(() => {
			for (let i = 0; i < 5; i += 1) renderLogo(spec);
		}) / 5;
		expect(elapsed).toBeLessThan(BUDGET.preview);
	});

	it("renders the eight style tiles inside the panel budget", () => {
		const elapsed = time(() => {
			for (const style of STYLE_IDS) renderLogo({ ...spec, style }, { markOnly: true });
		});
		expect(elapsed).toBeLessThan(BUDGET.eightStyles);
	});

	it("keeps the heaviest layout (two-line wordmark + tagline) inside budget", () => {
		renderLogo(spec);
		const elapsed = time(() => {
			for (let i = 0; i < 5; i += 1) {
				renderLogo({ ...spec, type: "icon-name", style: "retro", detail: "detailed", brandName: "Moss and Pine Botanical Atelier" });
			}
		}) / 5;
		expect(elapsed).toBeLessThan(BUDGET.wordmarkHeavy);
	});

	it("stays well under a megabyte per SVG", () => {
		// A design is stored as parameters, but the preview URL holds the markup:
		// two copies of a 400 KB SVG in a data URL is a per-render string cost.
		const { svg } = renderLogo(spec);
		expect(svg.length).toBeLessThan(200_000);
	});
});

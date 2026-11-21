import { describe, expect, it } from "vitest";
import { contrastRatio, ensureContrast, hexToRgb, hslToHex, luminance, mixHex, normalizeHex, rgbToHsl } from "../domain/palette";
import { extractPalette, resolvePalette } from "../domain/color-plan";
import { normalizeSpec } from "../domain/spec";

describe("colour maths", () => {
	it("normalises short and long hex forms", () => {
		expect(normalizeHex("#abc")).toBe("#AABBCC");
		expect(normalizeHex("2f6ff5")).toBe("#2F6FF5");
	});

	it("round-trips hex → hsl → hex within a channel of rounding", () => {
		for (const hex of ["#2F6FF5", "#E5484D", "#30A46C", "#14130F", "#FAF9F6"]) {
			const back = hslToHex(rgbToHsl(hexToRgb(hex)));
			const a = hexToRgb(hex);
			const b = hexToRgb(back);
			expect(Math.abs(a.r - b.r)).toBeLessThanOrEqual(2);
			expect(Math.abs(a.g - b.g)).toBeLessThanOrEqual(2);
			expect(Math.abs(a.b - b.b)).toBeLessThanOrEqual(2);
		}
	});

	it("computes WCAG contrast for black on white", () => {
		expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 1);
		expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 3);
	});

	it("raises a colour until it clears the floor", () => {
		const raised = ensureContrast("#EEEEEE", "#FFFFFF", 4.5);
		expect(contrastRatio(raised, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
	});

	it("mixes toward the target without leaving the sRGB cube", () => {
		const mixed = mixHex("#000000", "#FFFFFF", 0.5);
		expect(mixed).toBe("#808080");
	});

	it("reports luminance ordering", () => {
		expect(luminance("#FFFFFF")).toBeGreaterThan(luminance("#808080"));
	});
});

describe("palette plan", () => {
	it("gives an auto colour that reads on its surface", () => {
		const spec = normalizeSpec({ brandName: "Kettle Lane", intent: "a coffee roastery" });
		const palette = resolvePalette(spec);
		expect(contrastRatio(palette.ink, palette.surface)).toBeGreaterThanOrEqual(7);
		expect(contrastRatio(palette.muted, palette.surface)).toBeGreaterThanOrEqual(4);
	});

	it("is deterministic for the same spec", () => {
		const spec = normalizeSpec({ brandName: "Tidewell", style: "gradient" });
		expect(resolvePalette(spec).primary).toBe(resolvePalette(spec).primary);
	});

	it("keeps an explicit colour", () => {
		const palette = resolvePalette(normalizeSpec({ brandName: "Auric", primary: "#2F6FF5" }));
		expect(palette.primary).toBe("#2F6FF5");
	});

	it("collapses to one ink when monochrome is on", () => {
		const palette = resolvePalette(normalizeSpec({ brandName: "Auric", monochrome: true }));
		expect(palette.primary).toBe(palette.ink);
		expect(palette.secondary).not.toBe(palette.primary);
	});

	it("has no surface fill when the spec is transparent", () => {
		expect(resolvePalette(normalizeSpec({ brandName: "Vellum", surface: "transparent" })).surface).toBe("");
	});

	it("tunes for a dark surface", () => {
		const dark = resolvePalette(normalizeSpec({ brandName: "Ember Oak", surface: "dark" }));
		expect(dark.isDark).toBe(true);
		expect(contrastRatio(dark.ink, dark.surface)).toBeGreaterThanOrEqual(7);
	});
});

describe("palette extraction", () => {
	it("finds a saturated colour and skips the paper", () => {
		// 4 × 4 image: three near-white pixels, thirteen blue ones.
		const pixels = new Uint8ClampedArray(16 * 4);
		for (let i = 0; i < 16; i += 1) {
			const white = i < 3;
			pixels[i * 4] = white ? 250 : 30;
			pixels[i * 4 + 1] = white ? 249 : 110;
			pixels[i * 4 + 2] = white ? 246 : 245;
			pixels[i * 4 + 3] = 255;
		}
		const palette = extractPalette(pixels, 1);
		expect(palette.length).toBeGreaterThan(0);
		const hue = rgbToHsl(hexToRgb(palette[0])).h;
		expect(hue).toBeGreaterThan(180);
		expect(hue).toBeLessThan(250);
	});

	it("returns nothing for a flat grey image", () => {
		const pixels = new Uint8ClampedArray(8 * 4).fill(128);
		expect(extractPalette(pixels, 1)).toEqual([]);
	});
});

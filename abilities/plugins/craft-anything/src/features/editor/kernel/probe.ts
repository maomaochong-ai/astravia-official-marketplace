import type { CraftProbe } from "../../../domain/agent-report.ts";
import type { Rect } from "../../../domain/kernel-document.ts";

/**
 * Turning pixels into words.
 *
 * A tool result can only carry text, so the canvas is compressed into a letter map:
 * one letter per cell, plus the mean colour and how much the region varies. It is not
 * a screenshot — it answers "is anything there, and did my last action change it".
 *
 * ADR: docs/adr/<slug>/craft-0013-nothing-runs-in-the-background.md
 */

export interface PixelView {
	data: Uint8ClampedArray;
	width: number;
	height: number;
}

export type Region = "all" | "page" | "selection";

export function normalizeRegion(region: string | undefined): Region {
	if (region === "page") return "page";
	if (region === "selection") return "selection";
	return "all";
}

const LETTERS = "RYGCBM";

/** Six hue sectors, neutral greys for the middle, case carries the luma. */
export function hueLetter(r: number, g: number, b: number): string {
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const luma = 0.299 * r + 0.587 * g + 0.114 * b;

	if (max - min <= 20) {
		if (luma >= 236) return "W";
		if (luma <= 26) return "K";
		return luma >= 128 ? "w" : "k";
	}

	const dominant = max === r ? "R" : max === g ? "G" : "B";
	const middle = [r, g, b].filter((channel) => channel !== max).sort((a, b2) => b2 - a)[0];
	const lean = middle === r ? "R" : middle === g ? "G" : "B";
	const third = Math.min(r, g, b);
	const tie = Math.abs(middle - third) < (max - min) * 0.35;

	let index = 0;
	if (dominant === "R") index = lean === "G" || tie ? 0 : 5; // R or M
	else if (dominant === "G") index = lean === "B" || tie ? 2 : 1; // G or Y
	else index = lean === "R" || tie ? 5 : 3; // M or C

	let letter = LETTERS[index];
	if (dominant === "B" && (lean === "G" || tie)) letter = "C";
	if (dominant === "B" && lean === "R") letter = "M";
	if (dominant === "R" && lean === "B") letter = "M";
	if (dominant === "G" && lean === "R") letter = "Y";

	return luma >= 128 ? letter : letter.toLowerCase();
}

export function cellLetter(r: number, g: number, b: number): string {
	return hueLetter(r, g, b);
}

export function hex(value: number): string {
	return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");
}

export function colourDistance(a: readonly number[], b: readonly number[]): number {
	return Math.round(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]));
}

export interface ProbeOptions {
	region?: Region;
	columns?: number;
	rows?: number;
	/** The page rectangle inside the bitmap, in device pixels. */
	page?: Rect;
}

export function probePixels(view: PixelView, options: ProbeOptions = {}): CraftProbe {
	const region = options.region ?? "all";
	const page = options.page ?? { x: 0, y: 0, w: view.width, h: view.height };
	const box = region === "page" ? page : { x: 0, y: 0, w: view.width, h: view.height };

	const cols = Math.max(4, Math.min(64, Math.round(options.columns ?? 32)));
	const lines = Math.max(2, Math.min(36, Math.round(options.rows ?? 18)));

	const x0 = Math.max(0, Math.min(view.width - 1, Math.floor(box.x)));
	const y0 = Math.max(0, Math.min(view.height - 1, Math.floor(box.y)));
	const w = Math.max(1, Math.min(view.width - x0, Math.floor(box.w)));
	const h = Math.max(1, Math.min(view.height - y0, Math.floor(box.h)));

	const cells = cols * lines;
	let totalR = 0;
	let totalG = 0;
	let totalB = 0;
	let totalLuma = 0;
	let minLuma = 255;
	let maxLuma = 0;
	const rows: string[] = [];

	for (let row = 0; row < lines; row += 1) {
		let text = "";
		for (let col = 0; col < cols; col += 1) {
			const left = x0 + Math.floor((col * w) / cols);
			const right = Math.max(left + 1, x0 + Math.floor(((col + 1) * w) / cols));
			const top = y0 + Math.floor((row * h) / lines);
			const bottom = Math.max(top + 1, y0 + Math.floor(((row + 1) * h) / lines));
			// A handful of samples per cell, not every pixel: a 4K canvas must not
			// block the UI thread just to describe itself.
			const stepX = Math.max(1, Math.floor((right - left) / 4));
			const stepY = Math.max(1, Math.floor((bottom - top) / 4));
			let r = 0;
			let g = 0;
			let b = 0;
			let count = 0;
			for (let y = top; y < bottom; y += stepY) {
				for (let x = left; x < right; x += stepX) {
					const index = (Math.min(view.height - 1, y) * view.width + Math.min(view.width - 1, x)) * 4;
					r += view.data[index] ?? 0;
					g += view.data[index + 1] ?? 0;
					b += view.data[index + 2] ?? 0;
					count += 1;
				}
			}
			count = Math.max(1, count);
			r /= count;
			g /= count;
			b /= count;
			totalR += r;
			totalG += g;
			totalB += b;
			const luma = 0.299 * r + 0.587 * g + 0.114 * b;
			totalLuma += luma;
			minLuma = Math.min(minLuma, luma);
			maxLuma = Math.max(maxLuma, luma);
			text += cellLetter(r, g, b);
		}
		rows.push(text);
	}

	const meanRgb: [number, number, number] = [
		Math.round(totalR / cells),
		Math.round(totalG / cells),
		Math.round(totalB / cells),
	];

	return {
		region,
		columns: cols,
		rows: lines,
		cells: rows.join("\n"),
		mean: Math.round(totalLuma / cells),
		meanRgb,
		contrast: Math.round(((maxLuma - minLuma) / 255) * 100) / 100,
		width: w,
		height: h,
	};
}

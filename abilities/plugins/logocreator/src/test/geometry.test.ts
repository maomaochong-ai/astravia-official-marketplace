import { describe, expect, it } from "vitest";
import {
	arc,
	circle,
	nGon,
	polar,
	polyline,
	rect,
	ring,
	roundedRect,
	smooth,
	star,
	teeth,
} from "../domain/engine/geometry";

describe("geometry", () => {
	it("places points on a circle from degrees", () => {
		expect(polar(50, 50, 10, 0)).toEqual({ x: 60, y: 50 });
		expect(polar(50, 50, 10, 90)).toEqual({ x: 50, y: 60 });
		expect(polar(50, 50, 10, 180)).toEqual({ x: 40, y: 50 });
	});

	it("builds a full circle from two half arcs, never a degenerate arc", () => {
		const path = circle(50, 50, 20);
		expect(path).toBe("M30 50a20 20 0 1 0 40 0a20 20 0 1 0 -40 0Z");
	});

	it("rounds a rect's radius down to what actually fits", () => {
		// 20×20 with r=50 must not produce a radius larger than half the side.
		const path = roundedRect(0, 0, 20, 20, 50);
		expect(path).toContain("A10 10");
		expect(path.startsWith("M10 0")).toBe(true);
	});

	it("collapses a zero radius into a plain rect", () => {
		expect(roundedRect(1, 2, 10, 10, 0)).toBe(rect(1, 2, 10, 10));
	});

	it("closes polygons and stars", () => {
		expect(nGon(50, 50, 10, 3, -90).endsWith("Z")).toBe(true);
		expect(nGon(50, 50, 10, 3).match(/L/g)).toHaveLength(2);
		expect(star(50, 50, 10, 4, 5).match(/L/g)).toHaveLength(9);
	});

	it("draws a ring as two circles so even-odd fills leave a hole", () => {
		const path = ring(50, 50, 20, 10);
		expect(path.match(/Z/g)).toHaveLength(2);
	});

	it("emits a cubic segment count that matches the point count", () => {
		const points = [
			{ x: 0, y: 0 },
			{ x: 10, y: 10 },
			{ x: 20, y: 0 },
			{ x: 10, y: -10 },
		];
		expect(smooth(points, true).match(/C/g)).toHaveLength(4);
		expect(smooth(points, false).match(/C/g)).toHaveLength(3);
	});

	it("produces a closed sub-path per gear tooth", () => {
		expect(teeth(50, 50, 20, 30, 8, 10).match(/Z/g)).toHaveLength(8);
	});

	it("keeps every coordinate a finite number", () => {
		const paths = [
			arc(50, 50, 20, -30, 200),
			polyline([
				{ x: 1, y: 2 },
				{ x: 3, y: 4 },
			]),
			circle(0, 0, 1),
			star(50, 50, 40, 10, 12),
		];
		for (const path of paths) {
			expect(path).not.toMatch(/NaN|Infinity|undefined/);
			expect(path).toMatch(/^M/);
		}
	});
});

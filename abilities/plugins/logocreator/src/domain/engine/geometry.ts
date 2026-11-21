/**
 * Path construction for the mark box.
 *
 * Every motif draws inside a 0–100 square; the composer scales that into the
 * logo canvas. One coordinate space means a motif can be dropped into any layout
 * (mark-only, side-by-side, inside a badge) without rewriting it.
 *
 * You will not find string-surgery helpers here (translate/scale a finished path
 * string). Anything that changes a shape's geometry is applied to its points
 * before the path is built, which keeps every path a pure function of numbers.
 */

export interface Point {
	x: number;
	y: number;
}

export function round(value: number, places = 2): number {
	const factor = 10 ** places;
	return Math.round(value * factor) / factor;
}

export function polar(cx: number, cy: number, r: number, degrees: number): Point {
	const rad = (degrees * Math.PI) / 180;
	return { x: round(cx + r * Math.cos(rad)), y: round(cy + r * Math.sin(rad)) };
}

export function line(x1: number, y1: number, x2: number, y2: number): string {
	return `M${round(x1)} ${round(y1)}L${round(x2)} ${round(y2)}`;
}

export function polyline(points: readonly Point[], close = false): string {
	if (points.length === 0) return "";
	const head = `M${round(points[0].x)} ${round(points[0].y)}`;
	const rest = points
		.slice(1)
		.map((p) => `L${round(p.x)} ${round(p.y)}`)
		.join("");
	return close ? `${head}${rest}Z` : `${head}${rest}`;
}

/** Circular arc as a standalone path; `sweep` 1 draws clockwise on screen. */
export function arc(cx: number, cy: number, r: number, fromDeg: number, toDeg: number, sweep: 0 | 1 = 1): string {
	const start = polar(cx, cy, r, fromDeg);
	const end = polar(cx, cy, r, toDeg);
	const large = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0;
	return `M${start.x} ${start.y}A${round(r)} ${round(r)} 0 ${large} ${sweep} ${end.x} ${end.y}`;
}

/** Full circle from two half-arcs — no degenerate `A` start-to-same-point. */
export function circle(cx: number, cy: number, r: number): string {
	const rr = round(r);
	const left = round(cx - r);
	const top = round(cy);
	return `M${left} ${top}a${rr} ${rr} 0 1 0 ${round(r * 2)} 0a${rr} ${rr} 0 1 0 ${round(-r * 2)} 0Z`;
}

export function rect(x: number, y: number, w: number, h: number): string {
	return `M${round(x)} ${round(y)}H${round(x + w)}V${round(y + h)}H${round(x)}Z`;
}

export function roundedRect(x: number, y: number, w: number, h: number, r: number): string {
	const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
	if (radius <= 0.01) return rect(x, y, w, h);
	const rr = round(radius);
	return [
		`M${round(x + radius)} ${round(y)}`,
		`H${round(x + w - radius)}`,
		`A${rr} ${rr} 0 0 1 ${round(x + w)} ${round(y + radius)}`,
		`V${round(y + h - radius)}`,
		`A${rr} ${rr} 0 0 1 ${round(x + w - radius)} ${round(y + h)}`,
		`H${round(x + radius)}`,
		`A${rr} ${rr} 0 0 1 ${round(x)} ${round(y + h - radius)}`,
		`V${round(y + radius)}`,
		`A${rr} ${rr} 0 0 1 ${round(x + radius)} ${round(y)}`,
		"Z",
	].join("");
}

export function nGon(cx: number, cy: number, r: number, sides: number, rotationDeg = -90): string {
	const points = Array.from({ length: sides }, (_, i) => polar(cx, cy, r, rotationDeg + (360 / sides) * i));
	return polyline(points, true);
}

export function star(cx: number, cy: number, outer: number, inner: number, points = 5, rotationDeg = -90): string {
	const vertices = Array.from({ length: points * 2 }, (_, i) =>
		polar(cx, cy, i % 2 === 0 ? outer : inner, rotationDeg + (180 / points) * i),
	);
	return polyline(vertices, true);
}

/** An annulus as one even-odd path, so a ring can carry a gradient fill. */
export function ring(cx: number, cy: number, outer: number, inner: number): string {
	return `${circle(cx, cy, outer)}${circle(cx, cy, inner)}`;
}

/**
 * Catmull–Rom through the given points, emitted as cubic béziers. This is what
 * makes organic shapes (leaves, creatures, blobs) look drawn rather than
 * assembled out of straight segments.
 */
export function smooth(points: readonly Point[], close = true, tension = 1): string {
	if (points.length < 2) return "";
	const at = (i: number): Point => {
		if (close) return points[((i % points.length) + points.length) % points.length];
		return points[Math.max(0, Math.min(points.length - 1, i))];
	};
	let d = `M${round(points[0].x)} ${round(points[0].y)}`;
	const last = close ? points.length : points.length - 1;
	for (let i = 0; i < last; i += 1) {
		const p0 = at(i - 1);
		const p1 = at(i);
		const p2 = at(i + 1);
		const p3 = at(i + 2);
		const c1x = p1.x + ((p2.x - p0.x) / 6) * tension;
		const c1y = p1.y + ((p2.y - p0.y) / 6) * tension;
		const c2x = p2.x - ((p3.x - p1.x) / 6) * tension;
		const c2y = p2.y - ((p3.y - p1.y) / 6) * tension;
		d += `C${round(c1x)} ${round(c1y)} ${round(c2x)} ${round(c2y)} ${round(p2.x)} ${round(p2.y)}`;
	}
	return close ? `${d}Z` : d;
}

/** Nudge points so hand-drawn motifs do not look mechanical. */
export function jitter(points: readonly Point[], amount: number, next: () => number): Point[] {
	if (amount <= 0) return [...points];
	return points.map((p) => ({
		x: round(p.x + (next() - 0.5) * 2 * amount),
		y: round(p.y + (next() - 0.5) * 2 * amount),
	}));
}

export function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

export function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

/** Compass trisection used by the gear and aperture motifs. */
export function teeth(cx: number, cy: number, inner: number, outer: number, count: number, toothWidth: number): string {
	const segments: string[] = [];
	const step = 360 / count;
	for (let i = 0; i < count; i += 1) {
		const base = i * step;
		const a = polar(cx, cy, outer, base - toothWidth / 2);
		const b = polar(cx, cy, outer, base + toothWidth / 2);
		const c = polar(cx, cy, inner, base + step / 2 - toothWidth / 2);
		const d = polar(cx, cy, inner, base + step / 2 + toothWidth / 2);
		segments.push(polyline([a, b, c, d], true));
	}
	return segments.join("");
}

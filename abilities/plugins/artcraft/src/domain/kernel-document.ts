/**
 * The document model. Plain data plus pure functions — no React, no canvas, no DOM.
 *
 * Everything the editor and the agent can do to a page goes through here, which is
 * why `node --test` can exercise it without a browser: `applyMove` returns a new
 * document, and nothing else has to exist for that to be true.
 *
 * ADR: docs/adr/<slug>/craft-0011-the-engine-is-ours.md
 */

export type SurfaceMode = "canvas" | "sheet" | "doc" | "stage";

export type ShapeKind = "rect" | "ellipse" | "line" | "text" | "image";

export interface Point {
	x: number;
	y: number;
}

export interface Rect {
	x: number;
	y: number;
	w: number;
	h: number;
}

export interface Shape extends Rect {
	id: string;
	kind: ShapeKind;
	fill?: string;
	stroke?: string;
	strokeWidth?: number;
	radius?: number;
	opacity?: number;
	text?: string;
	fontSize?: number;
	fontWeight?: number;
	align?: "left" | "center" | "right";
	color?: string;
	/** Image data URL. Never a remote URL: the page must not need the network. */
	src?: string;
	name?: string;
	/** Ruled guides and seeded chrome: visible, never selectable by a pointer. */
	locked?: boolean;
	/** Two absolute page points, for `kind: "line"`. */
	points?: Point[];
}

export interface KernelDocument {
	schemaVersion: 1;
	mode: SurfaceMode;
	width: number;
	height: number;
	background: string;
	/** Back to front. Hit-testing walks this list in reverse. */
	shapes: Shape[];
}

export const LIMITS = {
	shapes: 600,
	imageBytes: 12 * 1024 * 1024,
	documentBytes: 24 * 1024 * 1024,
	textLength: 20000,
} as const;

let counter = 0;

export function nextId(): string {
	counter = (counter + 1) % 1296;
	return `s${counter.toString(36)}-${Date.now().toString(36).slice(-4)}`;
}

export function emptyDocument(
	mode: SurfaceMode,
	width: number,
	height: number,
	background = "#ffffff",
): KernelDocument {
	return { schemaVersion: 1, mode, width, height, background, shapes: [] };
}

export function rectOf(shape: Rect): Rect {
	return { x: shape.x, y: shape.y, w: shape.w, h: shape.h };
}

export function normalized(rect: Rect): Rect {
	return {
		x: rect.w < 0 ? rect.x + rect.w : rect.x,
		y: rect.h < 0 ? rect.y + rect.h : rect.y,
		w: Math.abs(rect.w),
		h: Math.abs(rect.h),
	};
}

export function boundsOf(shapes: readonly Shape[]): Rect | null {
	if (shapes.length === 0) return null;
	let left = Infinity;
	let top = Infinity;
	let right = -Infinity;
	let bottom = -Infinity;
	for (const shape of shapes) {
		const box = normalized(rectOf(shape));
		left = Math.min(left, box.x);
		top = Math.min(top, box.y);
		right = Math.max(right, box.x + box.w);
		bottom = Math.max(bottom, box.y + box.h);
	}
	return { x: left, y: top, w: right - left, h: bottom - top };
}

export function contains(rect: Rect, point: Point): boolean {
	const box = normalized(rect);
	return (
		point.x >= box.x &&
		point.x <= box.x + box.w &&
		point.y >= box.y &&
		point.y <= box.y + box.h
	);
}

export function intersects(a: Rect, b: Rect): boolean {
	const left = normalized(a);
	const right = normalized(b);
	return (
		left.x < right.x + right.w &&
		right.x < left.x + left.w &&
		left.y < right.y + right.h &&
		right.y < left.y + left.h
	);
}

function distanceToSegment(point: Point, from: Point, to: Point): number {
	const dx = to.x - from.x;
	const dy = to.y - from.y;
	const length = dx * dx + dy * dy;
	if (length === 0) return Math.hypot(point.x - from.x, point.y - from.y);
	const t = Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / length));
	return Math.hypot(point.x - (from.x + t * dx), point.y - (from.y + t * dy));
}

export function hitsShape(shape: Shape, point: Point): boolean {
	if (shape.kind === "line" && shape.points && shape.points.length >= 2) {
		const tolerance = Math.max(6, (shape.strokeWidth ?? 2) + 4);
		for (let index = 1; index < shape.points.length; index += 1) {
			if (distanceToSegment(point, shape.points[index - 1], shape.points[index]) <= tolerance) {
				return true;
			}
		}
		return false;
	}
	const box = normalized(rectOf(shape));
	if (shape.kind === "ellipse") {
		const rx = box.w / 2;
		const ry = box.h / 2;
		if (rx === 0 || ry === 0) return contains(rectOf(shape), point);
		const nx = (point.x - (box.x + rx)) / rx;
		const ny = (point.y - (box.y + ry)) / ry;
		return nx * nx + ny * ny <= 1;
	}
	return contains(rectOf(shape), point);
}

/** Topmost selectable shape under the point, or `null`. */
export function shapeAt(document: KernelDocument, point: Point): Shape | null {
	for (let index = document.shapes.length - 1; index >= 0; index -= 1) {
		const shape = document.shapes[index];
		if (shape.locked) continue;
		if (hitsShape(shape, point)) return shape;
	}
	return null;
}

export const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;

export type Handle = (typeof HANDLES)[number];

export function handlePoint(rect: Rect, handle: Handle): Point {
	const box = normalized(rect);
	const midX = box.x + box.w / 2;
	const midY = box.y + box.h / 2;
	switch (handle) {
		case "nw":
			return { x: box.x, y: box.y };
		case "n":
			return { x: midX, y: box.y };
		case "ne":
			return { x: box.x + box.w, y: box.y };
		case "e":
			return { x: box.x + box.w, y: midY };
		case "se":
			return { x: box.x + box.w, y: box.y + box.h };
		case "s":
			return { x: midX, y: box.y + box.h };
		case "sw":
			return { x: box.x, y: box.y + box.h };
		default:
			return { x: box.x, y: midY };
	}
}

export function handleAt(shape: Shape, point: Point, tolerance = 7): Handle | null {
	for (const handle of HANDLES) {
		const at = handlePoint(rectOf(shape), handle);
		if (Math.abs(point.x - at.x) <= tolerance && Math.abs(point.y - at.y) <= tolerance) {
			return handle;
		}
	}
	return null;
}

export function applyMove(shape: Shape, dx: number, dy: number): Shape {
	const moved: Shape = { ...shape, x: shape.x + dx, y: shape.y + dy };
	if (shape.kind === "line" && shape.points) {
		moved.points = shape.points.map((point) => ({ x: point.x + dx, y: point.y + dy }));
	}
	return moved;
}

export function applyResize(shape: Shape, handle: Handle, point: Point, minimum = 2): Shape {
	const box = normalized(rectOf(shape));
	let left = box.x;
	let top = box.y;
	let right = box.x + box.w;
	let bottom = box.y + box.h;

	if (handle.includes("w")) left = Math.min(point.x, right - minimum);
	if (handle.includes("e")) right = Math.max(point.x, left + minimum);
	if (handle.includes("n")) top = Math.min(point.y, bottom - minimum);
	if (handle.includes("s")) bottom = Math.max(point.y, top + minimum);

	return { ...shape, x: left, y: top, w: right - left, h: bottom - top };
}

/** Snap a value to the nearest target inside the tolerance, else leave it alone. */
export function snap(value: number, targets: readonly number[], tolerance = 6): number {
	let best = value;
	let bestDistance = tolerance + 1;
	for (const target of targets) {
		const distance = Math.abs(target - value);
		if (distance <= tolerance && distance < bestDistance) {
			best = target;
			bestDistance = distance;
		}
	}
	return best;
}

export function gridFor(mode: SurfaceMode): number {
	switch (mode) {
		case "sheet":
			return 28;
		case "doc":
			return 40;
		case "stage":
			return 60;
		default:
			return 10;
	}
}

const KIND_NAMES: Record<ShapeKind, string> = {
	rect: "矩形",
	ellipse: "椭圆",
	line: "直线",
	text: "文字",
	image: "图片",
};

export function defaultName(shape: Shape, index: number): string {
	return `${KIND_NAMES[shape.kind] ?? "对象"} ${index}`;
}

export function describeShape(shape: Shape): string {
	const box = normalized(rectOf(shape));
	const name = shape.name ?? KIND_NAMES[shape.kind] ?? "对象";
	const size = `${Math.round(box.w)}×${Math.round(box.h)}`;
	const position = `@${Math.round(box.x)},${Math.round(box.y)}`;
	const text = shape.text ? ` "${shape.text.slice(0, 24)}"` : "";
	return `${name}${text} ${size} ${position}`;
}

export function clampText(text: string): string {
	return text.length > LIMITS.textLength ? text.slice(0, LIMITS.textLength) : text;
}

export function withinLimits(document: KernelDocument): boolean {
	if (document.shapes.length > LIMITS.shapes) return false;
	for (const shape of document.shapes) {
		if (shape.kind === "image" && shape.src && shape.src.length > LIMITS.imageBytes) return false;
	}
	return true;
}

export function withShape(document: KernelDocument, shape: Shape): KernelDocument {
	return { ...document, shapes: [...document.shapes, shape] };
}

export function patchShape(
	document: KernelDocument,
	id: string,
	patch: Partial<Shape>,
): KernelDocument {
	return {
		...document,
		shapes: document.shapes.map((shape) => (shape.id === id ? { ...shape, ...patch, id: shape.id } : shape)),
	};
}

export function dropShapes(document: KernelDocument, ids: readonly string[]): KernelDocument {
	if (ids.length === 0) return document;
	const dropped = new Set(ids);
	return { ...document, shapes: document.shapes.filter((shape) => !dropped.has(shape.id)) };
}

/** `front` moves to the end of the list (drawn last), `back` to the start. */
export function reorder(
	document: KernelDocument,
	ids: readonly string[],
	where: "front" | "back" | "forward" | "backward",
): KernelDocument {
	if (ids.length === 0) return document;
	const picked = new Set(ids);
	const shapes = [...document.shapes];

	if (where === "front" || where === "back") {
		const moving = shapes.filter((shape) => picked.has(shape.id));
		const rest = shapes.filter((shape) => !picked.has(shape.id));
		return { ...document, shapes: where === "front" ? [...rest, ...moving] : [...moving, ...rest] };
	}

	// One adjacent swap per selected shape, so a repeated call walks the stack.
	if (where === "forward") {
		for (let index = shapes.length - 2; index >= 0; index -= 1) {
			if (picked.has(shapes[index].id) && !picked.has(shapes[index + 1].id)) {
				[shapes[index], shapes[index + 1]] = [shapes[index + 1], shapes[index]];
			}
		}
	} else {
		for (let index = 1; index < shapes.length; index += 1) {
			if (picked.has(shapes[index].id) && !picked.has(shapes[index - 1].id)) {
				[shapes[index], shapes[index - 1]] = [shapes[index - 1], shapes[index]];
			}
		}
	}
	return { ...document, shapes };
}

export type AlignMode = "left" | "center-x" | "right" | "top" | "middle" | "bottom" | "distribute-x" | "distribute-y";

export function align(shapes: readonly Shape[], mode: AlignMode): Shape[] {
	if (shapes.length < 2) return [...shapes];
	const box = boundsOf(shapes);
	if (!box) return [...shapes];

	if (mode === "distribute-x" || mode === "distribute-y") {
		const horizontal = mode === "distribute-x";
		const ordered = [...shapes].sort((a, b) =>
			horizontal ? rectOf(a).x - rectOf(b).x : rectOf(a).y - rectOf(b).y,
		);
		const span = horizontal ? box.w : box.h;
		const total = ordered.reduce((sum, shape) => sum + (horizontal ? shape.w : shape.h), 0);
		const gap = ordered.length > 1 ? (span - total) / (ordered.length - 1) : 0;
		let cursor = horizontal ? box.x : box.y;
		const placed = ordered.map((shape) => {
			const next = horizontal
				? { ...shape, x: cursor }
				: { ...shape, y: cursor };
			cursor += (horizontal ? shape.w : shape.h) + gap;
			return next;
		});
		return placed;
	}

	return shapes.map((shape) => {
		const own = normalized(rectOf(shape));
		switch (mode) {
			case "left":
				return { ...shape, x: box.x };
			case "center-x":
				return { ...shape, x: box.x + (box.w - own.w) / 2 };
			case "right":
				return { ...shape, x: box.x + box.w - own.w };
			case "top":
				return { ...shape, y: box.y };
			case "middle":
				return { ...shape, y: box.y + (box.h - own.h) / 2 };
			default:
				return { ...shape, y: box.y + box.h - own.h };
		}
	});
}

export function duplicate(shapes: readonly Shape[], offset = 16): Shape[] {
	return shapes.map((shape) => {
		const copy: Shape = { ...applyMove(shape, offset, offset), id: nextId() };
		if (shape.points) copy.points = shape.points.map((point) => ({ x: point.x + offset, y: point.y + offset }));
		return copy;
	});
}

export function serialize(document: KernelDocument): string {
	return JSON.stringify(document);
}

export function parse(text: string, fallback: KernelDocument): KernelDocument {
	try {
		const raw = JSON.parse(text) as Partial<KernelDocument>;
		if (!raw || !Array.isArray(raw.shapes)) return fallback;
		const shapes = raw.shapes.filter((shape): shape is Shape => {
			return (
				!!shape &&
				typeof shape.id === "string" &&
				typeof shape.kind === "string" &&
				["rect", "ellipse", "line", "text", "image"].includes(shape.kind) &&
				Number.isFinite(shape.x) &&
				Number.isFinite(shape.y) &&
				Number.isFinite(shape.w) &&
				Number.isFinite(shape.h)
			);
		});
		const mode = (["canvas", "sheet", "doc", "stage"] as const).includes(raw.mode as SurfaceMode)
			? (raw.mode as SurfaceMode)
			: fallback.mode;
		return {
			schemaVersion: 1,
			mode,
			width: Number.isFinite(raw.width) ? Number(raw.width) : fallback.width,
			height: Number.isFinite(raw.height) ? Number(raw.height) : fallback.height,
			background: typeof raw.background === "string" ? raw.background : fallback.background,
			shapes: shapes.slice(0, LIMITS.shapes),
		};
	} catch {
		return fallback;
	}
}

/** Locked guides, so a new sheet is not a blank page with no idea where to start. */
export function seedFor(mode: SurfaceMode, width: number, height: number): Shape[] {
	if (mode === "canvas") return [];
	const margin = mode === "doc" ? 72 : 48;
	const guides: Shape[] = [
		{
			id: nextId(),
			kind: "rect",
			x: margin,
			y: margin,
			w: width - margin * 2,
			h: height - margin * 2,
			fill: "transparent",
			stroke: "#cbd5f5",
			strokeWidth: 1,
			locked: true,
			name: "版心",
		},
	];
	if (mode === "sheet") {
		guides.push({
			id: nextId(),
			kind: "rect",
			x: margin,
			y: margin,
			w: width - margin * 2,
			h: 44,
			fill: "#f1f5f9",
			locked: true,
			name: "表头",
		});
	}
	if (mode === "doc") {
		guides.push({
			id: nextId(),
			kind: "text",
			x: margin,
			y: margin,
			w: width - margin * 2,
			h: 48,
			text: "标题",
			fontSize: 30,
			fontWeight: 700,
			color: "#0f172a",
			locked: true,
			name: "标题占位",
		});
	}
	return guides;
}

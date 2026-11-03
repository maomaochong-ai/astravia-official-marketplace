import {
	normalized,
	rectOf,
	type KernelDocument,
	type Rect,
	type Shape,
} from "../../../domain/kernel-document.ts";

/**
 * Painting. One function draws the page, another draws the chrome — so the editor
 * and the PNG export go through exactly the same code and cannot disagree.
 *
 * ADR: docs/adr/<slug>/craft-0012-chinese-is-rendered-here.md
 */

export interface View {
	zoom: number;
	panX: number;
	panY: number;
	dpr: number;
}

export interface Paint {
	background: string;
	accent: string;
	grid: number;
}

/**
 * The font stack is the whole Chinese story: no bundled face, no runtime
 * translation — each desktop platform already ships a CJK face, we just ask for it.
 */
export const FONT_STACK =
	'"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", "Source Han Sans SC", system-ui, -apple-system, "Segoe UI", sans-serif';

export const ACCENT = "#2f6df6";

export function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number): void {
	const r = Math.max(0, Math.min(radius, Math.abs(w) / 2, Math.abs(h) / 2));
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.lineTo(x + w - r, y);
	ctx.quadraticCurveTo(x + w, y, x + w, y + r);
	ctx.lineTo(x + w, y + h - r);
	ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
	ctx.lineTo(x + r, y + h);
	ctx.quadraticCurveTo(x, y + h, x, y + h - r);
	ctx.lineTo(x, y + r);
	ctx.quadraticCurveTo(x, y, x + r, y);
	ctx.closePath();
}

export function paintGuides(
	ctx: CanvasRenderingContext2D,
	document: KernelDocument,
	paint: Paint,
	zoom: number,
): void {
	const step = paint.grid;
	if (step < 4 || document.width / step > 400) return;
	ctx.save();
	ctx.lineWidth = 1 / zoom;
	ctx.strokeStyle = "rgba(148,163,184,0.16)";
	for (let x = step; x < document.width; x += step) {
		ctx.beginPath();
		ctx.moveTo(x, 0);
		ctx.lineTo(x, document.height);
		ctx.stroke();
	}
	for (let y = step; y < document.height; y += step) {
		ctx.beginPath();
		ctx.moveTo(0, y);
		ctx.lineTo(document.width, y);
		ctx.stroke();
	}
	ctx.restore();
}

function lines(text: string, maxWidth: number, measure: (value: string) => number): string[] {
	const out: string[] = [];
	for (const paragraph of text.split("\n")) {
		let line = "";
		for (const char of Array.from(paragraph)) {
			const candidate = line + char;
			if (line && measure(candidate) > maxWidth) {
				out.push(line);
				line = char;
			} else {
				line = candidate;
			}
		}
		out.push(line);
	}
	return out;
}

function paintText(ctx: CanvasRenderingContext2D, shape: Shape): void {
	const box = normalized(rectOf(shape));
	const size = shape.fontSize ?? 18;
	const lineHeight = Math.round(size * 1.5);
	ctx.save();
	ctx.font = `${shape.fontWeight ?? 400} ${size}px ${FONT_STACK}`;
	ctx.fillStyle = shape.color ?? shape.fill ?? "#0f172a";
	ctx.textBaseline = "top";
	const align = shape.align ?? "left";
	ctx.textAlign = align === "center" ? "center" : align === "right" ? "right" : "left";
	const originX = align === "center" ? box.x + box.w / 2 : align === "right" ? box.x + box.w : box.x;
	const rows = lines(shape.text ?? "", box.w, (value) => ctx.measureText(value).width);
	rows.forEach((row, index) => {
		const y = box.y + index * lineHeight;
		if (y > box.y + box.h) return;
		ctx.fillText(row, originX, y);
	});
	ctx.restore();
}

export function paintShape(ctx: CanvasRenderingContext2D, shape: Shape, images: Map<string, HTMLImageElement>): void {
	const box = normalized(rectOf(shape));
	const alpha = shape.opacity ?? 1;
	ctx.save();
	ctx.globalAlpha = alpha;

	if (shape.kind === "line") {
		const points = shape.points ?? [
			{ x: shape.x, y: shape.y },
			{ x: shape.x + shape.w, y: shape.y + shape.h },
		];
		ctx.strokeStyle = shape.stroke ?? shape.fill ?? "#0f172a";
		ctx.lineWidth = shape.strokeWidth ?? 2;
		ctx.lineCap = "round";
		ctx.beginPath();
		points.forEach((point, index) => (index === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y)));
		ctx.stroke();
		ctx.restore();
		return;
	}

	if (shape.kind === "text") {
		paintText(ctx, shape);
		ctx.restore();
		return;
	}

	if (shape.kind === "image" && shape.src) {
		const image = images.get(shape.id);
		if (image && image.complete) {
			ctx.save();
			rounded(ctx, box.x, box.y, box.w, box.h, shape.radius ?? 0);
			ctx.clip();
			ctx.drawImage(image, box.x, box.y, box.w, box.h);
			ctx.restore();
		} else {
			ctx.fillStyle = "#e2e8f0";
			rounded(ctx, box.x, box.y, box.w, box.h, shape.radius ?? 0);
			ctx.fill();
		}
		ctx.restore();
		return;
	}

	rounded(ctx, box.x, box.y, box.w, box.h, shape.kind === "ellipse" ? Math.max(box.w, box.h) : (shape.radius ?? 0));
	if (shape.kind === "ellipse") {
		ctx.beginPath();
		ctx.ellipse(box.x + box.w / 2, box.y + box.h / 2, box.w / 2, box.h / 2, 0, 0, Math.PI * 2);
	}
	if (shape.fill && shape.fill !== "transparent") {
		ctx.fillStyle = shape.fill;
		ctx.fill();
	}
	if (shape.stroke) {
		ctx.strokeStyle = shape.stroke;
		ctx.lineWidth = shape.strokeWidth ?? 1.5;
		ctx.stroke();
	}
	ctx.restore();
}

export function paintSelection(
	ctx: CanvasRenderingContext2D,
	box: Rect,
	zoom: number,
	accent: string,
	withHandles: boolean,
): void {
	const rect = normalized(box);
	ctx.save();
	ctx.strokeStyle = accent;
	ctx.lineWidth = 1.5 / zoom;
	ctx.setLineDash([6 / zoom, 4 / zoom]);
	ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
	ctx.setLineDash([]);
	if (withHandles) {
		const size = 7 / zoom;
		for (const [fx, fy] of [
			[0, 0],
			[0.5, 0],
			[1, 0],
			[1, 0.5],
			[1, 1],
			[0.5, 1],
			[0, 1],
			[0, 0.5],
		]) {
			ctx.fillStyle = "#ffffff";
			ctx.fillRect(rect.x + rect.w * fx - size / 2, rect.y + rect.h * fy - size / 2, size, size);
			ctx.strokeRect(rect.x + rect.w * fx - size / 2, rect.y + rect.h * fy - size / 2, size, size);
		}
	}
	ctx.restore();
}

export function drawDocument(
	ctx: CanvasRenderingContext2D,
	document: KernelDocument,
	view: View,
	paint: Paint,
	images: Map<string, HTMLImageElement> = new Map(),
	selected: readonly Shape[] = [],
	marquee: Rect | null = null,
): void {
	const dpr = view.dpr || 1;
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
	ctx.setTransform(dpr * view.zoom, 0, 0, dpr * view.zoom, dpr * view.panX, dpr * view.panY);

	// The page itself, with a shadow so it reads as a sheet on a desk.
	ctx.save();
	ctx.shadowColor = "rgba(15,23,42,0.18)";
	ctx.shadowBlur = 24 / view.zoom;
	ctx.shadowOffsetY = 6 / view.zoom;
	ctx.fillStyle = document.background;
	ctx.fillRect(0, 0, document.width, document.height);
	ctx.restore();

	ctx.save();
	ctx.beginPath();
	ctx.rect(0, 0, document.width, document.height);
	ctx.clip();
	paintGuides(ctx, document, paint, view.zoom);
	for (const shape of document.shapes) paintShape(ctx, shape, images);
	ctx.restore();

	ctx.save();
	ctx.strokeStyle = "rgba(148,163,184,0.5)";
	ctx.lineWidth = 1 / view.zoom;
	ctx.strokeRect(0, 0, document.width, document.height);
	ctx.restore();

	if (selected.length > 0) {
		const boxes = selected.map((shape) => normalized(rectOf(shape)));
		for (const box of boxes) paintSelection(ctx, box, view.zoom, paint.accent, selected.length === 1);
	}

	if (marquee) {
		const box = normalized(marquee);
		ctx.save();
		ctx.fillStyle = "rgba(47,109,246,0.10)";
		ctx.strokeStyle = paint.accent;
		ctx.lineWidth = 1 / view.zoom;
		ctx.fillRect(box.x, box.y, box.w, box.h);
		ctx.strokeRect(box.x, box.y, box.w, box.h);
		ctx.restore();
	}
}

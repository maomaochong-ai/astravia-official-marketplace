import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
	normalized,
	rectOf,
	type Point,
	type Rect,
	type Shape,
	type SurfaceMode,
} from "../../../domain/kernel-document.ts";
import type { KernelEngine } from "./engine.ts";
import { drawDocument } from "./render.ts";
import { surfacePreset, TOOL_CURSORS } from "./presets.ts";
import type { EditorStrings } from "../strings.ts";

/**
 * The canvas: pointers in, pixels out.
 *
 * It holds no document of its own. Every gesture is translated into an engine call,
 * and the engine's version bump is what redraws — so a batch the agent runs and a drag
 * the user makes go through the same path.
 */

interface KernelCanvasProps {
	engine: KernelEngine;
	version: number;
	strings: EditorStrings;
}

interface Editing {
	id: string;
	value: string;
	box: Rect;
	fontSize: number;
}

export function KernelCanvas({ engine, version, strings }: KernelCanvasProps) {
	const wrapRef = useRef<HTMLDivElement | null>(null);
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const imagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
	const pointRef = useRef<Point | null>(null);
	const panRef = useRef<{ x: number; y: number; origin: Point } | null>(null);
	const marqueeRef = useRef<Point | null>(null);
	const [marquee, setMarquee] = useState<Rect | null>(null);
	const [editing, setEditing] = useState<Editing | null>(null);
	const [imageTick, setImageTick] = useState(0);

	const toPage = useCallback(
		(clientX: number, clientY: number): Point => {
			const canvas = canvasRef.current;
			if (!canvas) return { x: 0, y: 0 };
			const rect = canvas.getBoundingClientRect();
			const pan = engine.pan();
			const zoom = engine.zoom();
			return { x: (clientX - rect.left - pan.x) / zoom, y: (clientY - rect.top - pan.y) / zoom };
		},
		[engine],
	);

	const draw = useCallback(() => {
		const canvas = canvasRef.current;
		const ctx = canvas?.getContext("2d");
		if (!canvas || !ctx) return;
		const document = engine.document();
		const dpr = window.devicePixelRatio || 1;
		drawDocument(
			ctx,
			document,
			{ zoom: engine.zoom(), panX: engine.pan().x, panY: engine.pan().y, dpr },
			{ background: document.background, accent: presetPalette(engine), grid: gridOf(document.mode) },
			imagesRef.current,
			engine.selectedShapes(),
			marquee,
		);
	}, [engine, marquee]);

	// Pixel and PNG sources live on the canvas, but the engine is what the agent
	// talks to: register them once and the probe/save ops just work.
	useLayoutEffect(() => {
		engine.setPixelSource(() => {
			const canvas = canvasRef.current;
			const ctx = canvas?.getContext("2d");
			if (!canvas || !ctx) return null;
			const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
			return { data: data.data, width: canvas.width, height: canvas.height };
		});
		engine.setPngSource(() => {
			const canvas = canvasRef.current;
			return canvas ? canvas.toDataURL("image/png") : null;
		});
		return () => {
			engine.setPixelSource(null);
			engine.setPngSource(null);
		};
	}, [engine]);

	useEffect(() => {
		const wrap = wrapRef.current;
		const canvas = canvasRef.current;
		if (!wrap || !canvas) return;

		const resize = () => {
			const dpr = window.devicePixelRatio || 1;
			const box = wrap.getBoundingClientRect();
			canvas.width = Math.max(1, Math.round(box.width * dpr));
			canvas.height = Math.max(1, Math.round(box.height * dpr));
			canvas.style.width = `${box.width}px`;
			canvas.style.height = `${box.height}px`;
			const first = engine.zoom() === 1 && engine.pan().x === 0 && engine.pan().y === 0;
			engine.setViewport(box.width, box.height);
			if (first) engine.fit();
			else draw();
		};

		resize();
		const observer = new ResizeObserver(resize);
		observer.observe(wrap);
		return () => observer.disconnect();
	}, [engine, draw]);

	useEffect(() => {
		draw();
	}, [draw, version, imageTick]);

	// Images are decoded once and cached by shape id; a failed load is not fatal, the
	// painter draws a placeholder so the layout stays honest.
	useEffect(() => {
		const document = engine.document();
		let pending = false;
		for (const shape of document.shapes) {
			if (shape.kind !== "image" || !shape.src) continue;
			if (imagesRef.current.has(shape.id)) continue;
			const image = new Image();
			image.onload = () => {
				setImageTick((tick) => tick + 1);
			};
			image.src = shape.src;
			imagesRef.current.set(shape.id, image);
			pending = true;
		}
		if (pending) setImageTick((tick) => tick + 1);
	}, [engine, version]);

	const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		canvas.setPointerCapture(event.pointerId);

		if (event.button === 1 || event.altKey) {
			panRef.current = { x: engine.pan().x, y: engine.pan().y, origin: { x: event.clientX, y: event.clientY } };
			return;
		}
		if (event.button !== 0) return;

		const point = toPage(event.clientX, event.clientY);
		pointRef.current = point;
		const tool = engine.tool();

		if (tool !== "select") {
			if (tool === "image") {
				void pickImage(engine, point);
				engine.setTool("select");
				return;
			}
			engine.insert(tool, {}, point);
			engine.setTool("select");
			return;
		}

		const handle = engine.handleFor(point);
		const hit = engine.hit(point);
		engine.beginDrag(point, event.shiftKey);
		if (!handle && !hit) marqueeRef.current = point;
	};

	const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
		const pan = panRef.current;
		if (pan) {
			engine.setPan(pan.x + (event.clientX - pan.origin.x), pan.y + (event.clientY - pan.origin.y));
			return;
		}
		const point = toPage(event.clientX, event.clientY);
		const start = marqueeRef.current;
		if (start) {
			setMarquee(normalized({ x: start.x, y: start.y, w: point.x - start.x, h: point.y - start.y }));
			return;
		}
		if (!pointRef.current) return;
		engine.dragTo(point);
	};

	const onPointerUp = () => {
		panRef.current = null;
		const start = marqueeRef.current;
		if (start && marquee) {
			engine.selectInRect(marquee);
		}
		marqueeRef.current = null;
		setMarquee(null);
		pointRef.current = null;
		engine.endDrag();
	};

	const onDoubleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
		const point = toPage(event.clientX, event.clientY);
		const hit = engine.hit(point);
		if (!hit) return;
		if (hit.kind === "text") {
			beginTextEdit(hit);
			return;
		}
		engine.select([hit.id]);
	};

	const beginTextEdit = (shape: Shape) => {
		engine.beginEdit();
		engine.select([shape.id]);
		setEditing({ id: shape.id, value: shape.text ?? "", box: rectOf(shape), fontSize: shape.fontSize ?? 24 });
	};

	const commitText = () => {
		if (!editing) return;
		engine.update(editing.id, { text: editing.value });
		engine.endEdit();
		engine.setEditing(null);
		setEditing(null);
	};

	const onWheel = (event: React.WheelEvent<HTMLCanvasElement>) => {
		event.preventDefault();
		if (event.ctrlKey || event.metaKey) {
			engine.zoomBy(event.deltaY > 0 ? 0.92 : 1.08);
			return;
		}
		const pan = engine.pan();
		engine.setPan(pan.x - event.deltaX, pan.y - event.deltaY);
	};

	const onDrop = (event: React.DragEvent<HTMLCanvasElement>) => {
		event.preventDefault();
		const file = event.dataTransfer.files?.[0];
		if (!file || !file.type.startsWith("image/")) return;
		const point = toPage(event.clientX, event.clientY);
		const reader = new FileReader();
		reader.onload = () => {
			const src = typeof reader.result === "string" ? reader.result : "";
			if (!src) return;
			engine.insert("image", { src, w: 320, h: 240 }, point);
		};
		reader.readAsDataURL(file);
	};

	const zoom = engine.zoom();

	return (
		<div ref={wrapRef} className="relative h-full w-full overflow-hidden bg-[#f1f3f8]">
			<canvas
				ref={canvasRef}
				className="absolute inset-0 touch-none"
				style={{ cursor: TOOL_CURSORS[engine.tool()] ?? "default" }}
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={onPointerUp}
				onPointerCancel={onPointerUp}
				onDoubleClick={onDoubleClick}
				onWheel={onWheel}
				onDragOver={(event) => event.preventDefault()}
				onDrop={onDrop}
			/>

			{editing && (
				<textarea
					autoFocus
					value={editing.value}
					onChange={(event) => setEditing({ ...editing, value: event.target.value })}
					onBlur={commitText}
					onKeyDown={(event) => {
						if (event.key === "Escape") {
							engine.endEdit();
							engine.setEditing(null);
							setEditing(null);
							return;
						}
						if (event.key === "Enter" && !event.shiftKey) {
							event.preventDefault();
							commitText();
						}
					}}
					style={{
						position: "absolute",
						left: `${editing.box.x * zoom + engine.pan().x}px`,
						top: `${editing.box.y * zoom + engine.pan().y}px`,
						width: `${Math.max(120, editing.box.w * zoom)}px`,
						height: `${Math.max(32, editing.box.h * zoom)}px`,
						fontSize: `${editing.fontSize * zoom}px`,
						lineHeight: 1.5,
					}}
					className="resize-none rounded-md border border-[#2f6df6] bg-white/95 p-1 text-[#0f172a] shadow-lg outline-none"
				/>
			)}

			{engine.document().shapes.every((shape) => shape.locked) && (
				<p className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-white/85 px-3 py-1 text-[12px] text-[#64748b] shadow-sm">
					{strings.canvasHint}
				</p>
			)}
		</div>
	);
}

function presetPalette(engine: KernelEngine): string {
	const preset = surfacePreset(engine.document().mode);
	return preset.palette[0] ?? "#2f6df6";
}

function gridOf(mode: SurfaceMode): number {
	return mode === "sheet" ? 28 : mode === "doc" ? 40 : mode === "stage" ? 60 : 10;
}

export async function pickImage(engine: KernelEngine, point: Point): Promise<void> {
	if (typeof document === "undefined") return;
	const input = document.createElement("input");
	input.type = "file";
	input.accept = "image/*";
	input.onchange = () => {
		const file = input.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => {
			const src = typeof reader.result === "string" ? reader.result : "";
			if (src) engine.insert("image", { src, w: 320, h: 240 }, point);
		};
		reader.readAsDataURL(file);
	};
	input.click();
}

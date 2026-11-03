import type { CraftChange, CraftProbe } from "../../../domain/agent-report.ts";
import { changedSince } from "../../../domain/agent-report.ts";
import {
	align as alignShapes,
	applyMove,
	applyResize,
	boundsOf,
	defaultName,
	describeShape,
	dropShapes,
	duplicate,
	emptyDocument,
	gridFor,
	handleAt,
	handlePoint,
	intersects,
	hitsShape,
	nextId,
	type AlignMode,
	type Handle,
	type KernelDocument,
	type Point,
	type Rect,
	rectOf,
	type Shape,
	type ShapeKind,
	type SurfaceMode,
	clampText,
	patchShape,
	reorder as reorderShapes,
	serialize,
	snap,
	withinLimits,
	withShape,
} from "../../../domain/kernel-document.ts";
import type { ToolId } from "./presets.ts";
import { surfacePreset } from "./presets.ts";
import { normalizeRegion, probePixels, type PixelView, type Region } from "./probe.ts";

/**
 * The engine. One instance per open tab, registered so the agent tools can reach the
 * same document the pointer is editing.
 *
 * It owns state and nothing else: no timers, no animation loop, no network. A change
 * calls `emit()` and whoever is listening repaints — which is why closing the tab
 * really does stop everything.
 *
 * ADR: docs/adr/<slug>/craft-0011-the-engine-is-ours.md
 */

export interface EngineOptions {
	mode: SurfaceMode;
	width: number;
	height: number;
	background: string;
	accent: string;
	grid?: number;
}

export interface EngineSnapshot {
	document: KernelDocument;
	selection: string[];
	tool: ToolId;
	zoom: number;
	dirty: boolean;
	saved: boolean;
}

export interface ActStep {
	op: string;
	label?: string;
	/** Page fractions, 0–1. Only `click` / `drag` / `move` use them. */
	x?: number;
	y?: number;
	x2?: number;
	y2?: number;
	kind?: ShapeKind;
	patch?: Partial<Shape>;
	text?: string;
	key?: string;
	ids?: string[];
	mode?: string;
	ms?: number;
	region?: string;
	columns?: number;
	rows?: number;
	save?: boolean;
	name?: string;
}

export interface ActStepResult {
	index: number;
	op: string;
	label: string;
	ok: boolean;
	note?: string;
}

export interface ActReport {
	ok: boolean;
	steps: ActStepResult[];
	elapsedMs: number;
	selection: string[];
	shapes: number;
	change: CraftChange;
	probe: CraftProbe | null;
}

const HISTORY = 80;

function frame(): Promise<void> {
	return new Promise((resolve) => {
		if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => resolve());
		else setTimeout(resolve, 16);
	});
}

function defaults(kind: ShapeKind, at: Point, accent: string): Shape {
	const id = nextId();
	switch (kind) {
		case "ellipse":
			return { id, kind, x: at.x - 80, y: at.y - 80, w: 160, h: 160, fill: accent, opacity: 0.9 };
		case "line":
			return {
				id,
				kind,
				x: at.x - 90,
				y: at.y,
				w: 180,
				h: 0,
				stroke: accent,
				strokeWidth: 3,
				points: [
					{ x: at.x - 90, y: at.y },
					{ x: at.x + 90, y: at.y },
				],
			};
		case "text":
			return {
				id,
				kind,
				x: at.x - 120,
				y: at.y - 20,
				w: 240,
				h: 40,
				text: "文字",
				fontSize: 24,
				color: "#0f172a",
			};
		case "image":
			return { id, kind, x: at.x - 120, y: at.y - 90, w: 240, h: 180, radius: 8 };
		default:
			return { id, kind, x: at.x - 120, y: at.y - 80, w: 240, h: 160, fill: accent, radius: 12, opacity: 0.9 };
	}
}

export class KernelEngine {
	private readonly options: EngineOptions;
	private doc: KernelDocument;
	private selected: string[] = [];
	private activeTool: ToolId = "select";
	private undoStack: KernelDocument[] = [];
	private redoStack: KernelDocument[] = [];
	private dragBase: KernelDocument | null = null;
	private editBase: KernelDocument | null = null;
	private dragOrigin: Point | null = null;
	private dragMode: { kind: "move" } | { kind: "resize"; handle: Handle } | { kind: "marquee" } | null = null;
	private zoomValue = 1;
	private panValue: Point = { x: 0, y: 0 };
	private viewport = { w: 0, h: 0 };
	private pixelSource: (() => PixelView | null) | null = null;
	private pngSource: (() => string | null) | null = null;
	private listeners = new Set<() => void>();
	private version = 0;
	private savedJson = "";
	private editing: string | null = null;

	onProgress?: (progress: { index: number; total: number; label: string }) => void;

	constructor(options: EngineOptions) {
		this.options = options;
		this.doc = emptyDocument(options.mode, options.width, options.height, options.background);
		this.savedJson = serialize(this.doc);
	}

	// ---- state ----------------------------------------------------------------

	document(): KernelDocument {
		return this.doc;
	}

	versionOf(): number {
		return this.version;
	}

	setDocument(next: KernelDocument): void {
		if (!withinLimits(next)) return;
		this.pushHistory();
		this.doc = next;
		this.selected = this.selected.filter((id) => next.shapes.some((shape) => shape.id === id));
		this.emit();
	}

	selection(): string[] {
		return [...this.selected];
	}

	selectedShapes(): Shape[] {
		return this.doc.shapes.filter((shape) => this.selected.includes(shape.id));
	}

	select(ids: readonly string[]): void {
		const allowed = new Set(this.doc.shapes.filter((shape) => !shape.locked).map((shape) => shape.id));
		this.selected = [...new Set(ids)].filter((id) => allowed.has(id));
		this.emit();
	}

	selectAll(): void {
		this.select(this.doc.shapes.filter((shape) => !shape.locked).map((shape) => shape.id));
	}

	/** Rubber-band selection: every unlocked shape that touches the box. */
	selectInRect(box: Rect, additive = false): void {
		const inside = this.doc.shapes
			.filter((shape) => !shape.locked && intersects(rectOf(shape), box))
			.map((shape) => shape.id);
		this.select(additive ? [...this.selected, ...inside] : inside);
	}

	clearSelection(): void {
		if (this.selected.length === 0) return;
		this.selected = [];
		this.emit();
	}

	tool(): ToolId {
		return this.activeTool;
	}

	setTool(tool: ToolId): void {
		this.activeTool = tool;
		this.emit();
	}

	dirty(): boolean {
		return serialize(this.doc) !== this.savedJson;
	}

	markSaved(): void {
		this.savedJson = serialize(this.doc);
		this.emit();
	}

	zoom(): number {
		return this.zoomValue;
	}

	setZoom(zoom: number): void {
		this.zoomValue = Math.max(0.2, Math.min(4, zoom));
		this.emit();
	}

	zoomBy(factor: number): void {
		this.setZoom(this.zoomValue * factor);
	}

	pan(): Point {
		return { ...this.panValue };
	}

	setPan(x: number, y: number): void {
		this.panValue = { x, y };
		this.emit();
	}

	setViewport(w: number, h: number): void {
		this.viewport = { w, h };
	}

	/** Fit the page into the viewport with a comfortable margin, then centre it. */
	fit(): void {
		const { w, h } = this.viewport;
		if (w <= 0 || h <= 0) return;
		const zoom = Math.min(1, Math.min((w - 96) / this.doc.width, (h - 96) / this.doc.height));
		this.zoomValue = Math.max(0.2, Math.min(4, zoom));
		this.panValue = {
			x: (w - this.doc.width * this.zoomValue) / 2,
			y: (h - this.doc.height * this.zoomValue) / 2,
		};
		this.emit();
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	private emit(): void {
		this.version += 1;
		for (const listener of this.listeners) listener();
	}

	private pushHistory(): void {
		this.undoStack.push(this.doc);
		if (this.undoStack.length > HISTORY) this.undoStack.shift();
		this.redoStack = [];
	}

	canUndo(): boolean {
		return this.undoStack.length > 0;
	}

	canRedo(): boolean {
		return this.redoStack.length > 0;
	}

	undo(): void {
		const previous = this.undoStack.pop();
		if (!previous) return;
		this.redoStack.push(this.doc);
		this.doc = previous;
		this.selected = this.selected.filter((id) => previous.shapes.some((shape) => shape.id === id));
		this.emit();
	}

	redo(): void {
		const next = this.redoStack.pop();
		if (!next) return;
		this.undoStack.push(this.doc);
		this.doc = next;
		this.emit();
	}

	private apply(next: KernelDocument, history = true): void {
		if (!withinLimits(next)) return;
		if (history) this.pushHistory();
		this.doc = next;
		this.emit();
	}

	// ---- geometry -------------------------------------------------------------

	/** Page fractions to page coordinates: `0.5, 0.5` is the middle of the page. */
	point(fx: number | undefined, fy: number | undefined): Point {
		return { x: (fx ?? 0.5) * this.doc.width, y: (fy ?? 0.5) * this.doc.height };
	}

	hit(point: Point): Shape | null {
		for (let index = this.doc.shapes.length - 1; index >= 0; index -= 1) {
			const shape = this.doc.shapes[index];
			if (shape.locked) continue;
			if (hitsShape(shape, point)) return shape;
		}
		return null;
	}

	handleFor(point: Point): Handle | null {
		const only = this.selectedShapes();
		if (only.length !== 1) return null;
		return handleAt(only[0], point);
	}

	selectionBox(): Point[] {
		const box = boundsOf(this.selectedShapes());
		return box ? [{ x: box.x, y: box.y }, { x: box.x + box.w, y: box.y + box.h }] : [];
	}

	// ---- editing --------------------------------------------------------------

	insert(kind: ShapeKind, patch: Partial<Shape> = {}, at?: Point): Shape {
		const base = defaults(kind, at ?? { x: this.doc.width / 2, y: this.doc.height / 2 }, this.options.accent);
		const shape: Shape = { ...base, ...patch, id: nextId(), kind };
		if (shape.text) shape.text = clampText(shape.text);
		if (!shape.name) shape.name = defaultName(shape, this.doc.shapes.length + 1);
		this.apply(withShape(this.doc, shape));
		this.selected = [shape.id];
		this.emit();
		return shape;
	}

	update(id: string, patch: Partial<Shape>, history = true): void {
		this.apply(patchShape(this.doc, id, patch), history);
	}

	patchSelection(patch: Partial<Shape>, history = true): void {
		if (this.selected.length === 0) return;
		let next = this.doc;
		for (const id of this.selected) next = patchShape(next, id, patch);
		this.apply(next, history);
	}

	remove(): void {
		if (this.selected.length === 0) return;
		this.apply(dropShapes(this.doc, this.selected));
		this.selected = [];
		this.emit();
	}

	duplicateSelection(): void {
		const copies = duplicate(this.selectedShapes());
		if (copies.length === 0) return;
		let next = this.doc;
		for (const copy of copies) next = withShape(next, copy);
		this.apply(next);
		this.selected = copies.map((shape) => shape.id);
		this.emit();
	}

	alignSelection(mode: AlignMode): void {
		const chosen = this.selectedShapes();
		if (chosen.length < 2) return;
		const placed = alignShapes(chosen, mode);
		const byId = new Map(placed.map((shape) => [shape.id, shape]));
		this.apply({ ...this.doc, shapes: this.doc.shapes.map((shape) => byId.get(shape.id) ?? shape) });
	}

	reorderSelection(where: "front" | "back" | "forward" | "backward"): void {
		if (this.selected.length === 0) return;
		this.apply(reorderShapes(this.doc, this.selected, where));
	}

	nudge(dx: number, dy: number): void {
		const chosen = this.selectedShapes();
		if (chosen.length === 0) return;
		const moved = new Map(chosen.map((shape) => [shape.id, applyMove(shape, dx, dy)]));
		this.apply({ ...this.doc, shapes: this.doc.shapes.map((shape) => moved.get(shape.id) ?? shape) });
	}

	beginDrag(point: Point, additive = false): void {
		const handle = this.handleFor(point);
		this.dragBase = this.doc;
		this.dragOrigin = point;
		this.dragMode = handle ? { kind: "resize", handle } : { kind: "move" };

		if (!handle) {
			const hit = this.hit(point);
			if (hit) {
				if (additive) {
					this.selected = this.selected.includes(hit.id)
						? this.selected.filter((id) => id !== hit.id)
						: [...this.selected, hit.id];
				} else if (!this.selected.includes(hit.id)) {
					this.selected = [hit.id];
				}
				this.emit();
			} else if (!additive) {
				this.dragMode = { kind: "marquee" };
				this.selected = [];
				this.emit();
			}
		}
	}

	dragTo(point: Point): void {
		if (!this.dragMode || !this.dragOrigin || !this.dragBase) return;
		const dx = point.x - this.dragOrigin.x;
		const dy = point.y - this.dragOrigin.y;

		if (this.dragMode.kind === "marquee") {
			this.emit();
			return;
		}

		if (this.dragMode.kind === "resize") {
			const only = this.dragBase.shapes.filter((shape) => this.selected.includes(shape.id));
			if (only.length !== 1) return;
			const resized = applyResize(only[0], this.dragMode.handle, point);
			this.doc = patchShape(this.dragBase, only[0].id, resized);
			this.emit();
			return;
		}

		const grid = gridFor(this.doc.mode);
		const snappedX = snap(dx, [Math.round(dx / grid) * grid], grid / 2);
		const snappedY = snap(dy, [Math.round(dy / grid) * grid], grid / 2);
		const moved = new Map(
			this.dragBase.shapes
				.filter((shape) => this.selected.includes(shape.id))
				.map((shape) => [shape.id, applyMove(shape, snappedX, snappedY)]),
		);
		this.doc = { ...this.dragBase, shapes: this.dragBase.shapes.map((shape) => moved.get(shape.id) ?? shape) };
		this.emit();
	}

	endDrag(): void {
		if (!this.dragBase) return;
		const base = this.dragBase;
		const changed = base !== this.doc;
		this.dragBase = null;
		this.dragMode = null;
		this.dragOrigin = null;
		if (changed) {
			this.undoStack.push(base);
			if (this.undoStack.length > HISTORY) this.undoStack.shift();
			this.redoStack = [];
		}
		this.emit();
	}

	beginEdit(): void {
		this.editBase = this.doc;
	}

	endEdit(): void {
		if (!this.editBase) return;
		const base = this.editBase;
		this.editBase = null;
		if (base !== this.doc) {
			this.undoStack.push(base);
			if (this.undoStack.length > HISTORY) this.undoStack.shift();
			this.redoStack = [];
		}
		this.emit();
	}

	editingId(): string | null {
		return this.editing;
	}

	setEditing(id: string | null): void {
		this.editing = id;
		this.emit();
	}

	// ---- pixels ---------------------------------------------------------------

	setPixelSource(source: (() => PixelView | null) | null): void {
		this.pixelSource = source;
	}

	setPngSource(source: (() => string | null) | null): void {
		this.pngSource = source;
	}

	png(): string | null {
		return this.pngSource ? this.pngSource() : null;
	}

	probe(options: { region?: Region | string; columns?: number; rows?: number } = {}): CraftProbe | null {
		const view = this.pixelSource ? this.pixelSource() : null;
		if (!view) return null;
		return probePixels(view, {
			region: normalizeRegion(options.region as string | undefined),
			columns: options.columns,
			rows: options.rows,
		});
	}

	// ---- batch execution ------------------------------------------------------

	formatSelection(): string[] {
		return this.selectedShapes().map((shape) => describeShape(shape));
	}

	async act(steps: readonly ActStep[], stopOnError = true): Promise<ActReport> {
		const started = Date.now();
		const results: ActStepResult[] = [];
		const before = this.probe({ columns: 16, rows: 9 });
		let ok = true;

		for (let index = 0; index < steps.length; index += 1) {
			const step = steps[index];
			const label = step.label ?? step.op;
			this.onProgress?.({ index: index + 1, total: steps.length, label });
			let note: string | undefined;
			try {
				note = await this.runStep(step, label);
			} catch (error) {
				results.push({
					index: index + 1,
					op: step.op,
					label,
					ok: false,
					note: error instanceof Error ? error.message : String(error),
				});
				ok = false;
				if (stopOnError) break;
				continue;
			}
			results.push({ index: index + 1, op: step.op, label, ok: true, note });
			await frame();
		}

		const after = this.probe({ columns: 16, rows: 9 });
		return {
			ok,
			steps: results,
			elapsedMs: Date.now() - started,
			selection: this.selection(),
			shapes: this.doc.shapes.length,
			change: changedSince(before, after),
			probe: after ?? before,
		};
	}

	private async runStep(step: ActStep, label: string): Promise<string | undefined> {
		switch (step.op) {
			case "label":
				return label;
			case "ready":
				return "ready";
			case "wait": {
				const ms = Math.max(0, Math.min(8000, step.ms ?? 200));
				await new Promise((resolve) => setTimeout(resolve, ms));
				return `${ms}ms`;
			}
			case "move": {
				const hit = this.hit(this.point(step.x, step.y));
				return hit ? `over ${hit.id}` : "empty";
			}
			case "click": {
				const point = this.point(step.x, step.y);
				const hit = this.hit(point);
				if (!hit) {
					this.clearSelection();
					return "empty";
				}
				this.select([hit.id]);
				return hit.id;
			}
			case "drag": {
				const from = this.point(step.x ?? step.x2, step.y ?? step.y2);
				const to = step.x2 === undefined && step.y2 === undefined ? { x: from.x + 120, y: from.y } : this.point(step.x2, step.y2);
				this.beginDrag(from);
				for (let frameIndex = 1; frameIndex <= 6; frameIndex += 1) {
					this.dragTo({ x: from.x + ((to.x - from.x) * frameIndex) / 6, y: from.y + ((to.y - from.y) * frameIndex) / 6 });
					await frame();
				}
				this.endDrag();
				return `${Math.round(to.x - from.x)},${Math.round(to.y - from.y)}`;
			}
			case "type": {
				const text = step.text ?? "";
				const only = this.selectedShapes().filter((shape) => shape.kind === "text");
				if (only.length === 0) {
					this.insert("text", { text, w: Math.max(120, text.length * 14), h: 32 }, step.x === undefined ? undefined : this.point(step.x, step.y));
					return text;
				}
				for (const shape of only) {
					this.update(shape.id, { text: clampText(`${shape.text ?? ""}${text}`) }, false);
				}
				return text;
			}
			case "key":
				return this.key(step.key ?? "");
			case "insert": {
				const shape = this.insert(step.kind ?? "rect", step.patch ?? {}, step.x === undefined ? undefined : this.point(step.x, step.y));
				return describeShape(shape);
			}
			case "set": {
				if (this.selected.length === 0) throw new Error("set-needs-selection");
				this.patchSelection(step.patch ?? {});
				return JSON.stringify(step.patch ?? {});
			}
			case "delete": {
				if (step.ids && step.ids.length > 0) {
					this.apply(dropShapes(this.doc, step.ids));
					this.selected = this.selected.filter((id) => !step.ids?.includes(id));
					return `${step.ids.length}`;
				}
				const count = this.selected.length;
				this.remove();
				return `${count}`;
			}
			case "select": {
				if (!step.ids || step.ids.length === 0) {
					this.selectAll();
					return "all";
				}
				if (step.mode === "last") {
					const last = this.doc.shapes.filter((shape) => !shape.locked).at(-1);
					this.select(last ? [last.id] : []);
					return last?.id ?? "empty";
				}
				this.select(step.ids);
				return `${this.selected.length}`;
			}
			case "arrange": {
				const where = (step.mode ?? "front") as "front" | "back" | "forward" | "backward";
				this.reorderSelection(where);
				return where;
			}
			case "align": {
				const mode = (step.mode ?? "left") as AlignMode;
				this.alignSelection(mode);
				return mode;
			}
			case "save": {
				if (step.save === false) return "skipped";
				return this.png() ? "captured" : "no-canvas";
			}
			case "capture":
				return "captured";
			default:
				throw new Error(`unknown-op:${step.op}`);
		}
	}

	private key(key: string): string {
		const normalised = key.toLowerCase();
		if (normalised === "delete" || normalised === "backspace") {
			this.remove();
			return "delete";
		}
		if (normalised === "escape") {
			this.clearSelection();
			return "escape";
		}
		if (normalised === "enter") return "enter";
		if (normalised === "cmd+z" || normalised === "ctrl+z") {
			this.undo();
			return "undo";
		}
		if (normalised === "cmd+shift+z" || normalised === "ctrl+shift+z") {
			this.redo();
			return "redo";
		}
		if (normalised === "cmd+d" || normalised === "ctrl+d") {
			this.duplicateSelection();
			return "duplicate";
		}
		if (normalised === "cmd+a" || normalised === "ctrl+a") {
			this.selectAll();
			return "select-all";
		}
		return `ignored:${key}`;
	}
}

export { frame, surfacePreset };

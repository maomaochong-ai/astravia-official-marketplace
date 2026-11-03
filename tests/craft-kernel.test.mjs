/**
 * The kernel is the product now, so it is tested directly.
 *
 * These cases run on the real source — Node strips the types — with no DOM, no canvas
 * and no host. That is the point of moving the engine in-repo: the document model, the
 * probe and the batch runner are ordinary functions that can be asserted, instead of
 * behaviour that only exists inside a wasm bundle behind an iframe.
 *
 * ADR: docs/adr/<plugin>/craft-0011-the-engine-is-ours.md
 * ADR: docs/adr/<plugin>/craft-0012-chinese-is-rendered-here.md
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
	KernelEngine,
} from "../abilities/plugins/designcraft/src/features/editor/kernel/engine.ts";
import {
	emptyDocument,
	parse,
	serialize,
	withinLimits,
} from "../abilities/plugins/designcraft/src/domain/kernel-document.ts";

const OPTIONS = { mode: "canvas", width: 800, height: 600, background: "#ffffff", accent: "#2f6df6" };

/** A page painted from the document, so a probe reflects what a change did. */
function pixelsFor(engine) {
	const doc = engine.document();
	const width = 80;
	const height = 60;
	const data = new Uint8ClampedArray(width * height * 4).fill(255);
	for (const shape of doc.shapes) {
		if (shape.locked) continue;
		const left = Math.max(0, Math.floor((shape.x / doc.width) * width));
		const top = Math.max(0, Math.floor((shape.y / doc.height) * height));
		const right = Math.min(width, Math.ceil(((shape.x + shape.w) / doc.width) * width));
		const bottom = Math.min(height, Math.ceil(((shape.y + shape.h) / doc.height) * height));
		for (let y = top; y < bottom; y += 1) {
			for (let x = left; x < right; x += 1) {
				const index = (y * width + x) * 4;
				data[index] = 16;
				data[index + 1] = 16;
				data[index + 2] = 16;
			}
		}
	}
	return { data, width, height };
}

test("a new engine starts blank and clean", () => {
	const engine = new KernelEngine(OPTIONS);
	assert.equal(engine.document().shapes.length, 0);
	assert.equal(engine.document().width, 800);
	assert.equal(engine.dirty(), false);
	assert.deepEqual(engine.selection(), []);
	assert.equal(engine.canUndo(), false);
});

test("the probe turns pixels into a letter map", () => {
	const engine = new KernelEngine(OPTIONS);
	assert.equal(engine.probe(), null, "no canvas means no map, not a fake one");

	engine.setPixelSource(() => pixelsFor(engine));
	const blank = engine.probe({ columns: 8, rows: 4 });
	assert.equal(blank.columns, 8);
	assert.equal(blank.rows, 4);
	assert.equal(blank.cells.split("\n").length, 4);
	assert.equal(blank.cells.split("\n")[0].length, 8);
	assert.equal(blank.mean, 255);
	assert.equal(blank.contrast, 0);

	const shape = engine.insert("rect", { x: 0, y: 0, w: 400, h: 600, fill: "#000000" });
	assert.ok(shape.id);
	const after = engine.probe({ columns: 8, rows: 4 });
	assert.ok(after.mean < blank.mean, "a dark block lowers the mean");
	assert.ok(after.contrast > 0);
	assert.match(after.cells, /[Kk]/);
});

test("insert selects the new shape, and undo takes it back", () => {
	const engine = new KernelEngine(OPTIONS);
	const shape = engine.insert("text", { text: "标题", fontSize: 28 });
	assert.equal(engine.document().shapes.length, 1);
	assert.deepEqual(engine.selection(), [shape.id]);
	assert.equal(engine.dirty(), true);

	engine.undo();
	assert.equal(engine.document().shapes.length, 0);
	assert.equal(engine.dirty(), false);

	engine.redo();
	assert.equal(engine.document().shapes.length, 1);
	assert.equal(engine.document().shapes[0].text, "标题");
});

test("align left gives every selected shape the same edge", () => {
	const engine = new KernelEngine(OPTIONS);
	const a = engine.insert("rect", { x: 40, y: 20, w: 100, h: 60 });
	const b = engine.insert("rect", { x: 220, y: 120, w: 80, h: 60 });
	const c = engine.insert("ellipse", { x: 330, y: 260, w: 120, h: 120 });
	engine.select([a.id, b.id, c.id]);
	engine.alignSelection("left");

	const xs = engine.selectedShapes().map((shape) => Math.round(shape.x));
	assert.equal(new Set(xs).size, 1, `expected one x, got ${xs.join(",")}`);
});

test("a batch edits the page and reports whether the pixels moved", async () => {
	const engine = new KernelEngine(OPTIONS);
	engine.setPixelSource(() => pixelsFor(engine));

	const report = await engine.act([
		{ op: "insert", kind: "rect", x: 0.3, y: 0.3, patch: { w: 200, h: 120, fill: "#2f6df6" } },
		{ op: "insert", kind: "rect", x: 0.6, y: 0.5, patch: { w: 200, h: 120, fill: "#2f6df6" } },
		{ op: "select", ids: [] },
		{ op: "align", mode: "left" },
		{ op: "set", patch: { fill: "#e8590c" } },
		{ op: "label", label: "两个块左对齐" },
	]);

	assert.equal(report.ok, true);
	assert.equal(report.steps.length, 6);
	assert.ok(report.steps.every((step) => step.ok));
	assert.equal(report.shapes, 2);
	assert.equal(report.change.changed, true, "the page went from empty to two blocks");
	assert.ok(report.probe, "the batch hands back a map of the result");
	assert.equal(engine.document().shapes[0].fill, "#e8590c");
});

test("an unknown step fails the batch without throwing", async () => {
	const engine = new KernelEngine(OPTIONS);
	const report = await engine.act([
		{ op: "insert", kind: "rect" },
		{ op: "teleport" },
		{ op: "insert", kind: "rect" },
	]);
	assert.equal(report.ok, false);
	assert.equal(report.steps.length, 2, "stopOnError refuses to run the rest");
	assert.match(report.steps[1].note, /unknown-op:teleport/);
	assert.equal(engine.document().shapes.length, 1);
});

test("a saved project opens again with the same shapes", () => {
	const engine = new KernelEngine(OPTIONS);
	engine.insert("rect", { x: 10, y: 20, w: 100, h: 50, fill: "#123456" });
	engine.insert("text", { text: "正文", fontSize: 20, color: "#222222" });
	const text = serialize(engine.document());

	const reopened = new KernelEngine(OPTIONS);
	const loaded = parse(text, reopened.document());
	assert.equal(loaded.shapes.length, 2);
	assert.equal(loaded.shapes[0].fill, "#123456");
	assert.equal(loaded.shapes[1].text, "正文");

	assert.equal(parse("not json at all", reopened.document()).shapes.length, 0);
});

test("a document beyond the shape limit is refused instead of half-loaded", () => {
	const engine = new KernelEngine(OPTIONS);
	const base = emptyDocument("canvas", 800, 600, "#ffffff");
	const shapes = Array.from({ length: 601 }, (_, index) => ({
		id: `s${index}`,
		kind: "rect",
		x: index,
		y: 0,
		w: 10,
		h: 10,
	}));
	assert.equal(withinLimits({ ...base, shapes }), false);
	engine.setDocument({ ...base, shapes });
	assert.equal(engine.document().shapes.length, 0, "the engine keeps the document it had");
});

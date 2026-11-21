// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Layout contract for the tab.
 *
 * These assertions encode the three decisions the redesign is built on, because
 * each one is invisible in a screenshot review and easy to undo by "just moving a
 * div back":
 *
 *  1. the canvas + the generate verb are inside a sticky block, above the form;
 *  2. results sit between the canvas and the form, not at the bottom;
 *  3. dialogs are scoped to the panel, so they cannot cover the conversation.
 */

const ROOT = process.cwd();
const canvas = readFileSync(join(ROOT, "src/features/canvas/components/logo-canvas.tsx"), "utf8");
const dialog = readFileSync(join(ROOT, "src/shared/components/modal-dialog.tsx"), "utf8");

const indexOf = (needle: string) => {
	const index = canvas.indexOf(needle);
	expect(index, `${needle} missing from the canvas`).toBeGreaterThan(-1);
	return index;
};

describe("the tab's layout order", () => {
	it("keeps the canvas and the generate button in a sticky block", () => {
		const sticky = indexOf("sticky top-0");
		const surface = indexOf("<CanvasSurface");
		const generate = indexOf('t("action.generate")');
		expect(surface).toBeGreaterThan(sticky);
		expect(generate).toBeGreaterThan(surface);
		// The form must live outside that block, or the whole panel becomes sticky.
		expect(indexOf("<CanvasControls")).toBeGreaterThan(generate);
	});

	it("puts the results between the canvas and the form", () => {
		const notes = indexOf("<NotesList");
		const grid = indexOf("<ResultGrid");
		const form = indexOf("<CanvasControls");
		expect(grid).toBeGreaterThan(notes);
		expect(form).toBeGreaterThan(grid);
		// Generating must not append tiles five screens below the fold.
		expect(indexOf('t("gallery.title")')).toBeLessThan(form);
	});

	it("offers no hand-off button until something is pinned", () => {
		const list = readFileSync(join(ROOT, "src/features/canvas/components/notes-list.tsx"), "utf8");
		// Returning null on an empty list is what makes the control absent rather
		// than permanently disabled.
		expect(list).toMatch(/if \(pending\.length === 0\) return null;/);
	});
});

describe("dialogs stay inside the panel", () => {
	it("anchors to the panel, not the window", () => {
		expect(dialog).toContain("absolute inset-0");
		expect(dialog).not.toContain('className="fixed inset-0');
		// The panel root is the containing block; without `relative` the overlay
		// would size itself against the wrong ancestor.
		expect(canvas).toContain("relative flex h-full min-h-0 w-full flex-col");
	});
});

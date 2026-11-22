// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Canvas anatomy.
 *
 * The tab is a canvas editor, not a form: a fixed stage, floating chrome, and one
 * scrollable rail. Each of those is invisible in a screenshot review and trivially
 * undone by "just moving a div back", so they are asserted here.
 *
 * Reference: the host's own design plugin keeps the stage `flex-1 min-h-0`, floats a
 * title slot top-left and a control bar `absolute bottom-3 left-1/2`, and scrolls
 * only the rail. Same shape here.
 */

const ROOT = process.cwd();
const canvas = readFileSync(join(ROOT, "src/features/canvas/components/logo-canvas.tsx"), "utf8");
const dock = readFileSync(join(ROOT, "src/features/canvas/components/canvas-dock.tsx"), "utf8");
const inspector = readFileSync(join(ROOT, "src/features/canvas/components/canvas-inspector.tsx"), "utf8");
const dialog = readFileSync(join(ROOT, "src/shared/components/modal-dialog.tsx"), "utf8");

const at = (source: string, needle: string) => {
	const index = source.indexOf(needle);
	expect(index, `${needle} missing`).toBeGreaterThan(-1);
	return index;
};

describe("the stage", () => {
	it("fills the tab and never scrolls", () => {
		// Stage = `relative min-h-0 flex-1`; the art is centred inside it.
		at(canvas, 'relative min-h-0 flex-1');
		at(canvas, 'absolute inset-0 flex items-center justify-center');
		// A page-level scroll on the stage is the old bug: the canvas drifts away.
		expect(canvas).not.toContain('flex-1 overflow-y-auto px-3 pb-3');
	});

	it("floats the title slot and the action rail over it", () => {
		at(canvas, 'absolute left-3 top-3 z-40');
		at(canvas, 'absolute right-2 top-2 z-40');
	});

	it("keeps the form out of the stage", () => {
		// The design controls live in the inspector component, not inline.
		expect(canvas).not.toContain("<CanvasControls");
		at(canvas, "<CanvasInspector");
	});
});

describe("the dock", () => {
	it("is a floating bar at the bottom centre", () => {
		at(dock, 'absolute bottom-3 left-1/2');
		at(dock, '-translate-x-1/2');
		// No backdrop blur: the stage behind it repaints on every edit.
		expect(dock).not.toMatch(/className="[^"]*backdrop-blur/);
	});

	it("carries the four canvas verbs and a notes badge", () => {
		for (const key of ["action.generate", "action.surprise", "dock.inspector", "dock.notes", "dock.export"]) {
			expect(dock, `dock is missing ${key}`).toContain(key);
		}
		expect(dock).toContain("badge={pendingNotes}");
	});
});

describe("the inspector", () => {
	it("overlaps the stage from the right instead of shrinking it", () => {
		// Docked left, like the host's own panels.
		at(inspector, "absolute inset-y-0 left-0");
		// Two tabs, one rail: design settings or the note list.
		expect(inspector).toContain('t("inspector.tabDesign")');
		expect(inspector).toContain('t("inspector.tabNotes")');
	});

	it("is the only thing that scrolls", () => {
		expect(inspector).toContain("overflow-y-auto");
	});
});

describe("dialogs stay inside the panel", () => {
	it("anchors to the panel, not the window", () => {
		expect(dialog).toContain("absolute inset-0");
		expect(dialog).not.toContain('className="fixed inset-0');
		expect(canvas).toContain("relative flex h-full min-h-0 w-full flex-col overflow-hidden");
	});
});

describe("the tab strip icon", () => {
	const registration = readFileSync(join(ROOT, "src/index.tsx"), "utf8");

	it("uses the plugin's own mark, resolved by the host", () => {
		// 上一版在这里放了一枚自绘字形：tab 上是星形、能力卡上是另一张图，用户看到两个 logo。
		// 现在唯一来源是 plugin.json#icon → ctx.plugin.iconUrl。
		expect(registration).toContain("ctx.plugin.iconUrl");
		expect(registration).toMatch(/<img src=\{ctx\.plugin\.iconUrl\}/);
		// 字形只剩一个兼容回退（读不到 iconUrl 的旧宿主），不再有两处。
		expect(registration.match(/<IconGenerate/g)?.length).toBe(1);
	});


	it("comes from the shared glyph set, drawn in currentColor", () => {
		// One set for the chip, the rail and the dock: a single stroke weight on a single
		// 24 px grid is what makes a toolbar look designed rather than assembled.
		const glyphs = readFileSync(join(ROOT, "src/shared/components/icons.tsx"), "utf8");
		expect(glyphs).toContain("currentColor");
		expect(glyphs).toContain('viewBox="0 0 24 24"');
		expect(glyphs).not.toMatch(/<img\s+src=/);
		// And the panel must not hand-roll path soup beside the set.
		const panel = readFileSync(join(ROOT, "src/features/canvas/components/logo-canvas.tsx"), "utf8");
		expect(panel).not.toContain("<svg viewBox");
	});
});

// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Two behaviours the user reported, pinned so they cannot quietly regress:
 *  - the stage can be moved (it could not be dragged at all);
 *  - the inspector docks left, and the canvas chrome gets out of its way.
 */
const ROOT = process.cwd();
const surface = readFileSync(join(ROOT, "src/features/canvas/components/canvas-surface.tsx"), "utf8");
const inspector = readFileSync(join(ROOT, "src/features/canvas/components/canvas-inspector.tsx"), "utf8");
const panel = readFileSync(join(ROOT, "src/features/canvas/components/logo-canvas.tsx"), "utf8");

describe("the stage can be moved", () => {
	it("pans on drag, zooms on a modified wheel, and resets on double click", () => {
		expect(surface).toContain("onPointerDown={onPointerDown}");
		expect(surface).toContain("onPointerMove={onPointerMove}");
		expect(surface).toContain("onDoubleClick={resetView}");
		// A plain wheel belongs to the panel's scroll; stealing it traps the user.
		expect(surface).toContain("!event.ctrlKey && !event.metaKey");
	});

	it("does not drop a note at the end of a pan", () => {
		// The threshold is what separates "click to pin" from "drag to move".
		expect(surface).toContain("DRAG_THRESHOLD");
		expect(surface).toMatch(/if \(!drag\.moved\) place\(/);
	});

	it("resets the view when the design changes", () => {
		// Keeping a 3× pan from the previous mark shows the new one's corner.
		expect(surface).toMatch(/useEffect\(\(\) => \{\s*resetView\(\);\s*\}, \[previewUrl, rasterUrl, resetView\]\)/);
	});
});

describe("the inspector docked left", () => {
	it("opens from the left edge", () => {
		expect(inspector).toContain("absolute inset-y-0 left-0");
		expect(inspector).not.toContain("absolute inset-y-0 right-0");
	});

	it("hides the canvas chrome while it is open", () => {
		// Chrome belongs to the visible part of the stage; leaving it under the rail
		// means two overlapping control clusters.
		const hiding = panel.match(/inspectorOpen \? "pointer-events-none opacity-0"/g) ?? [];
		expect(hiding.length).toBe(2);
	});
});

describe("no stray text under the dock", () => {
	it("keeps the empty-state reason in the control's own title", () => {
		// A permanent line of prose under a floating dock is what this removes: the dock
		// slot already carries the same sentence as its accessible name.
		const dock = readFileSync(join(ROOT, "src/features/canvas/components/canvas-dock.tsx"), "utf8");
		expect(dock).toContain('t("dock.locked")');
		expect(panel).not.toContain('t("action.needName")');
	});
});

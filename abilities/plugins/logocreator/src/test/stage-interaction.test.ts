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
	it("pans on drag, zooms on a modified wheel, and resets from an explicit control", () => {
		expect(surface).toContain("onPointerDown={onPointerDown}");
		expect(surface).toContain("onPointerMove={onPointerMove}");
		// 双击会让 pointerup 先落一枚备注，再被当成复位——两个行为抢同一手势。
		// 现在双击什么都不做；缩放/复位/手型全部搬到 dock，画布上不再挂视口控件。
		expect(surface).not.toContain("onDoubleClick={resetView}");
		expect(surface).not.toContain("onToggleHand");
		expect(surface).not.toContain('t("canvas.handTool")');
		expect(surface).not.toContain('t("canvas.resetView")');
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

	it("keeps the title chip visible while the rail is open", () => {
		// 上一版整块隐藏 chrome，于是改参数时看不到自己在改哪一版。
		// 现在只有右上角的动作簇让位，稿名与包切换器必须仍在。
		const hiding = panel.match(/inspectorOpen \? "pointer-events-none opacity-0"/g) ?? [];
		expect(hiding.length).toBe(1);
		// 侧栏在左侧：标题区要**右移**让开它（只给 padding-right 会继续重叠）。
		expect(panel).toMatch(/inspectorOpen[\s\S]{0,120}left-\[calc\(clamp\(15rem,88%,20rem\)\+0\.5rem\)\]/);
	});
});

describe("no stray text under the dock", () => {
	it("keeps the empty-state reason in the control's own title", () => {
		// A permanent line of prose under a floating dock is what this removes: the dock
		// slot already carries the same sentence as its accessible name.
		const dock = readFileSync(join(ROOT, "src/features/canvas/components/canvas-dock.tsx"), "utf8");
		// 没有名字时按钮禁用并用可见文案说明原因，不再需要单独的 locked 串。
		expect(dock).toMatch(/disabled=\{running \|\| !canGenerate\}/);
		expect(panel).not.toContain('t("action.needName")');
	});
});

describe("the dock owns the viewport controls", () => {
	it("keeps zoom and the hand tool in the dock, off the canvas", () => {
		// 用户报的问题：手型按钮浮在画布上（还带一句永久的快捷键文案），而 dock 里
		// 已经有一套缩放/抓手。画布只画作品，视口控件只在一个地方。
		const dock = readFileSync(join(ROOT, "src/features/canvas/components/canvas-dock.tsx"), "utf8");
		expect(dock).toContain('t("canvas.handTool")');
		expect(dock).toContain('t("dock.zoomIn")');
		expect(dock).toContain('t("dock.zoomOut")');
		expect(dock).toContain('t("dock.zoomReset")');
		// 手型是一个开关（再点一次退出），不是一次性动作。
		expect(dock).toMatch(/active=\{handMode\}/);
	});
});

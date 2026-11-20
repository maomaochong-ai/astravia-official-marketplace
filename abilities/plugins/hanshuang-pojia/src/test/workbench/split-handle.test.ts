import { describe, expect, it } from "vitest";
import { nextWidth } from "../../features/workbench/hooks/use-sidebar-width";

/**
 * 分栏把手的方向。
 *
 * 这一条必须靠算：上一版把符号写反了 —— 侧栏在把手左侧，却按「往左拖才变宽」算，
 * 于是用户往右拖，栏反而变窄。真机拖一次很难判断是手抖还是代码错，所以抽成纯函数测。
 *
 * 约定：`side` 是**被拖那一栏在把手的哪一边**。
 *   side="left"  → 栏在把手左侧（侧栏、文档目录）：往右拖 = 变宽
 *   side="right" → 栏在把手右侧：往右拖 = 变窄
 */
describe("nextWidth", () => {
	it("grows a left-side pane when the pointer moves right", () => {
		expect(nextWidth(240, 40, "left", 200, 360)).toBe(280);
		expect(nextWidth(240, -40, "left", 200, 360)).toBe(200);
	});

	it("shrinks a right-side pane when the pointer moves right", () => {
		expect(nextWidth(300, 40, "right", 200, 460)).toBe(260);
		expect(nextWidth(300, -40, "right", 200, 460)).toBe(340);
	});

	it("clamps instead of running past the bounds", () => {
		expect(nextWidth(240, 999, "left", 200, 360)).toBe(360);
		expect(nextWidth(240, -999, "left", 200, 360)).toBe(200);
		expect(nextWidth(300, -999, "right", 220, 460)).toBe(460);
	});

	it("rounds to whole pixels so the pane cannot end up on a half-pixel", () => {
		expect(nextWidth(240, 12.4, "left", 200, 360)).toBe(252);
	});
});

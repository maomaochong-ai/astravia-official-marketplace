import { describe, expect, it } from "vitest";
import { clampMenu, estimateMenuHeight, MENU_WIDTH, type PanelMenu } from "../../features/workbench/hooks/use-panel-menu";

/**
 * The right-click menu is drawn inside the activity panel, so its coordinates are relative
 * to the panel root and must be clamped there. Getting this wrong is invisible in unit
 * terms but obvious to the user: half the menu is outside the panel.
 */
const menu = (items: number): PanelMenu => ({
	left: 0,
	top: 0,
	heading: "cases/client-auth-gate/",
	groups: [{ id: "g", items: Array.from({ length: items }, (_, index) => ({ id: `i${index}`, label: "x", run: () => {} })) }],
});

describe("panel menu geometry", () => {
	it("keeps the menu inside the panel on a right-click near the bottom-right corner", () => {
		const point = clampMenu({ left: 320, top: 480 }, { width: MENU_WIDTH, height: 200 }, { width: 360, height: 520 });
		expect(point.left).toBe(360 - MENU_WIDTH - 8);
		expect(point.top).toBe(520 - 200 - 8);
	});

	it("never clamps past the top-left margin", () => {
		expect(clampMenu({ left: -40, top: -10 }, { width: MENU_WIDTH, height: 120 }, { width: 800, height: 600 })).toEqual({ left: 8, top: 8 });
	});

	it("falls back to the margin when the panel is narrower than the menu", () => {
		// 面板比菜单还窄时不能算出负数：贴左边，宁可右边裁一点，也不能整块跑到面板外。
		const point = clampMenu({ left: 100, top: 100 }, { width: 300, height: 100 }, { width: 220, height: 300 });
		expect(point.left).toBe(8);
		expect(point.top).toBe(100);
	});

	it("estimates a taller menu as items are added", () => {
		expect(estimateMenuHeight(menu(2))).toBeLessThan(estimateMenuHeight(menu(6)));
	});

	it("counts the heading and group gaps, not just the rows", () => {
		const withoutHeading: PanelMenu = { left: 0, top: 0, groups: [{ id: "g", items: [{ id: "a", label: "x", run: () => {} }] }] };
		expect(estimateMenuHeight({ ...withoutHeading, heading: "x" })).toBeGreaterThan(estimateMenuHeight(withoutHeading));
	});
});

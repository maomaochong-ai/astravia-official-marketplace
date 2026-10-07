/**
 * 右键菜单边界定位纯函数测试。
 *
 * 覆盖的缺陷：子菜单只按「父项顶部对齐 + 向右展开」摆放，翻转判断又用固定宽度常量，
 * 于是表右键底部的「更多」在面板下缘展开时整体落到面板/屏幕之外，后几项看不见。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { placeContextMenu, placeSubmenu } from "../shared/utils/menu-placement.ts";

/** 与 DOMRect 同形的普通对象（测试里的 .js 不能写类型标注）。 */
function rect(left, top, right, bottom) {
	return { left, top, right, bottom, width: right - left, height: bottom - top };
}

/** 1200x700 的面板，原点在屏幕 (0,0) —— 与面板铺满窗口时的真实情形一致。 */
const ROOT = rect(0, 0, 1200, 700);

describe("placeContextMenu", () => {
	it("右下角右键：贴住面板右下边界，不越界", () => {
		const box = placeContextMenu({ root: ROOT, x: 1180, y: 690, size: { width: 208, height: 300 }, width: 208 });
		assert.equal(box.left, 1200 - 208 - 4);
		assert.equal(box.top, 700 - 300 - 4);
		assert.equal(box.maxHeight, null);
		assert.equal(box.maxWidth, null);
	});

	it("菜单比面板还高：限高交给内部滚动，而不是溢出下边界", () => {
		const short = rect(0, 0, 600, 300);
		const box = placeContextMenu({ root: short, x: 100, y: 290, size: { width: 208, height: 520 }, width: 208 });
		assert.equal(box.maxHeight, 300 - 8);
		assert.equal(box.top, 4, "限高后从面板顶开始，底部正好贴边");
	});

	it("面板比菜单还窄：给出宽度上限", () => {
		const narrow = rect(0, 0, 160, 700);
		const box = placeContextMenu({ root: narrow, x: 8, y: 8, size: { width: 208, height: 100 }, width: 208 });
		assert.equal(box.maxWidth, 160 - 8);
		assert.equal(box.left, 4);
	});
});

describe("placeSubmenu", () => {
	/** 「更多」子菜单：6 项 + 1 条分隔线。 */
	const DUO = { width: 172, height: 175 };

	it("父项在面板下缘：子菜单整体上移，底部仍落在面板内", () => {
		const anchor = rect(120, 631, 328, 657);
		const box = placeSubmenu({ root: ROOT, anchor, size: DUO, minWidth: 172 });
		assert.equal(box.flipLeft, false);
		assert.equal(box.top + DUO.height, 700 - 4, "底边贴住面板下缘（原来是 806，被裁掉 4 项）");
		assert.ok(box.top >= 4);
	});

	it("空间够时与父项顶对齐：不无谓上移", () => {
		const anchor = rect(120, 120, 328, 146);
		const box = placeSubmenu({ root: ROOT, anchor, size: DUO, minWidth: 172 });
		assert.equal(box.top, 120);
		assert.equal(box.flipLeft, false);
	});

	it("右侧放不下：翻到父菜单左侧且不出界", () => {
		const anchor = rect(982, 300, 1190, 326);
		const box = placeSubmenu({ root: ROOT, anchor, size: DUO, minWidth: 172 });
		assert.equal(box.flipLeft, true);
		assert.equal(box.left, 982 + 1 - 172, "与父项重叠 1px");
		assert.ok(box.left >= 4 && box.left + DUO.width <= 1200 - 4);
	});

	it("宽度按实测值判断：长标签比常量宽，翻转判断不能用 172 硬算", () => {
		// 右侧只够 200px，若按 172 会判定「放得下」而溢出，实际宽 220 必须翻到左侧。
		const anchor = rect(950, 300, 1150, 326);
		const box = placeSubmenu({ root: ROOT, anchor, size: { width: 220, height: 120 }, minWidth: 172 });
		assert.equal(box.flipLeft, true);
		assert.ok(box.left + 220 <= 1200 - 4);
	});

	it("两侧都放不下：贴住空间更大的一侧，仍不出界", () => {
		const narrow = rect(0, 0, 200, 400);
		const anchor = rect(100, 100, 110, 126);
		const box = placeSubmenu({ root: narrow, anchor, size: DUO, minWidth: 172 });
		assert.ok(box.left >= 4);
		assert.ok(box.left + DUO.width <= 200 - 4);
	});

	it("子菜单比面板还高：限高滚动，不再整块溢出", () => {
		const short = rect(0, 0, 600, 160);
		const anchor = rect(100, 130, 308, 156);
		const box = placeSubmenu({ root: short, anchor, size: { width: 172, height: 300 }, minWidth: 172 });
		assert.equal(box.maxHeight, 160 - 8);
		assert.ok(box.top >= 4);
	});

	it("父项贴顶：子菜单不越过上边界", () => {
		const anchor = rect(120, 0, 328, 26);
		const box = placeSubmenu({ root: ROOT, anchor, size: DUO, minWidth: 172 });
		assert.equal(box.top, 4);
	});

	it("窄面板：内容过宽时给宽度上限", () => {
		const narrow = rect(0, 0, 160, 700);
		const anchor = rect(8, 100, 120, 126);
		const box = placeSubmenu({ root: narrow, anchor, size: { width: 300, height: 120 }, minWidth: 172 });
		assert.equal(box.maxWidth, 160 - 8);
		assert.equal(box.left, 4);
	});
});

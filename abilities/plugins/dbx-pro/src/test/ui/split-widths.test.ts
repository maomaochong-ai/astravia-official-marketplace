/**
 * 三栏宽度约束：容器变窄时不允许三栏之和超过容器宽（否则根节点 overflow-hidden 会切掉右栏）。
 *
 * 两条不变量：
 * 1) 宽度永远不收口到下限以下——被压成 0～80px 的栏位会让 nowrap 文案逐字换行；
 * 2) 装不下三栏时返回下限，由调用方（SplitLayout 的 compact 分支）切成单栏 + 抽屉。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
	DESIGN_LEFT,
	DESIGN_RIGHT,
	MIN_LEFT,
	MIN_MID,
	MIN_RIGHT,
	SPLITBAR_TOTAL,
	THREE_PANE_MIN,
	canFitThreePane,
	defaultWidths,
	fitWidths,
} from "../../features/database-workspace/services/split-widths.ts";

/** 三栏之和（含两条发丝分隔线），必须不超过容器宽。 */
function total(a, stub = 0) {
	return a.left + a.right + stub + SPLITBAR_TOTAL + MIN_MID;
}

describe("三栏宽度约束", () => {
	it("容器足够宽时原样保留用户宽度", () => {
		const fitted = fitWidths(1600, DESIGN_LEFT, DESIGN_RIGHT);
		assert.deepEqual(fitted, { left: DESIGN_LEFT, right: DESIGN_RIGHT });
	});

	it("只压让得出余量的一侧，不动已经到下限的一侧", () => {
		// 左栏可让 320（500-180），右栏只可让 0（已在下限）：溢出全部由左栏承担。
		const fitted = fitWidths(1000, 500, MIN_RIGHT);
		assert.equal(fitted.right, MIN_RIGHT);
		assert.ok(total(fitted) <= 1000, `三栏 ${total(fitted)} 超过容器 1000`);
		assert.ok(fitted.left >= MIN_LEFT, "左栏不应被压到下限以下");
	});

	it("两栏都有余量时按各自可让空间等比例退让", () => {
		// 左栏可让 220（400-180）、右栏可让 200（500-300）；容器 1000 需要让出 246。
		const fitted = fitWidths(1000, 400, 500);
		assert.equal(total(fitted), 1000, "应当刚好收进容器");
		assert.ok(fitted.left >= MIN_LEFT && fitted.right >= MIN_RIGHT, "两侧都不应被压到下限以下");
		assert.ok(400 - fitted.left > 500 - fitted.right, "可让空间更大的一侧应当让得更多");
	});

	it("连两条最小宽度都装不下时返回下限，不再等比压缩", () => {
		// 宿主活动面板最窄 260px：三栏之和 826 根本放不下，等比压缩会得到 0 宽的两栏。
		const fitted = fitWidths(600, MIN_LEFT, MIN_RIGHT);
		assert.deepEqual(fitted, { left: MIN_LEFT, right: MIN_RIGHT });
		assert.equal(canFitThreePane(600), false);
	});

	it("极窄容器（260px）也不会把栏位压到下限以下", () => {
		const fitted = fitWidths(260, 400, 400);
		assert.equal(fitted.left, MIN_LEFT);
		assert.equal(fitted.right, MIN_RIGHT);
		assert.equal(canFitThreePane(260), false);
	});

	it("THREE_PANE_MIN 正好是三栏最小宽度之和，临界值可取整", () => {
		assert.equal(THREE_PANE_MIN, MIN_LEFT + MIN_MID + MIN_RIGHT + SPLITBAR_TOTAL);
		assert.equal(canFitThreePane(THREE_PANE_MIN), true);
		assert.equal(canFitThreePane(THREE_PANE_MIN - 1), false);
	});

	it("左栏收起时把 36px 图标列算进容器占用", () => {
		const expanded = fitWidths(760, 0, 400, 0);
		const collapsed = fitWidths(760, 0, 400, 36);
		assert.ok(collapsed.right <= expanded.right, "收起左栏后右栏不应更宽");
		assert.ok(total(collapsed, 36) <= 760);
	});

	it("宽度未知（0）时不产生 NaN", () => {
		const fitted = fitWidths(0, 0, 0);
		assert.deepEqual(fitted, { left: 0, right: 0 });
		assert.deepEqual(defaultWidths(0), { left: DESIGN_LEFT, right: DESIGN_RIGHT });
	});

	it("窄面板按比例给默认宽，宽面板用设计稿固定宽", () => {
		const narrow = defaultWidths(800);
		assert.deepEqual(narrow, { left: 208, right: 224 });
		assert.deepEqual(defaultWidths(1440), { left: DESIGN_LEFT, right: DESIGN_RIGHT });
	});
});

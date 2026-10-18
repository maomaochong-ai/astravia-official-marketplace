/**
 * 画布 · 对齐与等距分布。
 *
 * 这两组动作来自企业级 BI 的 dashboard 编辑态（Superset「Arrange」、Metabase 的
 * align/distribute 工具）：多选后用包围盒做参考线，不改变节点顺序。
 * 断言集中在「参考轴上的那一维被改、另一维原样」，因为连续对齐最容易犯的错就是顺手改动另一维。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
	computeAlign,
	computeDistribute,
	type ArrangeBox,
} from "../../features/bi-editor/canvas/lib/auto-layout.ts";

const BOXES: ArrangeBox[] = [
	{ id: "a", x: 0, y: 0, w: 100, h: 40 },
	{ id: "b", x: 50, y: 100, w: 60, h: 20 },
	{ id: "c", x: 200, y: 60, w: 80, h: 30 },
];

const byId = (updates: { nodeId: string; x: number; y: number }[]) =>
	new Map(updates.map((u) => [u.nodeId, u]));

describe("画布 · 对齐与等距分布", () => {
	it("左对齐只改 x，y 保持原位", () => {
		const map = byId(computeAlign(BOXES, "left"));
		assert.deepEqual([map.get("a")?.x, map.get("b")?.x, map.get("c")?.x], [0, 0, 0]);
		assert.deepEqual([map.get("b")?.y, map.get("c")?.y], [100, 60]);
	});

	it("右对齐按包围盒右缘贴齐", () => {
		const map = byId(computeAlign(BOXES, "right"));
		// 包围盒右缘 = 200 + 80 = 280
		assert.deepEqual([map.get("a")?.x, map.get("b")?.x, map.get("c")?.x], [180, 220, 200]);
	});

	it("水平居中与垂直居中走包围盒中线", () => {
		const h = byId(computeAlign(BOXES, "hcenter"));
		assert.deepEqual([h.get("a")?.x, h.get("b")?.x, h.get("c")?.x], [90, 110, 100]);

		const v = byId(computeAlign(BOXES, "vcenter"));
		// 包围盒 = y 0..120，中线 60
		assert.deepEqual([v.get("a")?.y, v.get("b")?.y, v.get("c")?.y], [40, 50, 45]);
	});

	it("少于两个节点没有参考对象，直接返回空", () => {
		assert.deepEqual(computeAlign([BOXES[0]], "left"), []);
		assert.deepEqual(computeAlign([], "top"), []);
	});

	it("水平等距：首尾不动，中间节点按相等间隙铺开", () => {
		const map = byId(computeDistribute(BOXES, "horizontal"));
		// 跨度 0..280，节点宽 100 + 60 + 80 = 240 → 两个间隙各 20
		assert.equal(map.get("a")?.x, 0, "首个节点不动");
		assert.equal(map.get("b")?.x, 120, "中间的 b 落在 a 右缘 + 20");
		assert.equal(map.get("c")?.x, 200, "末个节点不动");
		assert.deepEqual([map.get("a")?.y, map.get("b")?.y, map.get("c")?.y], [0, 100, 60], "y 不受影响");
	});

	it("垂直等距按 y 排序后再铺开", () => {
		const map = byId(computeDistribute(BOXES, "vertical"));
		// y 跨度 0..120，高 40 + 20 + 30 = 90 → 两个间隙各 15；按 y 排序后顺序是 a(0) → c(60) → b(100)
		assert.equal(map.get("a")?.y, 0);
		assert.equal(map.get("c")?.y, 55);
		assert.equal(map.get("b")?.y, 100);
	});

	it("等距分布至少需要三个节点", () => {
		assert.deepEqual(computeDistribute(BOXES.slice(0, 2), "horizontal"), []);
	});

	it("结果取整，避免亚像素位置让吸附与辅助线抖动", () => {
		const boxes: ArrangeBox[] = [
			{ id: "a", x: 0, y: 0, w: 101, h: 40 },
			{ id: "b", x: 0, y: 0, w: 50, h: 40 },
			{ id: "c", x: 301, y: 0, w: 50, h: 40 },
		];
		for (const u of computeDistribute(boxes, "horizontal")) {
			assert.equal(u.x, Math.round(u.x));
		}
	});
});

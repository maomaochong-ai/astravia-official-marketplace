/**
 * 节点库 · 双击插入（V0.4.84）。
 *
 * 覆盖用户报的「拖到画布添加节点·双击插入」——之前每行只有 onDragStart 没有 onDoubleClick，
 * 双击无任何效果。现在行上补了 onDoubleClick → onInsertItem(key, label)，
 * 由画布在中心新建节点。这里直接验证：双击某图表行会用该 key 触发 onInsertItem。
 *
 * 运行：npm test
 */

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { createElement } from "react";
import RTL from "@testing-library/react";

import { NodeLibrary } from "../../features/bi-editor/canvas/components/node-library.tsx";

const { cleanup, fireEvent, render } = RTL;

afterEach(() => cleanup());

/** 按显示文本找某一行可拖节点。 */
function rowByText(text: string): Element {
	const rows = [...document.querySelectorAll('[draggable="true"]')];
	const row = rows.find((el) => el.textContent?.includes(text));
	assert.ok(row, `应渲染可拖节点行「${text}」`);
	return row!;
}

describe("节点库 · 双击插入", () => {
	it("双击图表行会以该图表 key 触发 onInsertItem", () => {
		const calls: Array<[string, string]> = [];
		render(createElement(NodeLibrary, { onInsertItem: (key, label) => calls.push([key, label]) }));

		fireEvent.doubleClick(rowByText("折线图"));

		assert.equal(calls.length, 1, "双击应恰好触发一次 onInsertItem");
		assert.equal(calls[0][0], "chart-line", "应传入折线图 key");
		assert.equal(calls[0][1], "折线图");
	});

	it("双击只触发 onInsertItem，一次且不因重复查行而翻倍", () => {
		const calls: string[] = [];
		render(createElement(NodeLibrary, { onInsertItem: (key) => calls.push(key) }));

		fireEvent.doubleClick(rowByText("柱状图"));

		assert.equal(calls.length, 1, "双击一次只应触发一次 onInsertItem");
		assert.equal(calls[0], "chart-bar");
	});
});
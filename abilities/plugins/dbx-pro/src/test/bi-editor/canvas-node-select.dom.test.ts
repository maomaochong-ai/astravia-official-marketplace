/**
 * 画布 · 节点单击选中 → 底部工具条 + insertAtCenter 双击插入底（V0.4.84）。
 *
 * 覆盖用户报的：
 *   1. 「画布节点点击后底部的小按钮没有出现」→ 单击节点应选中并出现节点下方浮动工具条；
 *   2. NodeLibrary「双击插入」的底层能力 insertAtCenter：在画布中心新增节点并选中。
 *
 * 说明：
 * - 节点卡片根元素带 data-node-id；单击 = pointerdown 后再 pointerup（无移动即单击）。
 *  NodeGraph 的 onMove/onUp 挂在 window 上，fireEvent 会冒泡到 window。
 * - 工具条按钮无文字，用 title 查询。
 * - happy-dom 布局坐标均为 0：pointerdown→pointerup 无移动即「单击」。
 *
 * 运行：npm test
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { act, createElement, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import RTL from "@testing-library/react";

import {
	NodeGraph,
	type Link,
	type NodeGraphApi,
	type NodePos,
} from "../../features/bi-editor/canvas/components/node-graph.tsx";

const { cleanup, fireEvent, render } = RTL;

const SOURCE_NODE: NodePos = { x: 16, y: 16, w: 196, h: 132, tone: "#3b82f6", kind: "source-table", values: {} };

interface Bridge {
	nodes: Record<string, NodePos>;
	setNodes: Dispatch<SetStateAction<Record<string, NodePos>>>;
	links: Link[];
	api: NodeGraphApi | null;
}

let bridge!: Bridge;

function Harness({ initial }: { initial: Record<string, NodePos> }) {
	const [nodes, setNodes] = useState(initial);
	const [links, setLinks] = useState<Link[]>([]);
	const apiRef = useRef<{ current: NodeGraphApi | null }>({ current: null });
	bridge.nodes = nodes;
	bridge.setNodes = setNodes;
	bridge.links = links;
	bridge.api = apiRef.current && apiRef.current.current;
	// NodeGraph 在渲染体内给 api.current 赋值，commit 后再回读一次，测试才能拿到方法。
	useEffect(() => {
		bridge.api = apiRef.current && apiRef.current.current;
	});
	return createElement(NodeGraph, { nodes, setNodes, links, setLinks, nodeResults: {}, api: apiRef.current });
}

beforeEach(() => {
	bridge = { nodes: {}, setNodes: () => {}, links: [], api: null };
});

afterEach(() => cleanup());

/** 单击节点：pointerdown(节点) → pointerup(节点)，无移动。 */
function clickNode(nodeId: string, clientX = 50, clientY = 50) {
	const el = document.querySelector(`[data-node-id="${nodeId}"]`);
	assert.ok(el, `node ${nodeId} rendered`);
	fireEvent.pointerDown(el!, { clientX, clientY });
	fireEvent.pointerUp(el!, { clientX, clientY });
}

/** 底部工具条是否出现（以其「复制节点」按钮是否渲染为判据）。 */
function hasToolbar() {
	return Boolean(document.querySelector('[title="复制节点"]'));
}

describe("节点单击选中 → 底部工具条", () => {
	it("单击节点后选中它，并出现节点下方工具条", () => {
		const nodes = { "a": { ...SOURCE_NODE } };
		render(createElement(Harness, { initial: nodes }));

		act(() => clickNode("a"));

		assert.ok(bridge.nodes["a"]?.selected, "节点 a 应被选中");
		assert.ok(hasToolbar(), "选中后应出现底部工具条（复制按钮）");
	});

	it("单击工具条的删除按钮能删除节点", () => {
		const nodes = { "a": { ...SOURCE_NODE }, "b": { ...SOURCE_NODE, x: 300 } };
		render(createElement(Harness, { initial: nodes }));

		act(() => clickNode("a"));
		const del = document.querySelector('[title="删除节点"]');
		assert.ok(del, "删除按钮应在工具条里");
		act(() => {
			fireEvent.click(del!);
		});

		assert.ok(!document.querySelector('[data-node-id="a"]'), "节点 a 应被删除");
		assert.ok(document.querySelector('[data-node-id="b"]'), "节点 b 应保留");
	});

	it("insertAtCenter 在画布中心新增节点并选中（NodeLibrary 双击插入的底）", () => {
		const nodes = { "a": { ...SOURCE_NODE } };
		render(createElement(Harness, { initial: nodes }));

		assert.ok(bridge.api, "api 应已就绪（NodeGraph 挂载后赋值）");
		act(() => bridge.api!.insertAtCenter("chart-line"));

		const ids = Array.from(document.querySelectorAll('[data-node-id]'));
		assert.ok(ids.length >= 2, "应新增一个节点（chart-line）");
		assert.ok(hasToolbar(), "新增节点后应出现底部工具条");
	});
});
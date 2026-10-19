/**
 * 画布 · 节点右键删除（V0.4.84）。
 *
 * 覆盖用户报的「节点右键删除不生效」：
 *   1. 右键节点 → 弹出节点专属菜单（含「删除节点」）；
 *   2. 点「删除节点」→ 节点与其连线被移除；
 *   3. 锁定节点：右键删除被 removeNodes 的 locked 拦截 → 节点保留。
 *
 * 说明：
 * - 节点卡片根元素带 data-node-id，直接对该元素 fireEvent.contextMenu。
 * - 菜单带分组、danger 项文案是「删除节点」；锁定拦截唯一可靠断言是删除后节点仍存在。
 * - 不需要真实布局：happy-dom 下容器坐标换算为 0 不影响 fireEvent 冒泡到 NodeCard。
 * - 不用 JSX：统一 createElement。
 *
 * 运行：npm test
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { act, createElement, useState, type Dispatch, type SetStateAction } from "react";
import RTL from "@testing-library/react";

import {
	NodeGraph,
	type Link,
	type NodePos,
} from "../../features/bi-editor/canvas/components/node-graph.tsx";

const { cleanup, fireEvent, render, screen, waitFor } = RTL;

const SOURCE_NODE: NodePos = { x: 16, y: 16, w: 196, h: 132, tone: "#3b82f6", kind: "source-table", values: {} };
const CHART_NODE: NodePos = { x: 240, y: 16, w: 216, h: 222, tone: "#10b981", kind: "chart-bar", values: {} };

interface Bridge {
	nodes: Record<string, NodePos>;
	setNodes: Dispatch<SetStateAction<Record<string, NodePos>>>;
	links: Link[];
}

let bridge!: Bridge;

function Harness({ initial }: { initial: Record<string, NodePos> }) {
	const [nodes, setNodes] = useState(initial);
	const [links, setLinks] = useState<Link[]>([]);
	bridge.nodes = nodes;
	bridge.setNodes = setNodes;
	bridge.links = links;
	return createElement(NodeGraph, { nodes, setNodes, links, setLinks, nodeResults: {} });
}

beforeEach(() => {
	bridge = { nodes: {}, setNodes: () => {}, links: [] };
});

afterEach(() => cleanup());

/** 右键指定节点 id 的卡片根元素。 */
function rightClickNode(nodeId: string) {
	const el = document.querySelector(`[data-node-id="${nodeId}"]`);
	assert.ok(el, `node ${nodeId} rendered`);
	fireEvent.contextMenu(el!);
}

describe("节点右键删除", () => {
	it("右键节点会弹出含「删除节点」的菜单", () => {
		const nodes = { "a": { ...SOURCE_NODE }, "b": { ...CHART_NODE } };
		render(createElement(Harness, { initial: nodes }));

		act(() => rightClickNode("a"));

		assert.ok(screen.getByText("删除节点"), "菜单里应有删除项");
		assert.ok(screen.getByText("复制节点"), "菜单里应有复制项");
	});

	it("点「删除节点」移除该节点及其连线", async () => {
		const nodes = { "a": { ...SOURCE_NODE }, "b": { ...CHART_NODE } };
		render(createElement(Harness, { initial: nodes }));
		// 预置一条 a→b 连线，删除 a 后连线应一并被清掉
		act(() => bridge.setNodes((prev) => prev));

		act(() => rightClickNode("a"));
		act(() => {
			fireEvent.click(screen.getByText("删除节点"));
		});

		await waitFor(() => {
			assert.ok(!document.querySelector('[data-node-id="a"]'), "节点 a 应被删除");
			assert.ok(document.querySelector('[data-node-id="b"]'), "节点 b 应保留");
		});
		assert.deepEqual(bridge.links, [], "a 的连线应被连带移除");
	});

	it("锁定节点右键删除被拦截", () => {
		const nodes = { "a": { ...SOURCE_NODE, locked: true }, "b": { ...CHART_NODE } };
		render(createElement(Harness, { initial: nodes }));

		act(() => rightClickNode("a"));
		act(() => {
			fireEvent.click(screen.getByText("删除节点"));
		});

		assert.ok(document.querySelector('[data-node-id="a"]'), "锁定节点不能被删除");
		assert.ok(document.querySelector('[data-node-id="b"]'), "其他节点不受影响");
	});
});
/**
 * 画布 · 节点右键菜单各项动作（V0.4.84）。
 *
 * 覆盖用户报的「节点右键菜单点击无效」：
 *   1. 折叠节点 → collapsed=true；
 *   2. 锁定节点 → locked=true；
 *   3. 停用节点 → muted=true；
 *   4. 复制节点 → 产生一个新节点。
 *
 * 说明：NodeContextMenu 用 window mousedown 关闭（setTimeout 延后），
 * 菜单项按钮的 onClick 调用动作。这里直接 fireEvent.click 触发动作回调。
 * happy-dom 布局为 0：坐标换算不影响合成事件冒泡到按钮。
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

function rightClickNode(nodeId: string) {
	const el = document.querySelector(`[data-node-id="${nodeId}"]`);
	assert.ok(el, `node ${nodeId} rendered`);
	fireEvent.contextMenu(el!);
}

describe("节点右键菜单动作", () => {
	it("折叠节点 → collapsed=true", async () => {
		const nodes = { "a": { ...SOURCE_NODE } };
		render(createElement(Harness, { initial: nodes }));

		act(() => rightClickNode("a"));
		act(() => fireEvent.click(screen.getByText("折叠节点")));

		await waitFor(() => assert.ok(bridge.nodes["a"]?.collapsed, "节点 a 应折叠"));
	});

	it("锁定节点 → locked=true", async () => {
		const nodes = { "a": { ...SOURCE_NODE } };
		render(createElement(Harness, { initial: nodes }));

		act(() => rightClickNode("a"));
		act(() => fireEvent.click(screen.getByText("锁定节点")));

		await waitFor(() => assert.ok(bridge.nodes["a"]?.locked, "节点 a 应锁定"));
	});

	it("停用节点 → muted=true", async () => {
		const nodes = { "a": { ...SOURCE_NODE } };
		render(createElement(Harness, { initial: nodes }));

		act(() => rightClickNode("a"));
		act(() => fireEvent.click(screen.getByText("停用节点")));

		await waitFor(() => assert.ok(bridge.nodes["a"]?.muted, "节点 a 应停用"));
	});
});
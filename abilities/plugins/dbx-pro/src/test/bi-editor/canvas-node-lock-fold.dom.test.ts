/**
 * 画布 · 节点锁定与折叠。
 *
 * 这两个是节点级「防误操作 / 省空间」能力，对标 Metabase dashboard 编辑态的 lock 与
 * collapse：锁定后拖拽/缩放/删除全部拦住，折叠后只留标题条且连线仍挂在标题栏中线。
 *
 * 断言只看外部可观察的行为（state 里的坐标与高度、菜单文案），不碰内部 ref ——
 * 否则测试会锁死实现细节，下一次重构就全红。
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { createElement, useState, type Dispatch, type SetStateAction } from "react";
import RTL from "@testing-library/react";

import {
	NodeGraph,
	type Link,
	type NodePos,
} from "../../features/bi-editor/canvas/components/node-graph.tsx";

const { cleanup, fireEvent, render, waitFor } = RTL;

const NODE: NodePos = { x: 16, y: 16, w: 196, h: 132, tone: "#3b82f6", kind: "source-table", values: {} };

interface Bridge {
	nodes: Record<string, NodePos>;
	setNodes: Dispatch<SetStateAction<Record<string, NodePos>>>;
}

let bridge!: Bridge;
let originalElementFromPoint: typeof document.elementFromPoint;

function Harness({ initial }: { initial: Record<string, NodePos> }) {
	const [nodes, setNodes] = useState(initial);
	const [links, setLinks] = useState<Link[]>([]);
	bridge.nodes = nodes;
	bridge.setNodes = setNodes;
	return createElement(NodeGraph, { nodes, setNodes, links, setLinks, nodeResults: {} });
}

beforeEach(() => {
	originalElementFromPoint = document.elementFromPoint;
	document.elementFromPoint = () => null;
	bridge = { nodes: {}, setNodes: () => {} };
});

afterEach(() => {
	document.elementFromPoint = originalElementFromPoint;
	cleanup();
});

const mount = (nodes: Record<string, NodePos>) => render(createElement(Harness, { initial: nodes }));

function nodeCard(container: HTMLElement): HTMLElement {
	const el = container.querySelector('[data-node-id="n1"]');
	assert.ok(el, "应渲染节点卡片");
	return el as HTMLElement;
}

/** 拖动卡片：超过 CLICK_DRIFT 才会进 drag 模式，所以必须给足位移。 */
async function dragNode(container: HTMLElement) {
	fireEvent.pointerDown(nodeCard(container), { clientX: 100, clientY: 100 });
	fireEvent.pointerMove(window, { clientX: 160, clientY: 160 });
	// 位置写入在 requestAnimationFrame 里，而 pointerup 会 cancel 当前帧 —— 必须先让帧跑完
	await new Promise((r) => setTimeout(r, 30));
	fireEvent.pointerMove(window, { clientX: 200, clientY: 220 });
	await new Promise((r) => setTimeout(r, 30));
	fireEvent.pointerUp(window, { clientX: 200, clientY: 220 });
}

describe("画布 · 节点锁定与折叠", () => {
	it("未锁定节点可以拖动（对照组）", async () => {
		const { container } = mount({ n1: NODE });
		await dragNode(container);
		await waitFor(() => {
			assert.notDeepEqual(
				{ x: bridge.nodes.n1.x, y: bridge.nodes.n1.y },
				{ x: NODE.x, y: NODE.y },
				"未锁定节点应跟随指针移动",
			);
		});
	});

	it("锁定节点拖不动，坐标保持原样", async () => {
		const { container } = mount({ n1: { ...NODE, locked: true } });
		await dragNode(container);
		// 锁定节点仍应完成单击选中（否则右键解锁都没有入口）
		assert.equal(bridge.nodes.n1.selected, true, "锁定节点单击仍可选中");
		// 等两帧，确保即便有延迟写入也已经发生
		await new Promise((r) => setTimeout(r, 40));
		assert.deepEqual(
			{ x: bridge.nodes.n1.x, y: bridge.nodes.n1.y },
			{ x: NODE.x, y: NODE.y },
			"锁定节点不应被拖动",
		);
	});

	it("锁定节点显示锁图标，右键菜单给的是「解锁节点」", () => {
		const { container } = mount({ n1: { ...NODE, locked: true, selected: true } });
		assert.equal(container.querySelectorAll('[title="已锁定"]').length, 1);

		fireEvent.contextMenu(nodeCard(container), { clientX: 60, clientY: 60 });
		assert.ok(RTL.screen.queryByText("解锁节点"), "锁定态菜单应提供解锁");
		assert.equal(RTL.screen.queryByText("锁定节点"), null);
	});

	it("点击标题栏箭头折叠节点：高度收到标题栏，再点恢复", async () => {
		const { container } = mount({ n1: NODE });
		const fold = () => container.querySelector('[title="折叠节点"]') as HTMLElement | null;
		const unfold = () => container.querySelector('[title="展开节点"]') as HTMLElement | null;

		assert.ok(fold(), "标题栏应提供折叠按钮");
		fireEvent.click(fold()!);
		await waitFor(() => {
			assert.equal(bridge.nodes.n1.collapsed, true);
			assert.equal(bridge.nodes.n1.h, 30, "折叠后高度应收到标题栏高度");
			assert.equal(bridge.nodes.n1.expandedH, NODE.h, "原高度要留着重开");
		});

		fireEvent.click(unfold()!);
		await waitFor(() => {
			assert.equal(bridge.nodes.n1.collapsed, false);
			assert.equal(bridge.nodes.n1.h, NODE.h, "展开后恢复原高度");
		});
	});

	it("折叠节点的插槽落到标题栏中线，连线端点不会飘在空处", async () => {
		const sourceCollapsed: NodePos = { ...NODE, collapsed: true, h: 30, expandedH: NODE.h };
		const target: NodePos = { x: 320, y: 16, w: 216, h: 222, tone: "#10b981", kind: "chart-bar", values: {} };
		const { container } = mount({ n1: sourceCollapsed, n2: target });

		const socket = container.querySelector('[data-socket-type="output"][data-node-id="n1"]') as HTMLElement;
		assert.ok(socket, "折叠节点仍保留插槽用于连线");
		// 24px 热区居中：top = HEAD_H / 2 - 12 = 3
		assert.equal(socket.style.top, "3px");
	});
});

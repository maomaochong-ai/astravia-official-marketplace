/**
 * 画布 · 端口连线「拖拽优先」（D4）。
 *
 * 修复前：pointerdown 落在 output 插槽上，同一帧就弹「添加节点」菜单 —— 单纯点一下插槽
 * 也会弹菜单，用户根本走不到「拖出一条线」。修复后语义：
 *   1. 按下插槽只启动待定连线（出现跟随指针的虚线），不弹菜单；
 *   2. 拖动过程中只更新虚线，不弹菜单 —— 中途弹菜单会抢焦点，看起来就像「拖不出线」；
 *   3. 松开在空白处 → 菜单出现在落点，供用户挑一个下游节点；
 *   4. 点一下就走（无漂移）→ 既不弹菜单也不建连线。
 *
 * 为什么这样写：
 * - happy-dom 没有布局引擎，elementFromPoint 不可靠 → 本文件统一桩成 null（只有最后一条用例
 *   需要真实命中，临时换成插槽元素）。这也顺带证明「拖拽结束在卡片/插槽上」不会误弹菜单。
 * - 菜单没有 role=menu，稳定查询点是标题文案「添加节点」；待定连线是 stroke-dasharray="6 4" 的 path。
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
	linkWriteCount: number;
}

let bridge!: Bridge;
let originalElementFromPoint: typeof document.elementFromPoint;

/** 需要真实 nodes 状态：连线完成会把新 link 写回 state，静态 props 观察不到。 */
function Harness({ initial }: { initial: Record<string, NodePos> }) {
	const [nodes, setNodes] = useState(initial);
	const [links, setLinks] = useState<Link[]>([]);
	bridge.nodes = nodes;
	bridge.setNodes = setNodes;
	bridge.links = links;
	const setLinksWithCount: Dispatch<SetStateAction<Link[]>> = (update) => {
		bridge.linkWriteCount += 1;
		setLinks(update);
	};
	return createElement(NodeGraph, { nodes, setNodes, links, setLinks: setLinksWithCount, nodeResults: {} });
}

beforeEach(() => {
	originalElementFromPoint = document.elementFromPoint;
	document.elementFromPoint = () => null;
	bridge = { nodes: {}, setNodes: () => {}, links: [], linkWriteCount: 0 };
});

afterEach(() => {
	document.elementFromPoint = originalElementFromPoint;
	cleanup();
});

function outputSocket(container: HTMLElement, nodeId: string): HTMLElement {
	const el = container.querySelector(`[data-socket-type="output"][data-node-id="${nodeId}"]`);
	assert.ok(el, `节点 ${nodeId} 应有输出插槽`);
	return el as HTMLElement;
}

function inputSocket(container: HTMLElement, nodeId: string): HTMLElement | null {
	return container.querySelector(`[data-socket-type="input"][data-node-id="${nodeId}"]`) as HTMLElement | null;
}

/** 已打开的「添加节点」菜单数量（菜单没有 role=menu，用标题文案定位）。 */
function menuCount(): number {
	return screen.queryAllByText("添加节点").length;
}

/** 待定连线（跟随指针的虚线贝塞尔）。 */
function pendingPath(container: HTMLElement): Element | null {
	return (
		Array.from(container.querySelectorAll("path")).find(
			(p) => (p.getAttribute("stroke-dasharray") ?? "").trim() === "6 4",
		) ?? null
	);
}

function mount(nodes: Record<string, NodePos>) {
	return render(createElement(Harness, { initial: nodes }));
}

describe("画布 · 端口连线拖拽优先（D4）", () => {
	it("按下输出插槽只启动待定连线，不弹菜单", () => {
		const { container } = mount({ n1: SOURCE_NODE });
		fireEvent.pointerDown(outputSocket(container, "n1"), { clientX: 100, clientY: 100 });

		assert.equal(menuCount(), 0, "单击插槽不应在同一帧弹出菜单");
		assert.ok(pendingPath(container), "应出现跟随指针的待定连线");
		assert.equal(bridge.linkWriteCount, 0, "仅按下不应写入连线");
	});

	it("拖动途中不弹菜单，松手落空白才弹且只弹一次", () => {
		const { container } = mount({ n1: SOURCE_NODE });
		fireEvent.pointerDown(outputSocket(container, "n1"), { clientX: 100, clientY: 100 });
		assert.equal(menuCount(), 0);

		fireEvent.pointerMove(window, { clientX: 120, clientY: 100 });
		fireEvent.pointerMove(window, { clientX: 220, clientY: 160 });
		assert.equal(menuCount(), 0, "拖动过程中不应弹菜单");
		assert.ok(pendingPath(container), "拖动过程中待定连线跟随指针");

		fireEvent.pointerUp(window, { clientX: 220, clientY: 160 });
		assert.equal(menuCount(), 1, "松手落在空白处才弹出菜单");
		assert.equal(pendingPath(container), null, "松手后待定连线应收起");
	});

	it("从输入插槽反向拖到输出插槽 → 反向建边，方向被正规化", async () => {
		const { container } = mount({ n1: SOURCE_NODE, n2: CHART_NODE });
		const target = inputSocket(container, "n2");
		assert.ok(target, "chart 节点应有输入插槽");

		fireEvent.pointerDown(target, { clientX: 300, clientY: 100 });
		assert.ok(pendingPath(container), "从输入插槽按下也应出现待定连线");

		document.elementFromPoint = () => outputSocket(container, "n1");
		fireEvent.pointerUp(window, { clientX: 100, clientY: 100 });

		assert.equal(menuCount(), 0, "反向拉线落空不应弹新增菜单");
		await waitFor(() => assert.equal(bridge.links.length, 1));
		assert.equal(bridge.links[0].from, "n1", "源必须仍是输出插槽那一侧");
		assert.equal(bridge.links[0].to, "n2");
	});

	it("点一下插槽就走：既不弹菜单也不建连线、不留待定连线", () => {
		const { container } = mount({ n1: SOURCE_NODE });
		const out = outputSocket(container, "n1");

		fireEvent.pointerDown(out, { clientX: 100, clientY: 100 });
		fireEvent.pointerUp(out, { clientX: 100, clientY: 100 });

		assert.equal(menuCount(), 0, "无漂移的单击不应弹菜单");
		assert.equal(pendingPath(container), null);
		assert.equal(bridge.linkWriteCount, 0);
	});

	it("松手落在别的节点输入插槽上 → 直接完成连线，不弹菜单", async () => {
		const { container } = mount({ n1: SOURCE_NODE, n2: CHART_NODE });
		const out = outputSocket(container, "n1");
		const target = inputSocket(container, "n2");
		assert.ok(target, "chart 节点应有输入插槽");

		fireEvent.pointerDown(out, { clientX: 100, clientY: 100 });
		document.elementFromPoint = () => target;
		fireEvent.pointerUp(window, { clientX: 300, clientY: 100 });

		assert.equal(menuCount(), 0, "落在输入插槽上应直接连成线，不该再弹菜单");
		await waitFor(() => assert.equal(bridge.links.length, 1));
		assert.equal(bridge.links[0].from, "n1");
		assert.equal(bridge.links[0].to, "n2");
	});

	it("松手落在自身输入插槽上 → 不建自连、也不弹菜单", () => {
		const { container } = mount({ c1: CHART_NODE });
		const out = outputSocket(container, "c1");
		const target = inputSocket(container, "c1");

		fireEvent.pointerDown(out, { clientX: 100, clientY: 100 });
		document.elementFromPoint = () => target;
		fireEvent.pointerUp(window, { clientX: 100, clientY: 100 });

		assert.equal(menuCount(), 0);
		assert.equal(bridge.linkWriteCount, 0, "起点与终点同节点不应建连线");
	});

	it("拖到挂载后才新增的节点上仍能完成连线（hitSocket 读的是最新 nodes）", async () => {
		const { container } = mount({ n1: SOURCE_NODE });

		// 模拟「拖拽过程中画布上又出现了一个节点」：state 里有 n2，但闭包里的 nodes 是旧的
		await act(async () => {
			bridge.setNodes((prev) => ({ ...prev, n2: CHART_NODE }));
		});
		const target = inputSocket(container, "n2");
		assert.ok(target, "新增节点应渲染出输入插槽");

		const out = outputSocket(container, "n1");
		fireEvent.pointerDown(out, { clientX: 100, clientY: 100 });
		document.elementFromPoint = () => target;
		fireEvent.pointerUp(window, { clientX: 300, clientY: 100 });

		await waitFor(() => assert.equal(bridge.links.length, 1, "应完成 n1 → n2 的连线"));
		assert.equal(bridge.links[0].from, "n1");
		assert.equal(bridge.links[0].to, "n2");
	});
});

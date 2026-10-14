/**
 * 画布 · 连线与输出插槽同色（wireTone）。
 *
 * 修复前：图表类节点的输出插槽是系列色（`var(--color-series-1)`，跟随画布调色板），
 * 但从它引出的连线仍是节点模板色（TONE.chart 的绿色 #10b981）—— 同一条数据流上
 * 一头蓝一头绿。本文件钉两件事：
 *   1. 纯函数层：`wireTone` / `isChartKind` 的取值表（图表类 → 系列色；其余 → 原 tone；缺 tone → 默认色）；
 *   2. DOM 层：真的从图表节点插槽拖出一条线，落到另一个节点的输入插槽，断言
 *      「卡片强调色 === 输出插槽底色 === 连线 tone === 连线 style.stroke」四者一致；
 *      非图表节点则四处一致地保持自己的数据类型色。
 *
 * 为什么这样写：
 * - 连线色可能是 CSS 变量，SVG 的 presentation attribute 不接受 var()，所以连线必须走 `style`。
 *   这里顺手断言 `getAttribute("stroke") === null`，防止以后又被改回属性写法而静默丢色
 *   （happy-dom 的 style 往返已实测：`path.style.stroke` 会原样保留 var()）。
 * - happy-dom 没有布局引擎，`elementFromPoint` 不可靠 → beforeEach 统一桩成 null，
 *   需要真实命中的用例在松手前临时换成目标插槽元素。
 * - 不用 JSX：统一 createElement；DOM 骨架与 canvas-link-menu.dom.test.ts 保持一致。
 *
 * 运行：npm test
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { createElement, useState, type Dispatch, type SetStateAction } from "react";
import RTL from "@testing-library/react";

import { isChartKind, wireTone } from "../../features/bi-editor/canvas/lib/link-tone.ts";
import { TONE } from "../../features/bi-editor/canvas/components/node-card.tsx";
import { SERIES } from "../../features/bi-editor/shared/components/charts.tsx";
import {
	NodeGraph,
	type Link,
	type NodePos,
} from "../../features/bi-editor/canvas/components/node-graph.tsx";

const { cleanup, fireEvent, render, waitFor } = RTL;

/** NODE_TEMPLATES 里所有图表类节点的 kind 前缀约定。 */
const CHART_KINDS = [
	"chart-line",
	"chart-bar",
	"chart-donut",
	"chart-kpi",
	"chart-funnel",
	"chart-boxplot",
	"chart-pie",
	"chart-scatter",
	"chart-map",
	"chart-radar",
];

/** 非图表节点：各自沿用 TONE 的数据类型色。 */
const NON_CHART_KINDS = [
	"source-table",
	"source-sql",
	"source-connector",
	"source-api",
	"output-page",
	"adv-table",
	"screen-page",
	"screen-map",
	"filter-select",
	"metric-big",
	"group-chart",
];

describe("wireTone / isChartKind — 取值表", () => {
	it("图表类 kind 全部命中 chart- 前缀", () => {
		for (const kind of CHART_KINDS) {
			assert.equal(isChartKind(kind), true, `${kind} 应判为图表类`);
		}
	});

	it("近似但不符合前缀约定的 kind 不算图表类", () => {
		for (const kind of ["", "chart", "charting", "Chart-bar", "prechart-bar", "source-chart-bar"]) {
			assert.equal(isChartKind(kind), false, `"${kind}" 不应判为图表类`);
		}
		assert.equal(isChartKind(undefined), false, "undefined 不应判为图表类");
	});

	it("图表类节点的连线色固定取系列色 1，忽略节点自身 tone", () => {
		for (const kind of CHART_KINDS) {
			// 图表节点的模板 tone 是 TONE.chart（绿），正是修复前连线显示的错色
			assert.equal(wireTone(TONE.chart, isChartKind(kind)), SERIES[0], `${kind} 应取系列色`);
			assert.equal(wireTone("#123456", isChartKind(kind)), SERIES[0], `${kind} 不应被 stored tone 影响`);
			assert.equal(wireTone(undefined, isChartKind(kind)), SERIES[0], `${kind} 缺 tone 也取系列色`);
		}
	});

	it("非图表节点原样沿用自身 tone（数据类型语义色）", () => {
		for (const kind of NON_CHART_KINDS) {
			assert.equal(wireTone(TONE.table, isChartKind(kind)), TONE.table, `${kind} 应保留数据集色`);
			assert.equal(wireTone(TONE.result, isChartKind(kind)), TONE.result, `${kind} 应保留结果色`);
			assert.equal(wireTone(TONE.control, isChartKind(kind)), TONE.control, `${kind} 应保留控件色`);
		}
	});

	it("tone 缺失时回落 TONE.chart（与改动前的默认值一致，避免连线变成无色）", () => {
		assert.equal(wireTone(undefined, false), TONE.chart);
		// 空串按 ?? 语义原样传递；NodePos.tone 是必填 string，实际不会出现空串
		assert.equal(wireTone("", false), "");
	});

	it("系列色 1 是画布调色板的 CSS 变量（调色板切换能影响连线）", () => {
		assert.equal(SERIES[0], "var(--color-series-1)");
		assert.notEqual(SERIES[0], TONE.chart, "系列色不能等于图表模板色，否则本修复无从观察");
	});
});

const CHART_NODE: NodePos = { x: 16, y: 16, w: 216, h: 222, tone: TONE.chart, kind: "chart-bar", values: {} };
const METRIC_NODE: NodePos = { x: 280, y: 16, w: 180, h: 110, tone: TONE.result, kind: "metric-big", values: {} };

interface Bridge {
	nodes: Record<string, NodePos>;
	setNodes: Dispatch<SetStateAction<Record<string, NodePos>>>;
	links: Link[];
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
	return createElement(NodeGraph, { nodes, setNodes, links, setLinks, nodeResults: {} });
}

beforeEach(() => {
	originalElementFromPoint = document.elementFromPoint;
	document.elementFromPoint = () => null;
	bridge = { nodes: {}, setNodes: () => {}, links: [] };
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

function inputSocket(container: HTMLElement, nodeId: string): HTMLElement {
	const el = container.querySelector(`[data-socket-type="input"][data-node-id="${nodeId}"]`);
	assert.ok(el, `节点 ${nodeId} 应有输入插槽`);
	return el as HTMLElement;
}

/** 卡片的强调色块（图标底色 span 的 color 就是 NodeCard 收到的 tone）。 */
function cardAccent(container: HTMLElement, nodeId: string): string {
	const card = container.querySelector(`[data-node-id="${nodeId}"]:not([data-socket-row])`);
	assert.ok(card, `节点 ${nodeId} 卡片应存在`);
	const chip = card.querySelector("span.bg-background");
	assert.ok(chip, `节点 ${nodeId} 卡片应有强调色块`);
	return (chip as HTMLElement).style.color;
}

/** 已落地的连线描边：排除虚线待定连线与 hover 命中区。 */
function solidLinkPaths(container: HTMLElement): SVGPathElement[] {
	return Array.from(container.querySelectorAll("path")).filter(
		(p) => (p.getAttribute("stroke-dasharray") ?? "").trim() === "" && (p as SVGPathElement).style.stroke !== "",
	) as SVGPathElement[];
}

/** 待定连线（跟随指针的虚线贝塞尔）。 */
function pendingPath(container: HTMLElement): SVGPathElement | null {
	return (
		(Array.from(container.querySelectorAll("path")).find(
			(p) => (p.getAttribute("stroke-dasharray") ?? "").trim() === "6 4",
		) as SVGPathElement | undefined) ?? null
	);
}

function mount(nodes: Record<string, NodePos>) {
	return render(createElement(Harness, { initial: nodes }));
}

describe("画布 · 连线与输出插槽同色（DOM）", () => {
	it("图表节点引出的连线取系列色，且与卡片强调色、输出插槽底色一致", async () => {
		const { container } = mount({ n1: CHART_NODE, n2: METRIC_NODE });
		const out = outputSocket(container, "n1");
		const target = inputSocket(container, "n2");

		assert.equal(out.style.background, SERIES[0], "图表节点输出插槽应是系列色");

		fireEvent.pointerDown(out, { clientX: 100, clientY: 100 });
		document.elementFromPoint = () => target;
		fireEvent.pointerUp(window, { clientX: 400, clientY: 100 });

		await waitFor(() => assert.equal(bridge.links.length, 1, "应完成连线"));
		assert.equal(bridge.links[0].tone, SERIES[0], "连线 tone 应取系列色，而不是节点模板绿");
		assert.equal(cardAccent(container, "n1"), SERIES[0], "卡片强调色应与连线同色");

		const paths = solidLinkPaths(container);
		assert.equal(paths.length, 1, "应渲染出一条连线");
		assert.equal(paths[0].style.stroke, SERIES[0], "连线描边应等于系列色");
		assert.equal(paths[0].getAttribute("stroke"), null, "连线色不能走 presentation attribute（var() 会失效）");
	});

	it("非图表节点引出的连线保留自身数据类型色", async () => {
		const { container } = mount({ n1: METRIC_NODE, n2: CHART_NODE });
		const out = outputSocket(container, "n1");
		const target = inputSocket(container, "n2");

		assert.equal(out.style.background, TONE.result, "非图表节点输出插槽应是结果色");

		fireEvent.pointerDown(out, { clientX: 100, clientY: 100 });
		document.elementFromPoint = () => target;
		fireEvent.pointerUp(window, { clientX: 400, clientY: 100 });

		await waitFor(() => assert.equal(bridge.links.length, 1, "应完成连线"));
		assert.equal(bridge.links[0].tone, TONE.result, "非图表节点的连线不应被改成系列色");
		assert.equal(solidLinkPaths(container)[0].style.stroke, TONE.result);
	});

	it("拖拽中的待定连线同样是系列色（图表节点）", () => {
		const { container } = mount({ n1: CHART_NODE });
		fireEvent.pointerDown(outputSocket(container, "n1"), { clientX: 100, clientY: 100 });
		fireEvent.pointerMove(window, { clientX: 140, clientY: 100 });

		const path = pendingPath(container);
		assert.ok(path, "拖动中应出现待定连线");
		assert.equal(path.style.stroke, SERIES[0], "待定连线也应取系列色，避免松手瞬间跳色");
		assert.equal(path.getAttribute("stroke"), null);
	});

	it("拖拽中的待定连线对非图表节点保留数据类型色", () => {
		const { container } = mount({ n1: METRIC_NODE });
		fireEvent.pointerDown(outputSocket(container, "n1"), { clientX: 100, clientY: 100 });
		fireEvent.pointerMove(window, { clientX: 140, clientY: 100 });

		const path = pendingPath(container);
		assert.ok(path, "拖动中应出现待定连线");
		assert.equal(path.style.stroke, TONE.result);
	});
});

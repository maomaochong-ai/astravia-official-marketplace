/**
 * 画布侧栏高度契约（D3）+ 选中自动展开右侧面板（D2b）+ 调色板对节点卡片可见（D5）。
 *
 * D3/D5 为什么只能做到类名级：
 * - 测试环境是 happy-dom，没有布局引擎 —— getBoundingClientRect 全是 0，
 *   无法断言「底部空余区域被填满」或「侧栏真的等高」。
 * - 因此这里断言的是**契约**（flex + h-full 这两个让高度能撑满的必要条件）
 *   与**可观测的颜色落点**；视觉效果仍需人工在 Electron 里确认。
 *
 * 运行：npm test
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, describe, it } from "node:test";
import { createElement } from "react";
import RTL from "@testing-library/react";

import { NodeLibrary } from "../../features/bi-editor/canvas/components/node-library.tsx";
import { PropertyInspector } from "../../features/bi-editor/canvas/components/property-inspector.tsx";
import { NodeGraph, type NodePos } from "../../features/bi-editor/canvas/components/node-graph.tsx";
import type { BigscreenPage } from "../../features/bi-editor/shared/hooks/use-bigscreen-pages.ts";

const { cleanup, render } = RTL;
afterEach(() => cleanup());

const PAGE = { id: "p1", name: "未命名看板", style: "default", theme: "dark", template: "[]" } as unknown as BigscreenPage;

function root(container: HTMLElement): HTMLElement {
	const el = container.firstElementChild;
	assert.ok(el, "组件应渲染出根元素");
	return el as HTMLElement;
}

function canvasEditorSource(): string {
	return readFileSync(new URL("../../features/bi-editor/canvas/canvas-editor.tsx", import.meta.url), "utf8");
}

describe("画布侧栏高度契约（D3，静态可证）", () => {
	it("canvas-editor 的两个侧栏包裹层是 flex 且占满高度", () => {
		const src = canvasEditorSource();
		assert.match(src, /hidden md:flex h-full/, "左侧栏包裹层应 flex + h-full（否则收起后底部留白）");
		assert.match(src, /hidden lg:flex h-full/, "右侧栏包裹层应 flex + h-full");
	});

	it("节点库收起 / 展开两个根元素都撑满父高，且收起态没有多余的底边框", () => {
		const collapsed = root(render(createElement(NodeLibrary, { collapsed: true })).container);
		assert.match(collapsed.className, /h-full/);
		// 注意：不能写成 /border-b/ —— 那会误伤 border-border。要按 class token 匹配。
		assert.doesNotMatch(collapsed.className, /(^|\s)border-b(\s|$)/, "收起态残留的 border-b 会在底部画一条断线");
		assert.match(collapsed.className, /w-10/);

		const expanded = root(render(createElement(NodeLibrary, { collapsed: false })).container);
		assert.match(expanded.className, /h-full/);
		assert.match(expanded.className, /w-60/);
	});

	it("属性面板收起 / 展开两个根元素都撑满父高", () => {
		const props = {
			page: PAGE,
			theme: "default" as const,
			onThemeChange: () => {},
			onNodeUpdate: () => {},
			nodes: {},
			links: [],
			nodeResults: {},
		};

		const collapsed = root(render(createElement(PropertyInspector, { ...props, collapsed: true })).container);
		assert.match(collapsed.className, /h-full/);
		assert.match(collapsed.className, /w-10/);

		const expanded = root(render(createElement(PropertyInspector, { ...props, collapsed: false })).container);
		assert.match(expanded.className, /h-full/);
		assert.match(expanded.className, /w-72/);
	});
});

describe("选中节点自动展开右侧面板（D2b，静态可证）", () => {
	it("画布编辑器在选中节点变化时把右侧面板展开", () => {
		const src = canvasEditorSource();
		assert.match(src, /lastAutoExpandedRef/, "需要用 ref 记住上一次自动展开的节点，避免每帧抢用户的收起操作");
		assert.match(src, /setRightCollapsed\(false\)/, "选中节点后应自动展开属性面板");
	});
});

describe("调色板对节点卡片可见（D5）", () => {
	function cardOf(container: HTMLElement, id: string): HTMLElement {
		const el = container.querySelector(`[data-node-id="${id}"]:not([data-socket-row])`);
		assert.ok(el, `应找到节点卡片 ${id}`);
		return el as HTMLElement;
	}

	/** 卡片左上角的图标底色块 —— tone 的唯一落点。 */
	function toneChip(card: HTMLElement): HTMLElement {
		const el = card.querySelector("span.bg-background");
		assert.ok(el, "卡片应有图标底色块");
		return el as HTMLElement;
	}

	const CHART: NodePos = { x: 16, y: 16, w: 216, h: 222, tone: "#10b981", kind: "chart-bar", values: {} };
	const SOURCE: NodePos = { x: 16, y: 16, w: 196, h: 132, tone: "#3b82f6", kind: "source-table", values: {} };

	it("图表类节点的强调色跟随系列色变量（调色板一换就变）", () => {
		const { container } = render(
			createElement(NodeGraph, { nodes: { c1: CHART }, setNodes: () => {}, links: [], setLinks: () => {}, nodeResults: {} }),
		);
		const style = toneChip(cardOf(container, "c1")).getAttribute("style") ?? "";
		assert.match(style, /var\(--color-series-1\)/, "图表节点的强调色应指向系列色变量，而不是写死的 semantic tone");
	});

	it("数据源节点不受调色板影响，仍是自己的语义色", () => {
		const { container } = render(
			createElement(NodeGraph, { nodes: { s1: SOURCE }, setNodes: () => {}, links: [], setLinks: () => {}, nodeResults: {} }),
		);
		const style = toneChip(cardOf(container, "s1")).getAttribute("style") ?? "";
		assert.match(style, /#3b82f6/, "非图表节点应保留语义色");
		assert.doesNotMatch(style, /--color-series/, "调色板不应改写数据源节点的语义色");
	});

	it("调色板切换会重绘 .dbx-root 上的内联变量（接线证据）", () => {
		const src = canvasEditorSource();
		assert.match(src, /paletteStyle\(palette\)/, "画布根元素应挂 paletteStyle 生成的内联变量");
		assert.match(src, /onPaletteChange=\{setPaletteId\}/, "调色板选择器应写回 paletteId");
	});
});

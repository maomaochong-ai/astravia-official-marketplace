/**
 * 画布「首次进入就是 demo」—— 看板画布（BigscreenEditor）侧回归。
 *
 * 旧行为：服务端新建页面写的是 template: "[]"，而 parseTemplate 对空值一律回退到
 * INITIAL_NODES / INITIAL_LINKS，于是新建看板一进去就是别人摆好的 6 个节点 5 条连线；
 * 再加上挂载即置脏，随手一保存就把演示数据写进了库里。
 *
 * 这里锁的是四件事：
 *   - 空模板（含 "[]"、非法 JSON、看板以外的形状）→ 真空白画布 + 空态引导，不渲染分组框
 *   - 挂载 / 加载完不置脏（显示「已同步」），选中态不参与脏判断
 *   - 保存写出的就是画布上真实的内容，空画布存下去是空的，不会有演示残留
 *   - 页面里本来有内容时如实还原，保存后内容不变
 *
 * 用 bindEngineServices 换掉引擎请求层，不起真实引擎。
 * 不用 JSX：node 原生不转换 JSX，统一用 createElement（与 driver-manager-page.test.js 一致）。
 *
 * 运行：npm test（脚本已带 --import ./src/test/support/dom-setup.mjs）。
 */

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { createElement } from "react";

import RTL from "@testing-library/react";

import { bindEngineServices } from "../shared/services/engine-client.ts";
import { BigscreenEditor } from "../features/bi-editor/bigscreen-editor.tsx";

const { act, cleanup, fireEvent, render, screen, waitFor } = RTL;

afterEach(() => cleanup());

/** 画布上真实存在的节点：NodePos 的字段（x/y/w/h/tone 必填）。 */
const REAL_NODE = {
	x: 16,
	y: 56,
	w: 196,
	h: 132,
	tone: "accent",
	kind: "source-sql",
	values: { table: "orders" },
	// 历史保存里可能带 selected，加载后不该因此变脏，保存时也不该写回去
	selected: true,
};

function okEnvelope(data) {
	return { ok: true, status: 200, statusText: "OK", headers: {}, body: { ok: true, data } };
}

function page(overrides = {}) {
	return {
		id: "p1",
		name: "未命名看板",
		style: "default",
		theme: "dark",
		designType: "",
		backgroundImage: "",
		updateCount: 1,
		updateTime: "2026-10-12T00:00:00.000Z",
		createTime: "2026-10-12T00:00:00.000Z",
		visits: 0,
		template: "[]",
		...overrides,
	};
}

function stubEngine({ current = page() } = {}) {
	const calls = [];
	return {
		calls,
		request: async (_serviceId, request) => {
			calls.push({ path: request.path, method: request.method ?? "POST", body: request.body });
			if (request.path.startsWith("/drag/template/list")) return okEnvelope([]);
			if (request.path.startsWith("/drag/page/queryById")) return okEnvelope(current);
			if (request.path === "/drag/page/edit") return okEnvelope({ updateCount: 2 });
			throw new Error(`桩引擎没有这个路由：${request.path}`);
		},
		editCalls() {
			return calls.filter((c) => c.path === "/drag/page/edit");
		},
	};
}

async function openEditor(engine = stubEngine()) {
	bindEngineServices({ request: engine.request });
	const utils = render(createElement(BigscreenEditor, { pageId: "p1", onClose: () => {} }));
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 0));
	});
	return utils;
}

/** ⌘S —— 顶栏那个「保存」按钮在没脏的时候是 disabled 的，快捷键才是稳定的触发口。 */
async function saveViaShortcut() {
	await act(async () => {
		fireEvent.keyDown(document.body, { key: "s", metaKey: true });
		await new Promise((resolve) => setTimeout(resolve, 0));
	});
}

function savedTemplate(engine) {
	const edits = engine.editCalls();
	assert.equal(edits.length, 1, "应当只有一次保存请求");
	return JSON.parse(edits[0].body.template);
}

describe("看板画布 · 空模板不再是 demo", () => {
	it("template 为 \"[]\" 时是空白画布：有引导、无分组框、不是未保存", async () => {
		const { container } = await openEditor();

		assert.ok(screen.getByTestId("canvas-empty-guide"), "空画布应显示引导");
		assert.ok(screen.getByText("已同步"), "刚进入不该是「未保存」");
		assert.equal(container.querySelector('[style*="left: 4px"]'), null, "空画布上不该摆分组框");
	});

	it("template 解析不了（脏数据）也退回空白画布，而不是演示布局", async () => {
		const engine = stubEngine({ current: page({ template: "{不是 JSON" }) });
		const { container } = await openEditor(engine);

		assert.ok(screen.getByTestId("canvas-empty-guide"));
		assert.equal(container.querySelector('[style*="left: 4px"]'), null);
	});

	it("空画布保存下去的是空内容，不会凭空写出节点", async () => {
		const engine = stubEngine();
		await openEditor(engine);
		await saveViaShortcut();

		await waitFor(() => assert.equal(engine.editCalls().length, 1));
		const template = savedTemplate(engine);
		assert.deepEqual(Object.keys(template.nodes), []);
		assert.deepEqual(template.links, []);
		assert.ok(screen.getByText("已同步"), "保存后应回到「已同步」");
	});

	it("页面里有真实节点时如实还原，挂载不算脏，保存只写这些节点", async () => {
		const engine = stubEngine({
			current: page({ template: JSON.stringify({ nodes: { n1: REAL_NODE }, links: [] }) }),
		});
		const { container } = await openEditor(engine);

		assert.equal(screen.queryByTestId("canvas-empty-guide"), null, "有节点就不该再显示空态引导");
		assert.ok(container.querySelector('[style*="left: 4px"]'), "有节点时应渲染分组框");
		assert.ok(screen.getByText("已同步"), "带着 selected 的旧数据加载后也不该是「未保存」");

		await saveViaShortcut();
		await waitFor(() => assert.equal(engine.editCalls().length, 1));

		const template = savedTemplate(engine);
		assert.deepEqual(Object.keys(template.nodes), ["n1"]);
		assert.equal(template.nodes.n1.kind, "source-sql");
		assert.equal(template.nodes.n1.values.table, "orders");
		assert.equal("selected" in template.nodes.n1, false, "临时选中态不该写进库");
	});

	it("分组框计数按节点真实坐标推导，不是写死的演示数字", async () => {
		const engine = stubEngine({
			current: page({
				template: JSON.stringify({
					nodes: {
						a: { ...REAL_NODE, x: 40, y: 80 },
						b: { ...REAL_NODE, x: 80, y: 200 },
						c: { ...REAL_NODE, x: 600, y: 300 },
					},
					links: [],
				}),
			}),
		});
		const { container } = await openEditor(engine);

		const frames = container.querySelectorAll('[style*="left: 4px"], [style*="left: 212px"], [style*="left: 428px"]');
		assert.equal(frames.length, 3, "三个分组框都应渲染");
		// a、b 落在「数据源」框内，c 落在「图表与产物」框内
		const LABELS = ["数据源", "SQL 查询", "图表与产物"];
		const counts = {};
		for (const el of frames) {
			const text = el.textContent ?? "";
			const label = LABELS.find((l) => text.startsWith(l));
			assert.ok(label, `分组框文案异常：${text}`);
			counts[label] = Number(text.slice(label.length));
		}
		assert.deepEqual(counts, { "数据源": 2, "SQL 查询": 0, "图表与产物": 1 });
	});
});

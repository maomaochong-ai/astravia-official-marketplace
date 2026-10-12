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

import { bindEngineServices, type EngineServicesApi } from "../../shared/services/engine-client.ts";
import { BigscreenEditor } from "../../features/bi-editor/canvas/canvas-editor.tsx";
import type { BigscreenPage } from "../../features/bi-editor/shared/hooks/use-bigscreen-pages.ts";

/** 桩引擎收到的一次请求；body 是插件发出去的 JSON 载荷。 */
type EngineCall = { path: string; method: string; body: Record<string, any> };
/** 插件调用引擎时传的请求描述，这里只关心 path/method/body。 */
type EngineRequest = { path: string; method?: string; body?: Record<string, any> };

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

function okEnvelope(data: unknown) {
	return { ok: true, status: 200, statusText: "OK", headers: {}, body: { ok: true, data } };
}

function page(overrides: Partial<BigscreenPage> = {}): BigscreenPage {
	return {
		id: "p1",
		name: "未命名看板",
		style: "default",
		theme: "dark",
		designType: 100,
		backgroundImage: "",
		updateCount: 1,
		updateTime: "2026-10-12T00:00:00.000Z",
		createTime: "2026-10-12T00:00:00.000Z",
		visits: 0,
		template: "[]",
		...overrides,
	};
}

function stubEngine({ current = page() }: { current?: BigscreenPage } = {}) {
	const calls: EngineCall[] = [];
	return {
		calls,
		request: async (_serviceId: string, request: EngineRequest) => {
			calls.push({ path: request.path, method: request.method ?? "POST", body: request.body ?? {} });
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

async function openEditor(engine: ReturnType<typeof stubEngine> = stubEngine()) {
	bindEngineServices({ request: engine.request as EngineServicesApi["request"] });
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

function savedTemplate(engine: ReturnType<typeof stubEngine>) {
	const edits = engine.editCalls();
	assert.equal(edits.length, 1, "应当只有一次保存请求");
	return JSON.parse(edits[0].body.template);
}

describe("看板画布 · 空模板不再是 demo", () => {
	it("template 为 \"[]\" 时是空白画布：有引导、无分组框、不是未保存", async () => {
		const { container } = await openEditor();

		assert.ok(screen.getByTestId("canvas-empty-guide"), "空画布应显示引导");
		assert.ok(screen.getByText("已同步"), "刚进入不该是「未保存」");
		assert.equal(container.querySelectorAll("[data-node-group-zone]").length, 0, "空画布上不该摆固定分组框");
	});

	it("template 解析不了（脏数据）也退回空白画布，而不是演示布局", async () => {
		const engine = stubEngine({ current: page({ template: "{不是 JSON" }) });
		const { container } = await openEditor(engine);

		assert.ok(screen.getByTestId("canvas-empty-guide"));
		assert.equal(container.querySelectorAll("[data-node-group-zone]").length, 0);
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
		assert.ok(screen.getByText("已同步"), "带着 selected 的旧数据加载后也不该是「未保存」");

		await saveViaShortcut();
		await waitFor(() => assert.equal(engine.editCalls().length, 1));

		const template = savedTemplate(engine);
		assert.deepEqual(Object.keys(template.nodes), ["n1"]);
		assert.equal(template.nodes.n1.kind, "source-sql");
		assert.equal(template.nodes.n1.values.table, "orders");
		assert.equal("selected" in template.nodes.n1, false, "临时选中态不该写进库");
	});

	it("分组节点作为独立节点渲染，不再是固定分组框", async () => {
		const engine = stubEngine({
			current: page({
				template: JSON.stringify({
					nodes: {
						a: { ...REAL_NODE, x: 40, y: 80 },
						b: { ...REAL_NODE, x: 80, y: 200 },
						g1: { x: 400, y: 40, w: 220, h: 400, tone: "#64748b", kind: "group-source", isGroup: true, groupLabel: "数据源", groupIcon: "icon-[lucide--database]" },
					},
					links: [],
				}),
			}),
		});
		await openEditor(engine);

		assert.equal(screen.queryByTestId("canvas-empty-guide"), null, "有节点就不该显示空态引导");
	});
});

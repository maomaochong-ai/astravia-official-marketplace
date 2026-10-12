/**
 * 大屏画布「首次进入就是 demo」+「保存写错状态」—— BigscreenScreenEditor 侧回归。
 *
 * 旧行为有两层问题：
 *   1. 节点状态的初值直接调 makeInitialNodes(page.name)，铺了 8 个演示节点；新建大屏一进去就是假的，
 *      而 page.template 从来没被读过。
 *   2. 保存不由本组件负责：编辑只存在 useState 里，顶栏「发布到工作树」调的是父组件的 onSave，
 *      序列化的是父组件的看板 { nodes, links } —— 大屏上的编辑永远存不下去。
 *
 * 现在锁的是：
 *   - 空模板（含 "[]"、看板形状的旧数据）→ 真空白大屏 + 空态引导
 *   - 挂载不置脏；点节点库加一个节点才变「未保存」
 *   - 「发布到工作树」先把自己的 { nodes, settings } 存进 /drag/page/edit，再 /drag/share/publish，
 *     存下去的只有用户放的内容，没有演示残留
 *   - 已有大屏内容能如实还原
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
import { BigscreenScreenEditor } from "../features/bi-editor/bigscreen-screen-editor.tsx";

const { act, cleanup, fireEvent, render, screen, waitFor } = RTL;

afterEach(() => cleanup());

function okEnvelope(data) {
	return { ok: true, status: 200, statusText: "OK", headers: {}, body: { ok: true, data } };
}

function screenPage(overrides = {}) {
	return {
		id: "bs1",
		name: "经营大屏",
		style: "bigScreen",
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

function existingNode() {
	return { id: "s-title-bar-3", kind: "title-bar", x: 40, y: 40, w: 1840, h: 72, title: "季度经营看板" };
}

function stubEngine() {
	const calls = [];
	return {
		calls,
		request: async (_serviceId, request) => {
			calls.push({ path: request.path, method: request.method ?? "POST", body: request.body });
			if (request.path === "/drag/page/edit") return okEnvelope({ updateCount: 2 });
			if (request.path === "/drag/share/publish") return okEnvelope({ url: "https://example.com/s/bs1" });
			if (request.path === "/drag/run/trigger") return okEnvelope({ ok: true });
			throw new Error(`桩引擎没有这个路由：${request.path}`);
		},
		paths() {
			return calls.map((c) => c.path);
		},
		call(path) {
			return calls.find((c) => c.path === path);
		},
	};
}

async function openEditor(engine, overrides = {}, onSaved) {
	bindEngineServices({ request: engine.request });
	const props = { page: screenPage(overrides), onClose: () => {} };
	if (onSaved) props.onSaved = onSaved;
	const utils = render(createElement(BigscreenScreenEditor, props));
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 0));
	});
	return utils;
}

describe("大屏画布 · 空模板不再是 demo", () => {
	it("template 为 \"[]\" 时是空白大屏：有引导、0 个节点、不是未保存", async () => {
		const engine = stubEngine();
		await openEditor(engine);

		assert.ok(screen.getByTestId("screen-empty-guide"), "空大屏应显示引导");
		assert.ok(screen.getByText(/^1 页 · 0 个节点$/), "节点数应为 0");
		assert.equal(screen.queryByText("未保存"), null, "刚进入不该是「未保存」");
		assert.deepEqual(engine.paths(), [], "只看不改时不该发任何请求");
	});

	it("看板画布留下的旧 template（对象形状）也当空大屏，不会炸也不会铺演示节点", async () => {
		const engine = stubEngine();
		await openEditor(engine, { template: JSON.stringify({ nodes: { n1: { x: 1, y: 2 } }, links: [] }) });

		assert.ok(screen.getByTestId("screen-empty-guide"));
		assert.ok(screen.getByText(/^1 页 · 0 个节点$/));
	});

	it("点节点库加一个节点：引导消失、变「未保存」", async () => {
		const engine = stubEngine();
		await openEditor(engine);

		fireEvent.click(screen.getByRole("button", { name: /大屏标题/ }));

		await waitFor(() => assert.equal(screen.queryByTestId("screen-empty-guide"), null));
		assert.ok(screen.getByText(/^1 页 · 1 个节点$/));
		await waitFor(() => assert.ok(screen.getByText("未保存")));
	});

	it("发布到工作树：先存本画布内容再发布，且存的不含演示节点", async () => {
		const engine = stubEngine();
		const saved = [];
		await openEditor(engine, { template: "[]" }, (updateCount) => saved.push(updateCount));

		fireEvent.click(screen.getByRole("button", { name: /大屏标题/ }));
		await waitFor(() => assert.ok(screen.getByText("未保存")));

		fireEvent.click(screen.getByRole("button", { name: /发布到工作树/ }));
		await waitFor(() => assert.equal(engine.call("/drag/share/publish") !== undefined, true));

		const paths = engine.paths();
		assert.equal(paths[0], "/drag/page/edit", "必须先保存再发布");
		assert.equal(paths[1], "/drag/share/publish");

		const edit = engine.call("/drag/page/edit");
		assert.equal(edit.body.id, "bs1");
		assert.equal(edit.body.style, "bigScreen");
		const template = JSON.parse(edit.body.template);
		assert.equal(template.nodes.length, 1, "存下去的只有用户放的那一个节点");
		assert.equal(template.nodes[0].kind, "title-bar");
		assert.match(template.nodes[0].id, /^s-title-bar-\d+$/, "节点 id 应是本次新建的");
		assert.equal(engine.call("/drag/share/publish").body.pageId, "bs1");
		assert.deepEqual(saved, [2], "onSaved 应收到服务端回传的 updateCount");
		await waitFor(() => assert.equal(screen.queryByText("未保存"), null), { timeout: 5_000 });
	});

	it("已有的节点留在大屏上的内容能如实还原，挂载不算脏", async () => {
		const engine = stubEngine();
		await openEditor(engine, {
			template: JSON.stringify({
				nodes: [existingNode()],
				settings: { resolution: "2560 × 1440 · 16:9" },
			}),
		});

		assert.equal(screen.queryByTestId("screen-empty-guide"), null, "有节点就不该再显示空态引导");
		assert.ok(screen.getByText(/^1 页 · 1 个节点$/));
		assert.equal(screen.queryByText("未保存"), null, "加载已有内容不该算脏");
	});

	it("保存后的内容与再次保存保持一致（不脏 → 不改 → 不重复置脏）", async () => {
		const engine = stubEngine();
		await openEditor(engine, {
			template: JSON.stringify({ nodes: [existingNode()], settings: {} }),
		});

		fireEvent.click(screen.getByRole("button", { name: /发布到工作树/ }));
		await waitFor(() => assert.equal(engine.call("/drag/share/publish") !== undefined, true));

		const template = JSON.parse(engine.call("/drag/page/edit").body.template);
		assert.deepEqual(Object.keys(template).sort(), ["nodes", "settings"]);
		assert.equal(template.nodes[0].id, "s-title-bar-3", "原有节点 id 必须原样保留");
		assert.equal(template.nodes[0].title, "季度经营看板");
		assert.equal("selected" in template.nodes[0], false, "临时选中态不该落盘");
		assert.ok(template.settings.resolution, "设置项应一起存下去");
	});
});

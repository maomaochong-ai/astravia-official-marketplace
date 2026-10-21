/**
 * 属性面板 · 选表下拉（数据源节点）。
 *
 * 钉住的行为：数据源/表节点的「表名」字段在连接可解析时渲染成真实的表下拉，
 * 而不是让用户凭记忆手打表名；拿不到表列表时退回自由文本输入并说明原因。
 *
 * 为什么这样写：
 * - 引擎请求层用 bindEngineServices 换掉，
 *   不起真实引擎、不打网络。真实链路是 api.request（不是全局 fetch）。
 * - 不用 JSX：node 原生不转换 JSX，统一用 createElement。
 * - 表列表按连接名做了模块级缓存，测试之间必须清理，否则第二个用例会读到第一个的缓存。
 *
 * 运行：npm test（脚本已带 --import ./src/test/support/dom-setup.mjs）
 */

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { createElement } from "react";
import RTL from "@testing-library/react";

import {
	bindEngineServices,
	type EngineServicesApi,
	type EngineConnectionSummary,
} from "../../shared/services/engine-client.ts";
import { PropertyInspector } from "../../features/bi-editor/canvas/components/property-inspector.tsx";
import { clearConnectionTablesCache } from "../../features/bi-editor/canvas/hooks/use-connection-tables.ts";
import type { NodePos } from "../../features/bi-editor/canvas/components/node-graph.tsx";
import type { BigscreenPage } from "../../features/bi-editor/shared/hooks/use-bigscreen-pages.ts";

const { cleanup, render, waitFor } = RTL;
afterEach(() => {
	cleanup();
	clearConnectionTablesCache();
});

const PAGE = {
	id: "p1",
	name: "未命名看板",
	style: "default",
	theme: "dark",
	template: "[]",
} as unknown as BigscreenPage;

const CONNECTIONS: EngineConnectionSummary[] = [
	{ id: "a1b2-uuid", name: "sales-mysql", groupPath: "", type: "mysql", host: "127.0.0.1", port: 3306, database: "sales" },
	{ id: "c3d4-uuid", name: "ops-pg", groupPath: "", type: "postgres", host: "127.0.0.1", port: 5432, database: "ops" },
];

/** 表名是自由文本字段的数据源节点；values 里存的是连接 id（写入侧的既有语义）。 */
function sourceNode(id: string, values: Record<string, unknown>): NodePos {
	return { x: 16, y: 16, w: 196, h: 132, tone: "#3b82f6", kind: "source-table", values };
}

/** 桩引擎：/tables 按连接名给不同结果，其余路径返回空数据。 */
function stubEngine(tablesByConnection: Record<string, string[]>) {
	const calls: { path: string; body: Record<string, unknown> }[] = [];
	const api = {
		request: async (_serviceId: string, request: { path: string; body?: Record<string, unknown> }) => {
			calls.push({ path: request.path, body: request.body ?? {} });
			if (request.path === "/tables") {
				const connection = String(request.body?.connectionName ?? "");
				const tables = (tablesByConnection[connection] ?? []).map((name) => ({ name, kind: "table" }));
				return { ok: true, status: 200, statusText: "OK", headers: {}, body: { ok: true, data: { connection, tables } } };
			}
			return { ok: true, status: 200, statusText: "OK", headers: {}, body: { ok: true, data: {} } };
		},
	} as unknown as EngineServicesApi;
	bindEngineServices(api);
	return { calls };
}

function mountInspector(node: NodePos) {
	return render(
		createElement(PropertyInspector, {
			page: PAGE,
			theme: "default",
			onThemeChange: () => {},
			selectedNode: { id: "n1", node },
			onNodeUpdate: () => {},
			nodes: { n1: node },
			links: [],
			connections: CONNECTIONS,
			nodeResults: {},
		}),
	);
}

describe("属性面板 · 表名字段（D2）", () => {
	it("连接可解析时渲染真实表下拉，且请求用的是连接名（不是面板存的 id）", async () => {
		const engine = stubEngine({ "sales-mysql": ["orders", "dim_user"] });
		const { container } = mountInspector(sourceNode("n1", { datasourceId: "a1b2-uuid", table: "" }));

		await waitFor(() => {
			assert.ok(
				container.querySelector('select[data-field-key="table"]'),
				"应渲染出表下拉而不是自由文本输入",
			);
		});

		const select = container.querySelector('select[data-field-key="table"]') as HTMLSelectElement;
		const values = Array.from(select.querySelectorAll("option")).map((o) => o.getAttribute("value"));
		assert.deepEqual(values, ["", "orders", "dim_user"]);

		// 引擎侧收到的必须是解析后的连接名 —— 这是 D1「面板存 id、引擎按 name 跑」的接线证据
		assert.equal(engine.calls.length, 1);
		assert.equal(engine.calls[0].path, "/tables");
		assert.equal(engine.calls[0].body.connectionName, "sales-mysql");
	});

	it("表列表为空时退回自由文本输入，并说明原因", async () => {
		stubEngine({});
		const { container } = mountInspector(sourceNode("n1", { datasourceId: "c3d4-uuid", table: "" }));

		await waitFor(() => {
			assert.ok(
				container.querySelector('input[data-field-key="table"]'),
				"拿不到表列表时应保留可手打的输入框",
			);
		});
		assert.equal(container.querySelector('select[data-field-key="table"]'), null);
		assert.match(container.textContent ?? "", /「ops-pg \(postgres\)」下未发现表，可手动输入/);
	});

	it("没选数据源时不发请求、不显示下拉，提示先选数据源", async () => {
		const engine = stubEngine({});
		const { container } = mountInspector(sourceNode("n1", { table: "" }));

		await waitFor(() => {
			assert.ok(container.querySelector('input[data-field-key="table"]'));
		});
		assert.equal(engine.calls.length, 0, "没有连接时不应发起 /tables 请求");
		assert.match(container.textContent ?? "", /选择数据源后可下拉选表/);
	});

	it("已手填的表名不会被下拉吃掉（补进选项并标注当前值）", async () => {
		stubEngine({ "sales-mysql": ["orders"] });
		const { container } = mountInspector(sourceNode("n1", { datasourceId: "a1b2-uuid", table: "legacy_table" }));

		await waitFor(() => {
			assert.ok(container.querySelector('select[data-field-key="table"]'));
		});
		const select = container.querySelector('select[data-field-key="table"]') as HTMLSelectElement;
		const legacy = Array.from(select.querySelectorAll("option")).find((o) => o.getAttribute("value") === "legacy_table");
		assert.ok(legacy, "手填的历史值应保留在下拉里");
		assert.match(legacy.textContent ?? "", /当前值/);
	});
});

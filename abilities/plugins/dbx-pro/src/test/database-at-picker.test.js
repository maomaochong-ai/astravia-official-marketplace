/**
 * DatabaseAtPicker 组件测试：连接列表 → 展开 → 表点击注入 @ token → 搜索过滤。
 * 不用 JSX / jest.mock：mock 宿主 runtime + mock 引擎服务 API，组件走真实 engine-client。
 */

import RTL from "@testing-library/react";
const { act, cleanup, fireEvent, render, screen, waitFor } = RTL;
import { createElement } from "react";
import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { setRuntime } from "../runtime-contract.ts";
import { bindEngineServices } from "../shared/services/engine-client.ts";
import { DatabaseAtPicker } from "../features/database-at-picker/index.tsx";

const inserted = [];

function envelope(data) {
	return { ok: true, data };
}

const mockApi = {
	async request(_serviceId, req) {
		let data;
		if (req.path === "/connections") {
			data = {
				connections: [
					{
						id: "c1",
						name: "demo-pg",
						type: "postgresql",
						host: "localhost",
						port: 5432,
						database: "demo",
					},
				],
			};
		} else if (req.path === "/schemas") {
			data = { connection: "demo-pg", supported: false, schemas: [] };
		} else if (req.path === "/tables") {
			data = {
				connection: "demo-pg",
				tables: [
					{ name: "users", kind: "table" },
					{ name: "orders", kind: "table" },
				],
			};
		} else {
			throw new Error(`unhandled ${req.path}`);
		}
		return { ok: true, status: 200, statusText: "OK", headers: {}, body: envelope(data) };
	},
};

describe("DatabaseAtPicker", () => {
	beforeEach(() => {
		inserted.length = 0;
		setRuntime({
			conversation: {
				insertText(text) {
					inserted.push(text);
				},
			},
			storage: {},
			secrets: {},
		});
		bindEngineServices(mockApi);
	});

	afterEach(() => {
		cleanup();
		bindEngineServices(null);
	});

	it("加载连接、展开表、点击表名注入 @ token", async () => {
		render(createElement(DatabaseAtPicker));

		const conn = await screen.findByText("demo-pg");
		assert.ok(conn, "连接名渲染");

		await act(async () => {
			fireEvent.click(conn);
		});

		const users = await screen.findByText("users");
		const orders = await screen.findByText("orders");
		assert.ok(users && orders, "展开后显示表列表");

		act(() => {
			fireEvent.click(users);
		});

		await waitFor(() => assert.equal(inserted.length, 1));
		assert.equal(inserted[0], "@`demo-pg:users` ");
	});

	it("搜索框过滤连接", async () => {
		render(createElement(DatabaseAtPicker));
		await screen.findByText("demo-pg");

		const input = screen.getByPlaceholderText(/搜索连接名/);
		act(() => {
			fireEvent.change(input, { target: { value: "nomatch" } });
		});

		await waitFor(() => assert.equal(screen.queryByText("demo-pg"), null));

		act(() => {
			fireEvent.change(input, { target: { value: "" } });
		});

		await waitFor(() => assert.ok(screen.queryByText("demo-pg")));
	});
});

/**
 * useConnectionEditor hook 测试 — 连接保存的完整状态机。
 *
 * 用内存假 services/storage/secrets 注入，不起真实引擎进程：
 * - 初始列表加载；
 * - 保存成功：POST /connections + 密码入 vault + onChange + 返回列表；
 * - 名称缺失：拦截并 alert；
 * - 引擎失败：alert，不触发 onChange；
 * - 切换数据库类型修正端口。
 */

import RTL from "@testing-library/react";
const { act, renderHook } = RTL;
import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { setRuntime } from "../runtime-contract.ts";
import { bindEngineServices } from "../shared/services/engine-client.ts";
import { useConnectionEditor } from "../features/database-workspace/hooks/use-connection-editor.ts";

/** 组装假宿主环境。 */
function setupHost({ failNextAdd = false } = {}) {
	const serverConnections = [
		{
			id: "srv-1",
			name: "existing-db",
			type: "postgres",
			host: "127.0.0.1",
			port: 5432,
			database: "app",
		},
	];
	const requests = [];
	const files = new Map();
	const secretMap = new Map();

	const services = {
		request: async (_id, req) => {
			requests.push(req);
			if (req.path === "/connections" && req.method === "GET") {
				return {
					status: 200,
					body: { ok: true, data: { connections: serverConnections.slice() } },
				};
			}
			if (req.path === "/connections" && req.method === "POST") {
				if (failNextAdd) {
					return {
						status: 400,
						body: { ok: false, error: { code: "BAD_REQUEST", message: "engine rejected" } },
					};
				}
				serverConnections.push({
					id: "new-id",
					name: req.body.name,
					type: req.body.dbType,
					host: req.body.host,
					port: req.body.port,
					database: req.body.database ?? "",
				});
				return {
					status: 200,
					body: { ok: true, data: { id: "uuid-1", name: req.body.name, detail: "added" } },
				};
			}
			if (req.path === "/api-sources" && req.method === "POST") {
				return {
					status: 200,
					body: { ok: true, data: { id: `api:${req.body.name}`, name: req.body.name, type: "api" } },
				};
			}
			if (req.path === "/api-sources/test" && req.method === "POST") {
				return {
					status: 200,
					body: {
						ok: true,
						data: {
							name: req.body.name,
							url: req.body.draft?.url ?? "",
							status: 200,
							columns: ["id", "amount"],
							sample: [{ id: 1, amount: 2 }],
							row_count: 12,
							total_records: 40,
							truncated: false,
							duration_ms: 33,
							fetched_at: "2026-01-01T00:00:00.000Z",
						},
					},
				};
			}
			throw new Error(`unexpected request: ${req.method} ${req.path}`);
		},
	};

	const storage = {
		readFile: async (path) => (files.has(path) ? files.get(path) : null),
		writeFile: async (path, data) => {
			files.set(path, data);
			return { revision: "rev-1" };
		},
	};

	const secrets = {
		get: async (key) => (secretMap.has(key) ? secretMap.get(key) : null),
		set: async (key, value) => {
			secretMap.set(key, value);
		},
		delete: async (key) => {
			secretMap.delete(key);
		},
	};

	setRuntime({ services, storage, secrets });
	bindEngineServices(services);

	return { requests, files, secretMap, serverConnections };
}

function validConnection(partial = {}) {
	return {
		id: "local-id",
		name: "new-conn",
		db_type: "postgres",
		host: "127.0.0.1",
		port: 5432,
		username: "u",
		password: "secret-pass",
		database: "d",
		ssl: false,
		is_production: false,
		read_only: false,
		...partial,
	};
}

/** 「API 接入」草稿：没有 host / port / 密码，配置全在 api 字段里。 */
function apiDraft(partial = {}) {
	return {
		id: "local-api",
		name: "orders-api",
		db_type: "api",
		host: "",
		port: 0,
		username: "",
		password: "",
		ssl: false,
		is_production: false,
		read_only: true,
		api: {
			url: "https://api.example.com/orders",
			method: "GET",
			auth: { kind: "bearer" },
			dataPath: "data.items",
			rowLimit: 500,
			token: "tok-1",
		},
		...partial,
	};
}

async function renderEditor() {
	const onChange = mock.fn();
	const rendered = renderHook(() => useConnectionEditor({ onChange }));
	// 等待挂载时的 readAllConfigs 异步效果完成。
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 0));
	});
	return { ...rendered, onChange };
}

describe("useConnectionEditor", () => {
	it("挂载后加载连接列表", async () => {
		setupHost();
		const { result } = await renderEditor();
		assert.equal(result.current.view, "list");
		assert.equal(result.current.connections.length, 1);
		assert.equal(result.current.connections[0].name, "existing-db");
	});

	it("startNew 切到表单态", async () => {
		setupHost();
		const { result } = await renderEditor();
		act(() => result.current.startNew());
		assert.equal(result.current.view, "form");
		assert.ok(result.current.editing);
	});

	it("保存成功：引擎 POST、密码入 vault、触发 onChange、返回列表", async () => {
		const host = setupHost();
		const { result, onChange } = await renderEditor();

		act(() => result.current.setEditing(validConnection()));
		await act(async () => {
			await result.current.save();
		});

		// 引擎收到 POST /connections，字段与表单一致。
		const post = host.requests.find((r) => r.method === "POST");
		assert.ok(post);
		assert.equal(post.body.name, "new-conn");
		assert.equal(post.body.dbType, "postgres");
		assert.equal(post.body.password, "secret-pass");

		// 密码写入加密 vault。
		assert.equal(host.secretMap.get("db-password:new-conn"), "secret-pass");
		// 本地镜像落盘且不含明文密码。
		const mirror = JSON.parse(host.files.get("connections.json"));
		const mirrored = mirror.connections.find((c) => c.name === "new-conn");
		assert.ok(mirrored);
		assert.equal(mirrored.password, "");

		// 回到列表，onChange 被调用，列表已刷新含新连接。
		assert.equal(result.current.view, "list");
		assert.equal(onChange.mock.calls.length > 0, true);
		assert.ok(result.current.connections.some((c) => c.name === "new-conn"));
	});

	it("名称为空时拦截保存并 alert，不发请求", async () => {
		const host = setupHost();
		const { result, onChange } = await renderEditor();
		if (typeof globalThis.alert !== "function") globalThis.alert = () => {};
		const alertSpy = mock.method(globalThis, "alert", () => {});

		act(() => result.current.startNew());
		act(() => result.current.setEditing(validConnection({ name: "  " })));
		await act(async () => {
			await result.current.save();
		});

		assert.equal(alertSpy.mock.calls.length, 1);
		assert.equal(host.requests.some((r) => r.method === "POST"), false);
		assert.equal(result.current.view, "form");
		assert.equal(onChange.mock.calls.length, 0);
		alertSpy.mock.restore();
	});

	it("引擎拒绝时保存失败：alert 报错、不触发 onChange", async () => {
		setupHost({ failNextAdd: true });
		const { result, onChange } = await renderEditor();
		if (typeof globalThis.alert !== "function") globalThis.alert = () => {};
		const alertSpy = mock.method(globalThis, "alert", () => {});

		act(() => result.current.startNew());
		act(() => result.current.setEditing(validConnection()));
		await act(async () => {
			await result.current.save();
		});

		assert.equal(alertSpy.mock.calls.length, 1);
		assert.match(alertSpy.mock.calls[0].arguments[0], /保存失败/);
		assert.equal(onChange.mock.calls.length, 0);
		assert.equal(result.current.view, "form");
		alertSpy.mock.restore();
	});

	it("setDbType 切换类型并修正默认端口", async () => {
		setupHost();
		const { result } = await renderEditor();
		act(() => result.current.startNew());
		act(() => result.current.setDbType("mysql"));
		assert.equal(result.current.editing.db_type, "mysql");
		assert.equal(result.current.editing.port, 3306);
	});

	it("setDbType 切到 API 接入：清掉端点字段并带上 api 默认值", async () => {
		setupHost();
		const { result } = await renderEditor();
		act(() => result.current.startNew());
		act(() => result.current.setEditing(validConnection()));
		act(() => result.current.setDbType("api"));

		const editing = result.current.editing;
		assert.equal(editing.db_type, "api");
		assert.equal(editing.host, "");
		assert.equal(editing.port, 0);
		assert.equal(editing.read_only, true);
		assert.equal(editing.api.url, "");
		assert.equal(editing.api.rowLimit, 1000);
	});

	it("setDbType 从 API 切回数据库：丢掉 api 配置并修正端口", async () => {
		setupHost();
		const { result } = await renderEditor();
		act(() => result.current.startNew());
		act(() => result.current.setEditing(apiDraft()));
		act(() => result.current.setDbType("mysql"));

		const editing = result.current.editing;
		assert.equal(editing.db_type, "mysql");
		assert.equal(editing.port, 3306);
		assert.equal(editing.api, undefined);
	});

	it("API 接入保存：走 /api-sources，不写引擎连接、不落密码", async () => {
		const host = setupHost();
		const { result, onChange } = await renderEditor();

		act(() => result.current.setEditing(apiDraft()));
		await act(async () => {
			await result.current.save();
		});

		const post = host.requests.find((r) => r.path === "/api-sources" && r.method === "POST");
		assert.ok(post);
		assert.equal(post.body.name, "orders-api");
		assert.equal(post.body.url, "https://api.example.com/orders");
		assert.equal(post.body.method, "GET");
		assert.equal(post.body.auth.kind, "bearer");
		assert.equal(post.body.dataPath, "data.items");
		assert.equal(post.body.rowLimit, 500);
		assert.equal(post.body.token, "tok-1");
		// 草稿里没有请求头 → 载荷不带 headers 键（服务端沿用已存值，而不是清空）。
		assert.equal("headers" in post.body, false);

		// 引擎不认 api 类型：不能走 /connections，也不写本地镜像 / vault
		assert.equal(host.requests.some((r) => r.path === "/connections" && r.method === "POST"), false);
		assert.equal(host.files.has("connections.json"), false);
		assert.equal(host.secretMap.size, 0);

		assert.equal(result.current.view, "list");
		assert.equal(onChange.mock.calls.length > 0, true);
	});

	it("API 接入凭据留空时不随请求回传（服务端沿用旧凭据）", async () => {
		const host = setupHost();
		const { result } = await renderEditor();
		act(() =>
			result.current.setEditing(
				apiDraft({ api: { url: "https://api.example.com/orders", method: "GET", auth: { kind: "bearer" } } }),
			),
		);
		await act(async () => {
			await result.current.save();
		});

		const post = host.requests.find((r) => r.path === "/api-sources" && r.method === "POST");
		assert.ok(post);
		assert.equal("token" in post.body, false);
		assert.equal("headers" in post.body, false);
	});

	it("API 接入填了自定义请求头时原样回传", async () => {
		const host = setupHost();
		const { result } = await renderEditor();
		act(() =>
			result.current.setEditing(
				apiDraft({
					api: {
						url: "https://api.example.com/orders",
						method: "GET",
						headers: { "X-Env": "prod" },
						auth: { kind: "none" },
					},
				}),
			),
		);
		await act(async () => {
			await result.current.save();
		});

		const post = host.requests.find((r) => r.path === "/api-sources" && r.method === "POST");
		assert.ok(post);
		assert.deepEqual(post.body.headers, { "X-Env": "prod" });
	});

	it("API 接入把请求头清空时显式回传空对象", async () => {
		const host = setupHost();
		const { result } = await renderEditor();
		act(() =>
			result.current.setEditing(
				apiDraft({
					api: { url: "https://api.example.com/orders", method: "GET", headers: {}, auth: { kind: "none" } },
				}),
			),
		);
		await act(async () => {
			await result.current.save();
		});

		const post = host.requests.find((r) => r.path === "/api-sources" && r.method === "POST");
		assert.ok(post);
		assert.deepEqual(post.body.headers, {});
	});

	it("API 接入缺接口地址时拦截保存", async () => {
		const host = setupHost();
		const { result, onChange } = await renderEditor();
		if (typeof globalThis.alert !== "function") globalThis.alert = () => {};
		const alertSpy = mock.method(globalThis, "alert", () => {});

		act(() => result.current.startNew());
		act(() => result.current.setEditing(apiDraft({ api: { url: "   ", method: "GET", auth: { kind: "none" } } })));

		await act(async () => {
			await result.current.save();
		});

		assert.equal(alertSpy.mock.calls.length, 1);
		assert.match(alertSpy.mock.calls[0].arguments[0], /接口地址/);
		assert.equal(host.requests.some((r) => r.path === "/api-sources"), false);
		assert.equal(result.current.view, "form");
		assert.equal(onChange.mock.calls.length, 0);
		alertSpy.mock.restore();
	});

	it("API 接入测试：走 /api-sources/test，不落盘，回报行数与列数", async () => {
		const host = setupHost();
		const { result } = await renderEditor();

		await act(async () => {
			await result.current.test(apiDraft());
		});

		const post = host.requests.find((r) => r.path === "/api-sources/test" && r.method === "POST");
		assert.ok(post);
		assert.equal(post.body.name, "orders-api");
		assert.equal(post.body.draft.url, "https://api.example.com/orders");
		assert.equal(post.body.draft.token, "tok-1");
		// 测试是干跑：既不必先存连接，也不应留下任何引擎连接写入
		assert.equal(host.requests.some((r) => r.path === "/api-sources" && r.method === "POST"), false);
		assert.equal(host.requests.some((r) => r.path === "/connections" && r.method === "POST"), false);
		assert.match(result.current.testResult, /接口可达/);
		assert.match(result.current.testResult, /12 行/);
		assert.match(result.current.testResult, /2 列/);
	});

	it("API 接入未命名时测试被拦下，不发请求", async () => {
		const host = setupHost();
		const { result } = await renderEditor();

		await act(async () => {
			await result.current.test(apiDraft({ name: "  " }));
		});

		assert.equal(host.requests.some((r) => r.path === "/api-sources/test"), false);
		assert.match(result.current.testResult, /连接名称/);
	});
});

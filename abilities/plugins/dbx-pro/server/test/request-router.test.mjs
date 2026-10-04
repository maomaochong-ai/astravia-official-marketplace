/**
 * request-router 测试。
 *
 * 路由 / 参数校验路径不需要引擎：404 / 405 / 400。
 * 真实数据路径（增删连、/tables、/query、/schemas）走真实 dbx-mcp，
 * 二进制不存在时整个数据套件显式 skip。
 */

import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { createRouter } from "../src/engine/request-router.mjs";
import { disposeDbxMcpClient } from "../src/engine/dbx-mcp-client.mjs";
import { engineBinaryAvailable, engineSkipMessage } from "./support/helpers.mjs";

const stubAuth = Object.freeze({ enabled: false, verify() {} });

after(async () => {
	await disposeDbxMcpClient();
});

describe("createRouter 构造约束", () => {
	it("缺少 auth 抛错", () => {
		assert.throws(() => createRouter(), /createRouter 需要 auth/);
	});
	it("正常构造返回 handle 与 routes", () => {
		const router = createRouter({ auth: stubAuth });
		assert.equal(typeof router.handle, "function");
		assert.ok(router.routes instanceof Map);
	});
});

describe("路由解析（不依赖引擎）", () => {
	const router = createRouter({ auth: stubAuth });

	it("未知路径 → 404 NOT_FOUND", async () => {
		const result = await router.handle({ method: "GET", pathname: "/nope" });
		assert.equal(result.status, 404);
		assert.equal(result.body.ok, false);
		assert.equal(result.body.error.code, "NOT_FOUND");
	});

	it("方法不允许 → 405 METHOD_NOT_ALLOWED", async () => {
		const result = await router.handle({ method: "PUT", pathname: "/health" });
		assert.equal(result.status, 405);
		assert.equal(result.body.error.code, "METHOD_NOT_ALLOWED");
	});

	it("POST /query 缺 connectionName → 400", async () => {
		const result = await router.handle({
			method: "POST",
			pathname: "/query",
			body: { sql: "SELECT 1" },
		});
		assert.equal(result.status, 400);
		assert.equal(result.body.error.code, "BAD_REQUEST");
	});

	it("POST /query 空白 SQL → 400", async () => {
		const result = await router.handle({
			method: "POST",
			pathname: "/query",
			body: { connectionName: "c", sql: "  " },
		});
		assert.equal(result.status, 400);
		assert.equal(result.body.error.code, "BAD_REQUEST");
	});

	it("POST /connections 缺 name/dbType → 400", async () => {
		const result = await router.handle({
			method: "POST",
			pathname: "/connections",
			body: { name: "x" },
		});
		assert.equal(result.status, 400);
		assert.equal(result.body.error.code, "BAD_REQUEST");
	});

	it("POST /tables 缺 connectionName → 400", async () => {
		const result = await router.handle({
			method: "POST",
			pathname: "/tables",
			body: {},
		});
		assert.equal(result.status, 400);
	});

	it("POST /describe 缺 table → 400", async () => {
		const result = await router.handle({
			method: "POST",
			pathname: "/describe",
			body: { connectionName: "c" },
		});
		assert.equal(result.status, 400);
	});

	it("POST /schema-context 缺 connectionName → 400", async () => {
		const result = await router.handle({
			method: "POST",
			pathname: "/schema-context",
			body: {},
		});
		assert.equal(result.status, 400);
	});
});

describe("路由数据路径（真实 dbx-mcp）", { skip: engineBinaryAvailable() ? false : engineSkipMessage }, () => {
	const router = createRouter({ auth: stubAuth });
	const NAME = `server-router-test-${Date.now().toString(36)}`;
	const names = [];

	async function handle(method, pathname, body) {
		return router.handle({ method, pathname, body });
	}

	it("POST /connections 保存连接成功（连接保存主链路）", async () => {
		const result = await handle("POST", "/connections", {
			name: NAME,
			dbType: "postgres",
			host: "127.0.0.1",
			port: 5432,
			username: "u",
			password: "p",
			database: "d",
			ssl: false,
		});
		assert.equal(result.status, 200);
		assert.equal(result.body.data.name, NAME);
		assert.match(result.body.data.id, /^[0-9a-f-]{36}$/i);
		names.push(NAME);
	});

	it("GET /connections 能读到刚保存的连接", async () => {
		const result = await handle("GET", "/connections");
		assert.equal(result.status, 200);
		const found = result.body.data.connections.find((c) => c.name === NAME);
		assert.ok(found);
		assert.equal(found.type, "postgres");
	});

	it("产品别名归一：mariadb 连接可保存", async () => {
		const aliasName = `${NAME}-maria`;
		const result = await handle("POST", "/connections", {
			name: aliasName,
			dbType: "mariadb",
			host: "127.0.0.1",
			port: 3306,
			username: "root",
			password: "p",
		});
		assert.equal(result.status, 200);
		names.push(aliasName);
	});

	it("DELETE /connections 删除连接", async () => {
		const result = await handle("DELETE", "/connections", { name: NAME });
		assert.equal(result.status, 200);
		assert.equal(result.body.data.deleted, NAME);
		// NAME 已删，cleanup 名单里移除，避免重复删除。
		const idx = names.indexOf(NAME);
		if (idx >= 0) names.splice(idx, 1);
	});

	it("清理全部测试连接", async () => {
		for (const name of names) {
			const result = await handle("DELETE", "/connections", { name });
			assert.equal(result.status, 200);
		}
		const remaining = (await handle("GET", "/connections")).body.data.connections
			.filter((c) => names.includes(c.name));
		assert.deepEqual(remaining, []);
	});
});

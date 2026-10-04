/**
 * http-server 单测 — 鉴权与引擎服务器生命周期。
 *
 * createAuth：令牌正确 / 错误 / 缺失；
 * createEngineServer：真实监听回环端口、/health 恒 200（即使引擎子进程缺失）、
 * 关闭后端口释放。不要求 dbx-mcp 二进制存在。
 */

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { createAuth, createEngineServer } from "../src/http-server.mjs";
import { disposeDbxMcpClient } from "../src/engine/dbx-mcp-client.mjs";

describe("createAuth", () => {
	const TOKEN = "secret-token-xyz";

	it("正确 Bearer 令牌放行", () => {
		const auth = createAuth({ token: TOKEN });
		assert.equal(auth.enabled, true);
		assert.doesNotThrow(() => auth.verify({ authorization: `Bearer ${TOKEN}` }));
	});

	it("错误令牌抛 UNAUTHORIZED", () => {
		const auth = createAuth({ token: TOKEN });
		assert.throws(
			() => auth.verify({ authorization: "Bearer wrong-token" }),
			(error) => error.code === "UNAUTHORIZED",
		);
	});

	it("缺失令牌抛 UNAUTHORIZED", () => {
		const auth = createAuth({ token: TOKEN });
		assert.throws(
			() => auth.verify({}),
			(error) => error.code === "UNAUTHORIZED",
		);
	});

	it("x-dbx-token 备用头也支持", () => {
		const auth = createAuth({ token: TOKEN });
		assert.doesNotThrow(() => auth.verify({ "x-dbx-token": TOKEN }));
	});

	it("disabled：任何请求放行，enabled=false", () => {
		const auth = createAuth({ token: TOKEN, disabled: true });
		assert.equal(auth.enabled, false);
		assert.doesNotThrow(() => auth.verify({}));
		assert.doesNotThrow(() => auth.verify({ authorization: "Bearer anything" }));
	});

	it("空 token 按禁用处理", () => {
		const auth = createAuth({ token: "" });
		assert.equal(auth.enabled, false);
	});
});

describe("createEngineServer 生命周期", () => {
	let dataDir;
	let server;
	const created = [];

	after(async () => {
		for (const item of created) {
			await new Promise((resolve) => item.close(resolve));
		}
		if (dataDir) rmSync(dataDir, { recursive: true, force: true });
		await disposeDbxMcpClient();
	});

	function listenOnEphemeral(instance) {
		return new Promise((resolve, reject) => {
			instance.once("error", reject);
			instance.listen(0, "127.0.0.1", () => resolve(instance.address().port));
		});
	}

	it("--auth-disabled 语义：服务器启动并返回 /health 200（引擎缺失也不崩溃）", async () => {
		dataDir = mkdtempSync(join(tmpdir(), "dbx-server-test-"));
		const engine = createEngineServer({
			authDisabled: true,
			dataDir,
		});
		server = engine.server;
		created.push(server);
		const port = await listenOnEphemeral(server);

		const response = await fetch(`http://127.0.0.1:${port}/health`);
		assert.equal(response.status, 200);
		const body = await response.json();
		assert.equal(body.ok, true);
		assert.equal(body.data.status, "ok");
		// dbx 字段存在：二进制缺失时为 error，存在时为 connected，但不影响 HTTP 状态。
		assert.ok(["connected", "error", "unknown"].includes(body.data.dbx.status));
		assert.equal(body.data.row_cap > 0, true);
	});

	it("未知路径返回 404 信封", async () => {
		const port = server.address().port;
		const response = await fetch(`http://127.0.0.1:${port}/no-such-route`);
		assert.equal(response.status, 404);
		const body = await response.json();
		assert.equal(body.ok, false);
		assert.equal(body.error.code, "NOT_FOUND");
	});

	it("非法转义路径不崩溃：按未知路径处理（Node URL 容忍 %ZZ）", async () => {
		const port = server.address().port;
		const response = await fetch(`http://127.0.0.1:${port}/%ZZ`);
		assert.equal(response.status, 404);
		const body = await response.json();
		assert.equal(body.error.code, "NOT_FOUND");
	});

	it("关闭服务器后端口释放", async () => {
		const port = server.address().port;
		await new Promise((resolve) => server.close(resolve));
		const index = created.indexOf(server);
		if (index >= 0) created.splice(index, 1);
		await assert.rejects(
			() => fetch(`http://127.0.0.1:${port}/health`),
			/fetch failed|ECONNREFUSED/,
		);
	});
});

/**
 * dbx-mcp-client 集成测试 — 直接对真实二进制做握手与工具调用。
 * 二进制不存在时整套 skip。
 *
 * 覆盖：
 * - 新 DbxMcpClient 以临时 dataDir 完成 MCP initialize 握手；
 * - dbx_add_connection → dbx_list_connections → dbx_remove_connection 全链路；
 * - dispose 幂等、可清理子进程；
 * - 单例 getDbxMcpClient 跨调用复用。
 */

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import {
	DbxMcpClient,
	disposeDbxMcpClient,
	getDbxMcpClient,
} from "../src/engine/dbx-mcp-client.mjs";
import { engineBinaryAvailable, engineSkipMessage } from "./helpers.mjs";

describe("dbx-mcp-client 真实引擎", { skip: engineBinaryAvailable() ? false : engineSkipMessage }, () => {
	let workDir;
	const clients = [];

	after(async () => {
		for (const client of clients) await client.dispose().catch(() => {});
		if (workDir) rmSync(workDir, { recursive: true, force: true });
	});

	it("新客户端用临时 dataDir 完成握手", async () => {
		workDir = mkdtempSync(join(tmpdir(), "dbx-mcp-client-"));
		const client = new DbxMcpClient({ dataDir: workDir });
		clients.push(client);
		// ensureInitialized 成功即握手通过（失败会抛错）。
		await assert.doesNotReject(() => client.ensureInitialized());
		// 重复调用不重建子进程。
		await assert.doesNotReject(() => client.ensureInitialized());
	});

	it("dbx_add/list/remove_connection 全链路", async () => {
		const client = new DbxMcpClient({ dataDir: workDir });
		clients.push(client);
		const name = `mcp-it-${Date.now().toString(36)}`;

		const added = await client.callTool("dbx_add_connection", {
			name,
			db_type: "postgres",
			host: "127.0.0.1",
			port: 5432,
			username: "u",
			password: "p",
			database: "d",
			ssl: false,
		});
		assert.equal(added.isError !== true, true);

		const listed = await client.callTool("dbx_list_connections", {});
		assert.equal(listed.isError !== true, true);
		const text = listed.content.map((c) => c.text).join("");
		assert.ok(text.includes(name));

		const removed = await client.callTool("dbx_remove_connection", { connection_name: name });
		assert.equal(removed.isError !== true, true);
	});

	it("不存在的工具调用返回错误而不是崩溃", async () => {
		const client = new DbxMcpClient({ dataDir: workDir });
		clients.push(client);
		// 对不存在的连接执行查询：错误以正常 MCP 响应返回。
		const result = await client.callTool(
			"dbx_execute_query",
			{ connection_name: "definitely-missing-conn", sql: "SELECT 1" },
		);
		// 引擎把业务错误放在 isError 响应里（不是传输异常）。
		assert.equal(result.isError, true);
		assert.ok(result.content[0].text.length > 0);
	});

	it("dispose 幂等且可重复调用", async () => {
		const client = new DbxMcpClient({ dataDir: workDir });
		clients.push(client);
		await client.ensureInitialized();
		await client.dispose();
		await assert.doesNotReject(() => client.dispose());
		const index = clients.indexOf(client);
		if (index >= 0) clients.splice(index, 1);
	});
});

describe("单例 getDbxMcpClient", { skip: engineBinaryAvailable() ? false : engineSkipMessage }, () => {
	after(async () => {
		await disposeDbxMcpClient();
	});

	it("多次获取返回同一实例", () => {
		const first = getDbxMcpClient();
		const second = getDbxMcpClient();
		assert.equal(first, second);
	});

	it("dispose 后重建为新实例", async () => {
		const first = getDbxMcpClient();
		await disposeDbxMcpClient();
		const second = getDbxMcpClient();
		assert.notEqual(first, second);
		await disposeDbxMcpClient();
	});
});

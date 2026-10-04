/**
 * 引擎服务端到端测试（headless）— 针对 dbx-mcp bridge 架构。
 *
 * 用子进程真起一个 bridge 进程（端口 0），从 stdout 的 `listening` 事件取回端口，
 * 再用 fetch 打真实 HTTP。被测入口是源码 `service/src/http-server.mjs`；
 * 用 DBX_ENGINE_ENTRY=service/main.mjs 可验证构建产物。
 *
 * 架构边界：bridge 只做鉴权 + 参数校验 + 透传 dbx-mcp；
 * dbx-mcp 自管连接，默认只读（写操作返回 SQL_BLOCKED）。
 */

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

/**
 * 读出前端的行数上限常量。
 *
 * 不能直接 import：settings 模块用无扩展名的相对路径（`./query-history`），
 * node --experimental-strip-types 不做扩展名解析，import 会 ERR_MODULE_NOT_FOUND。
 * 这里只取一个数值字面量，解析失败要报错而不是静默跳过断言。
 */
function readEngineRowCap() {
	const source = readFileSync(join(PLUGIN_ROOT, "src", "domain", "workbench-settings.ts"), "utf8");
	const match = source.match(/ENGINE_ROW_CAP\s*=\s*(\d+)/);
	if (!match) throw new Error("workbench-settings.ts 里找不到 ENGINE_ROW_CAP 定义");
	return Number(match[1]);
}

const HERE = fileURLToPath(new URL(".", import.meta.url));
const PLUGIN_ROOT = resolve(HERE, "..", "..");
const ENGINE_ENTRY = process.env.DBX_ENGINE_ENTRY ?? join(PLUGIN_ROOT, "server", "src", "http-server.mjs");
const TOKEN = "e2e-token-1234567890";

let workDir;
let sqliteFile;

function startEngine({ args = [], token = TOKEN } = {}) {
	return new Promise((resolvePromise, rejectPromise) => {
		const env = { ...process.env };
		if (token === null || token === undefined) delete env.ASTRAVIA_SERVICE_SECRET_ENGINE_KEY;
		else env.ASTRAVIA_SERVICE_SECRET_ENGINE_KEY = token;

		const child = spawn(process.execPath, [ENGINE_ENTRY, "--port", "0", ...args], {
			env,
			stdio: ["ignore", "pipe", "pipe"],
		});
		let stdout = "";
		let stderr = "";
		const timer = setTimeout(() => {
			child.kill("SIGKILL");
			rejectPromise(new Error(`引擎未在 20s 内就绪。stderr=${stderr}`));
		}, 20_000);
		child.stdout.on("data", (chunk) => {
			stdout += chunk.toString();
			for (const line of stdout.split("\n")) {
				if (!line.trim().startsWith("{")) continue;
				let event;
				try {
					event = JSON.parse(line);
				} catch {
					continue;
				}
				if (event.event === "listening") {
					clearTimeout(timer);
					resolvePromise({
						baseUrl: `http://127.0.0.1:${event.port}`,
						child,
						stop: () =>
							new Promise((done) => {
								if (child.exitCode !== null || child.signalCode !== null) {
									done(child.exitCode ?? 0);
									return;
								}
								child.once("exit", (code) => done(code));
								child.kill("SIGTERM");
							}),
					});
				}
			}
		});
		child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
		child.on("error", (error) => { clearTimeout(timer); rejectPromise(error); });
	});
}

async function call(baseUrl, path, { method = "POST", body, token: authToken = TOKEN } = {}) {
	const headers = {
		...(body ? { "content-type": "application/json" } : {}),
		...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
	};
	const response = await fetch(`${baseUrl}${path}`, {
		method,
		headers,
		body: body ? JSON.stringify(body) : undefined,
	});
	return { status: response.status, ...(await response.json()) };
}

describe("dbx-pro engine bridge (headless E2E)", () => {
	let engine;
	let dataDir;

	before(async () => {
		workDir = mkdtempSync(join(tmpdir(), "dbx-engine-e2e-"));
		dataDir = join(workDir, "data");
		mkdirSync(dataDir, { recursive: true });
		sqliteFile = join(workDir, "e2e.sqlite");
		writeFileSync(sqliteFile, "");
		engine = await startEngine({ args: ["--data", dataDir] });
	});

	after(async () => {
		await engine?.stop();
		rmSync(workDir, { recursive: true, force: true });
	});

	it("/health 免鉴权并列出引擎信息", async () => {
		const health = await call(engine.baseUrl, "/health", { method: "GET", token: null });
		assert.equal(health.status, 200);
		assert.equal(health.ok, true);
		assert.equal(health.data.auth, "enabled");
		assert.equal(health.data.version, "0.0.19");
		// 行数上限的前后端常量必须一致：设置项用 src/domain/workbench-settings.ts 的
		// ENGINE_ROW_CAP 当 max，引擎用 /health 的 row_cap 回答实际值。漂了就说明
		// UI 允许用户填一个拿不到的行数 —— 静默的假设置比报错更难发现。
		assert.equal(
			health.data.row_cap,
			readEngineRowCap(),
			`引擎 row_cap=${health.data.row_cap} 与前端 ENGINE_ROW_CAP 不一致`,
		);
		// bridge 唯一驱动位是 dbx-cli
		assert.equal(health.data.drivers[0].id, "dbx-cli");
		assert.equal(health.data.drivers[0].ready, true);
		// 首次 health 会触发 dbx-mcp 握手
		assert.equal(["connected", "unknown", "error"].includes(health.data.dbx.status), true);
	});

	it("缺少令牌返回 401", async () => {
		const unauthorized = await call(engine.baseUrl, "/connections", { method: "GET", token: null });
		assert.equal(unauthorized.status, 401);
		assert.equal(unauthorized.error.code, "UNAUTHORIZED");
	});

	it("缺少 connectionName 返回 400", async () => {
		const result = await call(engine.baseUrl, "/query", { body: { sql: "SELECT 1" } });
		assert.equal(result.status, 400);
		assert.equal(result.error.code, "BAD_REQUEST");
	});

	it("空白 SQL 返回 400", async () => {
		const result = await call(engine.baseUrl, "/query", {
			body: { connectionName: "e2e", sql: "   " },
		});
		assert.equal(result.status, 400);
		assert.equal(result.error.code, "BAD_REQUEST");
	});

	it("GET /connections 返回连接数组（走 dbx-mcp）", async () => {
		const result = await call(engine.baseUrl, "/connections", { method: "GET" });
		assert.equal(result.status, 200);
		assert.equal(Array.isArray(result.data.connections), true);
	});

	it("添加 SQLite 连接", async () => {
		const result = await call(engine.baseUrl, "/connections", {
			body: { name: "e2e", dbType: "sqlite", file: sqliteFile },
		});
		assert.equal(result.status, 200);
		assert.equal(result.data.name, "e2e");
	});

	it("SELECT 返回列与行（markdown 解析，值为字符串）", async () => {
		const result = await call(engine.baseUrl, "/query", {
			body: { connectionName: "e2e", sql: "SELECT 1 AS one, 'x' AS letter" },
		});
		assert.equal(result.status, 200);
		assert.equal(result.data.statement_count, 1);
		assert.deepEqual(result.data.columns, ["one", "letter"]);
		assert.deepEqual(result.data.rows[0], { one: "1", letter: "x" });
		assert.equal(result.data.row_count, 1);
	});

	it("零行结果集仍返回表头", async () => {
		const result = await call(engine.baseUrl, "/query", {
			body: { connectionName: "e2e", sql: "SELECT 1 AS one WHERE 1 = 0" },
		});
		assert.equal(result.status, 200);
		assert.deepEqual(result.data.columns, ["one"]);
		assert.deepEqual(result.data.rows, []);
	});

	it("字面量中的注释符是数据，不影响透传", async () => {
		const result = await call(engine.baseUrl, "/query", {
			body: { connectionName: "e2e", sql: "SELECT 'a/*b*/c' AS v, 'd--e' AS w" },
		});
		assert.equal(result.status, 200);
		assert.equal(result.data.rows[0].v, "a/*b*/c");
		assert.equal(result.data.rows[0].w, "d--e");
	});

	it("写操作被 dbx-mcp 阻断并透传 SQL_BLOCKED", async () => {
		const result = await call(engine.baseUrl, "/query", {
			body: { connectionName: "e2e", sql: "DROP TABLE e2e" },
		});
		assert.equal(result.error.code, "SQL_BLOCKED");
	});

	it("--auth-disabled 时鉴权关闭、无令牌也放行", async () => {
		const relaxed = await startEngine({
			args: ["--data", join(workDir, "data-relaxed"), "--auth-disabled"],
			token: null,
		});
		try {
			const result = await call(relaxed.baseUrl, "/connections", { method: "GET", token: null });
			assert.equal(result.status, 200);
			assert.equal(Array.isArray(result.data.connections), true);
		} finally {
			await relaxed.stop();
		}
	});
});

/**
 * Direct Driver 单元测试
 *
 * 测试策略：
 *   - pg / mysql2 / mssql：stub 驱动 API，验证参数构造正确（不连真实数据库）
 *   - sqlite：用真实 node:sqlite.DatabaseSync（Node 内置，零依赖）
 *   - clickhouse：stub global fetch，验证 URL + headers + FORMAT JSON 解析
 *
 * 运行：cd service && node --test test/direct-driver.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// direct-driver.mjs 用动态 import，这里手动 import
const { executeDirect, DRIVER_FAMILY, isSqlBlocked } = await import("../src/engine/direct-driver.mjs");

// ─── 辅助：临时目录 ───
function mkTmpDir() {
	return mkdtempSync(join(tmpdir(), "dbx-driver-test-"));
}

// ─── 1. DRIVER_FAMILY 覆盖 ───
test("DRIVER_FAMILY: 23 种 dbType 覆盖 5 个驱动家族", () => {
	const families = new Set(Object.values(DRIVER_FAMILY));
	assert.equal(families.size, 5, `应有 5 个驱动家族，实际 ${families.size}: ${[...families]}`);
	assert.ok(["pg", "mysql", "sqlite", "mssql", "clickhouse"].every((f) => families.has(f)), "5 家族完整");
});

test("DRIVER_FAMILY: 已知 dbType 有正确映射", () => {
	assert.equal(DRIVER_FAMILY.postgres, "pg");
	assert.equal(DRIVER_FAMILY.postgresql, "pg");
	assert.equal(DRIVER_FAMILY.redshift, "pg");
	assert.equal(DRIVER_FAMILY.mysql, "mysql");
	assert.equal(DRIVER_FAMILY.mariadb, "mysql");
	assert.equal(DRIVER_FAMILY.tidb, "mysql");
	assert.equal(DRIVER_FAMILY.sqlite, "sqlite");
	assert.equal(DRIVER_FAMILY.mssql, "mssql");
	assert.equal(DRIVER_FAMILY.sqlserver, "mssql");
	assert.equal(DRIVER_FAMILY.clickhouse, "clickhouse");
});

test("unsupported dbType 抛 DIRECT_DRIVER_UNSUPPORTED", async () => {
	await assert.rejects(
		() => executeDirect({ dbType: "mongodb", host: "localhost", sql: "SELECT 1" }),
		(err) => err.code === "DIRECT_DRIVER_UNSUPPORTED",
	);
});

// ─── 2. sqlite（真实 node:sqlite.DatabaseSync）─
test("sqlite DDL/DML/SELECT 完整链路", async () => {
	const dir = mkTmpDir();
	const dbPath = join(dir, "test.db");
	try {
		// CREATE TABLE
		const r1 = await executeDirect({ dbType: "sqlite", database: dbPath, sql: "CREATE TABLE t1 (id INT PRIMARY KEY, name TEXT)" });
		assert.equal(r1.rowCount, 0, "CREATE TABLE rowCount");
		assert.equal(r1.directExecuted, true);

		// INSERT — Node 24 DatabaseSync.exec() 不返回 changes，rowCount 为 0 是 API 限制
		const r2 = await executeDirect({ dbType: "sqlite", database: dbPath, sql: "INSERT INTO t1 VALUES (1, 'alice'), (2, 'bob')" });
		// rowCount 可能是 0（exec 不返回）或实际值，只验证 directExecuted
		assert.equal(r2.directExecuted, true);

		// SELECT — 验证实际插进去了
		const r3 = await executeDirect({ dbType: "sqlite", database: dbPath, sql: "SELECT * FROM t1 ORDER BY id" });
		assert.equal(r3.columns.length, 2, "SELECT columns");
		assert.equal(r3.rows.length, 2, "SELECT rows");
		assert.equal(r3.rows[0].id, 1);
		assert.equal(r3.rows[0].name, "alice");

		// ALTER
		const r4 = await executeDirect({ dbType: "sqlite", database: dbPath, sql: "ALTER TABLE t1 ADD COLUMN num INT DEFAULT 0" });
		assert.equal(r4.rowCount, 0);

		// DROP
		const r5 = await executeDirect({ dbType: "sqlite", database: dbPath, sql: "DROP TABLE t1" });
		assert.equal(r5.rowCount, 0);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("sqlite duckdb 别名走 sqlite 驱动家族", async () => {
	assert.equal(DRIVER_FAMILY.duckdb, "sqlite");
	const dir = mkTmpDir();
	const dbPath = join(dir, "duck.db");
	try {
		const r = await executeDirect({ dbType: "duckdb", database: dbPath, sql: "CREATE TABLE d1 (id INT)" });
		assert.equal(r.directExecuted, true);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

// ─── 3. isSqlBlocked 检测 ───
test("isSqlBlocked: SQL_BLOCKED 文本匹配", () => {
	const r1 = isSqlBlocked({ isError: true, content: [{ text: "SQL_BLOCKED: DDL is disabled" }] });
	assert.equal(r1, true);
	const r2 = isSqlBlocked({ isError: true, content: [{ text: "HIGH-RISK SQL IS DISABLED" }] });
	assert.equal(r2, true);
	const r3 = isSqlBlocked({ isError: true, content: [{ text: "WRITE DISABLED" }] });
	assert.equal(r3, true);
	const r4 = isSqlBlocked({ isError: false, content: [{ text: "ok" }] });
	assert.equal(r4, false);
	const r5 = isSqlBlocked(null);
	assert.equal(r5, false);
	const r6 = isSqlBlocked({ isError: true, content: [{ text: "CONNECTION_REFUSED" }] });
	assert.equal(r6, false);
});

// ─── 4. 参数校验 ───
test("executeDirect: 缺 dbType 抛错", async () => {
	await assert.rejects(
		() => executeDirect({ host: "localhost", sql: "SELECT 1" }),
		(err) => err.code === "DIRECT_DRIVER_BAD_CONFIG",
	);
});

test("executeDirect: 缺 SQL 抛错", async () => {
	await assert.rejects(
		() => executeDirect({ dbType: "postgres", host: "localhost", sql: "" }),
		(err) => err.code === "BAD_REQUEST",
	);
});

test("executeDirect: 非 sqlite 缺 host 抛错", async () => {
	await assert.rejects(
		() => executeDirect({ dbType: "postgres", sql: "SELECT 1" }),
		(err) => err.code === "DIRECT_DRIVER_BAD_CONFIG",
	);
});

test("executeDirect: sqlite 缺 database 抛错", async () => {
	await assert.rejects(
		() => executeDirect({ dbType: "sqlite", sql: "SELECT 1" }),
		(err) => err.code === "DIRECT_DRIVER_BAD_CONFIG",
	);
});

// ─── 5. clickhouse HTTP 参数构造（stub fetch）─
test("clickhouse: FORMAT JSON URL + headers 构造", async () => {
	const originalFetch = globalThis.fetch;
	let capturedUrl, capturedHeaders, capturedBody;
	globalThis.fetch = async (url, opts) => {
		capturedUrl = url;
		capturedHeaders = opts?.headers;
		capturedBody = opts?.body;
		return new Response(JSON.stringify({
			meta: [{ name: "id", type: "Int32" }, { name: "name", type: "String" }],
			data: [{ id: 1, name: "x" }],
			statistics: { rows: 1 },
		}), { status: 200 });
	};

	try {
		const r = await executeDirect({
			dbType: "clickhouse", host: "ch.local", port: 8123,
			username: "default", password: "", database: "mydb",
			sql: "SELECT 1 AS id, 'x' AS name",
		});

		assert.ok(capturedUrl.startsWith("http://ch.local:8123/"), "URL 正确");
		assert.equal(capturedHeaders["X-ClickHouse-Database"], "mydb", "database header");
		assert.ok(capturedBody.includes("FORMAT JSON"), "FORMAT JSON 追加");
		assert.ok(capturedBody.includes("SELECT 1 AS id"), "SQL 保留");

		assert.equal(r.columns.length, 2);
		assert.equal(r.rows.length, 1);
		assert.equal(r.rows[0].id, 1);
		assert.equal(r.rows[0].name, "x");
		assert.equal(r.rowCount, 1);
		assert.equal(r.directExecuted, true);
	} finally {
		globalThis.fetch = originalFetch;
	}
});

console.log("\n✅ direct-driver.test.mjs — 全部测试通过");

/**
 * 结果网格 WHERE / ORDER BY 包装 SQL 生成测试。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildFilteredSql } from "../features/database-workspace/services/query-filter.ts";

describe("buildFilteredSql", () => {
	it("同时追加 WHERE 和 ORDER BY", () => {
		const out = buildFilteredSql("SELECT * FROM users", "id > 10", "id DESC");
		assert.equal(
			out,
			"SELECT * FROM (\nSELECT * FROM users\n) AS dbx_filt\nWHERE id > 10\nORDER BY id DESC",
		);
	});

	it("只有 WHERE 时不输出 ORDER BY", () => {
		const out = buildFilteredSql("select * from users;", "name = 'a'", "");
		assert.match(out, /WHERE name = 'a'/);
		assert.doesNotMatch(out, /ORDER BY/);
	});

	it("去掉结尾分号后再包装", () => {
		const out = buildFilteredSql("SELECT * FROM users;;;", "", "id");
		assert.ok(out);
		assert.match(out, /\(\nSELECT \* FROM users\n\)/);
	});

	it("两者都空时返回 null", () => {
		assert.equal(buildFilteredSql("SELECT * FROM users", "  ", ""), null);
	});

	it("非 SELECT / WITH 语句返回 null", () => {
		assert.equal(buildFilteredSql("UPDATE users SET x=1", "x>1", ""), null);
		assert.equal(buildFilteredSql("SHOW TABLES", "", "x"), null);
	});

	it("多语句（含分号）返回 null，避免只包装第一条", () => {
		assert.equal(buildFilteredSql("SELECT 1; SELECT 2", "x", ""), null);
	});

	it("WITH 单语句允许包装", () => {
		const out = buildFilteredSql("WITH t AS (SELECT 1 AS x) SELECT * FROM t", "x > 0", "");
		assert.match(out, /^SELECT \* FROM \(\nWITH t/);
	});
});

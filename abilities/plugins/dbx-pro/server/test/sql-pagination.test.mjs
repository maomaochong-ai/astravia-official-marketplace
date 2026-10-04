/**
 * sql-pagination 测试（纯函数，不需要引擎二进制）。
 *
 * 覆盖：canPaginate 的保守判定、方言相关的 LIMIT/OFFSET 生成、COUNT 包装，
 * 以及「已分页的 SQL 不会被二次包裹」这个关键不变量 —— 路由把原 SQL 改写后
 * 再交给引擎，若 canPaginate 对包裹结果返回 true，就会套成派生表的派生表。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	buildCountSql,
	buildPagedSql,
	canPaginate,
	supportsPagination,
} from "../src/engine/sql-pagination.mjs";

describe("supportsPagination", () => {
	it("覆盖插件实际使用的 db_type 写法", () => {
		// 回归：曾经只收 "postgresql"，而插件发的是 "postgres"，导致主目标方言静默退化为客户端分页。
		for (const dbType of [
			"postgres",
			"aurora-postgresql",
			"redshift",
			"mysql",
			"mariadb",
			"sqlite",
			"cloudflare-d1",
			"duckdb",
			"mssql",
			"sqlserver",
			"clickhouse",
			"bigquery",
		]) {
			assert.equal(supportsPagination(dbType), true, `应支持 ${dbType}`);
		}
	});

	it("方言别名、大小写与空白都归一化", () => {
		for (const dbType of ["postgresql", "pg", " PostgreSQL ", "MySQL", "MariaDB"]) {
			assert.equal(supportsPagination(dbType), true, `应支持 ${dbType}`);
		}
	});

	it("未支持 / 缺失的方言返回 false（宁可不分页，不可生成非法 SQL）", () => {
		for (const dbType of ["oracle", "mongodb", "redis", "", undefined, null]) {
			assert.equal(supportsPagination(dbType), false, `不应支持 ${String(dbType)}`);
		}
	});
});

describe("canPaginate", () => {
	it("单条 SELECT / WITH 可分页", () => {
		assert.equal(canPaginate("SELECT * FROM users"), true);
		assert.equal(canPaginate("  select id from users  "), true);
		assert.equal(canPaginate("SELECT * FROM users;"), true);
		assert.equal(canPaginate("WITH t AS (SELECT 1 AS a) SELECT * FROM t"), true);
	});

	it("多语句不可分页", () => {
		assert.equal(canPaginate("SELECT 1; SELECT 2"), false);
		assert.equal(canPaginate("SELECT 1;\n"), true, "单条语句的结尾分号不算多语句");
	});

	it("非查询语句不可分页", () => {
		assert.equal(canPaginate("INSERT INTO t VALUES (1)"), false);
		assert.equal(canPaginate("SHOW TABLES"), false);
		assert.equal(canPaginate("EXPLAIN SELECT 1"), false);
		assert.equal(canPaginate("UPDATE t SET a = 1"), false);
	});

	it("自带分页子句时一律不介入（避免改写用户指定的范围）", () => {
		assert.equal(canPaginate("SELECT * FROM t LIMIT 10"), false);
		assert.equal(canPaginate("SELECT * FROM t limit 10 offset 20"), false);
		assert.equal(canPaginate("SELECT * FROM t OFFSET 5"), false);
		assert.equal(canPaginate("SELECT TOP 10 * FROM t"), false);
		assert.equal(canPaginate("SELECT * FROM t ORDER BY a FETCH FIRST 10 ROWS ONLY"), false);
		// 内层子查询自带 LIMIT 时同样保守拒绝。
		assert.equal(canPaginate("SELECT * FROM (SELECT * FROM t LIMIT 5) AS x"), false);
	});
});

describe("buildPagedSql", () => {
	it("PostgreSQL / MySQL / SQLite 用派生表 + LIMIT/OFFSET", () => {
		assert.equal(
			buildPagedSql("SELECT * FROM users", "postgresql", 50, 100),
			"SELECT * FROM (SELECT * FROM users) AS _dbx_page LIMIT 50 OFFSET 100",
		);
		assert.equal(
			buildPagedSql("select id from users", "mysql", 200, 400),
			"SELECT * FROM (select id from users) AS _dbx_page LIMIT 200 OFFSET 400",
		);
		assert.equal(
			buildPagedSql("SELECT * FROM t", "sqlite", 1000, 0),
			"SELECT * FROM (SELECT * FROM t) AS _dbx_page LIMIT 1000 OFFSET 0",
		);
	});

	it("MSSQL 用 ORDER BY (SELECT NULL) + OFFSET/FETCH", () => {
		assert.equal(
			buildPagedSql("SELECT * FROM users", "mssql", 50, 100),
			"SELECT * FROM (SELECT * FROM users) AS _dbx_page ORDER BY (SELECT NULL) OFFSET 100 ROWS FETCH NEXT 50 ROWS ONLY",
		);
		assert.equal(
			buildPagedSql("SELECT * FROM users", "sqlserver", 50, 0),
			"SELECT * FROM (SELECT * FROM users) AS _dbx_page ORDER BY (SELECT NULL) OFFSET 0 ROWS FETCH NEXT 50 ROWS ONLY",
		);
	});

	it("去掉原 SQL 末尾空白与分号，保证能包进派生表", () => {
		assert.equal(
			buildPagedSql("  SELECT * FROM users;;  ", "postgresql", 10, 0),
			"SELECT * FROM (SELECT * FROM users) AS _dbx_page LIMIT 10 OFFSET 0",
		);
		assert.equal(
			buildPagedSql("SELECT * FROM (SELECT 1 AS a) AS x;", "postgresql", 10, 20),
			"SELECT * FROM (SELECT * FROM (SELECT 1 AS a) AS x) AS _dbx_page LIMIT 10 OFFSET 20",
		);
	});

	it("包裹结果不会被二次分页（分页 SQL 自身不可再分页）", () => {
		for (const dbType of ["postgresql", "mysql", "sqlite", "mssql"]) {
			const paged = buildPagedSql("SELECT * FROM users", dbType, 50, 0);
			assert.equal(canPaginate(paged), false, `${dbType} 的包裹结果不应可再分页`);
		}
	});
});

describe("buildCountSql", () => {
	it("派生表外包 COUNT", () => {
		assert.equal(
			buildCountSql("SELECT * FROM users"),
			"SELECT COUNT(*) AS _dbx_total FROM (SELECT * FROM users) AS _dbx_count",
		);
		assert.equal(
			buildCountSql("  WITH t AS (SELECT 1 AS a) SELECT * FROM t;  "),
			"SELECT COUNT(*) AS _dbx_total FROM (WITH t AS (SELECT 1 AS a) SELECT * FROM t) AS _dbx_count",
		);
	});

	it("COUNT 包装不带分页子句（COUNT 本身不能被截断）", () => {
		// 路由的 countOnly 分支在 page 分支之前返回，COUNT SQL 不会再被包裹；
		// 这里守住的是「COUNT 结果不能带 LIMIT」，否则总数会被静默报小。
		assert.equal(/\b(?:LIMIT|OFFSET|FETCH)\b/i.test(buildCountSql("SELECT * FROM users")), false);
	});
});

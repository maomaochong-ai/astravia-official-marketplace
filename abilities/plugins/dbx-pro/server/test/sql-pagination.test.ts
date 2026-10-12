/**
 * sql-pagination.test.ts — SQL 服务端分页。
 *
 * 测试 supportsPagination / canPaginate / buildPagedSql / buildCountSql。
 * 纯函数模块，不接触引擎 / 网络。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
	supportsPagination,
	canPaginate,
	buildPagedSql,
	buildCountSql,
} from "../src/engine/sql-pagination.ts";

describe("sql-pagination · supportsPagination", () => {
	it("MySQL 系支持分页", () => {
		assert.equal(supportsPagination("mysql"), true);
		assert.equal(supportsPagination("mariadb"), true);
		assert.equal(supportsPagination("starrocks"), true);
		assert.equal(supportsPagination("doris"), true);
	});

	it("PostgreSQL 系支持分页", () => {
		assert.equal(supportsPagination("postgres"), true);
		assert.equal(supportsPagination("postgresql"), true);
		assert.equal(supportsPagination("redshift"), true);
	});

	it("SQLite 系支持分页", () => {
		assert.equal(supportsPagination("sqlite"), true);
		assert.equal(supportsPagination("duckdb"), true);
		assert.equal(supportsPagination("cloudflare-d1"), true);
	});

	it("MSSQL 支持分页", () => {
		assert.equal(supportsPagination("mssql"), true);
		assert.equal(supportsPagination("sqlserver"), true);
	});

	it("未知数据库不支持分页", () => {
		assert.equal(supportsPagination("unknown-db"), false);
		assert.equal(supportsPagination(""), false);
		assert.equal(supportsPagination(null), false);
		assert.equal(supportsPagination(undefined), false);
	});

	it("大小写不敏感", () => {
		assert.equal(supportsPagination("MySQL"), true);
		assert.equal(supportsPagination("POSTGRES"), true);
	});
});

describe("sql-pagination · canPaginate", () => {
	it("单条 SELECT 可以分页", () => {
		assert.equal(canPaginate("SELECT * FROM users"), true);
	});

	it("单条 WITH 可以分页", () => {
		assert.equal(canPaginate("WITH cte AS (SELECT 1) SELECT * FROM cte"), true);
	});

	it("多语句不能分页", () => {
		assert.equal(canPaginate("SELECT 1; SELECT 2"), false);
	});

	it("非 SELECT / WITH 不能分页", () => {
		assert.equal(canPaginate("SHOW TABLES"), false);
		assert.equal(canPaginate("INSERT INTO t VALUES (1)"), false);
		assert.equal(canPaginate("CREATE TABLE t (id INT)"), false);
	});

	it("已带 LIMIT 的不能再分页", () => {
		assert.equal(canPaginate("SELECT * FROM users LIMIT 10"), false);
	});

	it("已带 OFFSET 的不能再分页", () => {
		assert.equal(canPaginate("SELECT * FROM users OFFSET 5"), false);
	});

	it("已带 FETCH 的不能再分页", () => {
		assert.equal(canPaginate("SELECT * FROM users FETCH FIRST 10 ROWS ONLY"), false);
	});

	it("已带 TOP 的不能再分页", () => {
		assert.equal(canPaginate("SELECT TOP 10 * FROM users"), false);
	});

	it("忽略大小写", () => {
		assert.equal(canPaginate("select * from users"), true);
		assert.equal(canPaginate("SELECT * FROM users limit 10"), false);
	});
});

describe("sql-pagination · buildPagedSql", () => {
	it("MySQL / PostgreSQL 用 LIMIT OFFSET", () => {
		const sql = buildPagedSql("SELECT * FROM users", "mysql", 10, 20);
		assert.equal(sql, "SELECT * FROM (SELECT * FROM users) AS _dbx_page LIMIT 10 OFFSET 20");
	});

	it("PostgreSQL 用 LIMIT OFFSET", () => {
		const sql = buildPagedSql("SELECT * FROM users", "postgres", 10, 20);
		assert.equal(sql, "SELECT * FROM (SELECT * FROM users) AS _dbx_page LIMIT 10 OFFSET 20");
	});

	it("DuckDB 用 LIMIT OFFSET", () => {
		const sql = buildPagedSql("SELECT * FROM users", "duckdb", 50, 100);
		assert.equal(sql, "SELECT * FROM (SELECT * FROM users) AS _dbx_page LIMIT 50 OFFSET 100");
	});

	it("MSSQL 用 OFFSET/FETCH", () => {
		const sql = buildPagedSql("SELECT * FROM users", "mssql", 10, 20);
		assert.equal(
			sql,
			"SELECT * FROM (SELECT * FROM users) AS _dbx_page ORDER BY (SELECT NULL) OFFSET 20 ROWS FETCH NEXT 10 ROWS ONLY",
		);
	});

	it("sqlserver 也用 OFFSET/FETCH", () => {
		const sql = buildPagedSql("SELECT * FROM users", "sqlserver", 10, 20);
		assert.match(sql, /OFFSET 20 ROWS FETCH NEXT 10 ROWS ONLY/);
	});

	it("去掉原 SQL 末尾分号", () => {
		const sql = buildPagedSql("SELECT * FROM users;", "mysql", 10, 0);
		assert.equal(sql, "SELECT * FROM (SELECT * FROM users) AS _dbx_page LIMIT 10 OFFSET 0");
	});

	it("去掉原 SQL 末尾多个分号", () => {
		const sql = buildPagedSql("SELECT * FROM users; ;", "mysql", 10, 0);
		assert.match(sql, /FROM \(SELECT \* FROM users; \) AS _dbx_page/);
	});
});

describe("sql-pagination · buildCountSql", () => {
	it("构造 COUNT 查询", () => {
		const sql = buildCountSql("SELECT * FROM users");
		assert.equal(sql, "SELECT COUNT(*) AS _dbx_total FROM (SELECT * FROM users) AS _dbx_count");
	});

	it("去掉原 SQL 末尾分号", () => {
		const sql = buildCountSql("SELECT * FROM users;");
		assert.equal(sql, "SELECT COUNT(*) AS _dbx_total FROM (SELECT * FROM users) AS _dbx_count");
	});

	it("复杂查询也能 COUNT", () => {
		const sql = buildCountSql("SELECT u.id, o.total FROM users u JOIN orders o ON u.id = o.user_id WHERE o.total > 100");
		assert.match(sql, /SELECT COUNT\(\*\) AS _dbx_total/);
		assert.match(sql, /AS _dbx_count/);
	});
});

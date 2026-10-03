/**
 * catalog 纯函数单元测试 — 直接导入被测源码，不留手抄副本。
 * 运行: node --experimental-strip-types --test src/test/*.test.js
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	escapeSqlLiteral,
	filterSystemNames,
	flatColumnsSql,
	listFlatTablesSql,
	listFlatIndexesSql,
	listTablesInScopeSql,
	tableObjectSql,
} from "../domain/catalog.ts";

describe("catalog.escapeSqlLiteral", () => {
	it("doubles single quotes", () => { assert.equal(escapeSqlLiteral("a'b"), "'a''b'"); });
	it("wraps plain string", () => { assert.equal(escapeSqlLiteral("hello"), "'hello'"); });
	it("empty string", () => { assert.equal(escapeSqlLiteral(""), "''"); });
});

describe("catalog.filterSystemNames", () => {
	it("schemas: filters pg_* and system, public first", () => {
		const out = filterSystemNames("schemas", ["public", "pg_temp", "pg_catalog", "information_schema", "custom"]);
		assert.deepEqual(out, ["public", "custom"]);
	});
	it("databases: filters system dbs", () => {
		const out = filterSystemNames("databases", ["mysql", "sys", "mydb", "information_schema"]);
		assert.deepEqual(out, ["mydb"]);
	});
	it("schemas with no system: preserves sort", () => {
		const out = filterSystemNames("schemas", ["beta", "alpha"]);
		assert.deepEqual(out, ["alpha", "beta"]);
	});
	it("flat: keeps names as-is (sorted)", () => {
		assert.deepEqual(filterSystemNames("flat", ["b", "a"]), ["a", "b"]);
	});
});

describe("catalog.listTablesInScopeSql", () => {
	it("schemas: scopes by schema", () => {
		const sql = listTablesInScopeSql("schemas", { schema: "public" });
		assert.ok(sql.includes("'public'"));
		assert.ok(sql.includes("information_schema.tables"));
	});
	it("databases: scopes by database", () => {
		const sql = listTablesInScopeSql("databases", { database: "shop" });
		assert.ok(sql.includes("'shop'"));
	});
	it("flat: no scope filter", () => {
		const sql = listTablesInScopeSql("flat", {});
		assert.ok(!sql.includes("WHERE table_schema"));
	});
});

describe("catalog.flat helpers (sqlite 直连)", () => {
	it("listFlatTablesSql(sqlite) reads sqlite_master", () => {
		const sql = listFlatTablesSql("sqlite");
		assert.ok(sql.includes("sqlite_master"));
		assert.ok(sql.includes("NOT LIKE 'sqlite_%'"));
	});
	it("listFlatTablesSql(other engine) returns null", () => {
		assert.equal(listFlatTablesSql("postgres"), null);
		assert.equal(listFlatTablesSql("mysql"), null);
	});
	it("flatColumnsSql(sqlite) uses pragma_table_info", () => {
		const sql = flatColumnsSql("sqlite", "users");
		assert.ok(sql.includes("pragma_table_info('users')"));
	});
	it("flatColumnsSql escapes quotes in table name", () => {
		const sql = flatColumnsSql("sqlite", "o'brien");
		assert.ok(sql.includes("pragma_table_info('o''brien')"));
	});
	it("flatColumnsSql(other engine) returns null", () => {
		assert.equal(flatColumnsSql("mysql", "users"), null);
	});
	it("listFlatIndexesSql(sqlite) uses pragma_index_list", () => {
		const sql = listFlatIndexesSql("sqlite", "users");
		assert.match(sql, /pragma_index_list\('users'\)/);
		assert.match(sql, /AS name/);
	});
	it("listFlatIndexesSql escapes quotes and rejects other engines", () => {
		const sql = listFlatIndexesSql("sqlite", "o'brien");
		assert.match(sql, /pragma_index_list\('o''brien'\)/);
		assert.equal(listFlatIndexesSql("mysql", "users"), null);
	});
});

describe("catalog.tableObjectSql", () => {
	it("schemas × index: non-null, contains schema + table", () => {
		const sql = tableObjectSql("schemas", "index", "users", { schema: "public" });
		assert.ok(sql); assert.ok(sql.includes("'users'")); assert.ok(sql.includes("'public'"));
	});
	it("schemas without scope: returns null", () => { assert.equal(tableObjectSql("schemas", "index", "x"), null); });
	it("databases × constraint: excludes FOREIGN KEY", () => {
		const sql = tableObjectSql("databases", "constraint", "orders", { database: "shop" });
		assert.ok(sql); assert.ok(sql.includes("<> 'FOREIGN KEY'"));
	});
	it("databases without scope: returns null", () => { assert.equal(tableObjectSql("databases", "trigger", "x"), null); });
	it("flat: all kinds return null", () => {
		for (const k of ["index", "constraint", "trigger"]) {
			assert.equal(tableObjectSql("flat", k, "x"), null);
		}
	});
	it("partition: schemas uses pg_inherits", () => {
		const sql = tableObjectSql("schemas", "partition", "orders", { schema: "public" });
		assert.ok(sql.includes("pg_inherits"));
	});
	it("column kind: lists columns for both families", () => {
		const a = tableObjectSql("schemas", "column", "users", { schema: "public" });
		const b = tableObjectSql("databases", "column", "users", { database: "shop" });
		assert.ok(a.includes("information_schema.columns"));
		assert.ok(b.includes("information_schema.columns"));
	});
	it("names with quotes get escaped", () => {
		const sql = tableObjectSql("schemas", "trigger", "weird'table", { schema: "weird'schema" });
		assert.ok(sql.includes("'weird''table'")); assert.ok(sql.includes("'weird''schema'"));
	});
});

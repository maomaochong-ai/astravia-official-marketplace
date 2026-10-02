/**
 * catalog 纯函数单元测试 — Node 22 内置 node --test。
 * 运行: node --test src/test/catalog.test.js
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

function escapeSqlLiteral(value) {
	return `'${value.replaceAll("'", "''")}'`;
}

const SCHEMA_SYSTEM = new Set(["information_schema", "pg_catalog", "pg_toast"]);
const DATABASE_SYSTEM = new Set(["information_schema", "performance_schema", "mysql", "sys"]);

function filterSystemNames(family, names) {
	const system = family === "schemas" ? SCHEMA_SYSTEM : DATABASE_SYSTEM;
	const kept = names.filter((n) => {
		if (system.has(n)) return false;
		if (family === "schemas" && n.startsWith("pg_")) return false;
		return true;
	});
	kept.sort();
	if (family === "schemas") {
		const idx = kept.indexOf("public");
		if (idx > 0) { kept.splice(idx, 1); kept.unshift("public"); }
	}
	return kept;
}

function tableObjectSql(family, kind, table, scope) {
	const t = escapeSqlLiteral(table);
	if (family === "schemas") {
		const schema = scope?.schema;
		if (!schema) return null;
		const s = escapeSqlLiteral(schema);
		switch (kind) {
			case "index":
				return `SELECT indexname AS name FROM pg_indexes WHERE schemaname = ${s} AND tablename = ${t} ORDER BY indexname`;
			case "constraint":
				return `SELECT constraint_name AS name FROM information_schema.table_constraints WHERE table_schema = ${s} AND table_name = ${t} AND constraint_type <> 'FOREIGN KEY' ORDER BY constraint_name`;
			case "foreign-key":
				return `SELECT constraint_name AS name FROM information_schema.table_constraints WHERE table_schema = ${s} AND table_name = ${t} AND constraint_type = 'FOREIGN KEY' ORDER BY constraint_name`;
			case "trigger":
				return `SELECT trigger_name AS name FROM information_schema.triggers WHERE event_object_schema = ${s} AND event_object_table = ${t} ORDER BY trigger_name`;
			case "partition":
				return `SELECT child.relname AS name FROM pg_inherits i JOIN pg_class child ON child.oid = i.inhrelid JOIN pg_class parent ON parent.oid = i.inhparent JOIN pg_namespace ns ON ns.oid = parent.relnamespace WHERE ns.nspname = ${s} AND parent.relname = ${t} ORDER BY child.relname`;
		}
		return null;
	}
	if (family === "databases") {
		const db = scope?.database;
		if (!db) return null;
		const d = escapeSqlLiteral(db);
		switch (kind) {
			case "index":
				return `SELECT DISTINCT index_name AS name FROM information_schema.statistics WHERE table_schema = ${d} AND table_name = ${t} ORDER BY index_name`;
			case "constraint":
				return `SELECT constraint_name AS name FROM information_schema.table_constraints WHERE table_schema = ${d} AND table_name = ${t} AND constraint_type <> 'FOREIGN KEY' ORDER BY constraint_name`;
			case "foreign-key":
				return `SELECT DISTINCT constraint_name AS name FROM information_schema.table_constraints WHERE table_schema = ${d} AND table_name = ${t} AND constraint_type = 'FOREIGN KEY' ORDER BY constraint_name`;
			case "trigger":
				return `SELECT trigger_name AS name FROM information_schema.triggers WHERE trigger_schema = ${d} AND event_object_table = ${t} ORDER BY trigger_name`;
			case "partition":
				return `SELECT partition_name AS name FROM information_schema.partitions WHERE table_schema = ${d} AND table_name = ${t} AND partition_name IS NOT NULL ORDER BY partition_name`;
		}
		return null;
	}
	return null;
}

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
	it("names with quotes get escaped", () => {
		const sql = tableObjectSql("schemas", "trigger", "weird'table", { schema: "weird'schema" });
		assert.ok(sql.includes("'weird''table'")); assert.ok(sql.includes("'weird''schema'"));
	});
});

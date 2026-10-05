/**
 * 表 DDL 生成测试 — 根据 describe 列结构拼 CREATE TABLE。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildCreateTableSql } from "../features/database-workspace/services/table-ddl.ts";

function col(partial) {
	return {
		name: "id",
		type: "INTEGER",
		nullable: false,
		hasDefault: false,
		defaultValue: "",
		comment: "",
		isPrimaryKey: false,
		...partial,
	};
}

describe("buildCreateTableSql", () => {
	it("包含列类型、NOT NULL 与主键约束", () => {
		const ddl = buildCreateTableSql("public.users", [
			col({ isPrimaryKey: true }),
			col({ name: "name", type: "VARCHAR(100)", nullable: true }),
		]);
		assert.match(ddl, /CREATE TABLE public\.users \(/);
		assert.match(ddl, /id INTEGER NOT NULL/);
		assert.match(ddl, /name VARCHAR\(100\)/);
		assert.match(ddl, /PRIMARY KEY \(id\)/);
		assert.match(ddl, /\);\s*$/);
	});

	it("无主键时不输出 PRIMARY KEY 子句", () => {
		const ddl = buildCreateTableSql("t", [col({ isPrimaryKey: false })]);
		assert.doesNotMatch(ddl, /PRIMARY KEY/);
	});

	it("函数表达式默认值保持裸写，普通字符串加引号", () => {
		const ddl = buildCreateTableSql("t", [
			col({ name: "seq", hasDefault: true, defaultValue: "nextval('s'::regclass)" }),
			col({ name: "level", type: "INTEGER", nullable: true, hasDefault: true, defaultValue: "3" }),
			col({ name: "label", type: "TEXT", nullable: true, hasDefault: true, defaultValue: "draft" }),
		]);
		assert.match(ddl, /DEFAULT nextval\('s'::regclass\)/);
		assert.match(ddl, /DEFAULT 3/);
		assert.match(ddl, /DEFAULT 'draft'/);
	});

	it("含特殊字符的列名加双引号", () => {
		const ddl = buildCreateTableSql("t", [col({ name: "order-group", nullable: true })]);
		assert.match(ddl, /"order-group" INTEGER/);
	});
});

/**
 * 表元数据查询构造测试 — 方言路由与 SQL 转义。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildMetadataQuery, rowValue } from "../features/database-workspace/services/table-metadata.ts";

describe("buildMetadataQuery", () => {
	it("PostgreSQL 四类元数据都有查询并带 schema/table 转义", () => {
		const target = { schema: "public", table: "users" };
		const idx = buildMetadataQuery("postgres", "indexes", target);
		const fk = buildMetadataQuery("postgres", "foreignKeys", target);
		const trg = buildMetadataQuery("foreignKeys" === "x" ? "postgres" : "postgres", "triggers", target);
		const con = buildMetadataQuery("postgres", "constraints", target);
		assert.ok(idx && /pg_get_indexdef/.test(idx.sql));
		assert.ok(fk && /contype = 'f'/.test(fk.sql));
		assert.ok(trg && /information_schema\.triggers/.test(trg.sql));
		assert.ok(con && /pg_get_constraintdef/.test(con.sql));
	});

	it("PostgreSQL 表名中的单引号被转义", () => {
		const q = buildMetadataQuery("postgresql", "indexes", { schema: "s", table: "a'b" });
		assert.ok(q && q.sql.includes("'a''b'"));
	});

	it("MySQL 使用 information_schema 且 schema 为空时返回 null", () => {
		assert.equal(buildMetadataQuery("mysql", "indexes", { table: "t" }), null);
		const q = buildMetadataQuery("mysql8.0", "foreignKeys", { database: "db1", table: "t1" });
		assert.ok(q && /information_schema\.KEY_COLUMN_USAGE/.test(q.sql) && q.sql.includes("'db1'"));
	});

	it("SQLite 用 PRAGMA，约束不支持返回 null", () => {
		const idx = buildMetadataQuery("sqlite", "indexes", { table: "users" });
		assert.ok(idx && /PRAGMA index_list/.test(idx.sql));
		const fk = buildMetadataQuery("sqlite", "foreignKeys", { table: "users" });
		assert.ok(fk && /PRAGMA foreign_key_list/.test(fk.sql));
		assert.equal(buildMetadataQuery("sqlite", "constraints", { table: "users" }), null);
	});

	it("SQL Server 走 sys / information_schema 目录", () => {
		const q = buildMetadataQuery("sqlserver", "indexes", { schema: "dbo", table: "users" });
		assert.ok(q && /sys\.indexes/.test(q.sql));
	});

	it("未知方言返回 null（UI 显示不支持，不放假数据）", () => {
		assert.equal(buildMetadataQuery("oracle", "indexes", { schema: "s", table: "t" }), null);
	});
});

describe("rowValue", () => {
	it("大小写不敏感取值，null 归空串", () => {
		assert.equal(rowValue({ Name: "a" }, "name"), "a");
		assert.equal(rowValue({ IS_UNIQUE: null }, "is_unique"), "");
		assert.equal(rowValue({}, "missing"), "");
	});
});

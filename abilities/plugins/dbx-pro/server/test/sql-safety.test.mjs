/**
 * sql-safety 单测 — 注释剥离、读写 / DDL 判定、语句切分与整体分类。
 * 保守语义：无法明确判定为只读的一律视为写。
 * 全部纯函数。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	classifyQuery,
	isDdlStatement,
	isWriteStatement,
	splitStatements,
	stripSqlComments,
} from "../src/engine/sql-safety.mjs";

describe("stripSqlComments", () => {
	it("剥离行注释", () => {
		assert.equal(stripSqlComments("SELECT 1 -- comment\nWHERE x"), "SELECT 1 \nWHERE x");
	});
	it("剥离块注释", () => {
		assert.equal(stripSqlComments("SELECT /* x */ 1"), "SELECT  1");
	});
	it("字符串里的注释符不被剥离", () => {
		assert.equal(stripSqlComments("SELECT 'a--b', 'x/*y*/z'"), "SELECT 'a--b', 'x/*y*/z'");
	});
	it("块注释跨行", () => {
		assert.equal(stripSqlComments("SELECT /* a\nb */ 1"), "SELECT  1");
	});
});

describe("isWriteStatement", () => {
	const readStatements = [
		"SELECT 1",
		"SHOW TABLES",
		"DESCRIBE users",
		"DESC users",
		"EXPLAIN SELECT 1",
		"USE mydb",
		"VALUES (1)",
	];
	for (const sql of readStatements) {
		it(`只读：${sql}`, () => assert.equal(isWriteStatement(sql), false));
	}

	const writeStatements = [
		"INSERT INTO t VALUES (1)",
		"UPDATE t SET a = 1",
		"DELETE FROM t",
		"CREATE TABLE t (id int)",
		"ALTER TABLE t ADD COLUMN c int",
		"DROP TABLE t",
		"TRUNCATE TABLE t",
		"GRANT SELECT ON t TO u",
		"REVOKE SELECT ON t FROM u",
		"MERGE t ...",
	];
	for (const sql of writeStatements) {
		it(`写 / DDL：${sql}`, () => assert.equal(isWriteStatement(sql), true));
	}

	it("EXPLAIN ANALYZE 含写操作时按写判定", () => {
		assert.equal(isWriteStatement("EXPLAIN ANALYZE INSERT INTO t VALUES (1)"), true);
	});

	it("普通 EXPLAIN 只读", () => {
		assert.equal(isWriteStatement("EXPLAIN ANALYZE SELECT 1"), false);
	});

	it("WITH + CTE + 写操作按写判定", () => {
		const sql = "WITH x AS (SELECT 1) INSERT INTO t SELECT * FROM x";
		assert.equal(isWriteStatement(sql), true);
		assert.equal(isWriteStatement("WITH x AS (SELECT 1) SELECT * FROM x"), false);
	});

	it("空白与纯注释不是写", () => {
		assert.equal(isWriteStatement(""), false);
		assert.equal(isWriteStatement("-- only comment"), false);
		assert.equal(isWriteStatement("/* only comment */"), false);
	});

	it("无法识别的语句保守按写处理", () => {
		assert.equal(isWriteStatement("RANDOM_COMMAND something"), true);
	});

	it("注释里的写关键词不影响判定", () => {
		assert.equal(isWriteStatement("SELECT 1 -- DROP TABLE x"), false);
		assert.equal(isWriteStatement("SELECT 1 /* DELETE FROM t */"), false);
	});
});

describe("isDdlStatement", () => {
	it("DDL 首词判定", () => {
		assert.equal(isDdlStatement("CREATE TABLE t (id int)"), true);
		assert.equal(isDdlStatement("ALTER TABLE t DROP COLUMN c"), true);
		assert.equal(isDdlStatement("DROP TABLE t"), true);
		assert.equal(isDdlStatement("TRUNCATE t"), true);
		assert.equal(isDdlStatement("RENAME TABLE a TO b"), true);
	});
	it("DML 不是 DDL", () => {
		assert.equal(isDdlStatement("INSERT INTO t VALUES (1)"), false);
		assert.equal(isDdlStatement("SELECT 1"), false);
	});
	it("WITH 内含 DDL 时按 DDL 判定", () => {
		assert.equal(
			isDdlStatement("WITH x AS (SELECT 1) ALTER TABLE t ADD c int"),
			true,
		);
	});
	it("纯注释不是 DDL", () => {
		assert.equal(isDdlStatement("-- nothing"), false);
	});
});

describe("splitStatements", () => {
	it("按分号切分并丢弃空段", () => {
		assert.deepEqual(splitStatements("SELECT 1; SELECT 2;"), ["SELECT 1", "SELECT 2"]);
	});
	it("单条语句", () => {
		assert.deepEqual(splitStatements("SELECT 1"), ["SELECT 1"]);
	});
	it("空输入返回空数组", () => {
		assert.deepEqual(splitStatements(";;"), []);
	});
});

describe("classifyQuery", () => {
	it("纯只读 → read，无需确认", () => {
		const result = classifyQuery("SELECT 1; SHOW TABLES");
		assert.equal(result.kind, "read");
		assert.deepEqual(result.kinds, ["read", "read"]);
		assert.equal(result.requiresConfirmation, false);
	});
	it("含 DDL → ddl（优先级最高），需确认", () => {
		const result = classifyQuery("SELECT 1; DROP TABLE t");
		assert.equal(result.kind, "ddl");
		assert.equal(result.requiresConfirmation, true);
	});
	it("含写无 DDL → write，需确认", () => {
		const result = classifyQuery("SELECT 1; UPDATE t SET a = 2");
		assert.equal(result.kind, "write");
		assert.equal(result.requiresConfirmation, true);
	});
	it("语句数量正确", () => {
		assert.equal(classifyQuery("SELECT 1; SELECT 2; SELECT 3").statements.length, 3);
	});
});

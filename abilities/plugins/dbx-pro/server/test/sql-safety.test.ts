/**
 * sql-safety.test.ts — SQL 语句分类与写保护拦截。
 *
 * 测试 stripSqlComments / isWriteStatement / isDdlStatement / classifyQuery。
 * 保守语义：无法明确判定为只读的语句一律视为写操作。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
	stripSqlComments,
	isWriteStatement,
	isDdlStatement,
	splitStatements,
	classifyQuery,
} from "../src/engine/sql-safety.ts";

describe("sql-safety · stripSqlComments", () => {
	it("剥离行注释", () => {
		assert.equal(stripSqlComments("SELECT 1 -- comment"), "SELECT 1 ");
		assert.equal(stripSqlComments("-- full line\nSELECT 1"), "\nSELECT 1");
	});

	it("剥离块注释", () => {
		assert.equal(stripSqlComments("SELECT /* block */ 1"), "SELECT  1");
		assert.equal(stripSqlComments("/* leading */ SELECT 1"), " SELECT 1");
	});

	it("字符串内的注释符号不剥离", () => {
		assert.equal(stripSqlComments("SELECT '-- not comment'"), "SELECT '-- not comment'");
		assert.equal(stripSqlComments("SELECT '/* not block */'"), "SELECT '/* not block */'");
	});

	it("处理 SQL 转义引号", () => {
		assert.equal(stripSqlComments("SELECT 'it''s -- ok'"), "SELECT 'it''s -- ok'");
	});

	it("双引号标识符内的注释符号不剥离", () => {
		assert.equal(stripSqlComments('SELECT "col--name"'), 'SELECT "col--name"');
	});
});

describe("sql-safety · isWriteStatement", () => {
	it("SELECT 是只读", () => {
		assert.equal(isWriteStatement("SELECT * FROM users"), false);
		assert.equal(isWriteStatement("  select 1"), false);
	});

	it("SHOW / DESCRIBE / EXPLAIN 是只读", () => {
		assert.equal(isWriteStatement("SHOW TABLES"), false);
		assert.equal(isWriteStatement("DESCRIBE users"), false);
		assert.equal(isWriteStatement("EXPLAIN SELECT 1"), false);
	});

	it("INSERT / UPDATE / DELETE 是写操作", () => {
		assert.equal(isWriteStatement("INSERT INTO users VALUES (1)"), true);
		assert.equal(isWriteStatement("UPDATE users SET name = 'x'"), true);
		assert.equal(isWriteStatement("DELETE FROM users"), true);
	});

	it("DDL 也算写操作", () => {
		assert.equal(isWriteStatement("CREATE TABLE t (id INT)"), true);
		assert.equal(isWriteStatement("DROP TABLE t"), true);
		assert.equal(isWriteStatement("ALTER TABLE t ADD COLUMN c INT"), true);
	});

	it("WITH + SELECT 是只读", () => {
		assert.equal(isWriteStatement("WITH cte AS (SELECT 1) SELECT * FROM cte"), false);
	});

	it("WITH + INSERT 是写操作", () => {
		assert.equal(isWriteStatement("WITH cte AS (SELECT 1) INSERT INTO t SELECT * FROM cte"), true);
	});

	it("EXPLAIN ANALYZE + 写操作是写", () => {
		assert.equal(isWriteStatement("EXPLAIN ANALYZE DELETE FROM users"), true);
	});

	it("EXPLAIN ANALYZE + SELECT 是只读", () => {
		assert.equal(isWriteStatement("EXPLAIN ANALYZE SELECT * FROM users"), false);
	});

	it("带前导注释的语句", () => {
		assert.equal(isWriteStatement("-- comment\nSELECT 1"), false);
		assert.equal(isWriteStatement("/* block */ INSERT INTO t VALUES (1)"), true);
	});

	it("空字符串不是写操作", () => {
		assert.equal(isWriteStatement(""), false);
		assert.equal(isWriteStatement("   "), false);
	});
});

describe("sql-safety · isDdlStatement", () => {
	it("CREATE / ALTER / DROP / TRUNCATE / RENAME 是 DDL", () => {
		assert.equal(isDdlStatement("CREATE TABLE t (id INT)"), true);
		assert.equal(isDdlStatement("ALTER TABLE t ADD c INT"), true);
		assert.equal(isDdlStatement("DROP TABLE t"), true);
		assert.equal(isDdlStatement("TRUNCATE TABLE t"), true);
		assert.equal(isDdlStatement("RENAME TABLE t TO t2"), true);
	});

	it("SELECT / INSERT 不是 DDL", () => {
		assert.equal(isDdlStatement("SELECT 1"), false);
		assert.equal(isDdlStatement("INSERT INTO t VALUES (1)"), false);
	});

	it("WITH + DDL 是 DDL", () => {
		assert.equal(isDdlStatement("WITH cte AS (SELECT 1) CREATE TABLE t AS SELECT * FROM cte"), true);
	});

	it("WITH + SELECT 不是 DDL", () => {
		assert.equal(isDdlStatement("WITH cte AS (SELECT 1) SELECT * FROM cte"), false);
	});
});

describe("sql-safety · splitStatements", () => {
	it("按分号分割", () => {
		const stmts = splitStatements("SELECT 1; SELECT 2;");
		assert.deepEqual(stmts, ["SELECT 1", "SELECT 2"]);
	});

	it("忽略空语句", () => {
		const stmts = splitStatements("SELECT 1;; ; SELECT 2");
		assert.deepEqual(stmts, ["SELECT 1", "SELECT 2"]);
	});

	it("字符串内的分号也会被分割（splitStatements 不做字符串感知）", () => {
		const stmts = splitStatements("SELECT 'a;b'; SELECT 2");
		assert.equal(stmts.length, 3);
	});

	it("注释内的分号不分割", () => {
		const stmts = splitStatements("SELECT 1; -- ; not split\nSELECT 2");
		assert.equal(stmts.length, 2);
	});
});

describe("sql-safety · classifyQuery", () => {
	it("单条 SELECT 分类为 read", () => {
		const result = classifyQuery("SELECT * FROM users");
		assert.equal(result.kind, "read");
		assert.equal(result.requiresConfirmation, false);
		assert.equal(result.statements.length, 1);
	});

	it("单条 INSERT 分类为 write", () => {
		const result = classifyQuery("INSERT INTO users VALUES (1)");
		assert.equal(result.kind, "write");
		assert.equal(result.requiresConfirmation, true);
	});

	it("单条 CREATE 分类为 ddl", () => {
		const result = classifyQuery("CREATE TABLE t (id INT)");
		assert.equal(result.kind, "ddl");
		assert.equal(result.requiresConfirmation, true);
	});

	it("混合语句取最严格级别", () => {
		const readThenWrite = classifyQuery("SELECT 1; INSERT INTO t VALUES (1)");
		assert.equal(readThenWrite.kind, "write");
		assert.deepEqual(readThenWrite.kinds, ["read", "write"]);

		const readThenDdl = classifyQuery("SELECT 1; CREATE TABLE t (id INT)");
		assert.equal(readThenDdl.kind, "ddl");
		assert.deepEqual(readThenDdl.kinds, ["read", "ddl"]);
	});

	it("ddl 优先于 write", () => {
		const result = classifyQuery("INSERT INTO t VALUES (1); CREATE TABLE t2 (id INT)");
		assert.equal(result.kind, "ddl");
	});
});

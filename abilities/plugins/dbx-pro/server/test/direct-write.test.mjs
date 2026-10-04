/**
 * direct-write 单测。
 *
 * 真正的写执行需要活数据库，不在此覆盖；这里覆盖：
 * - familyOf：dbType → 驱动家族的别名识别；
 * - looksMultiStatement：忽略字符串 / 注释里的分号；
 * - executeWrite 的前置错误路径（不支持家族、只读连接），无需连接数据库。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { executeWrite, familyOf, looksMultiStatement } from "../src/write/direct-write.mjs";

describe("familyOf", () => {
	const pgTypes = ["postgres", "postgresql", "redhift", "greenplum", "cockroach", "pg"];
	for (const type of pgTypes) {
		it(`${type} → pg`, () => assert.equal(familyOf(type), "pg"));
	}
	const mysqlTypes = ["mysql", "mariadb", "tidb", "starrocks", "doris", "oceanbase"];
	for (const type of mysqlTypes) {
		it(`${type} → mysql`, () => assert.equal(familyOf(type), "mysql"));
	}
	const mssqlTypes = ["mssql", "sqlserver"];
	for (const type of mssqlTypes) {
		it(`${type} → mssql`, () => assert.equal(familyOf(type), "mssql"));
	}
	const unsupported = ["sqlite", "redis", "mongodb", "oracle", "", undefined];
	for (const type of unsupported) {
		it(`${String(type)} 不支持写`, () => assert.equal(familyOf(type), null));
	}
	it("大小写与前后空白不影响判定", () => {
		assert.equal(familyOf("  POSTGRES "), "pg");
	});
});

describe("looksMultiStatement", () => {
	it("两条真实语句 → true", () => {
		assert.equal(looksMultiStatement("UPDATE t SET a = 1; UPDATE t SET a = 2"), true);
		assert.equal(looksMultiStatement("INSERT INTO t VALUES (1); INSERT INTO t VALUES (2)"), true);
	});
	it("单语句 → false", () => {
		assert.equal(looksMultiStatement("UPDATE t SET a = 1"), false);
		assert.equal(looksMultiStatement("SELECT 1"), false);
	});
	it("字符串字面量里的分号不算语句边界", () => {
		assert.equal(looksMultiStatement("UPDATE t SET x = 'a;b'"), false);
		assert.equal(looksMultiStatement('UPDATE t SET x = "a;b"'), false);
	});
	it("注释里的分号不算语句边界", () => {
		assert.equal(looksMultiStatement("UPDATE t SET a = 1 -- ;comment"), false);
		assert.equal(looksMultiStatement("UPDATE t SET a = 1 /* ;c */"), false);
	});
	it("分号后只剩空白不算多语句", () => {
		assert.equal(looksMultiStatement("UPDATE t SET a = 1;   "), false);
		assert.equal(looksMultiStatement("UPDATE t SET a = 1; -- tail"), false);
	});
});

describe("executeWrite 前置错误路径", () => {
	it("不支持的 dbType 抛 WRITE_UNSUPPORTED（不会尝试连库）", async () => {
		await assert.rejects(
			() => executeWrite({ db_type: "sqlite", host: "x" }, "CREATE TABLE t (id int)"),
			(error) => {
				assert.equal(error.code, "WRITE_UNSUPPORTED");
				assert.match(error.message, /暂不支持/);
				return true;
			},
		);
	});

	it("只读连接抛 CONNECTION_READ_ONLY", async () => {
		await assert.rejects(
			() =>
				executeWrite(
					{ db_type: "postgres", host: "127.0.0.1", read_only: true },
					"UPDATE t SET a = 1",
				),
			(error) => {
				assert.equal(error.code, "CONNECTION_READ_ONLY");
				return true;
			},
		);
	});
});

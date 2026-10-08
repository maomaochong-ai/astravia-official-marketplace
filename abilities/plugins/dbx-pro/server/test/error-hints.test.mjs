/**
 * error-hints 单测 — SQL 失败诊断的纯函数部分。
 * 重点：各方言「对象不存在」识别、限定名与裸名的不同建议、
 * 上下文描述（含分页改写与截断）、目录查询 SQL 的转义与方言判定。
 * 全部纯函数，不发任何 MCP 调用。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	buildSqlErrorHint,
	describeQueryContext,
	matchMissingDatabase,
	matchMissingObject,
	matchMissingRole,
	parseTableLocations,
	tableLocationQuery,
} from "../src/engine/error-hints.mjs";

describe("matchMissingObject", () => {
	it("识别 PostgreSQL 的 relation / table / view", () => {
		assert.deepEqual(matchMissingObject('ERROR: relation "ods_x" does not exist'), {
			name: "ods_x",
			qualified: false,
		});
		assert.deepEqual(matchMissingObject('ERROR: table "public.t" does not exist'), {
			name: "public.t",
			qualified: true,
		});
		assert.deepEqual(matchMissingObject('ERROR: materialized view "mv_a" does not exist'), {
			name: "mv_a",
			qualified: false,
		});
	});

	it("识别 MySQL / SQL Server / SQLite / ClickHouse 的说法", () => {
		assert.equal(matchMissingObject("Table 'kaiwu.ods_x' doesn't exist").name, "kaiwu.ods_x");
		assert.equal(matchMissingObject("Invalid object name 'dbo.t'.").name, "dbo.t");
		assert.equal(matchMissingObject("SQLITE_ERROR: no such table: users").name, "users");
		assert.equal(matchMissingObject("Code: 60. DB::Exception: Unknown table 't'").name, "t");
	});

	it("认不出就不是表不存在", () => {
		assert.equal(matchMissingObject("connect ECONNREFUSED 127.0.0.1:5432"), null);
		assert.equal(matchMissingObject(""), null);
		assert.equal(matchMissingObject(null), null);
	});
});

describe("matchMissingRole / matchMissingDatabase", () => {
	it("提取角色名", () => {
		assert.equal(matchMissingRole('FATAL: role "tableau" does not exist'), "tableau");
		assert.equal(matchMissingRole("permission denied"), null);
	});
	it("提取库名", () => {
		assert.equal(matchMissingDatabase('FATAL: database "zhugeyue" does not exist'), "zhugeyue");
		assert.equal(matchMissingDatabase("relation does not exist"), null);
	});
});

describe("tableLocationQuery", () => {
	it("在 PG 系方言上按 relname 查 schema", () => {
		const sql = tableLocationQuery("postgres", "ods_x");
		assert.ok(sql.includes("pg_catalog.pg_class"));
		assert.ok(sql.includes("c.relname = 'ods_x'"));
		assert.ok(sql.includes("n.nspname NOT IN ('information_schema','pg_catalog','pg_toast')"));
		assert.ok(sql.includes("LIMIT 5"));
	});

	it("限定名只按最后一段查（schema 不参与匹配）", () => {
		assert.ok(tableLocationQuery("postgres", "ods.ods_x").includes("c.relname = 'ods_x'"));
	});

	it("名字里的单引号转义，不拼出语法错的 SQL", () => {
		assert.ok(tableLocationQuery("postgres", "it's").includes("c.relname = 'it''s'"));
	});

	it("非 PG 方言与空名字返回 null（不猜）", () => {
		assert.equal(tableLocationQuery("mysql", "ods_x"), null);
		assert.equal(tableLocationQuery("sqlserver", "dbo.t"), null);
		assert.equal(tableLocationQuery("postgres", "."), null);
		assert.equal(tableLocationQuery("postgres", ""), null);
	});
});

describe("parseTableLocations", () => {
	it("从 Markdown 表里取出 schema 名", () => {
		const text = "| schema_name |\n| --- |\n| ods |\n| ods_backup |";
		assert.deepEqual(parseTableLocations(text), ["ods", "ods_backup"]);
	});
	it("空结果 / 空文本返回空数组", () => {
		assert.deepEqual(parseTableLocations("| schema_name |\n| --- |"), []);
		assert.deepEqual(parseTableLocations(""), []);
	});
});

describe("describeQueryContext", () => {
	it("完整上下文含连接、方言、地址、库与 SQL", () => {
		const text = describeQueryContext({
			connection: "kaiwu-prod",
			dbType: "postgres",
			host: "10.0.0.5",
			port: 5432,
			database: "kaiwu",
			sql: "SELECT 1",
		});
		assert.ok(text.startsWith("本次查询上下文：连接 kaiwu-prod · postgres · 10.0.0.5:5432 · 库 kaiwu"));
		assert.ok(text.includes("实际执行的 SQL：\nSELECT 1"));
	});

	it("只给了连接名也不编造地址", () => {
		assert.equal(describeQueryContext({ connection: "c1", sql: "SELECT 1" }).split("\n")[0], "本次查询上下文：连接 c1");
	});

	it("分页改写后的语句只在确实不同时才附上", () => {
		const same = describeQueryContext({ connection: "c1", sql: "SELECT 1", effectiveSql: "SELECT 1" });
		assert.equal(same.includes("引擎分页改写"), false);
		const wrapped = describeQueryContext({
			connection: "c1",
			sql: "SELECT 1",
			effectiveSql: "SELECT * FROM (SELECT 1) AS _dbx_page LIMIT 100 OFFSET 0",
		});
		assert.ok(wrapped.includes("引擎分页改写后下发："));
	});

	it("超长 SQL 截断并标注原长", () => {
		const text = describeQueryContext({ connection: "c1", sql: "x".repeat(500) });
		assert.ok(text.includes("已截断，原长 500 字"));
		assert.ok(text.includes("x".repeat(400)));
	});
});

describe("buildSqlErrorHint", () => {
	it("裸表名：提示限定名，并给出 search_path 这个真实原因", () => {
		const hint = buildSqlErrorHint('ERROR: relation "ods_sclh_x" does not exist', {
			connection: "kaiwu-prod",
			database: "kaiwu",
			host: "10.0.0.5",
			port: 5432,
		});
		assert.ok(hint.includes("不带 schema 的裸名"));
		assert.ok(hint.includes("ods.ods_sclh_x"));
		assert.ok(hint.includes("复制限定名"));
	});

	it("限定名：指向 schema 名与连接库", () => {
		const hint = buildSqlErrorHint('ERROR: relation "ods.ods_x" does not exist', { database: "kaiwu" });
		assert.ok(hint.includes("带了限定名却不存在"));
		assert.ok(hint.includes("库 kaiwu"));
	});

	it("查到表在别的 schema：直接给出限定名", () => {
		const hint = buildSqlErrorHint('ERROR: relation "ods_x" does not exist', {
			tableLocation: ["ods", "ods_backup"],
		});
		assert.ok(hint.includes("存在于 schema：ods、ods_backup"));
		assert.ok(hint.includes("例如 ods.ods_x"));
	});

	it("查过但没有：提示可能连错库，而不是断言表不存在", () => {
		const hint = buildSqlErrorHint('ERROR: relation "ods_x" does not exist', { tableLocation: null });
		assert.ok(hint.includes("优先怀疑这个连接指向的数据库"));
	});

	it("未查目录（undefined）不提这件事", () => {
		const hint = buildSqlErrorHint('ERROR: relation "ods_x" does not exist', {});
		assert.equal(hint.includes("目录里查到"), false);
		assert.equal(hint.includes("没查到同名表"), false);
	});

	it("角色不存在：指向连接用户名与脚本里的角色引用", () => {
		const hint = buildSqlErrorHint('FATAL: role "tableau" does not exist', { database: "kaiwu" });
		assert.ok(hint.includes("角色「tableau」在目标库里不存在"));
		assert.ok(hint.includes("连接配置里的登录用户名"));
		assert.ok(hint.includes("SET ROLE"));
	});

	it("库不存在 / 权限不足各有说法", () => {
		assert.ok(buildSqlErrorHint('FATAL: database "nope" does not exist').includes("数据库「nope」不存在"));
		assert.ok(buildSqlErrorHint("ERROR: permission denied for table t").includes("权限不足"));
	});

	it("与本次错误无关的文本不产生提示", () => {
		assert.equal(buildSqlErrorHint("connect ECONNREFUSED"), "");
		assert.equal(buildSqlErrorHint(""), "");
		assert.equal(buildSqlErrorHint(null), "");
	});
});

/**
 * 例程目录的测试 — 方言门禁、重载去重、调用模板。
 *
 * 例程是「树里点得到、SQL 里跑不通」的重灾区，这里锁住三件事：
 * 1. 方言拿不准就不给 SQL（调用方据此隐藏分组，而不是给一个点开就报错的分组）；
 * 2. 同名重载按签名区分，不能互相覆盖；
 * 3. 调用模板只给骨架 —— 签名留在注释里，不把 `f(a integer)` 当可执行语句发出去。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	buildRoutineCallTemplate,
	parseRoutines,
	routineKeyName,
	routineLabel,
	routinesCatalogSql,
} from "../features/database-workspace/services/routines-catalog.ts";

describe("routinesCatalogSql — 方言门禁", () => {
	it("postgres 走 pg_proc，能拿到实参签名", () => {
		const sql = routinesCatalogSql("postgres", "public");
		assert.match(sql, /pg_catalog\.pg_proc/);
		assert.match(sql, /pg_get_function_identity_arguments/);
		assert.match(sql, /n\.nspname = 'public'/);
		assert.doesNotMatch(sql, /information_schema\.routines/);
	});

	it("不给 schema 时不加 schema 过滤（无 schema 层的库）", () => {
		assert.doesNotMatch(routinesCatalogSql("postgres"), /nspname = '/);
	});

	it("schema 名里的单引号被转义，不会拼出注入面", () => {
		assert.match(routinesCatalogSql("postgres", "o'brien"), /nspname = 'o''brien'/);
	});

	it("mysql 走 information_schema.routines", () => {
		const sql = routinesCatalogSql("mysql", "app");
		assert.match(sql, /information_schema\.routines/);
		assert.match(sql, /routine_schema = 'app'/);
	});

	it("拿不准的方言返回 null —— 宁可隐藏分组，也不给点开就报错的分组", () => {
		for (const dbType of ["sqlite", "oracle", "mongodb", "redshift", "greenplum", undefined]) {
			assert.equal(routinesCatalogSql(dbType, "public"), null, String(dbType));
		}
	});

	it("排除系统 schema 与临时 schema", () => {
		const sql = routinesCatalogSql("postgres", "public");
		assert.match(sql, /nspname NOT IN \('information_schema','pg_catalog'\)/);
		assert.match(sql, /nspname NOT LIKE 'pg_temp%'/);
	});
});

describe("parseRoutines — 重载去重", () => {
	it("同名不同签名都保留，重载必须能分别点开", () => {
		const routines = parseRoutines([
			{ schema_name: "public", routine_name: "f", routine_kind: "f", routine_args: "a integer" },
			{ schema_name: "public", routine_name: "f", routine_kind: "f", routine_args: "a text" },
		]);
		assert.deepEqual(routines.map((r) => r.args), ["a integer", "a text"]);
	});

	it("完全相同的行只保留一次", () => {
		const row = { schema_name: "public", routine_name: "f", routine_kind: "f", routine_args: "a integer" };
		assert.equal(parseRoutines([row, { ...row }]).length, 1);
	});

	it("kind 统一成大写，缺列退化成空串", () => {
		const [routine] = parseRoutines([{ routine_name: "f", routine_kind: "procedure" }]);
		assert.equal(routine.kind, "PROCEDURE");
		assert.equal(routine.schema, "");
		assert.equal(routine.args, "");
	});

	it("没有名字的行丢弃", () => {
		assert.deepEqual(parseRoutines([{ schema_name: "public", routine_kind: "f" }]), []);
	});
});

describe("routineLabel / routineKeyName — 树里的身份", () => {
	it("有签名时标签带签名，没签名时补空括号", () => {
		assert.equal(routineLabel({ schema: "public", name: "f", kind: "FUNCTION", args: "a integer" }), "f(a integer)");
		assert.equal(routineLabel({ schema: "public", name: "f", kind: "FUNCTION", args: "" }), "f()");
	});

	it("key 名不带空括号后缀（无签名的例程用它做节点标识）", () => {
		assert.equal(routineKeyName({ schema: "public", name: "f", kind: "FUNCTION", args: "" }), "f");
		assert.equal(routineKeyName({ schema: "public", name: "f", kind: "FUNCTION", args: "a integer" }), "f(a integer)");
	});
});

describe("buildRoutineCallTemplate — 只给骨架", () => {
	it("PROCEDURE 用 CALL，签名留在注释里", () => {
		const sql = buildRoutineCallTemplate({ schema: "public", name: "p", kind: "PROCEDURE", args: "a integer" });
		assert.equal(sql, "-- 存储过程 public.p(a integer)\nCALL public.p();");
	});

	it("FUNCTION 用 SELECT，不把形参类型写进可执行语句", () => {
		const sql = buildRoutineCallTemplate({ schema: "public", name: "f", kind: "FUNCTION", args: "a integer" });
		assert.equal(sql, "-- 函数 public.f(a integer)\nSELECT * FROM public.f();");
		assert.doesNotMatch(sql.split("\n")[1], /a integer/);
	});

	it("无 schema 的例程不给限定名", () => {
		const sql = buildRoutineCallTemplate({ schema: "", name: "p", kind: "PROCEDURE", args: "" });
		assert.equal(sql, "-- 存储过程 p()\nCALL p();");
	});
});

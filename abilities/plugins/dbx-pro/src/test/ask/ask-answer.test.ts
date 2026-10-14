/**
 * 问数 · 模型输出 → 结构化答案（纯函数）。
 *
 * 这是「不可信输入」的边界：模型的回答可能不带 JSON、带坏 JSON、带写操作 SQL、
 * 带多条语句。钉住四件事：
 *   1. 围栏 JSON / 前后夹解释文字 / 裸 JSON 都要能挖出来；
 *   2. 挖不出来就返回 error（可重试提示语），绝不返回「半成品草稿」；
 *   3. `checkReadOnlySql` 拦住写操作与多语句（run_sql 与最终 SQL 共用这一条规则）；
 *   4. 缺 findings / suggestions 不算错 —— 宁可少展示也不编造。
 *
 * 运行：npm test
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkReadOnlySql, extractJsonObject, parseAskAnswer } from "../../features/ask/ask-answer.ts";

const VALID = {
	intent: "近 14 天成交额趋势",
	chartKind: "chart-line",
	fields: ["dt", "gmv"],
	sql: "SELECT dt, SUM(gmv) AS gmv FROM orders WHERE dt >= '2026-10-01' GROUP BY dt ORDER BY dt",
	findings: "10-04 成交额 1,500，比 10-01 高 25%",
	conclusion: "成交额整体上行",
	suggestions: ["看渠道维度", "看新客占比"],
};

describe("ask-answer · JSON 抽取", () => {
	it("裸 JSON / 围栏 JSON / 夹带解释文字都能挖出来", () => {
		assert.ok(extractJsonObject(JSON.stringify(VALID)));
		assert.ok(extractJsonObject(`这是我的答案：\n\`\`\`json\n${JSON.stringify(VALID)}\n\`\`\``));
		assert.ok(extractJsonObject(`先说两句\n{"a":1}\n后面还有话`));
	});

	it("花括号配对必须尊重字符串里的括号与转义", () => {
		const text = '{"sql":"SELECT \'{\' AS x","note":"}\\"}"}';
		const extracted = extractJsonObject(text);
		assert.ok(extracted);
		assert.equal(JSON.parse(extracted).sql, "SELECT '{' AS x");
	});

	it("没有对象时返回 null", () => {
		assert.equal(extractJsonObject("我查了一下，数据是这样的"), null);
		assert.equal(extractJsonObject(""), null);
	});
});

describe("ask-answer · 只读单语句校验", () => {
	it("通过 SELECT / WITH", () => {
		assert.equal(checkReadOnlySql("SELECT 1"), null);
		assert.equal(checkReadOnlySql("select * from t where a = 1;"), null);
		assert.equal(checkReadOnlySql("WITH x AS (SELECT 1 AS a) SELECT * FROM x"), null);
	});

	it("拦住写操作", () => {
		for (const sql of [
			"DELETE FROM orders",
			"UPDATE orders SET gmv = 0",
			"INSERT INTO orders VALUES (1)",
			"DROP TABLE orders",
			"CREATE TABLE t (a int)",
			"TRUNCATE TABLE orders",
		]) {
			assert.ok(checkReadOnlySql(sql), `${sql} 应该被拒绝`);
		}
	});

	it("拦住多语句与空语句", () => {
		assert.ok(checkReadOnlySql("SELECT 1; SELECT 2"));
		assert.ok(checkReadOnlySql("SELECT 1; DROP TABLE t"));
		assert.ok(checkReadOnlySql(""));
		assert.ok(checkReadOnlySql("   "));
	});

	it("注释里的关键字不误伤", () => {
		assert.equal(checkReadOnlySql("SELECT 1 -- drop table nothing"), null);
		assert.equal(checkReadOnlySql("SELECT 1 /* delete from x */"), null);
	});

	it("不误伤名字里含关键字的列", () => {
		assert.equal(checkReadOnlySql("SELECT updated_at, created_at FROM orders"), null);
		assert.equal(checkReadOnlySql("SELECT deleted_flag FROM orders"), null);
	});
});

describe("ask-answer · 解析", () => {
	it("完整 JSON → 草稿", () => {
		const out = parseAskAnswer(JSON.stringify(VALID));
		assert.equal(out.error, null);
		assert.deepEqual(out.draft, VALID);
	});

	it("围栏 + 前后解释文字 → 草稿", () => {
		const out = parseAskAnswer(`我跑了三条 SQL，结论如下：\n\`\`\`json\n${JSON.stringify(VALID)}\n\`\`\`\n希望有帮助。`);
		assert.equal(out.error, null);
		assert.equal(out.draft?.sql, VALID.sql);
	});

	it("没有 JSON → 报错并给出可重试提示", () => {
		const out = parseAskAnswer("成交额整体上行，建议看渠道维度。");
		assert.equal(out.draft, null);
		assert.match(String(out.error), /没有找到 JSON/);
	});

	it("坏 JSON → 报错不抛异常", () => {
		const out = parseAskAnswer('{"sql": "SELECT 1",}');
		assert.equal(out.draft, null);
		assert.match(String(out.error), /JSON 解析失败/);
	});

	it("缺 sql / sql 非法 → 拒绝", () => {
		assert.match(String(parseAskAnswer('{"intent":"x"}').error), /缺少 sql 字段/);
		assert.match(
			String(parseAskAnswer(JSON.stringify({ sql: "DELETE FROM orders" })).error),
			/只读/,
		);
		assert.match(
			String(parseAskAnswer(JSON.stringify({ sql: "SELECT 1; SELECT 2" })).error),
			/一条 SQL/,
		);
	});

	it("顶层不是对象 → 拒绝", () => {
		assert.match(String(parseAskAnswer("[1,2]").error), /没有找到 JSON/);
		assert.match(String(parseAskAnswer('"just a string"').error), /没有找到 JSON/);
	});

	it("缺 findings / suggestions 不算错，字段类型放宽（字符串数组或逗号分隔）", () => {
		const out = parseAskAnswer(JSON.stringify({ sql: "SELECT 1", suggestions: "看渠道, 看新客；看地域" }));
		assert.equal(out.error, null);
		assert.equal(out.draft?.findings, "");
		assert.deepEqual(out.draft?.suggestions, ["看渠道", "看新客", "看地域"]);
	});
});

/**
 * send-context 测试 — 验证 prompt 构造函数的输出内容。
 * 发送逻辑在 send-to-ai-dialog 中单独测试。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	buildConnectionPrompt,
	buildQueryPrompt,
	buildTablePrompt,
} from "../shared/ai/send-context.ts";

describe("buildTablePrompt", () => {
	it("带 schema 时 prompt 含限定名", () => {
		const text = buildTablePrompt({ connectionName: "prod", schema: "public", table: "users" });
		assert.ok(text.includes("@`prod`"));
		assert.ok(text.includes("@`public.users`"));
		// 精简版不再包含抽样 SQL
		assert.equal(text.includes("SELECT *"), false);
	});

	it("无 schema 时只用表名", () => {
		const text = buildTablePrompt({ connectionName: "c", table: "t" });
		assert.ok(text.includes("@`c`"));
		assert.ok(text.includes("@`t`"));
	});
});

describe("buildConnectionPrompt", () => {
	it("prompt 含连接名与数据库类型，不包含样本数据请求", () => {
		const text = buildConnectionPrompt({ connectionName: "warehouse", dbType: "postgres" });
		assert.ok(text.includes("warehouse"));
		assert.ok(text.includes("@`warehouse`"));
		assert.ok(text.includes("postgres"));
		// 连接级上下文不需要重新抽样，只需列出可用表
		assert.ok(text.includes("列出该连接中的可用表"));
		assert.equal(text.includes("抽样"), false, "连接级 prompt 不应包含抽样请求");
	});
});

describe("buildQueryPrompt", () => {
	it("SQL 放在代码块中", () => {
		const text = buildQueryPrompt("db", "SELECT 1");
		assert.ok(text.includes("@`db`"));
		assert.ok(text.includes("```sql"));
		assert.ok(text.includes("SELECT 1"));
	});

	it("不附带结果 JSON（精简版）", () => {
		const rows = Array.from({ length: 50 }, (_, i) => ({ id: i }));
		const text = buildQueryPrompt("db", "SELECT * FROM t", rows);
		// 精简版不再附带 JSON 样本
		assert.equal(text.includes("```json"), false);
	});

	it("无样例行时也不附 JSON 块", () => {
		const text = buildQueryPrompt("db", "SELECT 1", []);
		assert.equal(text.includes("```json"), false);
	});
});

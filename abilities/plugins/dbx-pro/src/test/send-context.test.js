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
	it("带 schema 时 prompt 含限定名与抽样 SQL", () => {
		const text = buildTablePrompt({ connectionName: "prod", schema: "public", table: "users" });
		assert.ok(text.includes("@`prod`"));
		assert.ok(text.includes("@`public.users`"));
		assert.ok(text.includes("SELECT * FROM public.users LIMIT 100"));
	});

	it("无 schema 时只用表名", () => {
		const text = buildTablePrompt({ connectionName: "c", table: "t" });
		assert.ok(text.includes("@`c`"));
		assert.ok(text.includes("@`t`"));
		assert.ok(text.includes("SELECT * FROM t LIMIT 100"));
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

	it("样例行截断到 20 行并以 JSON 块附带", () => {
		const rows = Array.from({ length: 50 }, (_, i) => ({ id: i }));
		const text = buildQueryPrompt("db", "SELECT * FROM t", rows);
		assert.ok(text.includes("```json"));
		assert.ok(text.includes('"id": 19'));
		assert.equal(text.includes('"id": 20'), false);
	});

	it("无样例行时不附 JSON 块", () => {
		const text = buildQueryPrompt("db", "SELECT 1", []);
		assert.equal(text.includes("```json"), false);
	});
});

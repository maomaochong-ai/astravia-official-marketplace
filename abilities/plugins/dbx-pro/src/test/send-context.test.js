/**
 * send-context 测试 — 验证注入 AI 输入框的 prompt 内容。
 * 用假 conversation 捕获 insertText，不调用真实模型。
 */

import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { setRuntime } from "../runtime-contract.ts";
import {
	sendConnectionToAi,
	sendQueryToAi,
	sendTableToAi,
} from "../shared/ai/send-context.ts";

let captured = "";

function setup() {
	setRuntime({
		conversation: {
			insertText(text) {
				captured = text;
			},
		},
	});
}

after(() => setRuntime(null));

describe("sendTableToAi", () => {
	it("带 schema 时 prompt 含限定名与抽样 SQL", () => {
		setup();
		sendTableToAi({ connectionName: "prod", schema: "public", table: "users" });
		assert.ok(captured.includes("prod"));
		assert.ok(captured.includes("public.users"));
		assert.ok(captured.includes("SELECT * FROM public.users LIMIT 100"));
	});

	it("无 schema 时只用表名", () => {
		setup();
		sendTableToAi({ connectionName: "c", table: "t" });
		assert.ok(captured.includes("表 t。"));
		assert.ok(captured.includes("SELECT * FROM t LIMIT 100"));
	});
});

describe("sendConnectionToAi", () => {
	it("prompt 含连接名与数据库类型", () => {
		setup();
		sendConnectionToAi({ connectionName: "warehouse", dbType: "postgres" });
		assert.ok(captured.includes("warehouse"));
		assert.ok(captured.includes("postgres"));
	});
});

describe("sendQueryToAi", () => {
	it("SQL 放在代码块中", () => {
		setup();
		sendQueryToAi("db", "SELECT 1");
		assert.ok(captured.includes("```sql"));
		assert.ok(captured.includes("SELECT 1"));
	});

	it("样例行截断到 20 行并以 JSON 块附带", () => {
		setup();
		const rows = Array.from({ length: 50 }, (_, i) => ({ id: i }));
		sendQueryToAi("db", "SELECT * FROM t", rows);
		assert.ok(captured.includes("```json"));
		assert.ok(captured.includes('"id": 19'));
		assert.equal(captured.includes('"id": 20'), false);
	});

	it("无样例行时不附 JSON 块", () => {
		setup();
		sendQueryToAi("db", "SELECT 1", []);
		assert.equal(captured.includes("```json"), false);
	});
});

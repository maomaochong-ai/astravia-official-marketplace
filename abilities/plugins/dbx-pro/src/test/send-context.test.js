/**
 * send-context 测试 — 验证注入 AI 输入框的 prompt 内容。
 * 用假 conversation + 假权限模拟宿主环境，捕获最终 sendPrompt 或 insertText 的调用参数。
 */

import assert from "node:assert/strict";
import { after, beforeEach, describe, it } from "node:test";
import { setRuntime } from "../runtime-contract.ts";
import {
	sendConnectionToAi,
	sendQueryToAi,
	sendTableToAi,
} from "../shared/ai/send-context.ts";

let captured = "";
let lastSendPromptText = "";
let notified = [];

function setup() {
	captured = "";
	lastSendPromptText = "";
	notified = [];
	setRuntime({
		permissions: {
			has(name) {
				// 测试中认为所有权限已授予
				return true;
			},
		},
		ui: {
			notify(opts) {
				notified.push(opts);
			},
		},
		conversation: {
			// insertText：最终降级路径，用于捕获 prompt 内容
			insertText(text) {
				captured = text;
			},
			// on：订阅会话变化，测试中认为没有活跃会话（id=null）
			on(listener) {
				// 立即回放 conversation-changed，id=null 表示无活跃会话
				queueMicrotask(() => listener({ type: "conversation-changed", conversation: { id: null, isStreaming: false } }));
				return { dispose() {} };
			},
			// sendPrompt：测试中模拟成功
			async sendPrompt(text) {
				lastSendPromptText = text;
				return { status: "sent" };
			},
			// createSession：测试中模拟成功
			async createSession(_cwd) {
				return { id: "test-session", isStreaming: false };
			},
		},
	});
}

after(() => setRuntime(null));

describe("sendTableToAi", () => {
	it("带 schema 时 prompt 含限定名与抽样 SQL", async () => {
		setup();
		sendTableToAi({ connectionName: "prod", schema: "public", table: "users" });
		// 新链路：无活跃会话 → createSession → sendPrompt
		await new Promise((r) => setTimeout(r, 50));
		const text = lastSendPromptText || captured;
		assert.ok(text.includes("prod"));
		assert.ok(text.includes("public.users"));
		assert.ok(text.includes("SELECT * FROM public.users LIMIT 100"));
	});

	it("无 schema 时只用表名", async () => {
		setup();
		sendTableToAi({ connectionName: "c", table: "t" });
		await new Promise((r) => setTimeout(r, 50));
		const text = lastSendPromptText || captured;
		assert.ok(text.includes("表 @`t`。"));
		assert.ok(text.includes("SELECT * FROM t LIMIT 100"));
	});
});

describe("sendConnectionToAi", () => {
	it("prompt 含连接名与数据库类型", async () => {
		setup();
		sendConnectionToAi({ connectionName: "warehouse", dbType: "postgres" });
		await new Promise((r) => setTimeout(r, 50));
		const text = lastSendPromptText || captured;
		assert.ok(text.includes("warehouse"));
		assert.ok(text.includes("postgres"));
	});
});

describe("sendQueryToAi", () => {
	it("SQL 放在代码块中", async () => {
		setup();
		sendQueryToAi("db", "SELECT 1");
		await new Promise((r) => setTimeout(r, 50));
		const text = lastSendPromptText || captured;
		assert.ok(text.includes("```sql"));
		assert.ok(text.includes("SELECT 1"));
	});

	it("样例行截断到 20 行并以 JSON 块附带", async () => {
		setup();
		const rows = Array.from({ length: 50 }, (_, i) => ({ id: i }));
		sendQueryToAi("db", "SELECT * FROM t", rows);
		await new Promise((r) => setTimeout(r, 50));
		const text = lastSendPromptText || captured;
		assert.ok(text.includes("```json"));
		assert.ok(text.includes('"id": 19'));
		assert.equal(text.includes('"id": 20'), false);
	});

	it("无样例行时不附 JSON 块", async () => {
		setup();
		sendQueryToAi("db", "SELECT 1", []);
		await new Promise((r) => setTimeout(r, 50));
		const text = lastSendPromptText || captured;
		assert.equal(text.includes("```json"), false);
	});
});

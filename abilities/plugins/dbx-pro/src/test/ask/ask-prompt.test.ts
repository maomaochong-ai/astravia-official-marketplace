/**
 * 问数 · 系统提示词 / 工具契约 / 快捷提问（纯函数）。
 *
 * 提示词是「模型能不能自己取数」的第一道闸：数据集边界、必须先用 run_sql 看真实结果、
 * 只读、以及最终 JSON 契约的字段名 —— 字段名必须与 ask-answer.ts 的解析器一致，
 * 所以这里对字段名逐条断言，将来改契约会因为这条测试失败而被迫两处同改。
 *
 * 运行：npm test
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseAskAnswer } from "../../features/ask/ask-answer.ts";
import { ASK_JSON_CONTRACT, ASK_SQL_TOOL, buildAskSystemPrompt, suggestQuestions } from "../../features/ask/ask-prompt.ts";

describe("ask-prompt · 工具契约", () => {
	it("工具名与参数 schema 稳定", () => {
		assert.equal(ASK_SQL_TOOL.name, "run_sql");
		const params = ASK_SQL_TOOL.parameters as {
			type: string;
			properties: Record<string, unknown>;
			required: string[];
			additionalProperties: boolean;
		};
		assert.equal(params.type, "object");
		assert.deepEqual(Object.keys(params.properties).sort(), ["purpose", "sql"]);
		assert.deepEqual(params.required, ["sql"]);
		assert.equal(params.additionalProperties, false);
	});
});

describe("ask-prompt · 系统提示词", () => {
	const prompt = buildAskSystemPrompt({
		dataset: { connectionName: "warehouse", tables: ["orders", "users"], schemaText: "orders(dt, gmv)" },
		today: "2026-10-15",
	});

	it("带上数据集边界与日期", () => {
		assert.match(prompt, /warehouse/);
		assert.match(prompt, /orders、users/);
		assert.match(prompt, /orders\(dt, gmv\)/);
		assert.match(prompt, /2026-10-15/);
	});

	it("强调先取数再下结论，且只读", () => {
		assert.match(prompt, /run_sql/);
		assert.match(prompt, /真实/);
		assert.match(prompt, /SELECT/);
	});

	it("JSON 契约的字段名与解析器一致", () => {
		for (const field of ["intent", "chartKind", "fields", "sql", "findings", "conclusion", "suggestions"]) {
			assert.match(ASK_JSON_CONTRACT, new RegExp(`"${field}"`));
			assert.match(prompt, new RegExp(`"${field}"`));
		}
		const parsed = parseAskAnswer(
			`\`\`\`json\n{"intent":"i","chartKind":"chart-line","fields":["a"],"sql":"SELECT 1","findings":"f","conclusion":"c","suggestions":["s"]}\n\`\`\``,
		);
		assert.equal(parsed.error, null);
		assert.equal(parsed.draft?.conclusion, "c");
	});

	it("未限定表时提示先自查表结构", () => {
		const loose = buildAskSystemPrompt({ dataset: { connectionName: "dw" } });
		assert.match(loose, /information_schema|sqlite_master/);
		assert.ok(!loose.includes("今天的日期"));
	});
});

describe("ask-prompt · 快捷提问推荐", () => {
	it("按表名语义给更具体的问法", () => {
		const questions = suggestQuestions({ tables: ["orders"] });
		assert.match(questions.join(" | "), /成交额/);
	});

	it("无表时给通用问法，最多 6 条且不重复", () => {
		const questions = suggestQuestions({});
		assert.ok(questions.length > 0 && questions.length <= 6);
		assert.equal(new Set(questions).size, questions.length);
	});

	it("多个语义表叠加后仍不超过 6 条", () => {
		const questions = suggestQuestions({ tables: ["orders", "users", "products", "page_views"] });
		assert.equal(questions.length, 6);
		assert.equal(new Set(questions).size, 6);
	});
});

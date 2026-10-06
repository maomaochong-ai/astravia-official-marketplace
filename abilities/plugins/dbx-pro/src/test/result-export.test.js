/**
 * 结果导出序列化测试 — CSV / JSONL / SQL INSERT（含方言与转义）。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	toCsv,
	toJsonLines,
	toSqlInsert,
	toMarkdown,
	toTsv,
} from "../features/database-workspace/services/result-export.ts";

const cols = ["id", "name"];
const rows = [
	{ id: 1, name: "Alice" },
	{ id: 2, name: "O'Brie" },
	{ id: 3, name: null },
];

describe("toCsv", () => {
	it("带 BOM、CRLF、含逗号字段加引号", () => {
		const out = toCsv(["a"], [{ a: "x,y" }]);
		assert.ok(out.startsWith("\uFEFF"));
		assert.match(out, /"x,y"/);
		assert.ok(out.includes("\r\n"));
	});

	it("null 单元格导出为空串", () => {
		const out = toCsv(cols, rows);
		assert.match(out, /3,$/m);
	});
});

describe("toTsv", () => {
	it("制表符分隔且替换文本中的 tab", () => {
		const out = toTsv(cols, [{ id: 1, name: "a\tb" }]);
		assert.equal(out.split("\n")[0], "id\tname");
		assert.match(out, /a b/);
	});
});

describe("toJsonLines", () => {
	it("每行一个 JSON 对象", () => {
		const lines = toJsonLines(cols, rows).split("\n");
		assert.equal(lines.length, 3);
		assert.deepEqual(JSON.parse(lines[0]), { id: 1, name: "Alice" });
		assert.deepEqual(JSON.parse(lines[2]), { id: 3, name: null });
	});
});

describe("toMarkdown", () => {
	it("竖线转义", () => {
		const out = toMarkdown(cols, [{ id: 1, name: "a|b" }]);
		assert.match(out, /a\\\|b/);
		assert.match(out, /^\| id \| name \|/m);
	});
});

describe("toSqlInsert", () => {
	it("标准方言：双引号标识符仅用于非法名，单引号字符串转义", () => {
		const out = toSqlInsert(cols, rows, "public.users", "standard");
		const lines = out.split("\n");
		assert.equal(lines[0], "INSERT INTO public.users (id, name) VALUES");
		assert.match(lines[1], /\(1, 'Alice'\);/);
		assert.match(lines[2], /\(2, 'O''Brie'\);/);
		assert.match(lines[3], /\(3, NULL\);/);
	});

	it("MySQL 方言：反引号标识符", () => {
		const out = toSqlInsert(["na me"], [{ "na me": "x" }], "t", "mysql");
		assert.match(out, /INSERT INTO `t` \(`na me`\)/);
		assert.match(out, /'x'/);
	});

	it("布尔 / 数字裸写，对象 JSON 化", () => {
		const out = toSqlInsert(["b", "o"], [{ b: true, o: { k: 1 } }], "t");
		assert.match(out, /\(TRUE, '\{"k":1\}'\);/);
	});

	it("默认表名", () => {
		assert.match(toSqlInsert(["a"], [{ a: 1 }]), /INSERT INTO query_result/);
	});

	it("限定名按段加引号", () => {
		const out = toSqlInsert(["a"], [{ a: 1 }], "public.users");
		assert.match(out, /INSERT INTO public\.users/);
		const quoted = toSqlInsert(["a"], [{ a: 1 }], "my schema.users");
		assert.match(quoted, /INSERT INTO "my schema"\.users/);
	});
});

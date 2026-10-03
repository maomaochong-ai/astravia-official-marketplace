/**
 * sqlite3 输出解析回归 — 样例文本取自真实 `sqlite3 -json` 输出（见 .dbx-refactor/audit-2-report.md）。
 * 运行: node --experimental-strip-types --test src/test/*.test.js
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseResultSets } from "../domain/sqlite-output.ts";

describe("sqlite-output.parseResultSets", () => {
	it("单结果集（多行）", () => {
		const text = '[{"a":1,"b":"x"},\n{"a":2,"b":"y"}]';
		const sets = parseResultSets(text);
		assert.equal(sets.length, 1);
		assert.equal(sets[0].length, 2);
		assert.deepEqual(sets[0][1], { a: 2, b: "y" });
	});

	it("多结果集：按语句顺序切分", () => {
		const text = '[{"a":1}]\n[{"b":2,"s":"z]z"}]';
		const sets = parseResultSets(text);
		assert.equal(sets.length, 2);
		assert.deepEqual(sets[0], [{ a: 1 }]);
		assert.deepEqual(sets[1], [{ b: 2, s: "z]z" }]);
	});

	it("字符串内部的括号与转义引号不干扰切分", () => {
		const text = '[{"s":"a]\\"b[","n":1}]';
		const sets = parseResultSets(text);
		assert.equal(sets.length, 1);
		assert.deepEqual(sets[0], [{ s: 'a]"b[', n: 1 }]);
	});

	it("空输出 → 空数组", () => {
		assert.deepEqual(parseResultSets(""), []);
		assert.deepEqual(parseResultSets("   \n  "), []);
	});

	it("非 JSON 文本 → 空数组（不抛出）", () => {
		assert.deepEqual(parseResultSets("Error: no such table: nope"), []);
	});
});

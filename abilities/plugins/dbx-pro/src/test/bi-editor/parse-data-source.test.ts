/**
 * parse-csv.test.ts — 粘贴文本解析回归（纯函数）。
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseCsv } from "../../features/bi-editor/canvas/lib/parse-csv.ts";
import { parseRestJson } from "../../features/bi-editor/canvas/lib/parse-rest-json.ts";

describe("parseCsv", () => {
	it("逗号分隔 + 首行表头", () => {
		const out = parseCsv("region,gmv\n华东,100\n华北,50");
		assert.deepEqual(out.columns, ["region", "gmv"]);
		assert.deepEqual(out.rows, [
			{ region: "华东", gmv: "100" },
			{ region: "华北", gmv: "50" },
		]);
		assert.equal(out.note, "");
	});

	it("自动识别制表符与分号", () => {
		assert.deepEqual(parseCsv("a\tb\n1\t2").columns, ["a", "b"]);
		assert.deepEqual(parseCsv("a;b\n1;2").columns, ["a", "b"]);
	});

	it("引号内的逗号与换行不拆开，\"\" 转义为 \"", () => {
		const out = parseCsv('name,note\n"张""三", "含,逗号"\n"李\n四",x');
		assert.equal(out.rows[0].name, '张"三');
		assert.equal(out.rows[0].note, " 含,逗号");
		assert.equal(out.rows[1].name, "李\n四");
	});

	it("hasHeader=false 时用 col_N 命名", () => {
		const out = parseCsv("1,2\n3,4", false);
		assert.deepEqual(out.columns, ["col_1", "col_2"]);
		assert.equal(out.rows.length, 2);
		assert.match(out.note, /col_1/);
	});

	it("空表头补名，重名列加序号", () => {
		const out = parseCsv(",gmv,gmv\n1,2,3");
		assert.deepEqual(out.columns, ["col_1", "gmv", "gmv_2"]);
	});

	it("短行补空串，长行不丢列", () => {
		const out = parseCsv("a,b,c\n1\n1,2,3,4");
		assert.equal(out.rows[0].c, "");
		assert.deepEqual(out.columns, ["a", "b", "c", "col_4"]);
		assert.equal(out.rows[1].col_4, "4");
	});

	it("CRLF 与 BOM 不产生脏列名", () => {
		const out = parseCsv("\uFEFFa,b\r\n1,2\r\n");
		assert.deepEqual(out.columns, ["a", "b"]);
		assert.deepEqual(out.rows, [{ a: "1", b: "2" }]);
	});

	it("空内容 / 全空行给出明确提示", () => {
		assert.equal(parseCsv("").note, "内容为空");
		assert.equal(parseCsv("   \n\n").note, "内容为空");
	});
});

describe("parseRestJson", () => {
	it("对象数组取键并集，缺失字段补 null", () => {
		const out = parseRestJson([{ a: 1 }, { b: 2 }]);
		assert.deepEqual(out.columns, ["a", "b"]);
		assert.deepEqual(out.rows, [{ a: 1, b: null }, { a: null, b: 2 }]);
	});

	it("从 data / rows / items 包装层里取数组", () => {
		assert.deepEqual(parseRestJson({ code: 0, data: [{ x: 1 }] }).rows, [{ x: 1 }]);
		assert.deepEqual(parseRestJson({ result: { items: [{ y: 2 }] } }).rows, [{ y: 2 }]);
	});

	it("标量数组变单列 value", () => {
		const out = parseRestJson([1, 2, 3]);
		assert.deepEqual(out.columns, ["value"]);
		assert.deepEqual(out.rows, [{ value: 1 }, { value: 2 }, { value: 3 }]);
	});

	it("单个对象当一行", () => {
		assert.deepEqual(parseRestJson({ a: 1, b: 2 }).rows, [{ a: 1, b: 2 }]);
	});

	it("超过上限时截断并记录原始行数", () => {
		const out = parseRestJson(Array.from({ length: 10 }, (_, i) => ({ i })), 3);
		assert.equal(out.rows.length, 3);
		assert.equal(out.truncatedFrom, 10);
	});

	it("空数组 / null 返回空表，由调用方报错", () => {
		assert.deepEqual(parseRestJson([]).rows, []);
		assert.deepEqual(parseRestJson(null).rows, []);
	});
});

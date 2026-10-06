/**
 * xlsx-export 纯逻辑测试 — 不依赖 Excel / 第三方 ZIP 库：
 * 直接按 STORE ZIP 布局解析字节，验证五个 OOXML 部件齐全、
 * 表头 / 数字 / 布尔 / null / 转义写对、中央目录偏移可用。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toXlsx } from "../features/database-workspace/services/xlsx-export.ts";

const LOCAL_SIG = 0x04034b50;
const CENTRAL_SIG = 0x02014b50;
const EOCD_SIG = 0x06054b50;

function u32(bytes, off) {
	return (
		bytes[off] |
		(bytes[off + 1] << 8) |
		(bytes[off + 2] << 16) |
		(bytes[off + 3] << 24)
	) >>> 0;
}

function u16(bytes, off) {
	return bytes[off] | (bytes[off + 1] << 8);
}

/** 解析全部 STORE 本地文件头，返回 [{name, data: string}]。 */
function parseStoredEntries(bytes) {
	const entries = [];
	let off = 0;
	while (off + 30 <= bytes.length && u32(bytes, off) === LOCAL_SIG) {
		const size = u32(bytes, off + 18);
		const nameLen = u16(bytes, off + 26);
		const extraLen = u16(bytes, off + 28);
		const nameStart = off + 30;
		const dataStart = nameStart + nameLen + extraLen;
		const name = new TextDecoder().decode(bytes.subarray(nameStart, nameStart + nameLen));
		const data = new TextDecoder().decode(bytes.subarray(dataStart, dataStart + size));
		entries.push({ name, data });
		off = dataStart + size;
	}
	return entries;
}

describe("toXlsx", () => {
	const cols = ["id", "name", "active"];
	const rows = [
		{ id: 1, name: "O'Reilly", active: true, extra: "ignored" },
		{ id: 2, name: "<tag> & \"q\"", active: false },
		{ id: 3, name: null, active: null },
	];
	const bytes = toXlsx(cols, rows, "results");

	it("以 ZIP 本地文件头开头并以 EOCD 收尾", () => {
		assert.equal(u32(bytes, 0), LOCAL_SIG);
		// EOCD 签名必出现在最后 22 字节起始处
		assert.equal(u32(bytes, bytes.length - 22), EOCD_SIG);
	});

	it("包含 5 个 OOXML 部件", () => {
		const entries = parseStoredEntries(bytes);
		assert.deepEqual(
			entries.map((e) => e.name),
			[
				"[Content_Types].xml",
				"_rels/.rels",
				"xl/workbook.xml",
				"xl/_rels/workbook.xml.rels",
				"xl/worksheets/sheet1.xml",
			],
		);
	});

	it("中央目录条目数 = 文件数", () => {
		const eocd = bytes.length - 22;
		assert.equal(u16(bytes, eocd + 8), 5);
		assert.equal(u16(bytes, eocd + 10), 5);
		// 中央目录起点指向 CENTRAL_SIG
		const cdOff = u32(bytes, eocd + 16);
		assert.equal(u32(bytes, cdOff), CENTRAL_SIG);
	});

	it("工作表名写入 workbook.xml", () => {
		const entries = parseStoredEntries(bytes);
		const wb = entries.find((e) => e.name === "xl/workbook.xml");
		assert.ok(wb);
		assert.match(wb.data, /<sheet name="results"/);
	});

	it("sheet XML：表头 inlineStr、数字裸写、布尔 0/1、null 留空、XML 转义", () => {
		const sheet = parseStoredEntries(bytes).find(
			(e) => e.name === "xl/worksheets/sheet1.xml",
		);
		assert.ok(sheet);
		// 表头
		assert.match(sheet.data, /<c r="A1" t="inlineStr"><is><t[^>]*>id<\/t><\/is><\/c>/);
		// 数字裸写
		assert.match(sheet.data, /<c r="A2"><v>1<\/v><\/c>/);
		// 字符串：单引号在 XML 文本节点中无需转义，XML 特殊字符转义
		assert.match(sheet.data, /O'Reilly/);
		assert.match(sheet.data, /&lt;tag&gt; &amp; &quot;q&quot;/);
		// 布尔
		assert.match(sheet.data, /<c r="C2" t="b"><v>1<\/v><\/c>/);
		assert.match(sheet.data, /<c r="C3" t="b"><v>0<\/v><\/c>/);
		// null → 空单元格（C4 不出现）
		assert.ok(!/<c r="C4"/.test(sheet.data));
		// 行数：表头 + 3 数据行
		assert.equal(sheet.data.match(/<row /g)?.length, 4);
	});

	it("非法表名清洗到 Excel 合法范围（≤31 字符、无 :\\/?*[]）", () => {
		const b = toXlsx(["a"], [], "[bad]:name/that?is*very]longlonglonglonglonglonglonglong");
		const wb = parseStoredEntries(b).find((e) => e.name === "xl/workbook.xml");
		assert.ok(wb);
		const m = wb.data.match(/<sheet name="([^"]+)"/);
		assert.ok(m);
		assert.ok(m[1].length <= 31);
		assert.ok(!/[:\\/?*[\]]/.test(m[1]));
	});

	it("空结果集只含表头行也能成包", () => {
		const b = toXlsx(["a"], []);
		const sheet = parseStoredEntries(b).find((e) => e.name === "xl/worksheets/sheet1.xml");
		assert.ok(sheet);
		assert.equal(sheet.data.match(/<row /g)?.length, 1);
	});
});

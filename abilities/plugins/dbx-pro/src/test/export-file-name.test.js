/**
 * export-file-name 纯逻辑测试 —— 库名_表名_YYYYMMDD_HHmm 命名规则。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	EXPORT_FILE_NAME_FALLBACK,
	buildExportBaseName,
	buildExportFileName,
	compactExportTimestamp,
	sanitizeNameSegment,
} from "../features/database-workspace/services/export-file-name.ts";

// 固定本地时间：2026-10-06 15:30（月份从 0 起）。
const NOW = new Date(2026, 9, 6, 15, 30);
const TS = "20261006_1530";

describe("compactExportTimestamp", () => {
	it("格式为 YYYYMMDD_HHmm，月/日/时/分补零", () => {
		assert.equal(compactExportTimestamp(NOW), TS);
		assert.equal(compactExportTimestamp(new Date(2026, 0, 2, 3, 5)), "20260102_0305");
	});
});

describe("sanitizeNameSegment", () => {
	it("正常名字原样返回", () => {
		assert.equal(sanitizeNameSegment("orders"), "orders");
		assert.equal(sanitizeNameSegment("mydb"), "mydb");
	});
	it("非法字符替换为下划线", () => {
		assert.equal(sanitizeNameSegment('a/b\\c:d*e?f"g<h>i|j'), "a_b_c_d_e_f_g_h_i_j");
	});
	it("控制字符替换为下划线", () => {
		assert.equal(sanitizeNameSegment("a\nb\rc"), "a_b_c");
		assert.equal(sanitizeNameSegment("a\x00b"), "a_b");
	});
	it("连续空白合并，首尾空白裁剪", () => {
		assert.equal(sanitizeNameSegment("  my  orders \t"), "my orders");
	});
	it("去掉尾部的点/下划线/连字符/空白", () => {
		assert.equal(sanitizeNameSegment("orders_."), "orders");
		assert.equal(sanitizeNameSegment("orders--- "), "orders");
	});
	it("误带 .sql 后缀被摘掉", () => {
		assert.equal(sanitizeNameSegment("orders.sql"), "orders");
		assert.equal(sanitizeNameSegment("data.SQL"), "data");
	});
	it("非字符串 / 空串 / 纯空白 → 空串", () => {
		for (const bad of [null, undefined, 42, {}, [], "", "   "]) {
			assert.equal(sanitizeNameSegment(bad), "");
		}
	});
	it("截断到 120 字符", () => {
		assert.equal(sanitizeNameSegment("x".repeat(200)).length, 120);
	});
});

describe("buildExportBaseName", () => {
	it("库名_表名_时间戳 完整规则（对齐用户示例）", () => {
		assert.equal(buildExportBaseName({ database: "mydb", tableName: "orders", now: NOW }), `mydb_orders_${TS}`);
	});
	it("缺库名跳过该段", () => {
		assert.equal(buildExportBaseName({ tableName: "orders", now: NOW }), `orders_${TS}`);
	});
	it("缺表名跳过该段", () => {
		assert.equal(buildExportBaseName({ database: "mydb", now: NOW }), `mydb_${TS}`);
	});
	it("两段都缺 → fallback 兜底", () => {
		assert.equal(buildExportBaseName({ now: NOW }), `${EXPORT_FILE_NAME_FALLBACK}_${TS}`);
		assert.equal(buildExportBaseName({ fallback: "custom", now: NOW }), `custom_${TS}`);
	});
	it("库名表名 sanitize 后为空 / 非法输入 → 走兜底", () => {
		assert.equal(
			buildExportBaseName({ database: "///", tableName: null, fallback: "q", now: NOW }),
			`q_${TS}`,
		);
		assert.equal(
			buildExportBaseName({ database: 1, tableName: { x: 1 }, now: NOW }),
			`${EXPORT_FILE_NAME_FALLBACK}_${TS}`,
		);
	});
	it("带 schema 的表名中的点属合法字符，予以保留", () => {
		assert.equal(
			buildExportBaseName({ database: "mydb", tableName: "shop.orders", now: NOW }),
			`mydb_shop.orders_${TS}`,
		);
	});
});

describe("buildExportFileName", () => {
	it("拼上扩展名", () => {
		assert.equal(
			buildExportFileName({ database: "mydb", tableName: "orders", now: NOW }, "csv"),
			`mydb_orders_${TS}.csv`,
		);
	});
	it("扩展名前导点可容忍", () => {
		assert.equal(
			buildExportFileName({ database: "mydb", tableName: "orders", now: NOW }, ".json"),
			`mydb_orders_${TS}.json`,
		);
	});
	it("扩展名缺失/非法 → txt 兜底", () => {
		assert.equal(buildExportFileName({ now: NOW }, ""), `${EXPORT_FILE_NAME_FALLBACK}_${TS}.txt`);
		assert.equal(buildExportFileName({ now: NOW }, "???"), `${EXPORT_FILE_NAME_FALLBACK}_${TS}.txt`);
	});
});

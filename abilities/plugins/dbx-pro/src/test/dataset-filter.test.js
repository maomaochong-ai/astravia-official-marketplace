/**
 * dataset-filter — 产物级筛选求值（纯函数）。
 *
 * 语义边界比功能更重要：空集合不能变成「过滤掉所有行」，未知列不能报错，
 * null 单元格必须判为不匹配 —— 这些地方出错都会让用户看到一张静默错误的图。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	applyFilters,
	filtersForDataset,
	isFilterActive,
	matchesFilter,
	matchesFilters,
} from "../domain/dataset-filter.ts";

const COLUMNS = ["month", "region", "gmv", "created_at"];

const ROWS = [
	{ month: "2026-01", region: "华东", gmv: 100, created_at: "2026-01-05" },
	{ month: "2026-02", region: "华北", gmv: 250, created_at: "2026-02-11" },
	{ month: "2026-03", region: "华东", gmv: 80, created_at: "2026-03-20" },
	{ month: "2026-04", region: "华南", gmv: null, created_at: "2026-04-01" },
];

const months = (rows) => rows.map((row) => row.month);

describe("isFilterActive", () => {
	it("空对象 / 空集合都不生效", () => {
		assert.equal(isFilterActive({ column: "region" }), false);
		assert.equal(isFilterActive({ column: "region", values: [] }), false);
	});

	it("有值集合或任一范围端点就生效", () => {
		assert.equal(isFilterActive({ column: "region", values: ["华东"] }), true);
		assert.equal(isFilterActive({ column: "gmv", min: 0 }), true);
		assert.equal(isFilterActive({ column: "gmv", max: 100 }), true);
	});
});

describe("applyFilters — 空筛选", () => {
	it("没有筛选条件时返回全部行", () => {
		assert.equal(applyFilters(ROWS, COLUMNS, []).length, 4);
		assert.equal(applyFilters(ROWS, COLUMNS, undefined).length, 4);
	});

	it("只有未生效条件时也返回全部行（空集合 ≠ 过滤掉所有行）", () => {
		assert.equal(applyFilters(ROWS, COLUMNS, [{ column: "region", values: [] }]).length, 4);
	});

	it("返回的是新数组，不改动输入", () => {
		const result = applyFilters(ROWS, COLUMNS, []);
		assert.notEqual(result, ROWS);
		assert.equal(ROWS.length, 4);
	});
});

describe("applyFilters — 等值筛选", () => {
	it("单值命中", () => {
		const result = applyFilters(ROWS, COLUMNS, [{ column: "region", values: ["华东"] }]);
		assert.deepEqual(months(result), ["2026-01", "2026-03"]);
	});

	it("多值取并集", () => {
		const result = applyFilters(ROWS, COLUMNS, [{ column: "region", values: ["华北", "华南"] }]);
		assert.deepEqual(months(result), ["2026-02", "2026-04"]);
	});

	it("数值与字符串按文本比较（表单控件给回来的值类型不稳定）", () => {
		const rows = [{ gmv: 100 }, { gmv: "100" }, { gmv: 200 }];
		const result = applyFilters(rows, ["gmv"], [{ column: "gmv", values: ["100"] }]);
		assert.equal(result.length, 2);
	});

	it("值为 null 的行不匹配任何生效条件", () => {
		const result = applyFilters(ROWS, COLUMNS, [{ column: "gmv", values: [null] }]);
		assert.deepEqual(result, []);
	});
});

describe("applyFilters — 范围筛选", () => {
	it("min / max 是闭区间", () => {
		const result = applyFilters(ROWS, COLUMNS, [{ column: "gmv", min: 100, max: 250 }]);
		assert.deepEqual(months(result), ["2026-01", "2026-02"]);
	});

	it("只给 min 或只给 max", () => {
		assert.deepEqual(months(applyFilters(ROWS, COLUMNS, [{ column: "gmv", min: 100 }])), [
			"2026-01",
			"2026-02",
		]);
		assert.deepEqual(months(applyFilters(ROWS, COLUMNS, [{ column: "gmv", max: 100 }])), [
			"2026-01",
			"2026-03",
		]);
	});

	it("min === max 等价于等值", () => {
		const result = applyFilters(ROWS, COLUMNS, [{ column: "gmv", min: 80, max: 80 }]);
		assert.deepEqual(months(result), ["2026-03"]);
	});

	it("日期字符串按字典序比较（ISO 格式与时间序一致）", () => {
		const result = applyFilters(ROWS, COLUMNS, [
			{ column: "created_at", min: "2026-02-01", max: "2026-03-31" },
		]);
		assert.deepEqual(months(result), ["2026-02", "2026-03"]);
	});

	it("null 单元格不满足范围条件", () => {
		const result = applyFilters(ROWS, COLUMNS, [{ column: "gmv", min: 0 }]);
		assert.deepEqual(months(result), ["2026-01", "2026-02", "2026-03"]);
	});
});

describe("applyFilters — 组合与容错", () => {
	it("多个条件之间是 AND", () => {
		const result = applyFilters(ROWS, COLUMNS, [
			{ column: "region", values: ["华东"] },
			{ column: "gmv", min: 90 },
		]);
		assert.deepEqual(months(result), ["2026-01"]);
	});

	it("同一个条件里 values 与范围同时存在也是 AND", () => {
		const result = applyFilters(ROWS, COLUMNS, [
			{ column: "gmv", values: [80, 100], min: 90 },
		]);
		assert.deepEqual(months(result), ["2026-01"]);
	});

	it("列不在数据集里时跳过该条件而不是报错", () => {
		const result = applyFilters(ROWS, COLUMNS, [{ column: "不存在的列", values: ["x"] }]);
		assert.equal(result.length, 4);
	});

	it("未知列与生效条件混用时只应用已知列", () => {
		const result = applyFilters(ROWS, COLUMNS, [
			{ column: "不存在的列", values: ["x"] },
			{ column: "region", values: ["华南"] },
		]);
		assert.deepEqual(months(result), ["2026-04"]);
	});
});

describe("matchesFilter / matchesFilters", () => {
	it("matchesFilter 直接判断单元格", () => {
		assert.equal(matchesFilter("华东", { column: "region", values: ["华东"] }), true);
		assert.equal(matchesFilter("华南", { column: "region", values: ["华东"] }), false);
		assert.equal(matchesFilter(undefined, { column: "region", values: ["华东"] }), false);
	});

	it("matchesFilters 在列缺失时视为通过", () => {
		const row = { region: "华东" };
		assert.equal(matchesFilters(row, ["region"], [{ column: "gmv", min: 1 }]), true);
	});
});

describe("filtersForDataset", () => {
	it("缺省 datasetId 的条件作用于所有数据集", () => {
		const filters = [{ column: "region", values: ["华东"] }, { datasetId: "b", column: "tier", values: [1] }];
		assert.deepEqual(filtersForDataset(filters, "a"), [filters[0]]);
		assert.equal(filtersForDataset(filters, "b").length, 2);
	});
});

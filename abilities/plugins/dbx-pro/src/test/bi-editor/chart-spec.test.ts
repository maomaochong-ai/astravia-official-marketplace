/**
 * chart-spec.test.ts — 图表语义层回归。
 *
 * 覆盖：配置解析容错、过滤、聚合口径、时间粒度、排序 / TopN、数值格式。
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	aggregate,
	applyFilters,
	bucketTime,
	buildFrame,
	formatNumber,
	parseChartSpec,
	type ChartSpec,
} from "../../features/bi-editor/canvas/lib/chart-spec.ts";
import type { NodeResult } from "../../features/bi-editor/canvas/hooks/use-canvas-execution.ts";

const RESULT: NodeResult = {
	columns: ["region", "month", "gmv", "orderId"],
	rows: [
		{ region: "华东", month: "2025-01-03", gmv: 100, orderId: "A1" },
		{ region: "华东", month: "2025-01-19", gmv: 50, orderId: "A2" },
		{ region: "华北", month: "2025-02-02", gmv: 30, orderId: "A3" },
		{ region: "华北", month: "2025-02-20", gmv: 20, orderId: "A4" },
		{ region: "华南", month: "2025-03-05", gmv: null, orderId: "A5" },
	],
	rowCount: 5,
	durationMs: 1,
};

function spec(patch: Partial<ChartSpec>): ChartSpec {
	return {
		dimensions: [],
		measures: [],
		filters: [],
		sort: null,
		limit: null,
		...patch,
	};
}

describe("parseChartSpec — 容错", () => {
	it("空 values 得到空配置", () => {
		const s = parseChartSpec({});
		assert.deepEqual(s.dimensions, []);
		assert.deepEqual(s.measures, []);
		assert.equal(s.sort, null);
		assert.equal(s.limit, null);
	});

	it("接受 JSON 字符串与已解析数组两种形态", () => {
		const fromArray = parseChartSpec({
			dimensions: [{ field: "region", grain: "none" }],
			measures: [{ field: "gmv", agg: "sum", format: "compact" }],
		});
		const fromJson = parseChartSpec({
			dimensions: '[{"field":"region"}]',
			measures: '[{"field":"gmv","agg":"sum","format":"compact"}]',
		});
		assert.deepEqual(fromArray.measures, fromJson.measures);
		assert.deepEqual(fromArray.dimensions, fromJson.dimensions);
	});

	it("丢弃坏条目与未知枚举，不抛错", () => {
		const s = parseChartSpec({
			dimensions: '[{"field":""},{"nope":1},{"field":"region","grain":"decade"}]',
			measures: '[{"field":"gmv","agg":"median"},{"field":"x","agg":"variance"}]',
			filters: "[{\"field\":\"region\",\"op\":\"startsWith\",\"value\":\"华\"}]",
			sort: '{"by":"measure","index":0,"dir":"asc"}',
			limit: 10,
		});
		assert.deepEqual(s.dimensions, [{ field: "region", grain: "none" }]);
		assert.equal(s.measures[0].agg, "median");
		assert.equal(s.measures[1].agg, "sum", "未知聚合回退 sum");
		assert.equal(s.filters[0].op, "eq", "未知操作回退 eq");
		assert.deepEqual(s.sort, { by: "measure", index: 0, dir: "asc" });
		assert.equal(s.limit, 10);
	});

	it("limit 非正数视为不截断", () => {
		assert.equal(parseChartSpec({ limit: 0 }).limit, null);
		assert.equal(parseChartSpec({ limit: -3 }).limit, null);
		assert.equal(parseChartSpec({ limit: "abc" }).limit, null);
	});
});

describe("aggregate — 聚合口径", () => {
	const values = [1, 2, 2, null, "x", 5];

	it("sum / avg 跳过空值与非数值", () => {
		assert.equal(aggregate(values, "sum"), 10);
		assert.equal(aggregate([1, 2], "avg"), 1.5);
	});

	it("count 统计非空单元格，countDistinct 去重", () => {
		assert.equal(aggregate(values, "count"), 5);
		assert.equal(aggregate(values, "countDistinct"), 4);
	});

	it("median 偶数个取中间两值平均", () => {
		assert.equal(aggregate([1, 3, 2, 4], "median"), 2.5);
		assert.equal(aggregate([3, 1, 2], "median"), 2);
	});

	it("全空返回 0 而不是 NaN", () => {
		assert.equal(aggregate([null, undefined, ""], "avg"), 0);
		assert.equal(aggregate([], "max"), 0);
	});
});

describe("filters", () => {
	it("数值比较按数值而非字符串", () => {
		const rows = [{ v: 9 }, { v: 10 }, { v: 100 }];
		const kept = applyFilters(rows, [{ field: "v", op: "gt", value: "9" }]);
		assert.deepEqual(kept.map((r) => r.v), [10, 100]);
	});

	it("空值的 eq 视为未过滤，避免刚加一行就清空数据", () => {
		assert.equal(applyFilters(RESULT.rows, [{ field: "region", op: "eq", value: "" }]).length, 5);
	});

	it("contains 忽略大小写，isNull 命中空单元格", () => {
		// 三个区域都含「华」，5 行全部命中。
		assert.equal(applyFilters(RESULT.rows, [{ field: "region", op: "contains", value: "华" }]).length, 5);
		assert.equal(applyFilters(RESULT.rows, [{ field: "gmv", op: "isNull" }]).length, 1);
		assert.equal(applyFilters(RESULT.rows, [{ field: "gmv", op: "notNull" }]).length, 4);
	});
});

describe("bucketTime — 时间粒度", () => {
	it("按年 / 季 / 月 / 日 / 小时折叠", () => {
		const v = "2025-05-17 09:41:00";
		assert.equal(bucketTime(v, "year"), "2025");
		assert.equal(bucketTime(v, "quarter"), "2025-Q2");
		assert.equal(bucketTime(v, "month"), "2025-05");
		assert.equal(bucketTime(v, "day"), "2025-05-17");
		assert.equal(bucketTime(v, "hour"), "2025-05-17 09:00");
	});

	it("周按 ISO 周编号", () => {
		assert.equal(bucketTime("2025-01-01", "week"), "2025-W01");
		assert.equal(bucketTime("2025-01-06", "week"), "2025-W02");
	});

	it("日期解析不出来时原样返回，不丢行", () => {
		assert.equal(bucketTime("华东", "month"), "华东");
		assert.equal(bucketTime(null, "day"), "");
	});
});

describe("buildFrame", () => {
	it("未配置度量时返回空 frame（调用方回退旧字段映射）", () => {
		const frame = buildFrame(RESULT, spec({ dimensions: [{ field: "region" }] }));
		assert.deepEqual(frame.series, []);
		assert.equal(frame.rows.length, 5, "行仍在，表格类节点可用");
	});

	it("单维度 + 单度量按维度分组求和", () => {
		const frame = buildFrame(RESULT, spec({
			dimensions: [{ field: "region" }],
			measures: [{ field: "gmv", agg: "sum" }],
		}));
		assert.deepEqual(frame.categories, ["华东", "华北", "华南"]);
		assert.deepEqual(frame.series[0].data, [150, 50, 0]);
		assert.equal(frame.total, 200);
		assert.equal(frame.measureLabel, "gmv");
	});

	it("多度量产生多个系列，名称带聚合语义", () => {
		const frame = buildFrame(RESULT, spec({
			dimensions: [{ field: "region" }],
			measures: [
				{ field: "gmv", agg: "sum" },
				{ field: "orderId", agg: "countDistinct" },
			],
		}));
		assert.equal(frame.series.length, 2);
		assert.equal(frame.series[0].name, "gmv");
		assert.equal(frame.series[1].name, "去重计数(orderId)");
		assert.deepEqual(frame.series[1].data, [2, 2, 1]);
	});

	it("时间粒度把同月多行折叠", () => {
		const frame = buildFrame(RESULT, spec({
			dimensions: [{ field: "month", grain: "month" }],
			measures: [{ field: "gmv", agg: "sum" }],
		}));
		assert.deepEqual(frame.categories, ["2025-01", "2025-02", "2025-03"]);
		assert.deepEqual(frame.series[0].data, [150, 50, 0]);
	});

	it("多级维度拼接成类别", () => {
		const frame = buildFrame(RESULT, spec({
			dimensions: [{ field: "region" }, { field: "month", grain: "month" }],
			measures: [{ field: "gmv", agg: "sum" }],
		}));
		assert.deepEqual(frame.categories, ["华东 / 2025-01", "华北 / 2025-02", "华南 / 2025-03"]);
	});

	it("排序按度量数值并让所有系列同步重排", () => {
		const frame = buildFrame(RESULT, spec({
			dimensions: [{ field: "region" }],
			measures: [
				{ field: "gmv", agg: "sum" },
				{ field: "orderId", agg: "count" },
			],
			sort: { by: "measure", index: 0, dir: "desc" },
		}));
		assert.deepEqual(frame.categories, ["华东", "华北", "华南"]);
		assert.deepEqual(frame.series[1].data, [2, 2, 1]);

		const asc = buildFrame(RESULT, spec({
			dimensions: [{ field: "region" }],
			measures: [{ field: "gmv", agg: "sum" }],
			sort: { by: "measure", index: 0, dir: "asc" },
		}));
		assert.deepEqual(asc.categories, ["华南", "华北", "华东"]);
	});

	it("TopN 在排序之后截断", () => {
		const frame = buildFrame(RESULT, spec({
			dimensions: [{ field: "region" }],
			measures: [{ field: "gmv", agg: "sum" }],
			sort: { by: "measure", index: 0, dir: "desc" },
			limit: 2,
		}));
		assert.deepEqual(frame.categories, ["华东", "华北"]);
		assert.deepEqual(frame.series[0].data, [150, 50]);
	});

	it("无维度时给单一类别，且 total 用全部行算 avg 而不是分组平均", () => {
		const frame = buildFrame(RESULT, spec({ measures: [{ field: "gmv", agg: "avg" }] }));
		assert.deepEqual(frame.categories, ["全部"]);
		assert.equal(frame.series[0].data[0], 50);
		assert.equal(frame.total, 50);
	});

	it("过滤先于聚合生效", () => {
		const frame = buildFrame(RESULT, spec({
			dimensions: [{ field: "region" }],
			measures: [{ field: "gmv", agg: "sum" }],
			filters: [{ field: "region", op: "neq", value: "华南" }],
		}));
		assert.deepEqual(frame.categories, ["华东", "华北"]);
		assert.equal(frame.rows.length, 4);
		assert.equal(frame.total, 200);
	});
});

describe("formatNumber", () => {
	it("各格式输出稳定", () => {
		assert.equal(formatNumber(1234.5, "thousand"), "1,234.5");
		assert.equal(formatNumber(123456789, "compact"), "1.23亿");
		assert.equal(formatNumber(12000, "compact"), "1.2万");
		assert.equal(formatNumber(0.256, "percent"), "25.6%");
		assert.equal(formatNumber(99.6, "plain"), "100");
		assert.equal(formatNumber(12, "currency"), "¥12");
	});

	it("非有限值显示占位而不显示 NaN", () => {
		assert.equal(formatNumber(Number.NaN), "—");
		assert.equal(formatNumber(undefined, "compact"), "—");
	});
});

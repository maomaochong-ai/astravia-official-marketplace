/**
 * node-chart-data — 画布图表节点的「结果集 → 标签 / 数值」解析。
 *
 * 这是「拖进来的图表必须画真数据」这条验收标准的支点，所以要钉住三件事：
 * 数据只来自真实结果（自身优先、其次上游），字段对不上就如实报错，
 * 任何情况下都不能回退成哈希伪随机序列去充数。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveNodeChartData } from "../../features/bi-editor/canvas/lib/node-chart-data.ts";
import type { NodeResult } from "../../features/bi-editor/canvas/hooks/use-canvas-execution.ts";

/** 造一个结果集；只有 columns 与 rows 参与解析，其余字段补零。 */
function result(columns: string[], rows: Record<string, unknown>[]): NodeResult {
	return { columns, rows, rowCount: rows.length, durationMs: 1 };
}

describe("resolveNodeChartData — 取数来源", () => {
	it("自身有结果时用自身，不看上游", () => {
		const self = result(["month", "gmv"], [{ month: "01", gmv: 10 }]);
		const upstream = result(["month", "gmv"], [{ month: "99", gmv: 999 }]);
		const data = resolveNodeChartData("chart-line", {}, self, upstream);
		assert.equal(data.status, "ok");
		assert.equal(data.source, "self");
		assert.deepEqual(data.labels, ["01"]);
		assert.deepEqual(data.values, [10]);
	});

	it("自身没结果时回落到上游结果", () => {
		const upstream = result(["month", "gmv"], [{ month: "02", gmv: 250 }]);
		const data = resolveNodeChartData("chart-line", {}, null, upstream);
		assert.equal(data.status, "ok");
		assert.equal(data.source, "upstream");
		assert.deepEqual(data.labels, ["02"]);
		assert.deepEqual(data.values, [250]);
	});

	it("自身结果集为空时继续往上游找，而不是画一条空线", () => {
		const self = result(["month", "gmv"], []);
		const upstream = result(["month", "gmv"], [{ month: "03", gmv: 7 }]);
		const data = resolveNodeChartData("chart-line", {}, self, upstream);
		assert.equal(data.status, "ok");
		assert.equal(data.source, "upstream");
		assert.deepEqual(data.values, [7]);
	});

	it("两头都没有数据 → no-result，数组为空且给出提示，不编数据", () => {
		const data = resolveNodeChartData("chart-line", {}, null, null);
		assert.equal(data.status, "no-result");
		assert.equal(data.source, null);
		assert.deepEqual(data.labels, []);
		assert.deepEqual(data.values, []);
		assert.deepEqual(data.boxGroups, []);
		assert.equal(data.rowCount, 0);
		assert.match(data.note, /无数据/);
	});

	it("有结果集但一行都没有 → no-result 且说明查询为空", () => {
		const self = result(["month", "gmv"], []);
		const data = resolveNodeChartData("chart-line", {}, self, null);
		assert.equal(data.status, "no-result");
		assert.match(data.note, /查询结果为空/);
	});
});

describe("resolveNodeChartData — 字段映射", () => {
	const RESULT = result(
		["month", "gmv"],
		[
			{ month: "2026-01", gmv: 100 },
			{ month: "2026-02", gmv: 250 },
		],
	);

	it("未配置字段时按列推断：首个非数值列做维度、首个数值列做数值", () => {
		const data = resolveNodeChartData("chart-line", {}, RESULT, null);
		assert.equal(data.status, "ok");
		assert.equal(data.labelField, "month");
		assert.equal(data.valueField, "gmv");
		assert.deepEqual(data.labels, ["2026-01", "2026-02"]);
		assert.deepEqual(data.values, [100, 250]);
		assert.equal(data.rowCount, 2);
	});

	it("属性面板配置了 xField / yField 时按配置取列", () => {
		const data = resolveNodeChartData("chart-bar", { xField: "month", yField: "gmv" }, RESULT, null);
		assert.equal(data.labelField, "month");
		assert.equal(data.valueField, "gmv");
		assert.deepEqual(data.values, [100, 250]);
	});

	it("配置的列不在结果列里 → field-missing，并在提示里点名该字段", () => {
		const data = resolveNodeChartData("chart-line", { xField: "ts", yField: "gmv" }, RESULT, null);
		assert.equal(data.status, "field-missing");
		assert.equal(data.labelField, null);
		assert.equal(data.valueField, null);
		assert.deepEqual(data.values, []);
		assert.match(data.note, /ts/);
	});

	it("结果列里没有数值列 → field-missing，不硬凑一列出来", () => {
		const textOnly = result(["a", "b"], [{ a: "x", b: "y" }]);
		const data = resolveNodeChartData("chart-line", {}, textOnly, null);
		assert.equal(data.status, "field-missing");
		assert.match(data.note, /数值/);
	});

	it("数值列优先于文本列（配置缺省时不拿标签列当数值）", () => {
		const mixed = result(["name", "amount"], [{ name: "甲", amount: 9 }]);
		const data = resolveNodeChartData("chart-line", {}, mixed, null);
		assert.equal(data.labelField, "name");
		assert.equal(data.valueField, "amount");
	});

	it("labels / values 同步被 limit 截断，长度与顺序都一致", () => {
		const rows = [1, 2, 3, 4, 5].map((n) => ({ k: `k${n}`, v: n }));
		const resultSet = result(["k", "v"], rows);
		const data = resolveNodeChartData("chart-line", {}, resultSet, null, 3);
		assert.deepEqual(data.labels, ["k1", "k2", "k3"]);
		assert.deepEqual(data.values, [1, 2, 3]);
		assert.equal(data.rowCount, 5);
	});
});

describe("resolveNodeChartData — 数值与标签清洗", () => {
	it("非数值单元格按 0 计入（与 extractSeries 的强转一致）", () => {
		const resultSet = result(["v"], [{ v: "abc" }, { v: "3" }, { v: 4 }]);
		const data = resolveNodeChartData("chart-line", { yField: "v" }, resultSet, null);
		assert.deepEqual(data.values, [0, 3, 4]);
	});

	it("null / undefined 标签归一成空串，不输出 \"null\"", () => {
		const resultSet = result(["k", "v"], [{ k: null, v: 1 }, { v: 2 }]);
		const data = resolveNodeChartData("chart-line", {}, resultSet, null);
		assert.deepEqual(data.labels, ["", ""]);
	});
});

describe("resolveNodeChartData — 箱线图", () => {
	it("按维度分组算五数概括，labels / values 取每组中位数", () => {
		const rows = [
			{ g: "A", v: 10 },
			{ g: "A", v: 20 },
			{ g: "A", v: 30 },
			{ g: "A", v: 40 },
			{ g: "B", v: 5 },
			{ g: "B", v: 15 },
		];
		const data = resolveNodeChartData("chart-boxplot", { xField: "g", yField: "v" }, result(["g", "v"], rows), null);
		assert.equal(data.status, "ok");
		assert.deepEqual(data.labels, ["A", "B"]);
		assert.deepEqual(data.values, [25, 10]);
		assert.deepEqual(data.boxGroups, [
			{ label: "A", min: 10, q1: 17.5, median: 25, q3: 32.5, max: 40 },
			{ label: "B", min: 5, q1: 7.5, median: 10, q3: 12.5, max: 15 },
		]);
	});
});

describe("resolveNodeChartData — 未接入 / KPI", () => {
	it("散点 / 地图 / 雷达如实报 unsupported，不退化成一个别的图", () => {
		const resultSet = result(["x", "y"], [{ x: 1, y: 2 }]);
		for (const [kind, xField, yField] of [
			["chart-scatter", "xField", "yField"],
			["chart-map", "geoField", "valueField"],
			["chart-radar", "indicatorField", "valueFields"],
		] as const) {
			const data = resolveNodeChartData(kind, { [xField]: "x", [yField]: "y" }, resultSet, null);
			assert.equal(data.status, "unsupported", kind);
			assert.deepEqual(data.values, [], kind);
			assert.notEqual(data.note, "", kind);
		}
	});

	it("未知 kind 也归到 unsupported，不抛异常", () => {
		const data = resolveNodeChartData("chart-sankey", {}, result(["v"], [{ v: 1 }]), null);
		assert.equal(data.status, "unsupported");
	});

	it("KPI 只取一个数值、没有维度列", () => {
		const data = resolveNodeChartData("chart-kpi", { valueField: "gmv" }, result(["gmv"], [{ gmv: 1234.5 }]), null);
		assert.equal(data.status, "ok");
		assert.equal(data.labelField, null);
		assert.equal(data.valueField, "gmv");
		assert.deepEqual(data.labels, []);
		assert.deepEqual(data.values, [1234.5]);
	});

	it("非图表 kind 直接判 unsupported（本模块只管图表节点）", () => {
		const data = resolveNodeChartData("source-sql", {}, result(["v"], [{ v: 1 }]), null);
		assert.equal(data.status, "unsupported");
		assert.deepEqual(data.values, []);
	});
});

/**
 * chart-source — 行 → Chart.js data 的重映射。
 *
 * 这是「改筛选后图必须变」这条验收标准的实现支点，所以两件事都要钉住：
 * 有 source 的图跟着 rows 走，没有 source 的图一个字都不许动。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildChartJsData, resolveChartData } from "../domain/chart-source.ts";

const ROWS = [
	{ month: "2026-01", gmv: 100, cnt: 3 },
	{ month: "2026-02", gmv: 250, cnt: 5 },
];

const SOURCE = { datasetId: "lce", labelColumn: "month", valueColumns: ["gmv", "cnt"] };

function barItem(extra = {}) {
	return { type: "bar", data: { labels: ["旧"], datasets: [{ label: "旧", data: [1] }] }, ...extra };
}

describe("resolveChartData — 不参与的图", () => {
	it("没有 source 的图原样返回自己的 data（旧产物兼容）", () => {
		const item = barItem();
		assert.equal(resolveChartData(item, ROWS), item.data);
	});

	it("rows 为 undefined 时保留原 data（体积降级后不能把图清空）", () => {
		const item = barItem({ source: SOURCE });
		assert.equal(resolveChartData(item, undefined), item.data);
	});

	it("source 声明不完整时保留原 data", () => {
		const noLabel = barItem({ source: { datasetId: "lce", labelColumn: "", valueColumns: ["gmv"] } });
		assert.equal(resolveChartData(noLabel, ROWS), noLabel.data);
		const noValues = barItem({ source: { datasetId: "lce", labelColumn: "month", valueColumns: [] } });
		assert.equal(resolveChartData(noValues, ROWS), noValues.data);
	});
});

describe("buildChartJsData", () => {
	it("labels 取 labelColumn，每个 valueColumn 一条 series", () => {
		const data = buildChartJsData({ type: "bar", data: {} }, SOURCE, ROWS);
		assert.deepEqual(data.labels, ["2026-01", "2026-02"]);
		assert.equal(data.datasets.length, 2);
		assert.deepEqual(data.datasets.map((set) => set.label), ["gmv", "cnt"]);
		assert.deepEqual(data.datasets.map((set) => set.data), [
			[100, 250],
			[3, 5],
		]);
	});

	it("数值字符串转成数字，转不了的原样保留", () => {
		const data = buildChartJsData({ type: "bar", data: {} }, SOURCE, [
			{ month: "2026-01", gmv: "12.5", cnt: null },
		]);
		assert.deepEqual(data.datasets[0].data, [12.5]);
		assert.equal(Number.isNaN(data.datasets[1].data[0]), false);
	});

	it("pie / doughnut / polarArea / funnel 只用第一个 valueColumn（单 series 承载所有点）", () => {
		for (const type of ["pie", "doughnut", "polarArea", "funnel"]) {
			const data = buildChartJsData({ type, data: {} }, SOURCE, ROWS);
			assert.equal(data.datasets.length, 1, type);
			assert.equal(data.datasets[0].label, "gmv", type);
		}
	});

	it("metric 不是单 series：后续 series 是它的口径对照，不能被裁掉", () => {
		const data = buildChartJsData({ type: "metric", data: {} }, SOURCE, ROWS);
		assert.deepEqual(data.datasets.map((set) => set.label), ["gmv", "cnt"]);
	});

	it("按序保留原有样式，只替换 label 与 data（筛选不该洗掉配色）", () => {
		const item = {
			type: "bar",
			data: {
				labels: ["旧"],
				datasets: [{ label: "旧", data: [1], backgroundColor: "#123456", borderWidth: 7 }],
			},
		};
		const data = resolveChartData({ ...item, source: SOURCE }, ROWS);
		assert.equal(data.datasets[0].backgroundColor, "#123456");
		assert.equal(data.datasets[0].borderWidth, 7);
		assert.equal(data.datasets[0].label, "gmv");
		assert.deepEqual(data.datasets[0].data, [100, 250]);
		assert.equal(data.datasets[1].backgroundColor, undefined);
	});

	it("空行集渲染成空图而不是抛错（筛选筛到没有数据是正常结果）", () => {
		const data = buildChartJsData({ type: "bar", data: {} }, SOURCE, []);
		assert.deepEqual(data.labels, []);
		assert.deepEqual(data.datasets[0].data, []);
	});

	it("labels 里的 null / undefined 变成空串", () => {
		const data = buildChartJsData({ type: "bar", data: {} }, SOURCE, [
			{ month: null, gmv: 1 },
			{ gmv: 2 },
		]);
		assert.deepEqual(data.labels, ["", ""]);
	});
});

describe("筛选后重映射（接线级语义）", () => {
	it("行集变化时同一张图产出不同的 data —— 不重跑 SQL 也能重绘", () => {
		const item = { type: "bar", data: {}, source: SOURCE };
		const before = resolveChartData(item, ROWS);
		const after = resolveChartData(item, [ROWS[1]]);
		assert.notDeepEqual(before, after);
		assert.deepEqual(after.labels, ["2026-02"]);
		assert.deepEqual(after.datasets[0].data, [250]);
	});
});

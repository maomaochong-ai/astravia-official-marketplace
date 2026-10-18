/**
 * chart-option.test.ts — ECharts option 折算回归（纯函数，不启动渲染器）。
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	buildChartOption,
	parseChartStyle,
	FALLBACK_PALETTE,
	type ChartStyle,
} from "../../features/bi-editor/canvas/lib/chart-option.ts";
import type { ChartFrame } from "../../features/bi-editor/canvas/lib/chart-spec.ts";

const FRAME: ChartFrame = {
	categories: ["华东", "华北", "华南"],
	series: [
		{ name: "gmv", data: [150, 50, 0], format: "auto" },
		{ name: "去重计数(orderId)", data: [2, 2, 1], format: "auto" },
	],
	rows: [],
	columns: ["region", "gmv"],
	total: 200,
	measureLabel: "gmv",
	dimensionLabels: ["region"],
};

const STYLE: ChartStyle = parseChartStyle({});

function option(kind: string, style: ChartStyle = STYLE, frame: ChartFrame = FRAME) {
	const opt = buildChartOption(kind, frame, style);
	assert.ok(opt, `${kind} 应产出 option`);
	return opt as Record<string, unknown>;
}

function seriesOf(opt: Record<string, unknown>): Record<string, unknown>[] {
	return opt.series as Record<string, unknown>[];
}

describe("parseChartStyle", () => {
	it("缺省值：不显示图例 / 标签、无堆叠、纵向", () => {
		const s = parseChartStyle({});
		assert.equal(s.legend, false);
		assert.equal(s.labels, false);
		assert.equal(s.stack, "none");
		assert.equal(s.orientation, "vertical");
		assert.equal(s.valueFormat, "auto");
	});

	it("yes/no 与布尔都接受，未知堆叠回退 none", () => {
		const s = parseChartStyle({ legend: "yes", labels: true, stack: "percent", innerRadius: 120 });
		assert.equal(s.legend, true);
		assert.equal(s.labels, true);
		assert.equal(s.stack, "percent");
		assert.equal(s.innerRadius, 80, "内半径夹到 0–80");
		assert.equal(parseChartStyle({ stack: "weird" }).stack, "none");
	});

	it("数值轴上下限只接受有限数", () => {
		assert.equal(parseChartStyle({ yMin: 0 }).yMin, 0);
		assert.equal(parseChartStyle({ yMin: "abc" }).yMin, null);
	});
});

describe("buildChartOption — 直角坐标", () => {
	it("柱图每个度量一个系列，类别与语义层一致", () => {
		const opt = option("chart-bar");
		const series = seriesOf(opt);
		assert.equal(series.length, 2);
		assert.equal(series[0].type, "bar");
		assert.deepEqual(series[0].data, [150, 50, 0]);
		assert.deepEqual((opt.xAxis as Record<string, unknown>).data, FRAME.categories);
	});

	it("堆叠与百分比堆叠", () => {
		const stacked = seriesOf(option("chart-bar", parseChartStyle({ stack: "normal" })));
		assert.equal(stacked[0].stack, "total");

		const percent = option("chart-bar", parseChartStyle({ stack: "percent" }));
		const data = seriesOf(percent)[0].data as number[];
		// 百分比堆叠按「该类别全部系列之和」归一：华东 150 / (150 + 2) ≈ 98.7%
		assert.equal(data[0], 98.7);
		assert.equal((percent.yAxis as Record<string, unknown>).max, 100);
	});

	it("横向柱把类别轴换到 y 轴", () => {
		const opt = option("chart-bar", parseChartStyle({ orientation: "horizontal" }));
		assert.equal((opt.yAxis as Record<string, unknown>).type, "category");
		assert.equal((opt.xAxis as Record<string, unknown>).type, "value");
	});

	it("折线平滑 / 面积开关生效", () => {
		const line = seriesOf(option("chart-line", parseChartStyle({ smooth: "yes", area: "yes" })))[0];
		assert.equal(line.smooth, true);
		assert.ok(line.areaStyle);

		const area = seriesOf(option("chart-area", parseChartStyle({ smooth: "no" })))[0];
		assert.ok(area.areaStyle, "面积图即使没勾 area 也要有填充");
	});
});

describe("buildChartOption — 占比与分布", () => {
	it("饼图取首度量，环形图有内半径", () => {
		const pie = seriesOf(option("chart-pie"))[0];
		assert.equal(pie.type, "pie");
		assert.deepEqual(pie.radius, ["8%", "78%"]);

		const donut = seriesOf(option("chart-donut"))[0];
		assert.deepEqual(donut.radius, ["40%", "78%"]);
	});

	it("漏斗按数值降序", () => {
		const data = seriesOf(option("chart-funnel"))[0].data as { name: string; value: number }[];
		assert.deepEqual(data.map((d) => d.name), ["华东", "华北", "华南"]);
	});

	it("散点用前两个度量做 x/y", () => {
		const s = seriesOf(option("chart-scatter"))[0];
		assert.deepEqual(s.data, [[150, 2], [50, 2], [0, 1]]);
	});

	it("雷达按类别做指标轴", () => {
		const opt = option("chart-radar");
		const radar = opt.radar as { indicator: { name: string }[] };
		assert.deepEqual(radar.indicator.map((i) => i.name), FRAME.categories);
	});

	it("热力把「维度A / 维度B」拆成两轴", () => {
		const frame: ChartFrame = {
			...FRAME,
			categories: ["华东 / 一月", "华北 / 二月", "华东 / 二月"],
			series: [{ name: "gmv", data: [10, 20, 30], format: "auto" }],
		};
		const opt = option("chart-heatmap", STYLE, frame);
		assert.deepEqual((opt.xAxis as { data: string[] }).data, ["一月", "二月"]);
		assert.deepEqual((opt.yAxis as { data: string[] }).data, ["华东", "华北"]);
		assert.deepEqual(seriesOf(opt)[0].data, [[0, 0, 10], [1, 1, 20], [1, 0, 30]]);
	});
});

describe("buildChartOption — 构成与流向", () => {
	it("树图把类别转成节点", () => {
		const data = seriesOf(option("chart-treemap"))[0].data as { name: string; value: number }[];
		assert.deepEqual(data.map((d) => d.name), FRAME.categories);
		assert.equal(data[0].value, 150);
	});

	it("桑基把「来源 / 去向」拆成 links", () => {
		const frame: ChartFrame = {
			...FRAME,
			categories: ["首页 / 详情", "详情 / 下单"],
			series: [{ name: "uv", data: [120, 40], format: "auto" }],
		};
		const s = seriesOf(option("chart-sankey", STYLE, frame))[0];
		const links = s.links as { source: string; target: string; value: number }[];
		assert.deepEqual(links, [
			{ source: "首页", target: "详情", value: 120 },
			{ source: "详情", target: "下单", value: 40 },
		]);
		const nodes = (s.data as { name: string }[]).map((n) => n.name);
		assert.deepEqual(nodes, ["首页", "详情", "下单"], "节点去重且保持出现顺序");
	});

	it("瀑布逐项累计：正数向上、负数向下", () => {
		const frame: ChartFrame = {
			...FRAME,
			categories: ["期初", "增长", "流失", "期末"],
			series: [{ name: "gmv", data: [100, 30, -20, 110], format: "auto" }],
		};
		const series = seriesOf(option("chart-waterfall", STYLE, frame));
		assert.deepEqual(series[1].data, [100, 30, 0, 110], "增加项");
		assert.deepEqual(series[2].data, [0, 0, 20, 0], "减少项");
		assert.deepEqual(series[0].data, [0, 100, 110, 0], "占位基线");
	});
});

describe("buildChartOption — 组合与边界", () => {
	it("双轴组合：柱 + 右轴线", () => {
		const opt = option("chart-combo");
		const series = seriesOf(opt);
		assert.equal(series[0].type, "bar");
		assert.equal(series[1].type, "line");
		assert.equal(series[1].yAxisIndex, 1);
		assert.equal((opt.yAxis as unknown[]).length, 2);
	});

	it("仪表盘用首度量总计", () => {
		const s = seriesOf(option("chart-gauge"))[0];
		assert.equal((s.data as { value: number }[])[0].value, 200);
	});

	it("KPI / 箱线 / 表格不走 ECharts，返回 null", () => {
		assert.equal(buildChartOption("chart-kpi", FRAME, STYLE), null);
		assert.equal(buildChartOption("chart-boxplot", FRAME, STYLE), null);
		assert.equal(buildChartOption("adv-table", FRAME, STYLE), null);
	});

	it("调色板为空时退回兜底色", () => {
		const opt = buildChartOption("chart-bar", FRAME, STYLE, []) as Record<string, unknown>;
		assert.deepEqual(opt.color, FALLBACK_PALETTE);
	});
});

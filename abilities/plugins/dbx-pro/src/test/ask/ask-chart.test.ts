/**
 * ask-chart.test.ts — 保护「问数结果 → 图表」这一层的语义边界。
 *
 * 这层不做 IO、不做聚合，唯一的价值是两件事不能被悄悄改坏：
 *   1. 模型给的 chartKind 必须被归一到 6 种图型；认不出来时按提问意图兜底，
 *      而不是把编造的 chartKind 直接透传。
 *   1b. 图型 → 画布节点 kind 不能直接同名透传：画布的图表渲染器不认识某个 kind 时
 *      会落到「默认画折线」分支，明细表会被画成一条凭空的趋势线。
 *      真实约束（与 node-graph 的 NODE_TEMPLATES 对齐）由 ask-canvas-kind.test.ts 守住。
 *   2. 结果集 → 序列的搬运必须忠实：不聚合、不补零、不排序；数值非有限的行整行丢弃
 *      并把行数如实报出来（skipped）。补零后的图和真数据长得一样，用户会以为查到了。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
	ASK_CHART_KINDS,
	CHART_KIND_LABELS,
	formatCell,
	formatNumber,
	intentToChartKind,
	normalizeChartKind,
	pickChartSeries,
	toCanvasKind,
} from "../../features/ask/ask-chart.ts";
import type { AskChartKind, AskResult } from "../../features/ask/ask-types.ts";

function result(columns: string[], rows: Array<Record<string, unknown>>): AskResult {
	return { columns, rows };
}

describe("ask-chart · 图型归一", () => {
	it("模型给别名 / 大小写 / 中文名都能归一到画布图型", () => {
		assert.equal(normalizeChartKind("LINE"), "chart-line");
		assert.equal(normalizeChartKind(" bar "), "chart-bar");
		assert.equal(normalizeChartKind("chart-pie"), "chart-donut");
		assert.equal(normalizeChartKind("折线图"), "chart-line");
		assert.equal(normalizeChartKind("柱状图"), "chart-bar");
		assert.equal(normalizeChartKind("明细表"), "chart-table");
	});

	it("认不出来的 chartKind 回退到提问意图，而不是透传编造值", () => {
		assert.equal(normalizeChartKind("chart-3d-bar", "各渠道成交额占比"), "chart-donut");
		assert.equal(normalizeChartKind("", "近 14 天每天的成交额走势"), "chart-line");
		assert.equal(normalizeChartKind(undefined, "订单明细列出来"), "chart-table");
	});

	it("完全没有线索时落到折线图（唯一默认）", () => {
		assert.equal(normalizeChartKind(null), "chart-line");
		assert.equal(normalizeChartKind(42), "chart-line");
		assert.equal(normalizeChartKind("chart-3d-bar"), "chart-line");
	});

	it("6 种图型与展示名一一对应，且下拉列表顺序稳定", () => {
		assert.equal(ASK_CHART_KINDS.length, 6);
		for (const kind of ASK_CHART_KINDS) {
			assert.equal(typeof CHART_KIND_LABELS[kind], "string");
			assert.ok(CHART_KIND_LABELS[kind].length > 0);
		}
		assert.deepEqual([...ASK_CHART_KINDS], [
			"chart-line",
			"chart-bar",
			"chart-donut",
			"chart-kpi",
			"chart-funnel",
			"chart-table",
		] as AskChartKind[]);
	});
});

describe("ask-chart · 意图 → 默认图型", () => {
	it("六类意图各自命中约定图型", () => {
		assert.equal(intentToChartKind("列出全部订单明细"), "chart-table");
		assert.equal(intentToChartKind("各环节的转化率"), "chart-funnel");
		assert.equal(intentToChartKind("订单总数一共多少条"), "chart-kpi");
		assert.equal(intentToChartKind("各渠道成交额占比"), "chart-donut");
		assert.equal(intentToChartKind("渠道成交额排行 TOP10"), "chart-bar");
		assert.equal(intentToChartKind("近 14 天成交额趋势"), "chart-line");
		assert.equal(intentToChartKind("给我看看订单数据"), "chart-line");
	});

	it("优先级固定：明细 > 漏斗 > KPI > 占比 > 排行 > 趋势（先命中先赢）", () => {
		assert.equal(intentToChartKind("订单明细占比"), "chart-table");
		assert.equal(intentToChartKind("转化率总共多少"), "chart-funnel");
		assert.equal(intentToChartKind("总共占比多少"), "chart-kpi");
		assert.equal(intentToChartKind("占比排行"), "chart-donut");
		assert.equal(intentToChartKind("排行趋势"), "chart-bar");
	});
});

describe("ask-chart · 图型 → 画布节点 kind", () => {
	it("五个图表图型同名透传，明细表不映射（画布无明细表节点）", () => {
		assert.equal(toCanvasKind("chart-line"), "chart-line");
		assert.equal(toCanvasKind("chart-bar"), "chart-bar");
		assert.equal(toCanvasKind("chart-donut"), "chart-donut");
		assert.equal(toCanvasKind("chart-kpi"), "chart-kpi");
		assert.equal(toCanvasKind("chart-funnel"), "chart-funnel");
		assert.equal(toCanvasKind("chart-table"), null);
	});
	it("任何图型都不会返回一个画布不认识的值（null 除外）", () => {
		for (const kind of ASK_CHART_KINDS) {
			const canvasKind = toCanvasKind(kind);
			assert.ok(canvasKind === null || canvasKind === kind, `${kind} → ${canvasKind}`);
		}
	});
});

describe("ask-chart · 结果集 → 序列", () => {
	it("没有结果、没有列、没有行：都返回空序列，不报错", () => {
		assert.deepEqual(pickChartSeries(null, "chart-bar"), {
			labels: [],
			values: [],
			labelField: null,
			valueField: null,
			skipped: 0,
		});
		assert.equal(pickChartSeries(result([], []), "chart-bar").values.length, 0);
		assert.equal(pickChartSeries(result(["dt", "gmv"], []), "chart-bar").values.length, 0);
	});

	it("明细表不做维度/数值搬运（直接渲染表格）", () => {
		const series = pickChartSeries(result(["dt", "gmv"], [{ dt: "d1", gmv: 10 }]), "chart-table");
		assert.equal(series.values.length, 0);
		assert.equal(series.labelField, null);
	});

	it("维度列在前、数值列在后：标签与数值同长度同顺序", () => {
		const series = pickChartSeries(
			result(
				["dt", "gmv"],
				[
					{ dt: "2026-10-01", gmv: 120 },
					{ dt: "2026-10-02", gmv: 80 },
				],
			),
			"chart-line",
		);
		assert.deepEqual(series.labels, ["2026-10-01", "2026-10-02"]);
		assert.deepEqual(series.values, [120, 80]);
		assert.equal(series.labelField, "dt");
		assert.equal(series.valueField, "gmv");
		assert.equal(series.skipped, 0);
	});

	it("数值不成立的行整行丢弃，并如实计数（不补零、不猜）", () => {
		const series = pickChartSeries(
			result(
				["dt", "gmv"],
				[
					{ dt: "d1", gmv: 10 },
					{ dt: "d2", gmv: null },
					{ dt: "d3", gmv: "abc" },
					{ dt: "d4", gmv: "" },
					{ dt: "d5", gmv: 30 },
				],
			),
			"chart-bar",
		);
		assert.deepEqual(series.labels, ["d1", "d5"]);
		assert.deepEqual(series.values, [10, 30]);
		assert.equal(series.skipped, 3);
	});

	it("字符串数值与千分位字符串都能转成数字", () => {
		const series = pickChartSeries(
			result(
				["channel", "amount"],
				[
					{ channel: "微信", amount: "1,234.5" },
					{ channel: "抖音", amount: "80" },
				],
			),
			"chart-bar",
		);
		assert.deepEqual(series.values, [1234.5, 80]);
	});

	it("没有数值列时只给标签字段，不编造数值", () => {
		const series = pickChartSeries(result(["name"], [{ name: "a" }, { name: "b" }]), "chart-bar");
		assert.deepEqual(series.values, []);
		assert.equal(series.valueField, null);
		assert.equal(series.labelField, "name");
	});

	it("纯数值列也画得出来：没有维度列时用序号当标签", () => {
		const series = pickChartSeries(result(["gmv"], [{ gmv: 5 }, { gmv: 6 }]), "chart-line");
		assert.equal(series.valueField, "gmv");
		assert.equal(series.labelField, null);
		assert.deepEqual(series.labels, ["1", "2"]);
		assert.deepEqual(series.values, [5, 6]);
	});

	it("多列都是数值时，第一列做数值、其余列退化为标签（顺序固定）", () => {
		const series = pickChartSeries(
			result(["a", "b"], [{ a: 1, b: 2 }]),
			"chart-line",
		);
		assert.equal(series.valueField, "a");
		assert.equal(series.labelField, "b");
		assert.deepEqual(series.labels, ["2"]);
		assert.deepEqual(series.values, [1]);
	});

	it("最多 200 个点（面板与画布都不吃超长序列）", () => {
		const rows = Array.from({ length: 250 }, (_, i) => ({ dt: `d${i}`, gmv: i }));
		const series = pickChartSeries(result(["dt", "gmv"], rows), "chart-line");
		assert.equal(series.values.length, 200);
		assert.equal(series.labels.length, 200);
		assert.deepEqual(series.values.slice(0, 2), [0, 1]);
	});
});

describe("ask-chart · 单元格与数字展示", () => {
	it("空值统一破折号，布尔转中文，数字走千分位", () => {
		assert.equal(formatCell(null), "—");
		assert.equal(formatCell(undefined), "—");
		assert.equal(formatCell(""), "—");
		assert.equal(formatCell("   "), "—");
		assert.equal(formatCell(true), "是");
		assert.equal(formatCell(false), "否");
		assert.equal(formatCell(1234567), "1,234,567");
	});

	it("长文本截断到 58 字符以内，空白折成一个空格", () => {
		assert.equal(formatCell("a  b\n c"), "a b c");
		const long = formatCell("x".repeat(80));
		assert.equal(long.length, 58);
		assert.ok(long.endsWith("…"));
	});

	it("数字格式化：≥100 不留小数，<100 留两位，负数与非法值各自有交代", () => {
		assert.equal(formatNumber(1234567), "1,234,567");
		assert.equal(formatNumber(1234.4), "1,234");
		assert.equal(formatNumber(12.345), "12.35");
		assert.equal(formatNumber(0), "0");
		assert.equal(formatNumber(-1234), "-1,234");
		assert.equal(formatNumber(Number.NaN), "—");
		assert.equal(formatNumber(Number.POSITIVE_INFINITY), "—");
	});
});

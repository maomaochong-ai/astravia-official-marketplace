/**
 * figure-render — 不走 Chart.js 的自有渲染类型（funnel / metric / boxplot）。
 *
 * 这些片段会被 innerHTML 进宿主 UI，也会原样写进导出的离线 HTML，所以这里钉三件事：
 * 数据契约（跟 Chart.js 类型同一份）、未注册类型的可见降级、以及所有文本都经过转义。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FIGURE_TYPES, isFigureType, renderFigure } from "../features/visualization/figures/figure-registry.ts";
import { SERIES_COLORS } from "../features/visualization/figures/figure-palette.ts";

const DASHBOARD = { isScreen: false };
const SCREEN = { isScreen: true };

/** 三种 figure 片段共同的硬约束：自包含、不落 canvas、不依赖 CSS 变量。 */
function assertSelfContained(html) {
	assert.ok(html.includes("dbx-figure"), "片段必须带 dbx-figure 根类");
	assert.ok(!html.includes("<canvas"), "figure 不应产生 canvas");
	assert.ok(!html.includes("<svg"), "figure 不用 SVG");
	assert.ok(!html.includes("<style"), "figure 不注入 <style>");
	assert.ok(!html.includes("var(--"), "figure 不依赖 CSS 变量（导出页没有宿主变量）");
}

describe("figure 注册表与分派", () => {
	it("登记的三种类型都认得，Chart.js 的 8 种与未登记类型都不算 figure", () => {
		for (const type of ["funnel", "metric", "boxplot"]) assert.equal(isFigureType(type), true, type);
		for (const type of ["line", "bar", "pie", "doughnut", "polarArea", "radar", "scatter", "bubble"]) {
			assert.equal(isFigureType(type), false, type);
		}
		// 评估过但本轮不做的类型，以及原型链上的名字，都不能误判
		for (const type of ["sankey", "wordcloud", "table", "constructor", "toString", ""]) {
			assert.equal(isFigureType(type), false, type);
		}
	});

	it("FIGURE_TYPES 由登记表派生，不含 Chart.js 的类型名", () => {
		assert.deepEqual([...FIGURE_TYPES], ["funnel", "metric", "boxplot"]);
	});

	it("未注册的类型渲染成可见提示卡，而不是空白", () => {
		const html = renderFigure({ type: "sankey", data: {} }, DASHBOARD);
		assert.ok(html.includes("当前版本不支持该图表类型"));
		assert.ok(html.includes("sankey"));
		assert.ok(html.includes("已注册的自有类型"));
		assert.ok(html.includes("funnel / metric / boxplot"));
		// 提示卡里不重复列 Chart.js 的 8 种，避免两处清单漂移
		assert.ok(!html.includes("doughnut"));
		assertSelfContained(html);
	});

	it("同输入渲染结果逐字相同（无时间 / 随机依赖）", () => {
		const item = { type: "funnel", data: { labels: ["a", "b"], datasets: [{ data: [2, 1] }] } };
		assert.equal(renderFigure(item, DASHBOARD), renderFigure(item, DASHBOARD));
		assert.notEqual(renderFigure(item, DASHBOARD), renderFigure(item, SCREEN));
	});

	it("类别色板与 dbx_chart_collection 默认配色同源（前三个色值不动）", () => {
		assert.deepEqual([...SERIES_COLORS].slice(0, 3), ["#6366f1", "#06b6d4", "#f59e0b"]);
		assert.equal(SERIES_COLORS.length, 8);
	});
});

describe("funnel", () => {
	function funnel(labels, data, extra = {}) {
		return renderFigure({ type: "funnel", data: { labels, datasets: [{ label: "阶段", data }] }, ...extra }, DASHBOARD);
	}

	it("条宽按最大值等比，最大值占满", () => {
		const html = funnel(["访问", "加购", "下单", "支付"], [1000, 500, 250, 200]);
		assert.ok(html.includes("width:100.00%"));
		assert.ok(html.includes("width:50.00%"));
		assert.ok(html.includes("width:25.00%"));
		assert.ok(html.includes("width:20.00%"));
		assertSelfContained(html);
	});

	it("保持 labels 原顺序，不排序（漏斗顺序就是业务阶段顺序）", () => {
		const html = funnel(["访问", "加购", "下单"], [10, 500, 100]);
		assert.ok(html.indexOf("访问") < html.indexOf("加购"));
		assert.ok(html.indexOf("加购") < html.indexOf("下单"));
	});

	it("数值列带千分位与「占首段」，选项可关掉百分比", () => {
		const html = funnel(["访问", "加购"], [1234, 617]);
		assert.ok(html.includes("1,234"));
		assert.ok(html.includes("占首段 50.0%"));

		const bare = funnel(["访问", "加购"], [1234, 617], { options: { figure: { showPercent: false } } });
		assert.ok(!bare.includes("占首段"));
	});

	it("单位与小数位来自 options.figure", () => {
		const html = funnel(["访问"], [1234.5], { options: { figure: { unit: "人", digits: 0 } } });
		assert.ok(html.includes("1,235人"));
	});

	it("缺失值显示占位符、零值不画条，都不出 NaN", () => {
		const html = funnel(["a", "b", "c"], [100, 0, null]);
		assert.ok(!html.includes("NaN"));
		assert.ok(html.includes("width:0.00%"));
		assert.ok(html.includes(">—<"));
	});

	it("只读第一条 series（funnel 是单序列类型）", () => {
		const html = renderFigure(
			{
				type: "funnel",
				data: {
					labels: ["a", "b"],
					datasets: [
						{ label: "主", data: [10, 5] },
						{ label: "次", data: [9999, 7777] },
					],
				},
			},
			DASHBOARD,
		);
		assert.ok(!html.includes("9999"));
		assert.ok(!html.includes("7777"));
		assert.ok(!html.includes("次"));
	});

	it("labels 缺失时按索引补 1..n", () => {
		const html = renderFigure({ type: "funnel", data: { datasets: [{ data: [5, 3] }] } }, DASHBOARD);
		assert.ok(html.includes(">1<"));
		assert.ok(html.includes(">2<"));
	});

	it("没有数据 / 没有数值时给出可读提示", () => {
		assert.ok(funnel([], []).includes("漏斗图没有可用数据"));
		assert.ok(funnel(["a"], ["x"]).includes("漏斗图没有可用的数值"));
	});

	it("label 里的 HTML 被转义", () => {
		const html = funnel(['<script>alert(1)</script>', "b"], [10, 5]);
		assert.ok(html.includes("&lt;script&gt;"));
		assert.ok(!html.includes("<script>"));
	});
});

describe("metric", () => {
	function metric(labels, datasets, extra = {}) {
		return renderFigure({ type: "metric", data: { labels, datasets }, ...extra }, DASHBOARD);
	}

	it("每个 label 一张卡，主数值取 datasets[0]", () => {
		const html = metric(["GMV", "订单数"], [{ label: "本期", data: [1200, 88] }]);
		assert.equal(html.split("border-radius:8px;background:").length - 1, 2);
		assert.ok(html.includes("GMV"));
		assert.ok(html.includes("1,200"));
		assert.ok(html.includes("订单数"));
		assert.ok(html.includes("88"));
		assert.ok(html.includes("本期"), "series 名作为说明");
		assertSelfContained(html);
	});

	it("datasets[1..] 逐行列出，第一条同时用来算环比", () => {
		const html = metric(["GMV"], [
			{ label: "本期", data: [1200] },
			{ label: "上期", data: [1000] },
		]);
		assert.ok(html.includes("上期 1,000"));
		assert.ok(html.includes("▲ 20.0%"));
		assert.ok(html.includes("较 上期"));
		assert.ok(html.includes("#16a34a"), "上涨用 up 色");
	});

	it("下跌用 ▼ 与 down 色", () => {
		const html = metric(["GMV"], [
			{ label: "本期", data: [800] },
			{ label: "上期", data: [1000] },
		]);
		assert.ok(html.includes("▼ 20.0%"));
		assert.ok(html.includes("#dc2626"));
	});

	it("showDelta=false 时不显示环比；没有第二条 series 也不算", () => {
		const off = metric(
			["GMV"],
			[
				{ label: "本期", data: [1200] },
				{ label: "上期", data: [1000] },
			],
			{ options: { figure: { showDelta: false } } },
		);
		assert.ok(!off.includes("▲") && !off.includes("▼"));

		const single = metric(["GMV"], [{ label: "本期", data: [1200] }]);
		assert.ok(!single.includes("▲") && !single.includes("▼"));
	});

	it("第二条 series 没名字时用「口径 N」占位", () => {
		const html = metric(["GMV"], [
			{ label: "本期", data: [1200] },
			{ data: [1000] },
		]);
		assert.ok(html.includes("口径 2"));
		assert.ok(html.includes("较 口径 2"));
	});

	it("单位与小数位来自 options.figure", () => {
		const html = metric(["GMV"], [{ data: [1234.5] }], { options: { figure: { unit: "万元", digits: 0 } } });
		assert.ok(html.includes("1,235万元"));
	});

	it("label 多于数值时多出来的卡显示占位符", () => {
		const html = metric(["A", "B", "C"], [{ data: [1] }]);
		assert.equal(html.split("border-radius:8px;background:").length - 1, 3);
		assert.ok(html.includes(">—<"));
	});

	it("大屏用更大的字号与深色底板", () => {
		const screen = renderFigure({ type: "metric", data: { labels: ["A"], datasets: [{ data: [1] }] } }, SCREEN);
		assert.ok(screen.includes("font-size:30px"));
		assert.ok(screen.includes("rgba(255,255,255,0.03)"));
		assert.ok(screen.includes("rgba(6,182,212,0.25)"));
	});

	it("没有数据时给出可读提示", () => {
		assert.ok(metric([], []).includes("指标卡没有可用数据"));
	});

	it("label 里的 HTML 被转义", () => {
		const html = metric(["<b>GMV</b>"], [{ data: [1] }]);
		assert.ok(html.includes("&lt;b&gt;"));
		assert.ok(!html.includes("<b>"));
	});
});

describe("boxplot", () => {
	function boxplot(labels, data, extra = {}) {
		return renderFigure({ type: "boxplot", data: { labels, datasets: [{ label: "分布", data }] }, ...extra }, DASHBOARD);
	}

	const FIVE = [
		[1, 2, 3, 4, 5],
		[10, 20, 30, 40, 50],
	];

	it("数组形式的五数概括画出须线 / 箱体 / 中位线", () => {
		const html = boxplot(["A", "B"], FIVE);
		assert.ok(html.includes("flex:0 0 56px"), "左侧刻度栏");
		assert.ok(html.includes("width:1px;background:#9ca3af"), "须线");
		assert.ok(html.includes("width:30%;max-width:12px;height:1px"), "须帽");
		assert.ok(html.includes("width:70%;max-width:28px;box-sizing:border-box;background:rgba(99,102,241,0.22)"), "箱体");
		assert.ok(html.includes("width:70%;max-width:28px;height:2px;background:#6366f1"), "中位线");
		assert.ok(html.includes("border-top:1px solid rgba(156,163,175,0.25)"), "网格线");
		assert.ok(!html.includes("已跳过"));
		assertSelfContained(html);
	});

	it("对象形式的五数概括同样接受", () => {
		const html = boxplot(["A"], [{ min: 1, q1: 2, median: 3, q3: 4, max: 5 }]);
		assert.ok(html.includes("width:70%;max-width:28px"));
		assert.ok(!html.includes("已跳过"));
	});

	it("无效项被跳过并计数，且保留列位与标签", () => {
		const html = boxplot(["A", "B", "C"], [[1, 2, 3, 4, 5], [1, 2, 3], "oops"]);
		assert.ok(html.includes("已跳过 2 项无效数据"));
		assert.ok(html.includes(">B<") && html.includes(">C<"));
		assert.equal(html.split("flex:1 1 0;min-width:0\"></span>").length - 1, 2, "无效项留空列保持对齐");
	});

	it("options.figure 的 min / max 覆盖纵轴范围", () => {
		const html = boxplot(["A"], [[1000, 1250, 1500, 1750, 2000]], { options: { figure: { min: 0, max: 3000 } } });
		assert.ok(html.includes("3,150"), "上界刻度来自 options.figure.max");
		assert.ok(!html.includes("2,050"), "未使用数据自身的上下界");
	});

	it("刻度带千分位与小数位", () => {
		const html = boxplot(["A"], [[1000, 2000, 3000, 4000, 5000]], { options: { figure: { digits: 0 } } });
		assert.ok(html.includes("1,900"), "刻度已格式化");
		assert.ok(!html.includes("NaN"));
	});

	it("全空 / 全无效时给出可读提示", () => {
		assert.ok(boxplot([], []).includes("箱形图没有可用数据"));
		assert.ok(boxplot(["A"], [[1, 2]]).includes("箱形图没有可用的五数概括"));
	});

	it("高度取自 ChartItem.height", () => {
		const html = boxplot(["A"], [FIVE[0]], { height: 420 });
		assert.ok(html.includes("height:420px"));
	});

	it("label 里的 HTML 被转义", () => {
		const html = boxplot(["<img src=x onerror=1>"], [FIVE[0]]);
		assert.ok(html.includes("&lt;img"));
		assert.ok(!html.includes("<img"));
	});
});

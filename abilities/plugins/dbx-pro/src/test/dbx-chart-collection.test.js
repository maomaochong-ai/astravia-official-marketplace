/**
 * dbx-chart-collection — generateHtml() 纯函数测试
 *
 * 覆盖：Chart.js API 正确性、安全上限、主题区分、布局策略、8 种图表类型
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { createDbxChartCollectionTool, generateHtml, validateChartData, normalizeChartData } from "../tools/dbx-chart-collection.ts";
import { resolveChartItems } from "../domain/chart-source.ts";
import { resolveVisualizationHtml } from "../features/visualization/visualization-html.ts";
import { setPreviewCallback, setSaveCallback } from "../features/visualization/visualization-bridge.ts";
import { withEmbeddedChartJs } from "../shared/utils/chart-runtime.ts";

// ─── Fixtures ────────────────────────────────────────────

const lineChart = {
	type: "line",
	title: "月度 GMV 趋势",
	data: { labels: ["1月", "2月", "3月"], datasets: [{ label: "GMV", data: [100, 200, 300] }] },
};
const barChart = {
	type: "bar",
	title: "渠道分布",
	data: { labels: ["A", "B", "C"], datasets: [{ label: "量", data: [5, 8, 3] }] },
};
const pieChart = {
	type: "pie",
	title: "品类占比",
	data: { labels: ["电子", "服饰"], datasets: [{ data: [60, 40] }] },
};

const ALL_TYPES = [
	{ type: "line", title: "趋势", data: { labels: ["A"], datasets: [{ data: [1] }] } },
	{ type: "bar", title: "分布", data: { labels: ["A"], datasets: [{ data: [1] }] } },
	{ type: "pie", title: "占比", data: { labels: ["A"], datasets: [{ data: [1] }] } },
	{ type: "doughnut", title: "环形", data: { labels: ["A"], datasets: [{ data: [1] }] } },
	{ type: "polarArea", title: "极区", data: { labels: ["A"], datasets: [{ data: [1] }] } },
	{ type: "radar", title: "雷达", data: { labels: ["A"], datasets: [{ data: [1] }] } },
	{ type: "scatter", title: "散点", data: { datasets: [{ data: [{ x: 1, y: 2 }] }] } },
	{ type: "bubble", title: "气泡", data: { datasets: [{ data: [{ x: 1, y: 2, r: 10 }] }] } },
];

// ─── 基础结构 ────────────────────────────────────────────

describe("generateHtml — 基础结构", () => {
	it("输出完整 HTML 骨架", () => {
		const html = generateHtml({ charts: [lineChart], title: "测试看板" });
		assert.ok(html.startsWith("<!DOCTYPE html>"));
		assert.ok(html.includes('<html lang="zh">'));
		assert.ok(html.includes("</html>"));
		assert.ok(html.includes('<meta charset="UTF-8">'));
	});

	it("标题注入正确", () => {
		const html = generateHtml({ charts: [lineChart], title: "销售看板" });
		assert.ok(html.includes("<title>销售看板</title>"));
		assert.ok(html.includes("<h1>销售看板</h1>"));
	});

	it("默认主题 dashboard", () => {
		const html = generateHtml({ charts: [lineChart], title: "看板" });
		// 看板浅 QuickBI 风：浅背景 + 12px 圆角 + 柔和边框
		assert.ok(html.includes("#f8fafc"), "dashboard 浅背景");
		assert.ok(html.includes("border-radius:12px"), "dashboard 圆角");
		assert.ok(html.includes("企业看板"), "副标题");
		assert.ok(html.includes("Chart.defaults.elements.bar.borderWidth = 0"), "Chart.js defaults 注入");
	});

	it("screen 深主题", () => {
		const html = generateHtml({ charts: [lineChart], title: "大屏", type: "screen" });
		// 大屏深 DataV 风：渐变黑 + 青蓝边框 + 入场动画
		assert.ok(html.includes("#0c0c0c"), "screen 渐变起点");
		assert.ok(html.includes("#a5f3fc"), "screen 标题色");
		assert.ok(html.includes("数据大屏"), "副标题");
		assert.ok(html.includes("animation:fadeIn"), "入场动画");
	});

	it("Chart.js UMD CDN 正确", () => {
		const html = generateHtml({ charts: [lineChart], title: "看板" });
		assert.ok(html.includes("https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"));
	});
});

// ─── Chart.js API 正确性（白屏 bug 防御）─────────────────

describe("generateHtml — Chart.js API", () => {
	it("用 new Chart(canvas, {type}) — 不是 new ChartJS.Line", () => {
		const html = generateHtml({ charts: [lineChart], title: "看板" });
		assert.ok(html.includes("new Chart(document.getElementById('chart-0'),{type:'line'"));
		assert.ok(!html.includes("new ChartJS."));
		assert.ok(!html.includes("ChartJS.Line"));
		assert.ok(!html.includes("Chart.Line("));
	});

	it("所有 8 种类型都用 new Chart(canvas, {type: X}) 格式", () => {
		const html = generateHtml({ charts: ALL_TYPES, title: "全类型测试" });
		for (const t of ALL_TYPES) {
			const idx = ALL_TYPES.indexOf(t);
			const expected = `new Chart(document.getElementById('chart-${idx}'),{type:'${t.type}'`;
			assert.ok(html.includes(expected), `类型 ${t.type} 没有正确的 new Chart 调用`);
		}
	});

	it("canvas id 与 Chart 调用 id 一一对应", () => {
		const html = generateHtml({ charts: [lineChart, barChart, pieChart], title: "多图" });
		for (let i = 0; i < 3; i++) {
			assert.ok(html.includes(`<canvas id="chart-${i}">`), `canvas id chart-${i} 缺失`);
			assert.ok(html.includes(`getElementById('chart-${i}')`), `Chart 调用 chart-${i} 缺失`);
		}
	});
});

// ─── 安全上限 ────────────────────────────────────────────

describe("generateHtml — 安全上限 12", () => {
	it("13 图只渲染前 12 个", () => {
		const manyCharts = Array.from({ length: 13 }, (_, i) => ({
			type: "bar",
			title: `图表 ${i + 1}`,
			data: { labels: ["A"], datasets: [{ data: [i] }] },
		}));
		const html = generateHtml({ charts: manyCharts, title: "上限测试" });
		for (let i = 0; i < 12; i++) {
			assert.ok(html.includes(`id="chart-${i}"`), `chart-${i} 应该存在`);
		}
		assert.ok(!html.includes(`id="chart-12"`), "chart-12 应该被截断");
	});
});

// ─── 布局策略 ────────────────────────────────────────────

describe("generateHtml — 布局策略", () => {
	it("2 图 → 2 列 auto", () => {
		const html = generateHtml({ charts: [lineChart, barChart], title: "两图" });
		assert.ok(html.includes("grid-template-columns: repeat(2, 1fr);"));
	});

	it("4 图 → 2 列 auto", () => {
		const c = [lineChart, barChart, pieChart, { ...lineChart, title: "四" }];
		const html = generateHtml({ charts: c, title: "四图" });
		assert.ok(html.includes("grid-template-columns: repeat(2, 1fr);"));
	});

	it("6 图 → 3 列 auto", () => {
		const c = Array.from({ length: 6 }, (_, i) => ({ ...lineChart, title: String(i) }));
		const html = generateHtml({ charts: c, title: "六图" });
		assert.ok(html.includes("grid-template-columns: repeat(3, 1fr);"));
	});

	it("12 图 → 4 列 auto", () => {
		const c = Array.from({ length: 12 }, (_, i) => ({ ...lineChart, title: String(i) }));
		const html = generateHtml({ charts: c, title: "十二图" });
		assert.ok(html.includes("grid-template-columns: repeat(4, 1fr);"));
	});

	it("layout: grid-3 强制覆盖", () => {
		const html = generateHtml({ charts: [lineChart, barChart], title: "强制3列", layout: "grid-3" });
		assert.ok(html.includes("grid-template-columns: repeat(3, 1fr);"));
	});
});

// ─── 8 种 ChartType 覆盖 ──────────────────────────────────

describe("generateHtml — 8 种 ChartType", () => {
	for (const t of ALL_TYPES) {
		it(`${t.type} 可生成完整 HTML`, () => {
			const html = generateHtml({ charts: [{ type: t.type, title: t.title, data: t.data }], title: t.type });
			assert.ok(html.includes(`type:'${t.type}'`));
			assert.ok(html.includes('<canvas id="chart-0">'));
		});
	}
});

// ─── validateChartData 守卫（防 AI 传错 data 格式导致白屏）───

describe("validateChartData — 防白屏守卫", () => {
	it("标准格式 → ok", () => {
		const r = validateChartData({ labels: ["A"], datasets: [{ data: [1] }] });
		assert.ok(r.ok);
	});
	it("null → fail: 缺少 data", () => {
		const r = validateChartData(null);
		assert.ok(!r.ok && r.reason?.includes("缺少 data"));
	});
	it("数组（AI 把 rows 塞进来）→ fail", () => {
		const r = validateChartData([1, 2, 3]);
		assert.ok(!r.ok && r.reason?.includes("是数组"));
	});
	it("rows 对象（AI 没转 datasets）→ fail", () => {
		const r = validateChartData({ rows: [{ x: 1, y: 2 }] });
		assert.ok(!r.ok && r.reason?.includes("rows") && r.reason?.includes("没转"));
	});
	it("空 datasets → fail", () => {
		const r = validateChartData({ labels: ["A"], datasets: [] });
		assert.ok(!r.ok && r.reason?.includes("空"));
	});
});

// ─── normalizeChartData — AI 常见错格式自动修正 ─────────────

describe("normalizeChartData — AI 错格式自动修正", () => {
	it("裸数组 [1,2,3] → { labels: [1,2,3], datasets: [{ data: [...] }] }", () => {
		const r = normalizeChartData([100, 200, 300]);
		assert.deepStrictEqual(r, {
			labels: ["1", "2", "3"],
			datasets: [{ data: [100, 200, 300] }],
		});
	});

	it("{ rows: [...] } → 从第一行列名推 labels + 数值列变 datasets", () => {
		const r = normalizeChartData({
			rows: [
				{ month: "1月", gmv: 100 },
				{ month: "2月", gmv: 200 },
				{ month: "3月", gmv: 300 },
			],
		});
		assert.ok(typeof r === "object" && r !== null);
		const o = r;
		assert.deepStrictEqual(o.labels, ["1月", "2月", "3月"]);
		assert.ok(Array.isArray(o.datasets) && o.datasets.length === 1);
		assert.deepStrictEqual(o.datasets[0].data, [100, 200, 300]);
		assert.strictEqual(o.datasets[0].label, "gmv");
	});

	it("datasets 有值但缺 labels → 补索引标签", () => {
		const r = normalizeChartData({ datasets: [{ data: [10, 20, 30] }] });
		assert.deepStrictEqual(r.labels, ["1", "2", "3"]);
	});

	it("标准格式 → 原样返回", () => {
		const std = { labels: ["A"], datasets: [{ data: [1] }] };
		assert.strictEqual(normalizeChartData(std), std);
	});

	it("无法修正的（null / 非对象）→ 原样返回，让 validateChartData 拒绝", () => {
		assert.strictEqual(normalizeChartData(null), null);
		assert.strictEqual(normalizeChartData("oops"), "oops");
	});
});

// ─── generateHtml — 坏 data 格式：normalize 能修好的直接渲染，修不好才报错 ──

describe("generateHtml — normalize 自动修正 → 正常渲染", () => {
	it("data 是 rows 对象 → normalize 修成标准格式 → 渲染 canvas", () => {
		const html = generateHtml({
			charts: [{ type: "bar", title: "测试", data: { rows: [{ month: "1月", gmv: 100 }, { month: "2月", gmv: 200 }] } }],
			title: "测试",
		});
		assert.ok(html.includes('<canvas id="chart-0"'));
		assert.ok(html.includes("new Chart(document.getElementById('chart-0')"));
	});

	it("data 是裸数组 → normalize 修成标准格式 → 渲染 canvas", () => {
		const html = generateHtml({
			charts: [{ type: "bar", title: "测试", data: [1, 2, 3] }],
			title: "测试",
		});
		assert.ok(html.includes('<canvas id="chart-0"'));
		assert.ok(html.includes("new Chart(document.getElementById('chart-0')"));
	});
});

// ─── M1：datasets 与惰性 html（工具契约） ─────────────────

/** 带 source 的图：data 故意留空，验证渲染数据只能来自数据集。 */
const CHART_WITH_SOURCE = {
	type: "bar",
	title: "分区域 GMV",
	data: { labels: [], datasets: [] },
	source: { datasetId: "ds-1", labelColumn: "region", valueColumns: ["gmv"] },
};

const DS_1 = {
	id: "ds-1",
	title: "分区域 GMV",
	connection: "pg",
	table: "public.orders",
	sql: "select region, sum(gmv) as gmv from orders group by region",
	columns: ["region", "gmv"],
	rows: [
		{ region: "华东", gmv: 100 },
		{ region: "华南", gmv: 200 },
	],
	rowCount: 2,
};

describe("dbx_chart_collection — datasets 与惰性 html", () => {
	const tool = createDbxChartCollectionTool();
	let saved = null;
	let previewed = null;

	const run = (input) => tool.handler({ trigger: { input } });

	beforeEach(() => {
		saved = null;
		previewed = null;
		setSaveCallback((viz) => {
			saved = viz;
		});
		setPreviewCallback((viz) => {
			previewed = viz;
		});
	});

	afterEach(() => {
		setSaveCallback(null);
		setPreviewCallback(null);
	});

	it("不带 datasets 的旧调用：html 照旧落库，产物结构不变", async () => {
		const result = await run({ charts: [lineChart], title: "旧调用看板", connection_name: "pg", table: "public.orders" });

		assert.equal(result.ok, true);
		assert.equal(result.datasetCount, 0);
		assert.equal(saved.datasets, undefined, "没有数据集时不应凭空多出 datasets 字段");
		assert.equal(saved.chartItems.length, 1);
		assert.equal(saved.chartItems[0].source, undefined, "不该凭空多出 source");
		assert.equal(saved.connection, "pg");
		assert.equal(saved.table, "public.orders");
		assert.ok(typeof saved.html === "string" && saved.html.includes('<canvas id="chart-0"'), "旧路径仍然落库 html");
		assert.equal(previewed, saved, "预览拿到的就是入库的那份产物");
		assert.ok(!result.message.includes("筛选与重新取数"), "旧调用不该出现筛选提示");
	});

	it("带 datasets：html 不落库，只存数据与初始筛选", async () => {
		const result = await run({
			charts: [CHART_WITH_SOURCE],
			title: "销售看板",
			type: "dashboard",
			connection_name: "pg",
			table: "public.orders",
			datasets: [DS_1],
			filters: [{ column: "region", values: ["华东"] }],
		});

		assert.equal(result.ok, true);
		assert.equal(result.datasetCount, 1);
		assert.equal(saved.html, undefined, "有数据集时 html 是派生物，不该落库");
		assert.equal(saved.datasets.length, 1);
		assert.equal(saved.datasets[0].sql, DS_1.sql, "SQL 原样保存，重新取数直接重跑它");
		assert.equal(saved.datasets[0].rowCount, 2, "rowCount 保存 SQL 的完整行数");
		assert.equal(saved.filters.length, 1, "初始筛选随产物落库");
		assert.equal(saved.chartItems[0].source.datasetId, "ds-1");
		assert.deepEqual(saved.chartItems[0].source.valueColumns, ["gmv"]);
		assert.ok(result.message.includes("筛选与重新取数"), "返回值里要告诉用户新增了筛选能力");
	});

	it("导出时才生成 html：数据来自数据集，筛选变化直接反映在导出结果里", async () => {
		await run({ charts: [CHART_WITH_SOURCE], title: "导出看板", datasets: [DS_1] });
		assert.equal(saved.html, undefined);

		const full = resolveVisualizationHtml(saved, resolveChartItems(saved.chartItems, saved.datasets));
		assert.ok(full.includes("new Chart(document.getElementById('chart-0')"), "导出时才拼出渲染调用");
		for (const token of ["华东", "华南", "100", "200"]) {
			assert.ok(full.includes(token), `导出结果缺少数据集里的 ${token}`);
		}

		await run({ charts: [CHART_WITH_SOURCE], title: "导出看板", datasets: [DS_1], filters: [{ column: "region", values: ["华东"] }] });
		const filtered = resolveVisualizationHtml(saved, resolveChartItems(saved.chartItems, saved.datasets, saved.filters));
		assert.ok(filtered.includes("华东"));
		assert.ok(!filtered.includes("华南"), "导出的是当前筛选后的数据，不是全量快照");

		const offline = withEmbeddedChartJs(full);
		assert.ok(offline.includes("Chart.js v4.4.1"), "内联的是随插件打包的同一份运行时");
		assert.ok(!offline.includes("cdn.jsdelivr.net"), "离线打开不应再依赖 CDN");
	});
});

// ─── figure 类型（不走 Chart.js 的自有渲染）────────────────

const FUNNEL_CHART = {
	type: "funnel",
	title: "转化漏斗",
	data: { labels: ["访问", "加购", "下单"], datasets: [{ label: "人数", data: [1000, 400, 120] }] },
};
const METRIC_CHART = {
	type: "metric",
	title: "核心指标",
	data: { labels: ["GMV"], datasets: [{ data: [1200] }] },
};
const BOXPLOT_CHART = {
	type: "boxplot",
	title: "分布",
	data: { labels: ["A"], datasets: [{ data: [[1, 2, 3, 4, 5]] }] },
};

describe("generateHtml — figure 类型不走 Chart.js", () => {
	it("type 枚举在原有 8 种之后追加 3 种（只增不改）", () => {
		const enumValues = createDbxChartCollectionTool().parameters.properties.charts.items.properties.type.enum;
		assert.deepEqual(enumValues.slice(0, 8), ["line", "bar", "pie", "doughnut", "polarArea", "radar", "scatter", "bubble"]);
		assert.deepEqual(enumValues.slice(8), ["funnel", "boxplot", "metric"]);
	});

	it("工具描述里写清三种 figure 的数据契约与 options.figure", () => {
		const { description } = createDbxChartCollectionTool();
		for (const token of ["funnel", "metric", "boxplot", "options.figure"]) {
			assert.ok(description.includes(token), `描述缺少 ${token}`);
		}
	});

	for (const [name, chart, marker] of [
		["funnel", FUNNEL_CHART, "dbx-figure-funnel"],
		["metric", METRIC_CHART, "dbx-figure-metric"],
		["boxplot", BOXPLOT_CHART, "dbx-figure-boxplot"],
	]) {
		it(`${name} 片段自包含：不生成 canvas，也不调用 new Chart`, () => {
			const html = generateHtml({ charts: [chart], title: name });
			assert.ok(html.includes(marker));
			assert.ok(html.includes(chart.title));
			assert.ok(!html.includes("<canvas"), "figure 不产生 canvas");
			assert.ok(!html.includes("new Chart("), "figure 不产生 Chart.js 调用");
			assert.ok(html.includes(`(${name}) rendered without Chart.js`));
		});
	}

	it("混合页面：原生类型照旧画 canvas，figure 类型只注入片段", () => {
		const html = generateHtml({ charts: [barChart, FUNNEL_CHART], title: "混合" });
		assert.ok(html.includes('<canvas id="chart-0">'));
		assert.ok(html.includes("new Chart(document.getElementById('chart-0')"));
		assert.equal(html.split("<canvas").length - 1, 1, "只有原生类型出 canvas");
		assert.ok(html.includes("dbx-figure-funnel"));
		assert.ok(!html.includes("getElementById('chart-1')"), "figure 不注册 Chart 实例");
	});

	it("大屏主题用 screen 调色板", () => {
		const html = generateHtml({ charts: [METRIC_CHART], title: "大屏", type: "screen" });
		assert.ok(html.includes("rgba(6,182,212,0.25)"));
	});

	it("figure 的数据格式错误仍然先出错误卡，不落到渲染器", () => {
		const html = generateHtml({ charts: [{ type: "funnel", data: {} }], title: "坏数据" });
		assert.ok(html.includes("chart-error"));
		assert.ok(html.includes("skipped"));
		assert.ok(!html.includes("dbx-figure"));
	});

	it("离线导出仍能看到 figure —— 片段是服务端拼好的 HTML", () => {
		const offline = withEmbeddedChartJs(generateHtml({ charts: [FUNNEL_CHART], title: "离线" }));
		assert.ok(offline.includes("dbx-figure-funnel"));
		assert.ok(offline.includes("Chart.js v4.4.1"));
		assert.ok(!offline.includes("cdn.jsdelivr.net"));
	});
});

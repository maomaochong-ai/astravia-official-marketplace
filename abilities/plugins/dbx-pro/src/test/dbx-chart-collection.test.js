/**
 * dbx-chart-collection — generateHtml() 纯函数测试
 *
 * 覆盖：Chart.js API 正确性、安全上限、主题区分、布局策略、8 种图表类型
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateHtml } from "../tools/dbx-chart-collection.ts";

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
		assert.ok(html.includes("background: #f8fafc;"));
		assert.ok(html.includes("企业看板"));
	});

	it("screen 深主题", () => {
		const html = generateHtml({ charts: [lineChart], title: "大屏", type: "screen" });
		assert.ok(html.includes("linear-gradient(135deg, #0c0c0c 0%, #1a1a2e 100%)"));
		assert.ok(html.includes("数据大屏"));
		assert.ok(html.includes("animation:fadeIn"));
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

/**
 * figure-dispatch — UI 侧的类型分派接线回归。
 *
 * 只测渲染纯函数证明不了接线：ChartGrid 少写一条分支，figure 就会掉进 ChartItemRenderer，
 * 得到一个「Chart.js 不认识 funnel」的白 canvas，而纯函数测试照样全绿。
 * 所以这里渲染真实 ChartGrid，检查 DOM 里到底落到哪个分支，
 * 并断言 UI 注入的片段与导出路径的产物逐字相同（ADR-0009 §10 验收 ⑤）。
 */

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import RTL from "@testing-library/react";
import { createElement } from "react";
import { normalizeChartData } from "../tools/dbx-chart-collection.ts";
import { ChartGrid } from "../features/visualization/components/chart-grid.tsx";
import { renderFigure } from "../features/visualization/figures/figure-registry.ts";

const { cleanup, render } = RTL;

afterEach(() => cleanup());

function renderGrid(items, isScreen = false) {
	return render(createElement(ChartGrid, { items, isScreen })).container;
}

const FUNNEL = {
	type: "funnel",
	title: "转化漏斗",
	data: { labels: ["访问", "加购", "下单"], datasets: [{ label: "人数", data: [1000, 400, 120] }] },
};

const BAR = {
	type: "bar",
	title: "GMV",
	data: { labels: ["华东", "华南"], datasets: [{ label: "gmv", data: [100, 200] }] },
};

describe("ChartGrid 类型分派", () => {
	it("funnel 落到 figure 分支：注入片段、不建 canvas", () => {
		const container = renderGrid([FUNNEL]);
		const figure = container.querySelector(".viz-figure");
		assert.ok(figure, "funnel 应走 figure 分支");
		assert.ok(figure.innerHTML.includes("dbx-figure-funnel"));
		assert.equal(container.querySelector("canvas"), null);
		assert.equal(container.querySelector(".viz-canvas"), null);
	});

	it("metric / boxplot 同样落在 figure 分支", () => {
		const container = renderGrid([
			{ type: "metric", title: "核心指标", data: { labels: ["GMV"], datasets: [{ data: [1200] }] } },
			{ type: "boxplot", title: "分布", data: { labels: ["A"], datasets: [{ data: [[1, 2, 3, 4, 5]] }] } },
		]);
		assert.equal(container.querySelectorAll(".viz-figure").length, 2);
		assert.equal(container.querySelector("canvas"), null);
	});

	it("原生 8 种类型仍然走 Chart.js（新增类型不影响旧值语义）", () => {
		const container = renderGrid([BAR]);
		assert.ok(container.querySelector(".viz-canvas"), "bar 应走 canvas 分支");
		assert.ok(container.querySelector("canvas"));
		assert.equal(container.querySelector(".viz-figure"), null);
	});

	it("同一网格里两种类型各走各的分支", () => {
		const container = renderGrid([BAR, FUNNEL]);
		assert.equal(container.querySelectorAll(".viz-canvas").length, 1);
		assert.equal(container.querySelectorAll(".viz-figure").length, 1);
		assert.equal(container.querySelector(".viz-grid").style.gridTemplateColumns, "repeat(2, minmax(0, 1fr))");
	});

	it("数据格式错误时先出错误卡，两个分支都不进", () => {
		const container = renderGrid([{ type: "funnel", data: {} }]);
		assert.ok(container.querySelector(".viz-canvas-error"));
		assert.equal(container.querySelector(".viz-canvas"), null);
		assert.equal(container.querySelector(".viz-figure"), null);
	});

	it("UI 注入的片段与导出路径逐字相同", () => {
		for (const isScreen of [false, true]) {
			const container = renderGrid([FUNNEL, BAR], isScreen);
			const expected = renderFigure(
				{ ...FUNNEL, data: normalizeChartData(FUNNEL.data, FUNNEL.type) },
				{ isScreen },
			);
			assert.equal(container.querySelector(".viz-figure").innerHTML, expected, isScreen ? "大屏" : "看板");
			cleanup();
		}
	});
});

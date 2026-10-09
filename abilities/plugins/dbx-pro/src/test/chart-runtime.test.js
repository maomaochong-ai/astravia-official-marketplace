/**
 * chart-runtime — BI 产物 HTML 的内联运行时替换测试
 *
 * 覆盖：CDN 引用被替换为内联库、脚本内容转义、幂等、非 Chart.js 产物原样返回、
 * 以及与 generateHtml 串联后的独立文件形态（离线可渲染）。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateHtml } from "../tools/dbx-chart-collection.ts";
import {
	embedChartJs,
	escapeScriptContent,
	withEmbeddedChartJs,
} from "../shared/utils/chart-runtime.ts";

const CHART = {
	type: "bar",
	title: "渠道分布",
	data: { labels: ["A", "B"], datasets: [{ label: "gmv", data: [60, 40] }] },
};

/** 生成的产物 HTML 里唯一的画布 id，用于确认正文没被替换逻辑破坏。 */
const CDN_MIN = '<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>';
const CDN_PLAIN = '<script src="https://unpkg.com/chart.js@4.4.1/dist/chart.umd.js"></script>';

describe("chart-runtime — 内联替换", () => {
	it("替换 jsdelivr .min 引用，正文与图表脚本保留", () => {
		const standalone = withEmbeddedChartJs(
			`<html><head>${CDN_MIN}</head><body><canvas id="c"></canvas><script>new Chart(1);</script></body></html>`,
		);
		assert.ok(!standalone.includes("cdn.jsdelivr.net"), "不再依赖 CDN");
		assert.ok(!standalone.includes("<script src="), "没有外部脚本引用");
		assert.ok(standalone.includes("Chart.js v4.4.1"), "内联官方运行时版本");
		assert.ok(standalone.includes('<canvas id="c">'), "正文保留");
		assert.ok(standalone.includes("new Chart(1);"), "图表脚本保留");
	});

	it("替换 unpkg 的 chart.umd.js 引用", () => {
		const standalone = withEmbeddedChartJs(`<head>${CDN_PLAIN}</head>`);
		assert.ok(!standalone.includes("unpkg.com"));
		assert.ok(standalone.includes("Chart.js v4.4.1"));
	});

	it("幂等：重复调用结果一致", () => {
		const once = withEmbeddedChartJs(`<head>${CDN_MIN}</head>`);
		assert.equal(withEmbeddedChartJs(once), once);
	});

	it("非 Chart.js 产物原样返回", () => {
		const plain = "<html><body><p>hi</p></body></html>";
		assert.equal(withEmbeddedChartJs(plain), plain);
	});

	it("内联内容里的 </script 被转义，不会提前闭合标签", () => {
		const out = embedChartJs(
			`<head>${CDN_MIN}</head><body><script>new Chart(1);</script></body>`,
			'var x = "</script>";',
		);
		assert.ok(out.includes('<\\/script>'), "转义为 <\\/script>");
		// 闭合标签数量 = 原有正文脚本 1 个 + 内联运行时 1 个
		assert.equal(out.match(/<\/script>/g)?.length, 2);
	});

	it("escapeScriptContent 处理大小写变体", () => {
		assert.equal(escapeScriptContent("a</SCRIPT>b"), "a<\\/SCRIPT>b");
	});
});

describe("chart-runtime — 与 generateHtml 串联", () => {
	it("独立文件：无 CDN 引用、含运行时、保留图表初始化代码", () => {
		const html = generateHtml({ charts: [CHART], title: "渠道看板" });
		const standalone = withEmbeddedChartJs(html);

		assert.ok(html.includes("cdn.jsdelivr.net"), "generateHtml 原文仍是轻量 CDN 引用");
		assert.ok(!standalone.includes("cdn.jsdelivr.net"), "独立文件不再引用 CDN");
		assert.ok(standalone.includes("Chart.js v4.4.1"), "内联运行时");
		assert.ok(
			standalone.includes("new Chart(document.getElementById('chart-0')"),
			"图表初始化代码保留",
		);
		assert.ok(standalone.includes("渠道看板"), "标题保留");
	});

	it("产物内联了运行时缺失时的可见报错", () => {
		const html = generateHtml({ charts: [CHART], title: "看板" });
		assert.ok(html.includes("图表库 Chart.js 未加载"), "运行时检查在 defaults 之前");
	});
});

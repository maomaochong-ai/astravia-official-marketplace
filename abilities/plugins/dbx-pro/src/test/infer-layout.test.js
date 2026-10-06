/**
 * infer-layout 规则引擎测试 —— 单数据源 + 多数据源路径
 *
 * v0.0.94 多数据源路径验证：
 *   - 每个 source 独立跑 inferSchema + chartOptions
 *   - widgets 上 dataSourceId 正确关联到原数据源
 *   - 不同数据源的图表候选不串线（title 相同也能正确归属）
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { inferLayout, inferSchema } from "../features/visualization/components/canvas/infer-layout.ts";

describe("inferLayout — 单数据源（legacy 兼容）", () => {
	it("measures → KPI 卡", () => {
		const spec = inferLayout(
			{ columns: ["total_amount"], rows: [{ total_amount: 1000 }] },
			{ intent: "dashboard" },
		);
		assert.ok(spec.widgets.some((w) => w.kind === "kpi" && w.dataRef === "total_amount"));
		// 单数据源路径不应带 dataSourceId
		assert.ok(spec.widgets.every((w) => w.dataSourceId === undefined));
	});

	it("time + measure → 折线趋势图", () => {
		const rows = [];
		for (let i = 0; i < 30; i++) rows.push({ order_date: `2025-01-${String(i + 1).padStart(2, "0")}`, gmv: 100 + i * 10 });
		const spec = inferLayout(
			{ columns: ["order_date", "gmv"], rows },
			{ intent: "dashboard" },
		);
		assert.ok(spec.widgets.some((w) => w.kind === "line"));
	});
});

describe("inferLayout — v0.0.94 多数据源", () => {
	it("2 个独立数据源各自产出 widget，dataSourceId 正确归属", () => {
		const ds1 = {
			id: "kpi_overview",
			label: "核心指标",
			columns: ["total_orders", "total_amount"],
			rows: [{ total_orders: 500, total_amount: 9999 }],
		};
		const ds2 = {
			id: "daily_trend",
			label: "日趋势",
			columns: ["date", "gmv"],
			rows: [
				{ date: "2025-01-01", gmv: 100 },
				{ date: "2025-01-02", gmv: 200 },
				{ date: "2025-01-03", gmv: 300 },
			],
		};

		const spec = inferLayout({ dataSources: [ds1, ds2] }, { intent: "dashboard" });

		// 每个 widget 都必须带 dataSourceId
		for (const w of spec.widgets) {
			assert.ok(w.dataSourceId, `widget ${w.id}(${w.kind}) 缺少 dataSourceId`);
		}

		// ds1 的 KPI 卡归属 ds1
		const ds1Widgets = spec.widgets.filter((w) => w.dataSourceId === "kpi_overview");
		assert.ok(ds1Widgets.length >= 1, "ds1 应至少产出 1 个 widget");
		assert.ok(ds1Widgets.some((w) => w.kind === "kpi"), "ds1 应产出 KPI 卡");

		// ds2 的折线图归属 ds2
		const ds2Widgets = spec.widgets.filter((w) => w.dataSourceId === "daily_trend");
		assert.ok(ds2Widgets.length >= 1, "ds2 应至少产出 1 个 widget");
		assert.ok(ds2Widgets.some((w) => w.kind === "line"), "ds2 应产出折线图");
	});

	it("相同 title 在不同数据源 → 各自独立 widget，dataSourceId 不串线", () => {
		// 两个数据源都能产出 "明细数据" 表（title 相同），验证不会串线
		const dsA = {
			id: "src_a",
			label: "A",
			columns: ["category", "amount"],
			rows: [{ category: "food", amount: 100 }],
		};
		const dsB = {
			id: "src_b",
			label: "B",
			columns: ["region", "count"],
			rows: [{ region: "east", count: 50 }],
		};

		const spec = inferLayout({ dataSources: [dsA, dsB] }, { intent: "dashboard" });

		const widgetIds = new Set(spec.widgets.map((w) => w.id));
		assert.equal(widgetIds.size, spec.widgets.length, "所有 widget id 唯一");

		// 每个 dataSourceId 至少对应 1 个 widget
		const idsInSpec = new Set(spec.widgets.map((w) => w.dataSourceId));
		assert.ok(idsInSpec.has("src_a"), "src_a 应有 widget");
		assert.ok(idsInSpec.has("src_b"), "src_b 应有 widget");
	});

	it("空 dataSources → fallback 到单数据源路径（不崩）", () => {
		const spec = inferLayout({ dataSources: [], columns: ["x"], rows: [{ x: 1 }] }, { intent: "dashboard" });
		assert.ok(Array.isArray(spec.widgets));
	});

	it("多数据源：KPI 优先排最左上方，line/bar 在下方（packGrid 贪心顺序）", () => {
		const ds1 = { id: "kpi", label: "KPI", columns: ["cnt"], rows: [{ cnt: 42 }] };
		const ds2 = {
			id: "trend",
			label: "Trend",
			columns: ["day", "val"],
			rows: [
				{ day: "d1", val: 1 },
				{ day: "d2", val: 2 },
			],
		};
		const spec = inferLayout({ dataSources: [ds1, ds2] }, { intent: "dashboard" });
		// KPI 应在 line 之上（row 更小）
		const kpi = spec.widgets.find((w) => w.kind === "kpi");
		const line = spec.widgets.find((w) => w.kind === "line");
		if (kpi && line) {
			assert.ok(kpi.row <= line.row, `KPI(row=${kpi.row}) 应在 line(row=${line.row}) 之上或同行`);
		}
	});
});

describe("inferSchema — 列角色推断", () => {
	it("time pattern → time", () => {
		const meta = inferSchema(["order_date"], [{ order_date: "2025-01-01" }]);
		assert.equal(meta[0].role, "time");
	});
	it("count pattern → measure", () => {
		const meta = inferSchema(["order_count"], [{ order_count: 42 }]);
		assert.equal(meta[0].role, "measure");
	});
});

describe("inferLayout — v0.0.100 Gauge 启发式", () => {
	it("bigscreen + 列名 completion_rate → gauge", () => {
		const spec = inferLayout(
			{ columns: ["completion_rate"], rows: [{ completion_rate: 0.85 }] },
			{ intent: "bigscreen" },
		);
		const gauge = spec.widgets.find((w) => w.dataRef === "completion_rate");
		assert.ok(gauge, "completion_rate 应有 widget");
		assert.equal(gauge.kind, "gauge", `应为 gauge 但得到 ${gauge.kind}`);
	});

	it("dashboard + 列名 completion_rate → kpi（Gauge 仅 bigscreen）", () => {
		const spec = inferLayout(
			{ columns: ["completion_rate"], rows: [{ completion_rate: 0.85 }] },
			{ intent: "dashboard" },
		);
		const gauge = spec.widgets.find((w) => w.dataRef === "completion_rate");
		assert.ok(gauge);
		assert.equal(gauge.kind, "kpi", "dashboard 不应生成 gauge，应 fallback kpi");
	});

	it("bigscreen + 值全在 0-1 范围（非 rate 列名）→ gauge", () => {
		const spec = inferLayout(
			{ columns: ["score"], rows: [{ score: 0.72 }, { score: 0.88 }] },
			{ intent: "bigscreen" },
		);
		const w = spec.widgets.find((x) => x.dataRef === "score");
		assert.ok(w);
		assert.equal(w.kind, "gauge", "score 值全在 [0,1] 应触发 gauge");
	});

	it("bigscreen + 正常值（非 rate / 非 0-1 范围）→ kpi", () => {
		const spec = inferLayout(
			{ columns: ["total_amount"], rows: [{ total_amount: 9999 }] },
			{ intent: "bigscreen" },
		);
		const w = spec.widgets.find((x) => x.dataRef === "total_amount");
		assert.ok(w);
		assert.equal(w.kind, "kpi", "9999 绝对值应走 kpi");
	});

	it("rate 列名 regex: coverage, accuracy, percent, pct, ratio, score, rate 都触发", () => {
		const rateNames = ["coverage_rate", "accuracy", "completion_pct", "success_ratio", "percent_done"];
		for (const name of rateNames) {
			const spec = inferLayout(
				{ columns: [name], rows: [{ [name]: 0.9 }] },
				{ intent: "bigscreen" },
			);
			const w = spec.widgets.find((x) => x.dataRef === name);
			assert.equal(w?.kind, "gauge", `${name} 应触发 gauge 但得到 ${w?.kind}`);
		}
	});
});

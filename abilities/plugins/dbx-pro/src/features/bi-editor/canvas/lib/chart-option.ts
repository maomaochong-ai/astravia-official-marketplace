/**
 * chart-option.ts — 把语义层产出的 ChartFrame 折算成 ECharts option（纯函数）。
 *
 * 与渲染器解耦：这里只产出普通对象，Electron / 测试环境都能直接跑，
 * 不需要 DOM、不需要 echarts 实例。真实调色板由 EChart 组件从 CSS 变量读出后传入。
 *
 * 图表类型与开源 BI 的对应关系（Superset ECharts 插件 / Quick BI 图表族）：
 *   趋势 → line / area         对比 → bar（分组 / 堆叠 / 百分比 / 横向）
 *   占比 → pie / donut / treemap   分布 → scatter / boxplot   达成 → gauge
 *   转化 → funnel              流向 → sankey                构成 → waterfall
 *   双轴 → combo               关系 → heatmap
 */

import type { ChartFrame, NumberFormat } from "./chart-spec";
import { formatNumber } from "./chart-spec";

export type StackMode = "none" | "normal" | "percent";

export interface ChartStyle {
	legend: boolean;
	labels: boolean;
	smooth: boolean;
	area: boolean;
	stack: StackMode;
	orientation: "vertical" | "horizontal";
	/** 环形图内半径百分比（0–80）；饼图传 0。 */
	innerRadius: number;
	showGrid: boolean;
	valueFormat: NumberFormat;
	yMin: number | null;
	yMax: number | null;
}

/** 宿主 CSS 变量取不到时的兜底调色板（与画布 TONE / 系列色同色系）。 */
export const FALLBACK_PALETTE = ["#3b82f6", "#f59e0b", "#10b981", "#8b5cf6"];

const FORMATS = new Set<NumberFormat>(["auto", "plain", "thousand", "compact", "percent", "currency"]);

function yes(value: unknown): boolean {
	return value === "yes" || value === true || value === "true";
}

function stackMode(value: unknown): StackMode {
	const raw = typeof value === "string" ? value.trim() : "";
	if (raw === "normal" || raw === "percent") return raw;
	return yes(value) ? "normal" : "none";
}

function finite(value: unknown): number | null {
	const n = Number(value);
	return Number.isFinite(n) ? n : null;
}

export function parseChartStyle(values: Record<string, unknown> = {}): ChartStyle {
	const formatRaw = typeof values.valueFormat === "string" ? (values.valueFormat as NumberFormat) : "auto";
	const inner = finite(values.innerRadius);
	return {
		legend: yes(values.legend),
		labels: yes(values.labels),
		smooth: yes(values.smooth),
		area: yes(values.area),
		stack: stackMode(values.stack),
		orientation: values.orientation === "horizontal" ? "horizontal" : "vertical",
		innerRadius: inner === null ? 0 : Math.min(80, Math.max(0, inner)),
		showGrid: values.showGrid === undefined ? true : yes(values.showGrid),
		valueFormat: FORMATS.has(formatRaw) ? formatRaw : "auto",
		yMin: finite(values.yMin),
		yMax: finite(values.yMax),
	};
}

type Option = Record<string, unknown>;

const AXIS_LABEL = { fontSize: 9, color: "rgba(148,163,184,0.9)" };
const GRID = { left: 30, right: 8, top: 20, bottom: 20, containLabel: false };

/** 单个数值的展示文本（tooltip / 轴标签）。 */
function fmt(n: number, format: NumberFormat): string {
	return formatNumber(n, format);
}

function axisBase(style: ChartStyle, categories: string[]): Option {
	return {
		type: "category",
		data: categories,
		axisLabel: { ...AXIS_LABEL, interval: 0, hideOverlap: true },
		axisLine: { lineStyle: { color: "rgba(148,163,184,0.25)" } },
		axisTick: { show: false },
	};
}

function valueAxis(style: ChartStyle): Option {
	return {
		type: "value",
		min: style.yMin ?? undefined,
		max: style.yMax ?? undefined,
		axisLabel: { ...AXIS_LABEL, formatter: (v: number) => fmt(v, style.valueFormat === "auto" ? "compact" : style.valueFormat) },
		splitLine: { show: style.showGrid, lineStyle: { color: "rgba(148,163,184,0.15)" } },
		axisLine: { show: false },
		axisTick: { show: false },
	};
}

function baseOption(style: ChartStyle, palette: string[]): Option {
	return {
		color: palette,
		animationDuration: 240,
		textStyle: { fontSize: 10 },
		tooltip: {
			trigger: "axis",
			confine: true,
			textStyle: { fontSize: 10 },
			valueFormatter: (v: number) => fmt(Number(v), style.valueFormat),
		},
		legend: style.legend
			? { show: true, top: 0, left: 0, itemWidth: 8, itemHeight: 8, textStyle: { fontSize: 9 } }
			: { show: false },
	};
}

/** 柱 / 条 / 折线 / 面积共用的直角坐标系。 */
function cartesianOption(
	kind: "bar" | "line",
	frame: ChartFrame,
	style: ChartStyle,
	palette: string[],
): Option {
	const horizontal = style.orientation === "horizontal";
	const isLine = kind === "line";
	const categories = frame.categories;
	const stack = style.stack;

	const stackTotal = stack === "percent"
		? categories.map((_, i) => frame.series.reduce((sum, s) => sum + Math.abs(s.data[i] ?? 0), 0) || 1)
		: null;

	const series = frame.series.map((s) => {
		const data = stackTotal ? s.data.map((v, i) => (Math.abs(v) / stackTotal[i]) * 100) : s.data;
		const format: NumberFormat = stack === "percent" ? "percent" : s.format;
		return {
			name: s.name,
			type: isLine ? "line" : "bar",
			stack: stack === "none" ? undefined : "total",
			smooth: isLine ? style.smooth : undefined,
			barMaxWidth: isLine ? undefined : 18,
			barGap: isLine ? undefined : "10%",
			symbol: isLine ? "circle" : undefined,
			symbolSize: isLine ? 3 : undefined,
			lineStyle: isLine ? { width: 1.4 } : undefined,
			areaStyle: isLine && style.area
				? { opacity: stack === "none" ? 0.18 : 0.5 }
				: undefined,
			label: style.labels
				? {
					show: true,
					position: horizontal ? "right" : "top",
					fontSize: 9,
					formatter: (p: { value: number }) => fmt(Number(p.value), format),
				}
				: { show: false },
			data: stack === "percent" ? data.map((v) => Math.round(v * 10) / 10) : data,
		};
	});

	const categoryAxis = axisBase(style, categories);
	const numericAxis = valueAxis(style);
	if (stack === "percent") {
		numericAxis.max = 100;
		numericAxis.axisLabel = { ...AXIS_LABEL, formatter: "{value}%" };
	}

	const base = baseOption(style, palette);
	const tooltip = stack === "percent"
		? { ...(base.tooltip as Option), valueFormatter: (v: number) => `${v}%` }
		: base.tooltip;
	return {
		...base,
		tooltip,
		grid: { ...GRID, left: horizontal ? 46 : 32 },
		xAxis: horizontal ? numericAxis : categoryAxis,
		yAxis: horizontal ? categoryAxis : numericAxis,
		series,
	};
}

/** 饼 / 环：只取第一个度量的构成。 */
function pieOption(frame: ChartFrame, style: ChartStyle, palette: string[]): Option {
	const values = frame.series[0]?.data ?? [];
	const data = frame.categories.map((name, i) => ({ name, value: Math.abs(values[i] ?? 0) }));
	return {
		...baseOption(style, palette),
		tooltip: {
			trigger: "item",
			confine: true,
			textStyle: { fontSize: 10 },
			formatter: (p: { name: string; value: number; percent: number }) =>
				`${p.name}<br/>${fmt(p.value, style.valueFormat)}（${p.percent}%）`,
		},
		series: [{
			type: "pie",
			radius: style.innerRadius > 0 ? [`${Math.max(0, style.innerRadius)}%`, "78%"] : ["8%", "78%"],
			center: ["50%", "54%"],
			avoidLabelOverlap: true,
			itemStyle: { borderWidth: 1, borderColor: "rgba(15,23,42,0.35)" },
			label: {
				show: style.labels,
				fontSize: 9,
				formatter: (p: { name: string; value: number }) => `${p.name}`,
			},
			labelLine: { show: style.labels, length: 4, length2: 4 },
			data,
		}],
	};
}

/** 散点：前两个度量做 x / y；只有一个度量时 x 用序号。 */
function scatterOption(frame: ChartFrame, style: ChartStyle, palette: string[]): Option {
	const [a, b] = frame.series;
	const x = a?.data ?? [];
	const y = b?.data ?? a?.data ?? [];
	const points = x.map((v, i) => [v, y[i] ?? 0]);
	return {
		...baseOption(style, palette),
		grid: { ...GRID, left: 34 },
		xAxis: { ...valueAxis(style), name: a?.name ?? "", nameTextStyle: { fontSize: 9 } },
		yAxis: { ...valueAxis(style), name: b?.name ?? a?.name ?? "", nameTextStyle: { fontSize: 9 } },
		series: [{
			type: "scatter",
			symbolSize: 5,
			itemStyle: { opacity: 0.75 },
			label: style.labels
				? { show: true, position: "right", fontSize: 8, formatter: (p: { dataIndex: number }) => frame.categories[p.dataIndex] ?? "" }
				: { show: false },
			data: points,
		}],
	};
}

/** 雷达：类别做指标轴，每个度量一条折线。 */
function radarOption(frame: ChartFrame, style: ChartStyle, palette: string[]): Option {
	const maxes = frame.categories.map((_, i) =>
		Math.max(1, ...frame.series.map((s) => Math.abs(s.data[i] ?? 0))),
	);
	return {
		...baseOption(style, palette),
		tooltip: { trigger: "item", confine: true, textStyle: { fontSize: 10 } },
		radar: {
			center: ["50%", "55%"],
			radius: "62%",
			indicator: frame.categories.map((name, i) => ({ name, max: maxes[i] })),
			axisName: { fontSize: 8, color: "rgba(148,163,184,0.9)" },
			splitLine: { lineStyle: { color: "rgba(148,163,184,0.18)" } },
			splitArea: { show: false },
		},
		series: [{
			type: "radar",
			symbolSize: 3,
			areaStyle: { opacity: 0.15 },
			data: frame.series.map((s) => ({ name: s.name, value: s.data })),
		}],
	};
}

/** 漏斗：按度量值降序（ECharts funnel 默认按 data 顺序，需显式排）。 */
function funnelOption(frame: ChartFrame, style: ChartStyle, palette: string[]): Option {
	const values = frame.series[0]?.data ?? [];
	const data = frame.categories
		.map((name, i) => ({ name, value: Math.abs(values[i] ?? 0) }))
		.sort((x, y) => y.value - x.value);
	return {
		...baseOption(style, palette),
		tooltip: {
			trigger: "item",
			confine: true,
			textStyle: { fontSize: 10 },
			formatter: (p: { name: string; value: number; percent: number }) =>
				`${p.name}<br/>${fmt(p.value, style.valueFormat)}（${p.percent}%）`,
		},
		series: [{
			type: "funnel",
			left: "6%",
			right: "6%",
			top: 6,
			bottom: 4,
			minSize: "18%",
			sort: "descending",
			gap: 1,
			label: {
				show: true,
				position: "inside",
				fontSize: 9,
				formatter: (p: { name: string; value: number }) => `${p.name} ${fmt(p.value, style.valueFormat)}`,
			},
			data,
		}],
	};
}

/** 仪表：首度量总计，min/max 默认按数据跨度取。 */
function gaugeOption(frame: ChartFrame, style: ChartStyle, palette: string[]): Option {
	const value = frame.total;
	const min = style.yMin ?? 0;
	const max = style.yMax ?? Math.max(1, Math.ceil(Math.abs(value) * 1.2));
	return {
		...baseOption(style, palette),
		legend: { show: false },
		series: [{
			type: "gauge",
			min,
			max,
			startAngle: 210,
			endAngle: -30,
			radius: "86%",
			center: ["50%", "58%"],
			progress: { show: true, width: 8 },
			axisLine: { lineStyle: { width: 8 } },
			axisTick: { show: false },
			splitLine: { show: false },
			axisLabel: { show: false },
			pointer: { show: false },
			detail: {
				valueAnimation: true,
				fontSize: 16,
				offsetCenter: [0, "8%"],
				formatter: (v: number) => fmt(v, style.valueFormat),
			},
			title: {
				fontSize: 9,
				offsetCenter: [0, "62%"],
				color: "rgba(148,163,184,0.9)",
			},
			data: [{ value, name: frame.measureLabel }],
		}],
	};
}

/**
 * 热力：类别形如「维度A / 维度B」，拆成 y / x 两轴。
 * 只有一级维度时退化成单行热力，仍能看出度量强弱。
 */
function heatmapOption(frame: ChartFrame, style: ChartStyle, palette: string[]): Option {
	const values = frame.series[0]?.data ?? [];
	const split = frame.categories.map((c) => c.split(" / "));
	const xs = [...new Set(split.map((p) => p[1] ?? "全部"))];
	const ys = [...new Set(split.map((p) => p[0]))];
	const data = frame.categories.map((_, i) => {
		const [y, x] = [split[i][0], split[i][1] ?? "全部"];
		return [xs.indexOf(x), ys.indexOf(y), values[i] ?? 0];
	});
	const flat = values.filter((v) => Number.isFinite(v));
	const min = flat.length ? Math.min(...flat) : 0;
	const max = flat.length ? Math.max(...flat) : 1;
	return {
		...baseOption(style, palette),
		tooltip: {
			trigger: "item",
			confine: true,
			textStyle: { fontSize: 10 },
			formatter: (p: { value: [number, number, number] }) =>
				`${ys[p.value[1]]} · ${xs[p.value[0]]}<br/>${fmt(p.value[2], style.valueFormat)}`,
		},
		grid: { ...GRID, left: 42, bottom: 24, top: 20 },
		xAxis: { ...axisBase(style, xs), splitArea: { show: true } },
		yAxis: { ...axisBase(style, ys), splitArea: { show: true } },
		visualMap: {
			min,
			max,
			show: false,
			inRange: { color: [palette[0] ?? "#3b82f6", palette[1] ?? "#f59e0b"] },
		},
		series: [{
			type: "heatmap",
			data,
			label: { show: style.labels, fontSize: 8, formatter: (p: { value: [number, number, number] }) => fmt(p.value[2], style.valueFormat) },
			itemStyle: { borderWidth: 1, borderColor: "rgba(15,23,42,0.35)" },
		}],
	};
}

/** 树图：单层面积即度量占比。 */
function treemapOption(frame: ChartFrame, style: ChartStyle, palette: string[]): Option {
	const values = frame.series[0]?.data ?? [];
	return {
		...baseOption(style, palette),
		legend: { show: false },
		tooltip: {
			trigger: "item",
			confine: true,
			textStyle: { fontSize: 10 },
			formatter: (p: { name: string; value: number }) => `${p.name}<br/>${fmt(p.value, style.valueFormat)}`,
		},
		series: [{
			type: "treemap",
			left: 2,
			right: 2,
			top: 2,
			bottom: 2,
			breadcrumb: { show: false },
			roam: false,
			nodeClick: false,
			itemStyle: { borderWidth: 1, borderColor: "rgba(15,23,42,0.35)", gapWidth: 1 },
			label: { show: true, fontSize: 9, overflow: "truncate" },
			data: frame.categories.map((name, i) => ({ name, value: Math.abs(values[i] ?? 0) })),
		}],
	};
}

/** 桑基：类别「来源 / 去向」拆成节点与流向，度量做流量。 */
function sankeyOption(frame: ChartFrame, style: ChartStyle, palette: string[]): Option {
	const values = frame.series[0]?.data ?? [];
	const nodes: { name: string }[] = [];
	const seen = new Set<string>();
	const links: { source: string; target: string; value: number }[] = [];
	frame.categories.forEach((category, i) => {
		const parts = category.split(" / ");
		const [source, target] = parts.length >= 2 ? [parts[0], parts[1]] : ["全部", parts[0] ?? "未分组"];
		for (const name of [source, target]) {
			if (!seen.has(name)) {
				seen.add(name);
				nodes.push({ name });
			}
		}
		links.push({ source, target, value: Math.abs(values[i] ?? 0) });
	});
	return {
		...baseOption(style, palette),
		tooltip: {
			trigger: "item",
			confine: true,
			textStyle: { fontSize: 10 },
			formatter: (p: { data: { source?: string; target?: string; value?: number; name?: string } }) =>
				p.data.source
					? `${p.data.source} → ${p.data.target}<br/>${fmt(p.data.value ?? 0, style.valueFormat)}`
					: (p.data.name ?? ""),
		},
		series: [{
			type: "sankey",
			left: 4,
			right: 4,
			top: 6,
			bottom: 6,
			nodeGap: 6,
			nodeWidth: 8,
			emphasis: { focus: "adjacency" },
			label: { fontSize: 8 },
			lineStyle: { opacity: 0.35, curveness: 0.5 },
			data: nodes,
			links,
		}],
	};
}

/** 瀑布：逐项累加，正负用两条堆叠系列（透明占位 + 实值）。 */
function waterfallOption(frame: ChartFrame, style: ChartStyle, palette: string[]): Option {
	const values = frame.series[0]?.data ?? [];
	let running = 0;
	const base: number[] = [];
	const rise: number[] = [];
	const fall: number[] = [];
	for (const [i, raw] of values.entries()) {
		const v = raw ?? 0;
		// 最后一项按「总计」处理：从 0 画满，不再叠加到前面的累计值上。
		const isTotal = values.length > 1 && i === values.length - 1;
		if (isTotal) {
			base.push(0);
			rise.push(Math.max(0, v));
			fall.push(Math.max(0, -v));
			running = v;
			continue;
		}
		if (v >= 0) {
			base.push(running);
			rise.push(v);
			fall.push(0);
		} else {
			base.push(running + v);
			rise.push(0);
			fall.push(Math.abs(v));
		}
		running += v;
	}
	return {
		...baseOption(style, palette),
		legend: { ...(baseOption(style, palette).legend as Option), show: false },
		grid: { ...GRID, left: 34 },
		xAxis: axisBase(style, frame.categories),
		yAxis: valueAxis(style),
		series: [
			{ name: "占位", type: "bar", stack: "wf", itemStyle: { opacity: 0 }, emphasis: { disabled: true }, data: base },
			{
				name: "增加", type: "bar", stack: "wf", barMaxWidth: 20,
				itemStyle: { color: palette[2] ?? "#10b981" },
				label: { show: style.labels, position: "top", fontSize: 8, formatter: (p: { value: number }) => (p.value ? `+${fmt(p.value, style.valueFormat)}` : "") },
				data: rise,
			},
			{
				name: "减少", type: "bar", stack: "wf", barMaxWidth: 20,
				itemStyle: { color: palette[3] ?? "#8b5cf6" },
				label: { show: style.labels, position: "bottom", fontSize: 8, formatter: (p: { value: number }) => (p.value ? `-${fmt(p.value, style.valueFormat)}` : "") },
				data: fall,
			},
		],
	};
}

/** 双轴组合：首度量柱、次度量线；只有一个度量时全画柱。 */
function comboOption(frame: ChartFrame, style: ChartStyle, palette: string[]): Option {
	const [first, second] = frame.series;
	const secondFormat = second?.format ?? "auto";
	const numericAxis = valueAxis(style);
	return {
		...baseOption(style, palette),
		grid: { ...GRID, left: 34, right: 30 },
		xAxis: axisBase(style, frame.categories),
		yAxis: [
			numericAxis,
			{ ...valueAxis(style), position: "right", splitLine: { show: false }, axisLabel: { ...AXIS_LABEL, formatter: (v: number) => fmt(v, secondFormat === "auto" ? "compact" : secondFormat) } },
		],
		series: [
			{
				name: first?.name ?? "",
				type: "bar",
				barMaxWidth: 18,
				label: style.labels ? { show: true, position: "top", fontSize: 8, formatter: (p: { value: number }) => fmt(Number(p.value), first?.format ?? "auto") } : { show: false },
				data: first?.data ?? [],
			},
			{
				name: second?.name ?? "",
				type: "line",
				yAxisIndex: second ? 1 : 0,
				smooth: style.smooth,
				symbolSize: 4,
				lineStyle: { width: 1.4, color: palette[1] ?? "#f59e0b" },
				itemStyle: { color: palette[1] ?? "#f59e0b" },
				data: second?.data ?? [],
			},
		],
	};
}

/**
 * 按 kind 产出 ECharts option。
 * 未覆盖的类型返回 null，由调用方渲染自己的轻量画法（KPI / 箱线 / 表格）。
 */
export function buildChartOption(
	kind: string,
	frame: ChartFrame,
	style: ChartStyle,
	palette: string[] = FALLBACK_PALETTE,
): Option | null {
	const colors = palette.length > 0 ? palette : FALLBACK_PALETTE;
	switch (kind) {
		case "chart-bar":
			return cartesianOption("bar", frame, style, colors);
		case "chart-line":
		case "chart-area":
			return cartesianOption("line", frame, { ...style, area: kind === "chart-area" ? true : style.area }, colors);
		case "chart-pie":
			return pieOption(frame, { ...style, innerRadius: 0 }, colors);
		case "chart-donut":
			return pieOption(frame, { ...style, innerRadius: Math.max(40, style.innerRadius) }, colors);
		case "chart-scatter":
			return scatterOption(frame, style, colors);
		case "chart-radar":
			return radarOption(frame, style, colors);
		case "chart-funnel":
			return funnelOption(frame, style, colors);
		case "chart-gauge":
			return gaugeOption(frame, style, colors);
		case "chart-heatmap":
			return heatmapOption(frame, style, colors);
		case "chart-treemap":
			return treemapOption(frame, style, colors);
		case "chart-sankey":
			return sankeyOption(frame, style, colors);
		case "chart-waterfall":
			return waterfallOption(frame, style, colors);
		case "chart-combo":
			return comboOption(frame, style, colors);
		default:
			return null;
	}
}

/**
 * 把 option 里写死的兜底色换成宿主实际系列色。
 *
 * option 由纯函数生成，只能拿到常量色；真实色值要从 CSS 变量在运行时读，
 * 所以这里按「兜底色 → 索引」映射，把 color 数组与 series 上显式颜色一起替换。
 */
export function applyPalette(option: Option, palette: string[]): Option {
	const colors = palette.length > 0 ? palette : FALLBACK_PALETTE;
	const swap = (value: unknown): unknown => {
		if (typeof value !== "string") return value;
		const index = FALLBACK_PALETTE.indexOf(value.toLowerCase());
		return index >= 0 ? (colors[index % colors.length] ?? value) : value;
	};
	const swapStyle = (style: unknown): unknown => {
		if (!style || typeof style !== "object") return style;
		const rec = { ...(style as Record<string, unknown>) };
		if ("color" in rec) rec.color = swap(rec.color);
		return rec;
	};
	const next: Option = { ...option, color: colors };
	if (Array.isArray(option.series)) {
		next.series = (option.series as Record<string, unknown>[]).map((s) => {
			const copy: Record<string, unknown> = { ...s };
			if ("itemStyle" in copy) copy.itemStyle = swapStyle(copy.itemStyle);
			if ("lineStyle" in copy) copy.lineStyle = swapStyle(copy.lineStyle);
			return copy;
		});
	}
	return next;
}

/**
 * dbx-bigscreen-builder —— AI skill spec_builder.py 的 TypeScript 对等实现。
 *
 * AI 写紧凑 JSON spec → 本 builder 展开为 ECharts option / HTML 片段 / ChartItem[]。
 * 与 AI skill 的 spec_builder.py 共享同一套设计模式（ADR-0010a）：
 *   ① 紧凑 spec 格式 ② defaults 库驱动展开 ③ per-type handler 路由
 *   ④ pitfall 防呆 ⑤ 命名色板自动应用 ⑥ 布局约束预警 ⑦ 变体支持
 *
 * 目标产物：不是组件 JSON，而是 dbx-pro 的 ChartItem / EChartsOption / HTML。
 */

// ============================================================================
// 类型定义
// ============================================================================

/** 紧凑 spec 风格紧凑 spec。AI 只需要写最少字段。 */
export interface ScreenCompactSpec {
	page?: { name?: string; bg?: string; theme?: "dark" | "light" };
	palette?: ScreenPaletteName;
	components: ScreenCompactComponent[];
}

export type ScreenPaletteName =
	| "tech" | "tech-blue" | "gov" | "biz" | "retro" | "medical" | "financial" | "custom";

export interface ScreenCompactComponent {
	/** 组件类型名：JBar, JLine, JPie, JStatsSummary, JCountTo, JScrollRankingBoard, ... */
	type: string;
	/** 变体：JStatsSummary variant "1"/"2"/"3" / JScrollList variant "1"/"2"/"3" / JDragBorder variant "边框2"/"边框3" */
	variant?: string;
	/** 绝对坐标 [x, y, w, h]（可选，走 CSS Grid 就不要） */
	pos?: [number, number, number, number];
	/** 标题 */
	title?: string;
	/** 组件特有字段（data, text, value, colors, ...） */
	[key: string]: unknown;
}

/** 编译后的产物 */
export interface BuiltComponent {
	kind: "echarts" | "chartjs" | "html" | "error";
	type: string; // 标准化类型：bar, line, pie, gauge, stats-summary, scroll-ranking, ...
	title?: string;
	echartsOption?: Record<string, unknown>;
	chartItem?: Record<string, unknown>;
	html?: string;
	warnings?: string[];
}

/** dbx builder 输入（palette 可选，默认 tech 深色） */
export interface DbxBigscreenBuilderInput {
	spec: ScreenCompactSpec;
	engine?: "echarts" | "chartjs"; // 默认 echarts
}

// ============================================================================
// Palettes —— 命名色板（5 套命名色板）
// ============================================================================

export interface Palette {
	title: string; subtitle: string; label: string; value: string;
	axis: string; axisLine: string; gridline: string;
	tooltipBg: string; tooltipTxt: string;
	colors: string[];
}

const PALETTES: Record<ScreenPaletteName, Palette> = {
	tech: { // 科技深色
		title: "#f0c040", subtitle: "#00d4ff", label: "#ffffff", value: "#d4e8ff",
		axis: "#8ab8d0", axisLine: "#1a3a5a", gridline: "#1a3a5a55",
		tooltipBg: "#0b1e3acc", tooltipTxt: "#e0f0ff",
		colors: ["#00d4ff", "#f0c040", "#ff6b6b", "#7ee8a2", "#ffa726", "#8ab8d0", "#00ffc8", "#d4a6ff"],
	},
	gov: { // 政务深空蓝 + 金
		title: "#ffd700", subtitle: "#00d4ff", label: "#ffffff", value: "#d4e8ff",
		axis: "#5a7a9a", axisLine: "#0a1a2a", gridline: "#1a3a5a44",
		tooltipBg: "#0a1a2acc", tooltipTxt: "#e0f0ff",
		colors: ["#ffd700", "#00d4ff", "#1e90ff", "#4169e1", "#6495ed", "#87ceeb", "#b0c4de", "#dda0dd"],
	},
	biz: { // 商务深空蓝 + 青
		title: "#00bcd4", subtitle: "#26c6da", label: "#e0f7fa", value: "#b2ebf2",
		axis: "#4dd0e1", axisLine: "#006064", gridline: "#00838f44",
		tooltipBg: "#004d4dcc", tooltipTxt: "#e0f7fa",
		colors: ["#00bcd4", "#26c6da", "#4dd0e1", "#00acc1", "#0097a7", "#00838f", "#80deea", "#b2ebf2"],
	},
	retro: { // 复古暗红 + 金
		title: "#ffd700", subtitle: "#ff8c00", label: "#2d1810", value: "#4a2c1e",
		axis: "#8b6914", axisLine: "#3d2914", gridline: "#5a3a2a44",
		tooltipBg: "#2d1810cc", tooltipTxt: "#ffe0b2",
		colors: ["#8b0000", "#ff4500", "#ff8c00", "#ffd700", "#b8860b", "#cd853f", "#deb887", "#daa520"],
	},
	medical: { // 医疗深绿 + 白
		title: "#4caf50", subtitle: "#8bc34a", label: "#ffffff", value: "#e8f5e9",
		axis: "#81c784", axisLine: "#1b5e20", gridline: "#2e7d3244",
		tooltipBg: "#1b5e20cc", tooltipTxt: "#e8f5e9",
		colors: ["#4caf50", "#8bc34a", "#cddc39", "#00bcd4", "#ffffff", "#81c784", "#a5d6a7", "#c8e6c9"],
	},
	financial: { // 金融深蓝 + 金
		title: "#ffc107", subtitle: "#ff9800", label: "#ffffff", value: "#e3f2fd",
		axis: "#64b5f6", axisLine: "#0d47a1", gridline: "#1565c044",
		tooltipBg: "#0d47a1cc", tooltipTxt: "#bbdefb",
		colors: ["#ffc107", "#ff9800", "#ff5722", "#0d47a1", "#1976d2", "#2196f3", "#64b5f6", "#90caf9"],
	},
	"tech-blue": { title: "#00d4ff", subtitle: "#0099cc", label: "#ffffff", value: "#e0f7ff", axis: "#80c8ff", axisLine: "#003355", gridline: "#00446644", tooltipBg: "#002244cc", tooltipTxt: "#c0e8ff", colors: ["#00d4ff", "#0099cc", "#006699", "#00ccff", "#00ffff", "#80d4ff", "#c0e8ff", "#ffffff"] },
	custom: { title: "#f0c040", subtitle: "#00d4ff", label: "#ffffff", value: "#d4e8ff", axis: "#8ab8d0", axisLine: "#1a3a5a", gridline: "#1a3a5a55", tooltipBg: "#0b1e3acc", tooltipTxt: "#e0f0ff", colors: ["#00d4ff", "#f0c040", "#ff6b6b", "#7ee8a2", "#ffa726", "#8ab8d0", "#00ffc8", "#d4a6ff"] },
};

// ============================================================================
// 组件 → ECharts component type mapping
// ============================================================================

/** ECharts 可渲染的组件类型集合。不在此集合里的 → 降级处理。 */
const ECHARTS_CARTESIAN = new Set([
	"JBar", "JStackBar", "JMultipleBar", "JNegativeBar", "JPercentBar",
	"JLine", "JSmoothLine", "JStepLine", "JArea", "JMultipleLine",
	"JScatter", "JBubble", "JQuadrant",
]);

const ECHARTS_POLAR = new Set([
	"JPie", "JRose", "JRotatePie", "JRing", "JBreakRing", "JActiveRing",
	"JRadar", "JCircleRadar", "JFunnel", "JPyramidFunnel",
]);

const ECHARTS_GAUGE = new Set(["JGauge", "JSemiGauge", "JColorGauge", "JAntvGauge"]);
const ECHARTS_MAP = new Set(["JFlyLineMap", "JAreaMap", "JBubbleMap", "JBarMap"]);

/** HTML 自包含组件（不进 ECharts，由 builder 生成 div） */
const HTML_COMPONENTS = new Set([
	"JText", "JDragDecoration", "JDragBorder",
	"JCountTo", "JNumber", "JStatsSummary",
	"JScrollBoard", "JScrollTable", "JScrollList",
	"JCapsuleChart", "JListProgress",
]);
// 注意：JScrollRankingBoard 走 ECharts bar（自动排序 + 截断前 N），不走 HTML_COMPONENTS

/** 组件 → ECharts series type 映射 */
const COMPONENT_TO_ECHARTS_TYPE: Record<string, string> = {
	// Cartesian
	JBar: "bar", JStackBar: "bar", JMultipleBar: "bar", JNegativeBar: "bar", JPercentBar: "bar",
	JLine: "line", JSmoothLine: "line", JStepLine: "line", JArea: "line", JMultipleLine: "line",
	JScatter: "scatter", JBubble: "scatter", JQuadrant: "scatter",
	// Polar
	JPie: "pie", JRose: "pie", JRotatePie: "pie", JRing: "pie", JBreakRing: "pie", JActiveRing: "pie",
	JRadar: "radar", JCircleRadar: "radar",
	JFunnel: "funnel", JPyramidFunnel: "funnel",
	// Gauge
	JGauge: "gauge", JSemiGauge: "gauge", JColorGauge: "gauge", JAntvGauge: "gauge",
};

const CITY_COORDS: Record<string, [number, number]> = {
	北京: [116.4074, 39.9042], 上海: [121.4737, 31.2304], 深圳: [114.0579, 22.5431],
	广州: [113.2644, 23.1291], 杭州: [120.1551, 30.2741], 成都: [104.0657, 30.6586],
	武汉: [114.2734, 30.5801], 西安: [108.9541, 34.2658], 重庆: [106.5049, 29.5331],
	天津: [117.1901, 39.0851], 南京: [118.7969, 32.0603], 苏州: [120.5853, 31.2990],
	青岛: [120.3826, 36.0671], 大连: [121.6147, 38.9140],
};

// ============================================================================
// Pitfall 防呆
// ============================================================================

function pitfallFix(comp: ScreenCompactComponent): { comp: ScreenCompactComponent; warnings: string[] } {
	const warnings: string[] = [];
	const c = { ...comp };

	// 1. 字段名兼容：label → name（紧凑 spec 里 label 和 name 混用）
	if ((c as Record<string, unknown>).label !== undefined && c.type && ECHARTS_CARTESIAN.has(c.type)) {
		if ((c as Record<string, unknown>).name === undefined) {
			(c as Record<string, unknown>).name = (c as Record<string, unknown>).label;
			warnings.push(`字段 label 自动修正为 name`);
		}
	}

	// 2. 颜色格式：#rgb 缩写 → #rrggbb
	if (typeof c.color === "string" && /^#[0-9a-fA-F]{3}$/.test(c.color)) {
		c.color = "#" + c.color.slice(1).split("").map(x => x + x).join("");
		warnings.push(`颜色 ${comp.color} → ${c.color}（缩写展开）`);
	}

	// 3. 饼图 pitfall：没有 xAxis/yAxis，如果用户加了 → 警告
	if (c.type && ECHARTS_POLAR.has(c.type)) {
		if ((c as Record<string, unknown>).xAxis || (c as Record<string, unknown>).yAxis) {
			warnings.push(`${c.type} 不需要 xAxis/yAxis，将被忽略`);
		}
	}

	// 4. 百分比 width → 0（pitfall：AI 写 width: "100%" 到 option.grid）
	const opt = (c as Record<string, unknown>).options as Record<string, unknown> | undefined;
	if (opt && opt.grid) {
		const grid = opt.grid as Record<string, unknown>;
		for (const k of ["width", "height"]) {
			const v = grid[k];
			if (typeof v === "string" && v.endsWith("%")) {
				warnings.push(`grid.${k}: "${v}" 百分比字符串无效 → 移除（用 containLabel:true）`);
				delete grid[k];
			}
		}
	}

	return { comp: c, warnings };
}

function layoutAdvisor(comp: ScreenCompactComponent): string[] {
	const warnings: string[] = [];
	const h = comp.pos?.[3];

	// 饼图 h < 220 可能图例重叠
	if (h && h < 220 && ECHARTS_POLAR.has(comp.type)) {
		warnings.push(`⚠️ ${comp.type} 高度 ${h} < 220px，饼图图例可能重叠。建议 pos[3] ≥ 240`);
	}
	// 仪表盘 h < 180
	if (h && h < 180 && ECHARTS_GAUGE.has(comp.type)) {
		warnings.push(`⚠️ ${comp.type} 高度 ${h} < 180px，仪表盘显示可能不全`);
	}
	return warnings;
}

// ============================================================================
// Handlers —— 核心：紧凑 spec → ECharts option
// ============================================================================

/** 从 data 数组推断 ECharts data 格式 */
function inferEChartsData(data: unknown[]): { labels: string[]; seriesData: unknown[] } {
	if (!data || data.length === 0) return { labels: [], seriesData: [] };

	// [{name, value}] 格式（紧凑 spec 标准）
	if (typeof data[0] === "object" && data[0] !== null && ("name" in (data[0] as object) || "value" in (data[0] as object))) {
		const d = data as Array<Record<string, unknown>>;
		return {
			labels: d.map(x => String(x.name ?? x.label ?? "未知")),
			seriesData: d.map(x => x.value ?? x.data ?? 0),
		};
	}
	// 裸数组 [1,2,3,...]
	if (typeof data[0] === "number") {
		return { labels: data.map((_, i) => String(i + 1)), seriesData: data };
	}
	return { labels: [], seriesData: data };
}

/** Cartesian 族 handler：JBar/JLine/JScatter 等 */
function handleCartesian(comp: ScreenCompactComponent, palette: Palette): Record<string, unknown> {
	const type = COMPONENT_TO_ECHARTS_TYPE[comp.type] ?? "bar";
	const { labels, seriesData } = inferEChartsData(comp.data as unknown[]);
	const colors = (comp.colors as string[]) ?? palette.colors;

	const option: Record<string, unknown> = {
		tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
		grid: { left: 50, right: 20, top: 40, bottom: 30, containLabel: true },
		legend: { top: 8, right: 10, textStyle: { color: palette.label } },
		xAxis: {
			type: "category", data: labels,
			axisLine: { lineStyle: { color: palette.axisLine } },
			axisLabel: { color: palette.axis },
			splitLine: { show: false },
		},
		yAxis: {
			type: "value",
			axisLine: { show: false },
			axisLabel: { color: palette.axis },
			splitLine: { lineStyle: { color: palette.gridline } },
		},
		series: [{
			type,
			name: comp.title ?? "数据",
			data: seriesData,
			itemStyle: { color: colors[0] ?? palette.colors[0] },
			barMaxWidth: 40,
			smooth: ["JLine", "JSmoothLine", "JMultipleLine"].includes(comp.type),
			areaStyle: ["JArea"].includes(comp.type) ? {} : undefined,
		}],
	};

	// stack（堆叠）
	if (comp.type === "JStackBar") {
		(option.series as Array<Record<string, unknown>>)[0].stack = "total";
	}
	// horizontal bar（横向）
	if (comp.type === "JHorizontalBar") {
		option.xAxis = { type: "value", axisLine: { show: false }, axisLabel: { color: palette.axis }, splitLine: { lineStyle: { color: palette.gridline } } };
		option.yAxis = { type: "category", data: labels, axisLine: { lineStyle: { color: palette.axisLine } }, axisLabel: { color: palette.axis } };
	}

	return option;
}

/** Polar 族 handler：JPie/JRing/JRose/JRadar/JFunnel */
function handlePolar(comp: ScreenCompactComponent, palette: Palette): Record<string, unknown> {
	const { labels, seriesData } = inferEChartsData(comp.data as unknown[]);
	const colors = (comp.colors as string[]) ?? palette.colors;
	const type = COMPONENT_TO_ECHARTS_TYPE[comp.type] ?? "pie";

	const option: Record<string, unknown> = {
		tooltip: { trigger: "item", backgroundColor: palette.tooltipBg, textStyle: { color: palette.tooltipTxt } },
		legend: { top: 8, right: 10, textStyle: { color: palette.label } },
		color: colors,
		series: [{
			type,
			name: comp.title ?? "数据",
			data: labels.map((name, i) => ({ name, value: seriesData[i] })),
		}],
	};

	if (comp.type === "JRadar" || comp.type === "JCircleRadar") {
		option.radar = { indicator: labels.map(name => ({ name, max: 100 })) };
		(option.series as Array<Record<string, unknown>>)[0].data = [{ value: seriesData, name: comp.title ?? "" }];
		option.series = [{
			type: "radar",
			name: comp.title ?? "",
			data: [{ value: seriesData, name: comp.title ?? "" }],
			areaStyle: { opacity: 0.2 },
		}];
	}
	if (comp.type === "JRing" || comp.type === "JBreakRing") {
		(option.series as Array<Record<string, unknown>>)[0].radius = ["40%", "70%"];
	}
	if (comp.type === "JRose") {
		(option.series as Array<Record<string, unknown>>)[0].roseType = "area";
	}

	return option;
}

/** JGauge 族 handler */
function handleGauge(comp: ScreenCompactComponent, palette: Palette): Record<string, unknown> {
	const value = (comp.value as number) ?? 0;
	const max = (comp.max as number) ?? 100;
	const isSemi = comp.type === "JSemiGauge";

	const option: Record<string, unknown> = {
		series: [{
			type: "gauge",
			startAngle: isSemi ? 200 : 220,
			endAngle: isSemi ? -20 : -40,
			min: 0, max,
			progress: { show: true, width: 12, itemStyle: { color: palette.colors[0] } },
			axisLine: { lineStyle: { width: 12, color: [[1, palette.axisLine]] } },
			axisTick: { show: false },
			splitLine: { show: true, length: 8, lineStyle: { color: palette.axis } },
			axisLabel: { color: palette.label, fontSize: 10, distance: 20 },
			pointer: { show: true, width: 4, itemStyle: { color: palette.colors[0] } },
			anchor: { show: true, size: 12, itemStyle: { color: palette.colors[0] } },
			title: { show: true, offsetCenter: [0, "70%"], color: palette.label, fontSize: 13 },
			detail: { offsetCenter: [0, "45%"], color: palette.title, fontSize: 28, fontWeight: "bold" },
			data: [{ value, name: comp.title ?? "" }],
		}],
	};
	return option;
}

/** JScrollRankingBoard → ECharts bar（自动排序 + 截断前 N）*/
function handleScrollRanking(comp: ScreenCompactComponent, palette: Palette): Record<string, unknown> {
	const raw = (comp.data as Array<Record<string, unknown>>) ?? [];
	const rowNum = (comp.rowNum as number) ?? raw.length;
	const sorted = [...raw].sort((a, b) => (b.value as number) - (a.value as number)).slice(0, rowNum);

	return handleCartesian({ ...comp, data: sorted } as ScreenCompactComponent, palette);
}

// ============================================================================
// HTML 组件 handlers
// ============================================================================

function handleJText(comp: ScreenCompactComponent, palette: Palette): string {
	const text = (comp.text as string) ?? comp.title ?? "";
	const style = (comp.style as string) ?? "normal";
	const color = (comp.color as string) ?? (style === "title" ? palette.title : palette.label);
	const fontSize = style === "title" ? 20 : style === "subtitle" ? 16 : 14;
	return `<div style="color:${color};font-size:${fontSize}px;font-weight:${style === "title" || style === "subtitle" ? 600 : 400};line-height:1.4;">${text}</div>`;
}

function handleJCountTo(comp: ScreenCompactComponent, palette: Palette): string {
	const value = (comp.value as number) ?? 0;
	const title = comp.title ?? "";
	const suffix = (comp.suffix as string) ?? "";
	const color = (comp.color as string) ?? palette.title;
	return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:12px;">
<span style="font-size:36px;font-weight:700;color:${color};font-variant-numeric:tabular-nums;">${value.toLocaleString()}${suffix}</span>
${title ? `<span style="font-size:13px;color:${palette.label};opacity:0.85;">${title}</span>` : ""}
</div>`;
}

function handleJStatsSummary(comp: ScreenCompactComponent, palette: Palette): string {
	const variant = comp.variant ?? "1";
	const items = (comp.items ?? comp.data ?? []) as Array<{ label: string; value: number | string; suffix?: string; trend?: string }>;

	if (variant === "2") {
		// 横向滚动统计条
		const html = items.map(it => `
<div style="flex:1;text-align:center;padding:12px 8px;border-right:1px solid ${palette.axisLine};">
<div style="font-size:24px;font-weight:700;color:${palette.title};">${it.value}${it.suffix ?? ""}</div>
<div style="font-size:12px;color:${palette.label};opacity:0.8;">${it.label}</div>
${it.trend ? `<div style="font-size:11px;color:${it.trend.startsWith("+") ? "#7ee8a2" : "#ff6b6b"};">${it.trend}</div>` : ""}
</div>`).join("");
		return `<div style="display:flex;width:100%;border:1px solid ${palette.axisLine};border-radius:8px;background:rgba(0,0,0,0.02);">${html}</div>`;
	}

	// variant 1 / 3：竖向列表
	const html = items.map(it => `
<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 12px;border-bottom:1px solid ${palette.axisLine};">
<span style="font-size:13px;color:${palette.label};">${it.label}</span>
<span style="font-size:16px;font-weight:600;color:${palette.value};font-variant-numeric:tabular-nums;">${it.value}${it.suffix ?? ""}</span>
</div>`).join("");
	return `<div style="width:100%;border:1px solid ${palette.axisLine};border-radius:8px;overflow:hidden;background:rgba(0,0,0,0.02);">${html}</div>`;
}

function handleJScrollBoard(comp: ScreenCompactComponent, palette: Palette): string {
	const title = comp.title ?? "";
	const headers = (comp.headers as string[]) ?? (comp.data && (comp.data as Record<string, unknown>).columns as string[]) ?? [];
	const rows = (comp.rows ?? comp.data ?? []) as unknown[][];

	const headHtml = headers.map(h => `<th style="padding:8px 12px;font-size:12px;color:${palette.label};font-weight:600;text-align:left;background:${palette.axisLine};">${h}</th>`).join("");
	const rowHtml = rows.slice(0, 10).map((r, i) => {
		const td = (r as unknown[]).map(c => `<td style="padding:6px 12px;font-size:12px;color:${palette.value};border-top:1px solid ${palette.axisLine};">${c}</td>`).join("");
		return `<tr>${td}</tr>`;
	}).join("");

	return `<div style="width:100%;border:1px solid ${palette.axisLine};border-radius:8px;overflow:hidden;">
${title ? `<div style="padding:8px 12px;background:${palette.axisLine};color:${palette.title};font-size:13px;font-weight:600;">${title}</div>` : ""}
<table style="width:100%;border-collapse:collapse;">
<thead><tr>${headHtml}</tr></thead>
<tbody>${rowHtml}</tbody>
</table>
</div>`;
}

// ============================================================================
// 主编译入口
// ============================================================================

/** 编译一个大屏紧凑组件 → BuiltComponent */
function compileComponent(comp: ScreenCompactComponent, palette: Palette, engine: "echarts" | "chartjs"): BuiltComponent {
	const result: BuiltComponent = { kind: "echarts", type: comp.type, title: comp.title };
	const warnings: string[] = [];

	// pitfall 防呆
	const fixed = pitfallFix(comp);
	warnings.push(...fixed.warnings);

	// 布局预警
	warnings.push(...layoutAdvisor(fixed.comp));

	const type = fixed.comp.type;

	try {
		// 1. HTML 组件
		if (HTML_COMPONENTS.has(type)) {
			result.kind = "html";
			if (type === "JText") result.html = handleJText(fixed.comp, palette);
			else if (type === "JCountTo" || type === "JNumber") result.html = handleJCountTo(fixed.comp, palette);
			else if (type === "JStatsSummary") result.html = handleJStatsSummary(fixed.comp, palette);
			else if (type === "JScrollBoard" || type === "JScrollTable") result.html = handleJScrollBoard(fixed.comp, palette);
			else if (type === "JDragDecoration") result.html = `<div style="text-align:center;color:${palette.subtitle};font-size:28px;">◆</div>`;
			else result.html = `<div style="color:${palette.label};font-size:13px;padding:12px;border:1px dashed ${palette.axisLine};border-radius:6px;">${type}（HTML 组件待完善）</div>`;
			result.warnings = warnings;
			return result;
		}

		// 2. ECharts 组件
		let echartsOpt: Record<string, unknown>;
		if (ECHARTS_CARTESIAN.has(type)) {
			echartsOpt = handleCartesian(fixed.comp, palette);
		} else if (ECHARTS_POLAR.has(type)) {
			echartsOpt = handlePolar(fixed.comp, palette);
		} else if (ECHARTS_GAUGE.has(type)) {
			echartsOpt = handleGauge(fixed.comp, palette);
		} else if (type === "JScrollRankingBoard") {
			echartsOpt = handleScrollRanking(fixed.comp, palette);
		} else if (ECHARTS_MAP.has(type)) {
			result.kind = "error";
			result.warnings = [...warnings, `⚠️ ${type} 需要中国 GeoJSON 地图数据，暂不支持。建议换 JBar/JPie/JScatter 组合`];
			return result;
		} else {
			result.kind = "error";
			result.warnings = [...warnings, `⚠️ ${type} 未实现对等 handler。建议换已支持的组件类型`];
			return result;
		}

		// 应用 theme 到 option（整屏 palette）
		if (!echartsOpt.backgroundColor) echartsOpt.backgroundColor = "transparent";

		result.echartsOption = echartsOpt;
		result.warnings = warnings;
		return result;
	} catch (err) {
		result.kind = "error";
		result.warnings = [...warnings, `❌ 编译失败: ${(err as Error).message}`];
		return result;
	}
}

/** 主入口：编译整个 spec → BuiltComponent[] */
export function dbxBigscreenBuilder(input: DbxBigscreenBuilderInput): BuiltComponent[] {
	const { spec, engine = "echarts" } = input;
	const paletteName = spec.palette ?? spec.page?.bg as ScreenPaletteName ?? "tech";
	const palette = PALETTES[paletteName] ?? PALETTES.tech;

	const results: BuiltComponent[] = [];
	for (const comp of spec.components) {
		results.push(compileComponent(comp, palette, engine));
	}
	return results;
}

/** 便捷：直接生成完整 HTML 大屏（走现有 dbx_chart_collection 生成链路） */
export function buildBigscreenHtml(input: DbxBigscreenBuilderInput): string {
	const built = dbxBigscreenBuilder(input);

	// 转成 ChartItem[] → 调 dbx_chart_collection generateHtml
	// 但这里先不依赖 dbx_chart_collection，独立输出 HTML
	const componentsHtml: string[] = [];
	const componentsJs: string[] = [];

	built.forEach((b, i) => {
		const height = 280;
		if (b.kind === "html") {
			componentsHtml.push(`<div class="chart-card"><h3>${b.title ?? `组件 ${i + 1}`}</h3><div style="height:${height}px;">${b.html}</div></div>`);
			componentsJs.push(`/* comp-${i} html */`);
		} else if (b.kind === "echarts" && b.echartsOption) {
			const id = `comp-${i}`;
			componentsHtml.push(`<div class="chart-card"><h3>${b.title ?? `组件 ${i + 1}`}</h3><div id="${id}" style="width:100%;height:${height}px;"></div></div>`);
			componentsJs.push(`(function(){var d=document.getElementById('${id}');var c=echarts.init(d,'dbx-dark');c.setOption(${JSON.stringify(b.echartsOption)});window.addEventListener('resize',function(){c.resize();});})();`);
		} else if (b.kind === "error") {
			const msg = b.warnings?.join("; ") ?? "未知错误";
			componentsHtml.push(`<div class="chart-card chart-error"><h3>${b.title ?? `组件 ${i + 1}`}</h3><div style="height:${height}px;padding:16px;color:#ef4444;background:#fef2f2;border:1px dashed #fecaca;border-radius:8px;">⚠️ ${msg}</div></div>`);
			componentsJs.push(`/* comp-${i} error */`);
		}
	});

	return componentsHtml.join("") + `\n<script>\n${componentsJs.join("\n")}\n</script>`;
}

/** 导出 palette 方便外部使用 */
export function getPalette(name: ScreenPaletteName = "tech"): Palette {
	return PALETTES[name] ?? PALETTES.tech;
}

/** 列出所有已支持的组件类型 */
export function listSupportedTypes(): { echarts: string[]; html: string[]; error: string[] } {
	return {
		echarts: [...ECHARTS_CARTESIAN, ...ECHARTS_POLAR, ...ECHARTS_GAUGE, "JScrollRankingBoard"],
		html: [...HTML_COMPONENTS],
		error: [...ECHARTS_MAP],
	};
}

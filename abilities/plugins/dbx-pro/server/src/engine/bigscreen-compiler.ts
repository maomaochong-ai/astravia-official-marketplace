/**
 * bigscreen-compiler —— 紧凑 spec → 大屏组件 JSON
 *
 * 与 AI skill (spec_builder.py) 同构：
 *   AI 输出紧凑 JSON spec → compile_component 分发 → SPECIAL_HANDLERS / 通用路径
 *   → load defaults/*.json → 合并 chartData → 应用 ECharts theme → 返回完整组件 JSON
 *
 * 组件 JSON 结构对齐 dbx 默认配置（大屏模式）：
 *   { w, h, dataType, chartData, option, chart: { subclass, category },
 *     url, timeOut, turnConfig, linkType, linkageConfig, markLineConfig, dataMapping,
 *     background, borderColor }
 *
 * 为什么不返回 HTML：主流程是"组件 JSON → 存储 → 前端 ECharts 渲染"，
 * generateBigscreenHtml() 保留作调试/预览工具（不是主流程）。
 */

// ============ Defaults 内联（单一 bundle JSON）============
// agent/skills/dbx-pro-bigscreen/scripts/defaults/*.json 由 bundle-defaults.mjs 先修复
// （AI skill Python 导出含 4 引号/三引号/None 等非标准 JSON）打包成
// references/defaults/_defaults-bundle.json，再 esbuild JSON loader 内联进 bundle。
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — ESM JSON import
import _DEFAULTS_BUNDLE from "../../../agent/skills/dbx-pro-bigscreen/references/defaults/_defaults-bundle.json";

const DEFAULTS_MAP = _DEFAULTS_BUNDLE;

/** defaults 深拷贝缓存（JeecgBoot 同策略）。 */
const DEFAULTS_CACHE = new Map();

function loadDef(compKey) {
	let cached = DEFAULTS_CACHE.get(compKey);
	if (cached === undefined) {
		const raw = DEFAULTS_MAP[compKey];
		if (!raw) { cached = null; DEFAULTS_CACHE.set(compKey, null); return null; }
		cached = raw;
		DEFAULTS_CACHE.set(compKey, cached);
	}
	if (!cached) return null;
	return JSON.parse(JSON.stringify(cached)); // 深拷贝防污染
}

// ============ Palettes（扩展到 6 套，JeecgBoot 只有 1 套 bg4）============
type Palette = { title: string; subtitle: string; label: string; value: string; axis: string; axisLine: string; gridline: string; tooltipBg: string; tooltipTxt: string; colors: string[] };

const PALETTES: Record<string, Palette> = {
	tech:     { title: "#f0c040", subtitle: "#00d4ff", label: "#ffffff", value: "#d4e8ff", axis: "#8ab8d0", axisLine: "#1a3a5a", gridline: "#1a3a5a55", tooltipBg: "#0b1e3acc", tooltipTxt: "#e0f0ff", colors: ["#00d4ff","#f0c040","#ff6b6b","#7ee8a2","#ffa726","#8ab8d0","#00ffc8","#d4a6ff"] },
	gov:      { title: "#ffd700", subtitle: "#00d4ff", label: "#ffffff", value: "#d4e8ff", axis: "#5a7a9a", axisLine: "#0a1a2a", gridline: "#1a3a5a44", tooltipBg: "#0a1a2acc", tooltipTxt: "#e0f0ff", colors: ["#ffd700","#00d4ff","#1e90ff","#4169e1","#6495ed","#87ceeb","#b0c4de","#dda0dd"] },
	biz:      { title: "#00bcd4", subtitle: "#26c6da", label: "#e0f7fa", value: "#b2ebf2", axis: "#4dd0e1", axisLine: "#006064", gridline: "#00838f44", tooltipBg: "#004d4dcc", tooltipTxt: "#e0f7fa", colors: ["#00bcd4","#26c6da","#4dd0e1","#00acc1","#0097a7","#00838f","#80deea","#b2ebf2"] },
	retro:    { title: "#ffd700", subtitle: "#ff8c00", label: "#2d1810", value: "#4a2c1e", axis: "#8b6914", axisLine: "#3d2914", gridline: "#5a3a2a44", tooltipBg: "#2d1810cc", tooltipTxt: "#ffe0b2", colors: ["#8b0000","#ff4500","#ff8c00","#ffd700","#b8860b","#cd853f","#deb887","#daa520"] },
	medical:  { title: "#4caf50", subtitle: "#8bc34a", label: "#ffffff", value: "#e8f5e9", axis: "#81c784", axisLine: "#1b5e20", gridline: "#2e7d3244", tooltipBg: "#1b5e20cc", tooltipTxt: "#e8f5e9", colors: ["#4caf50","#8bc34a","#cddc39","#00bcd4","#ffffff","#81c784","#a5d6a7","#c8e6c9"] },
	financial:{ title: "#ffc107", subtitle: "#ff9800", label: "#ffffff", value: "#e3f2fd", axis: "#64b5f6", axisLine: "#0d47a1", gridline: "#1565c044", tooltipBg: "#0d47a1cc", tooltipTxt: "#bbdefb", colors: ["#ffc107","#ff9800","#ff5722","#0d47a1","#1976d2","#2196f3","#64b5f6","#90caf9"] },
};
PALETTES.dark = PALETTES.tech;  // 别名
PALETTES.bg4  = PALETTES.tech;  // 兼容 JeecgBoot 的 bg4
PALETTES.light = { ...PALETTES.biz };

// ============ 组件分类（完整对标 bi-component-types.md）============
// 轴类图表（ECharts cartesian，需 xAxis/yAxis 主题注入）
const ECHARTS_CARTESIAN = new Set([
	"JBar","JStackBar","JHorizontalBar","JBackgroundBar","JDynamicBar",
	"JMultipleBar","JNegativeBar","JPercentBar","JMixLineBar",
	"JLine","JSmoothLine","JStepLine","JArea","JMultipleLine","DoubleLineBar",
	"JScatter","JQuadrant","JBubble",
]);
// 极坐标图表（无 xAxis/yAxis）
const ECHARTS_POLAR = new Set([
	"JPie","JRose","JRotatePie","JRing","JBreakRing","JActiveRing",
	"JRadialBar","JRadar","JCircleRadar","JFunnel","JPyramidFunnel",
]);
// 仪表盘
const ECHARTS_GAUGE = new Set(["JGauge","JColorGauge","JAntvGauge","JSemiGauge"]);
// 地图（需 GeoJSON → dbx-pro 用 ECharts map 系列 + registerMap）
const ECHARTS_MAP = new Set(["JBubbleMap","JFlyLineMap","JBarMap","JTotalFlyLineMap","JTotalBarMap","JHeatMap","JAreaMap","JGaoDeMap"]);
// 3D
const ECHARTS_3D = new Set(["JBar3d","JBarGroup3d","JPyramid3D"]);
// 进度图
const PROGRESS_COMPS = new Set(["JCustomProgress","JProgress","JListProgress","JRoundProgress","JLiquid","JCapsuleChart","JRingProgress"]);
// 表格
const TABLE_COMPS = new Set(["JScrollBoard","JScrollTable","JScrollList","JScrollRankingBoard","JFlashList","JBubbleRank","JDevHistory","JCommonTable","JList"]);
// 文字/装饰
const TEXT_COMPS = new Set(["JText","JCountTo","JNumber","JColorBlock","JCurrentTime","JOrbitRing","JWordCloud","JImgWordCloud","JFlashCloud","JPermanentCalendar","JGender","JRectangle"]);
// 装饰 wrapper
const DECOR_COMPS = new Set(["JDragDecoration","JDragBorder","JImg","JCarousel","JCustomIcon","JCardScroll","JCardCarousel","JCardScroll_1","JCardScroll_2","JCardScroll_3","JStatsSummary","JStatsSummary_1","JStatsSummary_2","JStatsSummary_3"]);
// 交互/表单/视频/其他
const OTHER_COMPS = new Set(["JSelectRadio","JTabToggle","JForm","JIframe","JRadioButton","JDragEditor","JCommon","JCustomEchart","JVideoPlay","JVideoJs","JWeatherForecast","JWeatherForecast_带背景","JWeatherForecast_好123版","JWeatherForecast_横线版","JWeatherForecast_列表文字版","JWeatherForecast_温度计版","JPictorialBar","JPictorial","JCustomProgress"]);

// 大屏不支持的组件（同 JeecgBoot DISABLED_COMPONENTS）
const DISABLED_COMPONENTS = new Set(["JRankingList","JTotalProgress","JPivotTable","JFly3dMap"]);

// ============ 城市坐标（JFlyLineMap 用）============
const CITY_COORDS = {
	"北京":[116.4074,39.9042],"上海":[121.4737,31.2304],"深圳":[114.0579,22.5431],
	"广州":[113.2644,23.1291],"杭州":[120.1551,30.2741],"成都":[104.0657,30.6586],
	"武汉":[114.2734,30.5801],"西安":[108.9541,34.2658],"重庆":[106.5049,29.5331],
	"天津":[117.1901,39.0851],"南京":[118.7969,32.0603],"苏州":[120.5853,31.2990],
	"青岛":[120.3826,36.0671],"大连":[121.6147,38.9140],"厦门":[118.0894,24.4798],
	"长沙":[112.9388,28.2278],"郑州":[113.6253,34.7466],"济南":[117.1201,36.6512],
	"沈阳":[123.4315,41.8057],"哈尔滨":[126.5349,45.8038],"昆明":[102.8329,24.8801],
	"贵阳":[106.6302,26.6477],"南昌":[115.8921,28.6765],"合肥":[117.2830,31.8612],
	"石家庄":[114.5149,38.0428],"太原":[112.5489,37.8706],"长春":[125.3245,43.8868],
	"福州":[119.2965,26.0745],"兰州":[103.8343,36.0611],"银川":[106.2309,38.4872],
	"乌鲁木齐":[87.6177,43.7928],"香港":[114.1694,22.3193],"澳门":[113.5439,22.1987],
	"台北":[121.5654,25.0330],
};

// ============ 工具函数 ============
function deepUpdate(target, source) {
	if (!target || !source) return;
	for (const k of Object.keys(source)) {
		const sv = source[k];
		if (sv && typeof sv === "object" && !Array.isArray(sv)) {
			if (!target[k] || typeof target[k] !== "object") target[k] = {};
			deepUpdate(target[k], sv);
		} else {
			target[k] = sv;
		}
	}
}
function gradient(direction, c1, c2) {
	const dir = direction === "h" || direction === "horizontal" ? { x:0,y:0,x2:1,y2:0 } : { x:0,y:0,x2:0,y2:1 };
	return { type:"linear", ...dir, colorStops:[{offset:0,color:c1},{offset:1,color:c2}] };
}

/** 应用 ECharts 主题色到 option（抄 JeecgBoot _apply_echarts_theme）。 */
function applyEchartsTheme(opt, p, { hasAxes=true, titleText=null } = {}) {
	if (titleText) {
		const t = opt.title ?? {};
		t.show = true; t.text = titleText;
		t.textStyle = t.textStyle ?? {}; t.textStyle.color = p.subtitle; t.textStyle.fontSize = 13;
		opt.title = t;
	}
	if (hasAxes) {
		for (const ak of ["xAxis","yAxis"]) {
			let existing = opt[ak];
			if (typeof existing === "string") opt[ak] = existing = { type: existing };
			else if (!existing) opt[ak] = existing = {};
			const axes = Array.isArray(existing) ? existing : [existing];
			for (const a of axes) {
				if (!a || typeof a !== "object") continue;
				a.axisLabel = a.axisLabel ?? {}; a.axisLabel.color = p.axis;
				a.axisLine = a.axisLine ?? {}; a.axisLine.lineStyle = a.axisLine.lineStyle ?? {};
				a.axisLine.lineStyle.color = p.axisLine;
				if (ak === "yAxis") {
					a.splitLine = a.splitLine ?? {}; a.splitLine.lineStyle = a.splitLine.lineStyle ?? {};
					a.splitLine.lineStyle.color = p.gridline;
				}
			}
		}
		const g = opt.grid ?? {};
		if (g.bottom === undefined) g.bottom = 30;
		if (g.left   === undefined) g.left = 55;
		if (g.right  === undefined) g.right = 20;
		g.top = Math.max(g.top ?? 0, 30);
		opt.grid = g;
	}
	const tt = opt.tooltip ?? {};
	tt.backgroundColor = p.tooltipBg; tt.textStyle = tt.textStyle ?? {}; tt.textStyle.color = p.tooltipTxt;
	opt.tooltip = tt;
	const leg = opt.legend ?? {}; leg.textStyle = leg.textStyle ?? {}; leg.textStyle.color = p.axis;
	opt.legend = leg;
}

// ============ 特殊组件 HANDLERS（22 种，抄 JeecgBoot + 改写 JS）============

function handleJText(c: any, p: Palette) {
	const text = c.text ?? c.title ?? "";
	const style = c.style ?? "label";
	const sizeMap: Record<string, number> = { title: 40, subtitle: 22, label: 14, value: 28 };
	const colorMap: Record<string, string> = { title: p.title, subtitle: p.subtitle, label: p.label, value: p.value };
	const body: Record<string, unknown> = {
		text,
		color: c.color ?? colorMap[style] ?? p.label,
		fontSize: c.fontSize ?? sizeMap[style] ?? 14,
		fontWeight: c.fontWeight ?? (style === "title" || style === "value" ? "bold" : "normal"),
		textAlign: c.align ?? "center",
	};
	if (c.letterSpacing) body.letterSpacing = c.letterSpacing;
	if (c.fontStyle) body.fontStyle = c.fontStyle;
	if (c.fontFamily) body.fontFamily = c.fontFamily;
	return { compKey: "JText", cfg: { chartData: { value: text }, option: { body } } };
}

function handleJDragDecoration(c, p) {
	return { compKey: "JDragDecoration", cfg: { option: {
		type: String(c.variant ?? "1"),
		mainColor: c.color ?? p.subtitle,
		subColor: c.subColor ?? c.color ?? p.subtitle,
		dur: c.dur ?? 3,
	}}};
}

function handleJDragBorder(c, p) {
	const d = loadDef("JDragBorder") ?? { option: {} };
	d.option.type = String(c.variant ?? "1");
	if (c.color) { d.option.mainColor = c.color; d.option.subColor = c.subColor ?? c.color; }
	else if (c.mainColor) d.option.mainColor = c.mainColor;
	if (c.option) deepUpdate(d.option, c.option);
	return { compKey: "JDragBorder", cfg: d };
}

function handleJStatsSummary(c, p) {
	const d = loadDef("JStatsSummary_2") ?? loadDef("JStatsSummary") ?? {};
	if (c.data) d.chartData = JSON.stringify(c.data.filter(it => it.value !== undefined && it.value !== null));
	d.option = d.option ?? {};
	d.option.color = c.color ?? p.title;
	d.option.bgColor = c.bgColor ?? "transparent";
	return { compKey: "JStatsSummary", cfg: d };
}

function handleJScrollBoard(c, p) {
	const d = loadDef("JScrollBoard") ?? {};
	if (c.headers) d.option = d.option ?? {}; d.option.headerName = c.headers;
	if (c.rows) d.chartData = JSON.stringify(c.rows);
	d.option = d.option ?? {}; d.option.backgroundColor = c.bgColor ?? "transparent";
	return { compKey: "JScrollBoard", cfg: d };
}

function handleJScrollRankingBoard(c, p) {
	const d = loadDef("JScrollRankingBoard") ?? {};
	const data = c.data ?? c.rows ?? [];
	const topN = c.topN ?? data.length;
	const sorted = [...data].sort((a,b) => (b.value ?? 0) - (a.value ?? 0)).slice(0, topN);
	d.chartData = JSON.stringify(sorted);
	d.option = d.option ?? {}; d.option.color = c.color ?? p.title;
	return { compKey: "JScrollRankingBoard", cfg: d };
}

function handleJCountTo(c, p) {
	const d = loadDef("JCountTo") ?? {};
	d.chartData = { value: c.value ?? 0 };
	d.option = d.option ?? {};
	Object.assign(d.option, {
		whole: c.whole ?? true,
		fontSize: c.fontSize ?? 48,
		color: c.color ?? p.title,
		fontWeight: c.fontWeight ?? "bold",
		textAlign: c.align ?? "center",
	});
	if (c.prefix) d.option.prefix = c.prefix;
	if (c.suffix) d.option.suffix = c.suffix;
	return { compKey: "JCountTo", cfg: d };
}

function handleJNumber(c, p) {
	const d = loadDef("JNumber") ?? {};
	d.chartData = { value: c.value ?? 0 };
	d.option = d.option ?? {}; d.option.body = d.option.body ?? {};
	Object.assign(d.option.body, {
		color: c.color ?? p.value,
		fontSize: c.fontSize ?? 28,
		fontWeight: c.fontWeight ?? "bold",
		textAlign: c.align ?? "center",
	});
	if (c.prefix) d.option.body.prefix = c.prefix;
	if (c.suffix) d.option.body.suffix = c.suffix;
	return { compKey: "JNumber", cfg: d };
}

function handleJCapsuleChart(c, p) {
	const d = loadDef("JCapsuleChart") ?? {};
	d.chartData = JSON.stringify(c.data ?? []);
	d.option = d.option ?? {};
	d.option.showValue = c.showValue ?? true;
	d.option.unit = c.unit ?? "";
	if (c.colors) d.option.customColor = c.colors.map(col => ({ color1: col, color: col }));
	return { compKey: "JCapsuleChart", cfg: d };
}

function handleJListProgress(c, p) {
	const d = loadDef("JListProgress") ?? {};
	const rows = (c.data ?? []).map(it => ({
		title: it.title ?? "",
		value: it.current ?? it.value ?? 0,
		total: it.target ?? it.total ?? 100,
		endLabel: it.label ?? it.endLabel ?? "",
		date: it.date ?? "",
	}));
	d.chartData = JSON.stringify(rows);
	d.option = d.option ?? {}; d.option.body = d.option.body ?? {}; d.option.bar = d.option.bar ?? {}; d.option.beginInfo = d.option.beginInfo ?? {};
	d.option.body.color = c.textColor ?? p.value; d.option.body.fontSize = c.fontSize ?? 16;
	d.option.bar.background = "#1a3a5a"; d.option.bar.color = c.color ?? p.subtitle;
	if (c.option) deepUpdate(d.option, c.option);
	return { compKey: "JListProgress", cfg: d };
}

function handleJFlyLineMap(c, p) {
	const d = loadDef("JFlyLineMap") ?? {};
	const rows = [];
	for (const it of c.data ?? []) {
		if (it.from && it.to) {
			const fc = CITY_COORDS[it.from]; const tc = CITY_COORDS[it.to];
			if (!fc || !tc) throw new Error(`JFlyLineMap 未知城市: ${JSON.stringify(it)}`);
			rows.push({ fromName: it.from, toName: it.to, fromLng: fc[0], fromLat: fc[1], toLng: tc[0], toLat: tc[1], value: it.value ?? 1 });
		} else rows.push(it);
	}
	d.chartData = JSON.stringify(rows);
	d.option = d.option ?? {};
	const area = d.option.area ?? {};
	const raw = area.value ?? [];
	if (Array.isArray(raw) && raw.some(v => String(v).toLowerCase() === "china")) area.value = ["100000"];
	else if (!area.value || area.value.length === 0) area.value = ["100000"];
	d.option.area = area;
	if (c.title) { d.option.title = d.option.title ?? {}; d.option.title.show = true; d.option.title.text = c.title; d.option.title.textStyle = { color: p.subtitle, fontSize: 13 }; }
	d.commonOption = d.commonOption ?? {}; d.commonOption.effect = d.commonOption.effect ?? {};
	Object.assign(d.commonOption.effect, { trailLength: c.trailLength ?? 0.2, symbolSize: c.symbolSize ?? 6, color: c.effectColor ?? p.title });
	if (c.option) deepUpdate(d.option, c.option);
	return { compKey: "JFlyLineMap", cfg: d };
}

function handleJMapSimple(compType, c, p) {
	const d = loadDef(compType) ?? {};
	if (c.data) d.chartData = JSON.stringify(c.data);
	d.option = d.option ?? {};
	if (c.title) { d.option.title = d.option.title ?? {}; d.option.title.show = true; d.option.title.text = c.title; d.option.title.textStyle = { color: p.subtitle, fontSize: 13 }; }
	if (c.option) deepUpdate(d.option, c.option);
	d.commonOption = d.commonOption ?? {};
	if (c.commonOption) deepUpdate(d.commonOption, c.commonOption);
	return { compKey: compType, cfg: d };
}
const handleJAreaMap   = (c, p) => handleJMapSimple("JAreaMap",   c, p);
const handleJBubbleMap = (c, p) => handleJMapSimple("JBubbleMap", c, p);
const handleJBarMap    = (c, p) => handleJMapSimple("JBarMap",    c, p);

function handleGauge(compType, c, p) {
	const d = loadDef(compType) ?? {};
	d.option = d.option ?? {};
	d.option.series = d.option.series ?? [{ type: "gauge" }];
	const ser = d.option.series[0];
	ser.data = [{ value: c.value ?? 0, name: c.title ?? "" }];
	if (c.title) ser.name = c.title;
	if (c.min !== undefined) ser.min = c.min;
	if (c.max !== undefined) ser.max = c.max;
	if (c.radius) ser.radius = c.radius;
	return { compKey: compType, cfg: d };
}
const handleJGauge      = (c, p) => handleGauge("JGauge",      c, p);
const handleJColorGauge = (c, p) => handleGauge("JColorGauge", c, p);
const handleJSemiGauge  = (c, p) => handleGauge("JSemiGauge",  c, p);
const handleJAntvGauge  = (c, p) => handleGauge("JAntvGauge",  c, p);

function handleJScrollList(c, p) {
	const d = loadDef("JScrollList_2") ?? loadDef("JScrollList") ?? {};
	d.chartData = JSON.stringify(c.data ?? []);
	d.option = d.option ?? {}; d.option.colors = p.colors;
	return { compKey: "JScrollList", cfg: d };
}

function handleJScrollTable(c, p) {
	const d = loadDef("JScrollTable") ?? {};
	if (c.headers) d.option = d.option ?? {}; d.option.headerName = c.headers;
	if (c.rows) d.chartData = JSON.stringify(c.rows);
	return { compKey: "JScrollTable", cfg: d };
}

function handleJLiquid(c, p) {
	const d = loadDef("JLiquid") ?? {};
	d.chartData = JSON.stringify({ value: c.value ?? 0.5 });
	d.option = d.option ?? {}; d.option.color = c.color ?? p.subtitle;
	return { compKey: "JLiquid", cfg: d };
}

function handleJRingProgress(c, p) {
	const d = loadDef("JRingProgress") ?? {};
	d.chartData = JSON.stringify([{ value: c.value ?? 0, title: c.title ?? "" }]);
	d.option = d.option ?? {}; d.option.color = c.color ?? p.subtitle;
	return { compKey: "JRingProgress", cfg: d };
}

const SPECIAL_HANDLERS = {
	JText:               handleJText,
	JDragDecoration:     handleJDragDecoration,
	JDragBorder:         handleJDragBorder,
	JStatsSummary:       handleJStatsSummary,
	JScrollBoard:        handleJScrollBoard,
	JScrollRankingBoard: handleJScrollRankingBoard,
	JCountTo:            handleJCountTo,
	JNumber:             handleJNumber,
	JCapsuleChart:       handleJCapsuleChart,
	JListProgress:       handleJListProgress,
	JFlyLineMap:         handleJFlyLineMap,
	JAreaMap:            handleJAreaMap,
	JBubbleMap:          handleJBubbleMap,
	JBarMap:             handleJBarMap,
	JGauge:              handleJGauge,
	JColorGauge:         handleJColorGauge,
	JAntvGauge:          handleJAntvGauge,
	JSemiGauge:          handleJSemiGauge,
	JLiquid:             handleJLiquid,
	JScrollList:         handleJScrollList,
	JScrollTable:        handleJScrollTable,
	JRingProgress:       handleJRingProgress,
};

// ============ 通用 CHART HANDLERS ============

/** 轴类图表（JBar/JLine 等）通用 handler。 */
function handleCartesian(c, p, type) {
	const d = loadDef(type) ?? {};
	d.option = d.option ?? {};
	if (c.gradient) {
		const [dir, c1, c2] = c.gradient;
		d.option.color = gradient(dir, c1, c2);
	} else if (c.color) {
		d.option.color = c.color;
	} else if (!d.option.color) {
		d.option.color = p.colors;
	}
	if (c.colors) d.option.color = c.colors;
	// 注入数据
	if (c.data && c.data.length > 0) {
		const labels = c.data.map(d => String(d.name ?? d.label ?? ""));
		const seriesData = c.data.map(d => d.value ?? 0);
		d.chartData = JSON.stringify(c.data);
		// 更新 series
		d.option.series = d.option.series ?? [{ type: type === "JStackBar" ? "bar" : "bar", data: seriesData }];
		d.option.series[0].data = seriesData;
		if (c.title) d.option.series[0].name = c.title;
		// 更新 axis data（避免与 chartData 不同步）
		if (d.option.xAxis && typeof d.option.xAxis === "object") d.option.xAxis.data = labels;
	}
	applyEchartsTheme(d.option, p, { hasAxes: true, titleText: c.title ?? null });
	if (c.option) deepUpdate(d.option, c.option);
	return { compKey: type, cfg: d };
}

/** 极坐标图表（JPie/JRadar 等）通用 handler。 */
function handlePolar(c, p, type) {
	const d = loadDef(type) ?? {};
	d.option = d.option ?? {};
	d.option.color = c.colors ?? d.option.color ?? p.colors;
	if (c.data && c.data.length > 0) {
		d.chartData = JSON.stringify(c.data);
		d.option.series = d.option.series ?? [{ type: "pie", data: c.data }];
		d.option.series[0].data = c.data;
		if (c.title) { d.option.title = d.option.title ?? {}; d.option.title.show = true; d.option.title.text = c.title; }
	}
	applyEchartsTheme(d.option, p, { hasAxes: false });
	if (c.option) deepUpdate(d.option, c.option);
	return { compKey: type, cfg: d };
}

/** Map 系列图表通用 handler（JBubbleMap 等 8 种）。 */
function handleMap(c, p, type) {
	const d = loadDef(type) ?? {};
	d.option = d.option ?? {};
	if (c.data) d.chartData = JSON.stringify(c.data);
	if (c.title) { d.option.title = d.option.title ?? {}; d.option.title.show = true; d.option.title.text = c.title; d.option.title.textStyle = { color: p.subtitle, fontSize: 13 }; }
	if (c.option) deepUpdate(d.option, c.option);
	return { compKey: type, cfg: d };
}

/** 进度/仪表类通用。 */
function handleGaugeLike(c, p, type) {
	return SPECIAL_HANDLERS[type] ? SPECIAL_HANDLERS[type](c, p) : handleGauge(type, c, p);
}

// ============ 主分发器：compile_component ============

function inferCompKey(type) {
	const variant = String(this.get?.("variant") ?? "").trim();
	if (variant) {
		const cand = `${type}_${variant}`;
		if (DEFAULTS_MAP[cand]) return cand;
	}
	return type;
}

/**
 * 编译单个紧凑 spec component → 大屏组件 JSON。
 * @param {object} c   紧凑 spec（{ type, pos: [x,y,w,h], title, data, ... }）
 * @param {object} p   palette（6 套命名色板之一）
 * @returns {{ compKey: string, cfg: object, warnings: string[] }}
 */
export function compileComponent(c, p) {
	const warnings = [];
	const t = c.type;

	if (DISABLED_COMPONENTS.has(t)) {
		throw new Error(`组件 ${t} 在大屏（bigScreen）中不受支持。替代建议：JRankingList→JScrollRankingBoard；JTotalProgress→JListProgress/JCapsuleChart；JPivotTable→JScrollBoard/JCommonTable；JFly3dMap→JFlyLineMap/JTotalFlyLineMap`);
	}

	// 变体支持：spec 里写 variant 时优先加载 <type>_<variant>.json
	let compKey = t;
	const variant = String(c.variant ?? "").trim();
	if (variant) {
		const cand = `${t}_${variant}`;
		if (DEFAULTS_MAP[cand]) compKey = cand;
	}

	let cfg;
	if (SPECIAL_HANDLERS[compKey]) {
		const r = SPECIAL_HANDLERS[compKey](c, p);
		compKey = r.compKey; cfg = r.cfg;
	} else if (ECHARTS_CARTESIAN.has(t)) {
		const r = handleCartesian(c, p, t);
		compKey = r.compKey; cfg = r.cfg;
	} else if (ECHARTS_POLAR.has(t)) {
		const r = handlePolar(c, p, t);
		compKey = r.compKey; cfg = r.cfg;
	} else if (ECHARTS_MAP.has(t)) {
		const r = handleMap(c, p, t);
		compKey = r.compKey; cfg = r.cfg;
	} else if (ECHARTS_GAUGE.has(t)) {
		const r = handleGaugeLike(c, p, t);
		compKey = r.compKey; cfg = r.cfg;
	} else {
		// Passthrough fallback：加载 defaults → 合并 data/option/commonOption
		cfg = loadDef(compKey) ?? {};
		if (c.data) {
			cfg.chartData = JSON.stringify(c.data);
		}
		if (c.title && !cfg.title) cfg.title = c.title;
		cfg.option = cfg.option ?? {};
		if (c.option) deepUpdate(cfg.option, c.option);
		cfg.commonOption = cfg.commonOption ?? {};
		if (c.commonOption) deepUpdate(cfg.commonOption, c.commonOption);
	}

	// 通用后处理：pos → w/h；chartData list → string；透明背景
	// 兼容两种 spec 格式：c.pos=[x,y,w,h] 数组 或 c.w/c.h 顶层字段
	if (Array.isArray(c.pos) && c.pos.length >= 4) {
		cfg.x = c.pos[0]; cfg.y = c.pos[1]; cfg.w = cfg.w ?? c.pos[2]; cfg.h = cfg.h ?? c.pos[3];
	} else {
		cfg.w = cfg.w ?? c.w ?? 400; cfg.h = cfg.h ?? c.h ?? 300;
	}
	if (c.x !== undefined) cfg.x = cfg.x ?? c.x;
	if (c.y !== undefined) cfg.y = cfg.y ?? c.y;
	if (!cfg.dataType) cfg.dataType = 1;
	// chartData 统一序列化为 JSON 字符串（前端期望 string 类型）
	if (cfg.chartData !== undefined && typeof cfg.chartData !== "string") {
		cfg.chartData = JSON.stringify(cfg.chartData);
	}
	cfg.background = cfg.background ?? "#FFFFFF00";
	cfg.borderColor = cfg.borderColor ?? "#FFFFFF00";
	// chart.category / chart.subclass（前端用这些字段识别组件类型）
	cfg.chart = cfg.chart ?? { subclass: t, category: inferCategory(t) };

	// 布局预警
	if (ECHARTS_POLAR.has(t) && (cfg.h ?? 0) < 220) {
		warnings.push(`⚠️ ${t} h=${cfg.h}<220，饼/环图 legend 易重叠`);
	}
	if (t === "JStatsSummary" && (cfg.h ?? 0) < 150) {
		warnings.push(`⚠️ JStatsSummary h=${cfg.h}<150，内容可能被截断`);
	}

	return { compKey, cfg, warnings };
}

function inferCategory(compType) {
	if (ECHARTS_CARTESIAN.has(compType)) return "Bar";
	if (ECHARTS_POLAR.has(compType)) return "Pie";
	if (ECHARTS_GAUGE.has(compType)) return "Gauge";
	if (ECHARTS_MAP.has(compType)) return "Map";
	if (PROGRESS_COMPS.has(compType)) return "Progress";
	if (TABLE_COMPS.has(compType)) return "Table";
	if (TEXT_COMPS.has(compType)) return "Text";
	if (DECOR_COMPS.has(compType)) return "Decoration";
	return "Custom";
}

// ============ 主入口：compileBigscreen ============

/**
 * 编译完整大屏。
 * @param {object} spec 紧凑 spec { page:{name,theme,bg}, palette, components:[{type,pos,...}] }
 * @returns {{ page: object, components: object[], palette: object, warnings: string[] }}
 */
export function compileBigscreen(spec) {
	const page = spec.page ?? {};
	const paletteName = spec.palette ?? page.bg ?? "tech";
	const palette = PALETTES[paletteName] ?? PALETTES.tech;
	const theme = page.theme ?? "dark";
	const bgImage = page.bgImage ?? `/img/bg/${page.bg ?? "bg4"}.png`;

	const components = [];
	const allWarnings = [];
	for (const c of spec.components ?? []) {
		try {
			const { compKey, cfg, warnings } = compileComponent(c, palette);
			allWarnings.push(...warnings.map(w => `[${compKey}] ${w}`));
			components.push({
				type: compKey,
				title: c.title ?? c.name ?? c.text ?? "",
				cfg,
			});
		} catch (e) {
			allWarnings.push(`[${c.type ?? "unknown"}] ❌ ${e.message}`);
			components.push({
				type: c.type,
				title: c.title ?? "",
				error: e.message,
			});
		}
	}

	return {
		page: {
			name: page.name ?? "untitled",
			style: page.style ?? "bigScreen",
			theme,
			width: page.width ?? 1920,
			height: page.height ?? 1080,
			backgroundImage: bgImage,
		},
		components,
		palette: { ...palette, name: paletteName },
		warnings: allWarnings,
	};
}

// ============ 以下为调试/预览用工具（不是主流程）============

/** 大屏组件 JSON → 调试 HTML（1920×1080 canvas + 绝对定位）。 */
export function generateBigscreenHtml(spec) {
	const { page, components, palette } = compileBigscreen(spec);
	const isScreen = (page.theme ?? "dark") === "dark";
	const canvasW = page.width ?? 1920;
	const canvasH = page.height ?? 1080;

	const bgCss = isScreen
		? `html,body{margin:0;padding:0;background:#051020;color:#d4e8ff;font-family:system-ui,sans-serif;}.canvas{position:relative;width:${canvasW}px;height:${canvasH}px;margin:0 auto;background:linear-gradient(180deg,#0a1929 0%,#051020 100%);overflow:hidden;border:1px solid #1a3a5a;} .comp{position:absolute;overflow:hidden;border:1px solid #1a3a5a55;border-radius:4px;background:rgba(11,30,58,0.15);}`
		: `html,body{margin:0;padding:0;background:#f3f4f6;color:#1f2937;font-family:system-ui,sans-serif;}.canvas{position:relative;width:${canvasW}px;height:${canvasH}px;margin:0 auto;background:#f9fafb;overflow:hidden;border:1px solid #e5e7eb;}.comp{position:absolute;overflow:hidden;border:1px solid #e5e7eb;border-radius:4px;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,0.04);}`;

	const head = `<!DOCTYPE html><html lang="zh"><head><meta charset="UTF-8"><meta name="viewport" content="width=1">
<title>${page.name}</title>
<script src="https://cdn.jsdelivr.net/npm/echarts@5.6.0/dist/echarts.min.js"></script>
<style>${bgCss}</style>
</head><body>
<div class="canvas" style="background-image:url('${page.backgroundImage ?? ""}');">`;

	const bodyHtml = components.map((c, i) => {
		if (c.error) return `<div class="comp" style="left:0;top:0;width:400px;height:100px;color:#ef4444;font-size:12px;padding:8px;">❌ ${c.type}: ${c.error}</div>`;
		const cfg = c.cfg;
		if (!cfg) return "";
		const x = cfg.x ?? 0, y = cfg.y ?? 0, w = cfg.w ?? 400, h = cfg.h ?? 300;
		const kind = inferKind(c.type);
		if (kind === "echarts" && cfg.option) {
			return `<div class="comp" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;" title="${c.title || c.type}"><div id="chart-${i}" style="width:100%;height:100%;"></div></div>`;
		}
		// HTML/text/decoration 组件：直接渲染内容
		if (kind === "html") {
			const html = renderHtmlComponent(c, cfg, palette);
			return `<div class="comp" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;border:none;background:transparent;">${html}</div>`;
		}
		return `<div class="comp" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;padding:8px;"><pre style="font-size:10px;color:#999;margin:0;overflow:hidden;">${c.type}</pre></div>`;
	}).join("");

	const js = `<script>
(function(){${components.map((c, i) => {
		if (c.error) return "";
		const cfg = c.cfg; if (!cfg) return "";
		if (cfg.option && typeof cfg.option.series === "object" && inferKind(c.type) === "echarts") {
			const opt = cfg.option;
			return `(function(){var d=document.getElementById('chart-${i}');if(d){var e=echarts.init(d,'${isScreen?"dark":"light"}');e.setOption(${JSON.stringify(opt)});window.addEventListener('resize',function(){e.resize();});}})();`;
		}
		return "";
	}).join("\n")}
})();
</script>`;

	return `${head}${bodyHtml}${js}</body></html>`;
}

function renderHtmlComponent(c, cfg, p) {
	const opt = cfg.option ?? {};
	switch (c.type) {
		case "JText": {
			const body = opt.body ?? {};
			return `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:${body.color ?? p.label};font-size:${body.fontSize ?? 14}px;font-weight:${body.fontWeight ?? "normal"};text-align:${body.textAlign ?? "center"};letter-spacing:${body.letterSpacing ?? 0}px;">${body.text ?? cfg.chartData?.value ?? ""}</div>`;
		}
		case "JDragDecoration": {
			// 装饰条：简单 CSS 渐变代替（JeecgBoot 用 SVG，这里简化）
			const col = opt.mainColor ?? p.subtitle;
			const sub = opt.subColor ?? col;
			return `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(90deg,${col}33,${sub}33);border-top:2px solid ${col};border-bottom:2px solid ${sub};"><span style="color:${col};font-size:12px;">▸ ${opt.title ?? opt.type ?? ""}</span></div>`;
		}
		case "JCountTo": case "JNumber": {
			const body = opt.body ?? opt;
			const val = typeof cfg.chartData === "string" ? JSON.parse(cfg.chartData).value : cfg.chartData?.value ?? 0;
			return `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:${body.color ?? p.title};font-size:${body.fontSize ?? 32}px;font-weight:${body.fontWeight ?? "bold"};font-variant-numeric:tabular-nums;">${opt.prefix ?? body.prefix ?? ""}${val}${opt.suffix ?? body.suffix ?? ""}</div>`;
		}
		case "JStatsSummary": {
			// 简化统计卡
			let items = [];
			try { items = JSON.parse(cfg.chartData ?? "[]"); } catch { items = []; }
			if (!Array.isArray(items)) items = [];
			const itemHtml = items.slice(0, 4).map(it => `<div style="flex:1;text-align:center;padding:8px;border-right:1px solid ${p.axisLine};"><div style="font-size:20px;font-weight:700;color:${p.title};">${it.value ?? 0}${it.suffix ?? ""}</div><div style="font-size:11px;color:${p.label};opacity:0.8;margin-top:4px;">${it.name ?? it.label ?? ""}</div></div>`).join("");
			return `<div style="width:100%;height:100%;display:flex;">${itemHtml}</div>`;
		}
		case "JScrollBoard": case "JScrollTable": {
			return `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:${p.label};font-size:12px;padding:8px;overflow:hidden;"><pre style="margin:0;white-space:pre-wrap;">${c.type}</pre></div>`;
		}
		default:
			return `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:${p.label};font-size:11px;padding:4px;">${c.type}</div>`;
	}
}

function inferKind(compType) {
	if (ECHARTS_CARTESIAN.has(compType) || ECHARTS_POLAR.has(compType) || ECHARTS_GAUGE.has(compType)) return "echarts";
	if (ECHARTS_MAP.has(compType)) return "echarts";
	if (TEXT_COMPS.has(compType) || DECOR_COMPS.has(compType)) return "html";
	return "html";
}

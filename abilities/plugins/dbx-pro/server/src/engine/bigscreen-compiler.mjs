/**
 * bigscreen-compiler —— Jimubi 紧凑 spec → ECharts option + HTML
 *
 * 从 src/tools/dbx-bigscreen-builder.ts 核心逻辑移植过来（mjs 格式）。
 * server 端 HTTP API 层和 Astravia Agent 工具注册层都 import 这份。
 *
 * 职责：接收 compact spec → defaults 展开 → handler 路由 → palette 应用 → pitfall 防呆 → 输出 BuiltComponent[] + 完整 HTML。
 */

// ============ Palettes ============
const PALETTES = {
	tech: { title: "#f0c040", subtitle: "#00d4ff", label: "#ffffff", value: "#d4e8ff", axis: "#8ab8d0", axisLine: "#1a3a5a", gridline: "#1a3a5a55", tooltipBg: "#0b1e3acc", tooltipTxt: "#e0f0ff", colors: ["#00d4ff", "#f0c040", "#ff6b6b", "#7ee8a2", "#ffa726", "#8ab8d0", "#00ffc8", "#d4a6ff"] },
	"tech-blue": { title: "#00d4ff", subtitle: "#0099cc", label: "#ffffff", value: "#e0f7ff", axis: "#80c8ff", axisLine: "#003355", gridline: "#00446644", tooltipBg: "#002244cc", tooltipTxt: "#c0e8ff", colors: ["#00d4ff", "#0099cc", "#006699", "#00ccff", "#00ffff", "#80d4ff", "#c0e8ff", "#ffffff"] },
	gov: { title: "#ffd700", subtitle: "#00d4ff", label: "#ffffff", value: "#d4e8ff", axis: "#5a7a9a", axisLine: "#0a1a2a", gridline: "#1a3a5a44", tooltipBg: "#0a1a2acc", tooltipTxt: "#e0f0ff", colors: ["#ffd700", "#00d4ff", "#1e90ff", "#4169e1", "#6495ed", "#87ceeb", "#b0c4de", "#dda0dd"] },
	biz: { title: "#00bcd4", subtitle: "#26c6da", label: "#e0f7fa", value: "#b2ebf2", axis: "#4dd0e1", axisLine: "#006064", gridline: "#00838f44", tooltipBg: "#004d4dcc", tooltipTxt: "#e0f7fa", colors: ["#00bcd4", "#26c6da", "#4dd0e1", "#00acc1", "#0097a7", "#00838f", "#80deea", "#b2ebf2"] },
	retro: { title: "#ffd700", subtitle: "#ff8c00", label: "#2d1810", value: "#4a2c1e", axis: "#8b6914", axisLine: "#3d2914", gridline: "#5a3a2a44", tooltipBg: "#2d1810cc", tooltipTxt: "#ffe0b2", colors: ["#8b0000", "#ff4500", "#ff8c00", "#ffd700", "#b8860b", "#cd853f", "#deb887", "#daa520"] },
	medical: { title: "#4caf50", subtitle: "#8bc34a", label: "#ffffff", value: "#e8f5e9", axis: "#81c784", axisLine: "#1b5e20", gridline: "#2e7d3244", tooltipBg: "#1b5e20cc", tooltipTxt: "#e8f5e9", colors: ["#4caf50", "#8bc34a", "#cddc39", "#00bcd4", "#ffffff", "#81c784", "#a5d6a7", "#c8e6c9"] },
	financial: { title: "#ffc107", subtitle: "#ff9800", label: "#ffffff", value: "#e3f2fd", axis: "#64b5f6", axisLine: "#0d47a1", gridline: "#1565c044", tooltipBg: "#0d47a1cc", tooltipTxt: "#bbdefb", colors: ["#ffc107", "#ff9800", "#ff5722", "#0d47a1", "#1976d2", "#2196f3", "#64b5f6", "#90caf9"] },
};

// ============ 组件类型分类 ============
const ECHARTS_CARTESIAN = new Set(["JBar", "JStackBar", "JMultipleBar", "JNegativeBar", "JPercentBar", "JLine", "JSmoothLine", "JStepLine", "JArea", "JMultipleLine", "JScatter", "JBubble", "JQuadrant"]);
const ECHARTS_POLAR = new Set(["JPie", "JRose", "JRotatePie", "JRing", "JBreakRing", "JActiveRing", "JRadar", "JCircleRadar", "JFunnel", "JPyramidFunnel"]);
const ECHARTS_GAUGE = new Set(["JGauge", "JSemiGauge", "JColorGauge", "JAntvGauge"]);
const ECHARTS_MAP = new Set(["JFlyLineMap", "JAreaMap", "JBubbleMap", "JBarMap"]);
const HTML_COMPONENTS = new Set(["JText", "JDragDecoration", "JDragBorder", "JCountTo", "JNumber", "JStatsSummary", "JScrollBoard", "JScrollTable", "JScrollList", "JCapsuleChart", "JListProgress"]);

const JIMUBI_TO_ECHARTS_TYPE = { JBar: "bar", JStackBar: "bar", JMultipleBar: "bar", JNegativeBar: "bar", JPercentBar: "bar", JLine: "line", JSmoothLine: "line", JStepLine: "line", JArea: "line", JMultipleLine: "line", JScatter: "scatter", JBubble: "scatter", JPie: "pie", JRing: "pie", JRose: "pie", JRotatePie: "pie", JRadar: "radar", JCircleRadar: "radar", JFunnel: "funnel", JPyramidFunnel: "funnel", JGauge: "gauge", JSemiGauge: "gauge", JColorGauge: "gauge" };

// ============ Pitfall 防呆 ============
function pitfallFix(comp) {
	const warnings = [];
	const c = { ...comp };
	if (c.label !== undefined && c.type && ECHARTS_CARTESIAN.has(c.type) && c.name === undefined) {
		c.name = c.label;
		warnings.push("字段 label 自动修正为 name");
	}
	if (typeof c.color === "string" && /^#[0-9a-fA-F]{3}$/.test(c.color)) {
		c.color = "#" + c.color.slice(1).split("").map(x => x + x).join("");
		warnings.push(`颜色缩写展开: ${comp.color} → ${c.color}`);
	}
	if (c.type && ECHARTS_POLAR.has(c.type) && (c.xAxis || c.yAxis)) {
		warnings.push(`${c.type} 不需要 xAxis/yAxis，已忽略`);
	}
	const opt = c.options;
	if (opt && opt.grid) {
		for (const k of ["width", "height"]) {
			const v = opt.grid[k];
			if (typeof v === "string" && v.endsWith("%")) {
				warnings.push(`grid.${k}: "${v}" 百分比字符串无效，已移除`);
				delete opt.grid[k];
			}
		}
	}
	return { comp: c, warnings };
}

function layoutAdvisor(comp) {
	const warnings = [];
	const h = comp.pos?.[3];
	if (h && h < 220 && ECHARTS_POLAR.has(comp.type)) warnings.push(`⚠️ ${comp.type} 高度 ${h} < 220px，图例可能重叠`);
	if (h && h < 180 && ECHARTS_GAUGE.has(comp.type)) warnings.push(`⚠️ ${comp.type} 高度 ${h} < 180px，显示不全`);
	return warnings;
}

// ============ 数据推断 ============
function inferEChartsData(data) {
	if (!data || data.length === 0) return { labels: [], seriesData: [] };
	if (typeof data[0] === "object" && (data[0].name !== undefined || data[0].value !== undefined)) {
		return { labels: data.map(x => String(x.name ?? x.label ?? "未知")), seriesData: data.map(x => x.value ?? 0) };
	}
	if (typeof data[0] === "number") return { labels: data.map((_, i) => String(i + 1)), seriesData: data };
	return { labels: [], seriesData: data };
}

// ============ Handlers ============
function handleCartesian(comp, palette) {
	const type = JIMUBI_TO_ECHARTS_TYPE[comp.type] ?? "bar";
	const { labels, seriesData } = inferEChartsData(comp.data);
	const colors = comp.colors ?? palette.colors;
	const opt = {
		tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
		grid: { left: 50, right: 20, top: 40, bottom: 30, containLabel: true },
		legend: { top: 8, right: 10, textStyle: { color: palette.label } },
		xAxis: { type: "category", data: labels, axisLine: { lineStyle: { color: palette.axisLine } }, axisLabel: { color: palette.axis }, splitLine: { show: false } },
		yAxis: { type: "value", axisLine: { show: false }, axisLabel: { color: palette.axis }, splitLine: { lineStyle: { color: palette.gridline } } },
		series: [{ type, name: comp.title ?? "数据", data: seriesData, itemStyle: { color: colors[0] ?? palette.colors[0] }, barMaxWidth: 40 }],
	};
	if (comp.type === "JStackBar") opt.series[0].stack = "total";
	if (comp.type === "JHorizontalBar") { opt.xAxis = { type: "value" }; opt.yAxis = { type: "category", data: labels }; }
	if (comp.type === "JLine" || comp.type === "JSmoothLine") opt.series[0].smooth = true;
	if (comp.type === "JArea") { opt.series[0].areaStyle = {}; opt.series[0].smooth = true; }
	return opt;
}

function handlePolar(comp, palette) {
	const { labels, seriesData } = inferEChartsData(comp.data);
	const colors = comp.colors ?? palette.colors;
	const type = JIMUBI_TO_ECHARTS_TYPE[comp.type] ?? "pie";
	const opt = {
		tooltip: { trigger: "item", backgroundColor: palette.tooltipBg, textStyle: { color: palette.tooltipTxt } },
		legend: { top: 8, right: 10, textStyle: { color: palette.label } },
		color: colors,
		series: [{ type, name: comp.title ?? "数据", data: labels.map((name, i) => ({ name, value: seriesData[i] })) }],
	};
	if (comp.type === "JRing" || comp.type === "JBreakRing") opt.series[0].radius = ["40%", "70%"];
	if (comp.type === "JRose") opt.series[0].roseType = "area";
	if (comp.type === "JRadar") {
		opt.radar = { indicator: labels.map(name => ({ name, max: 100 })) };
		opt.series[0].data = [{ value: seriesData, name: comp.title ?? "" }];
	}
	return opt;
}

function handleGauge(comp, palette) {
	const value = comp.value ?? 0;
	const max = comp.max ?? 100;
	const isSemi = comp.type === "JSemiGauge";
	return {
		series: [{
			type: "gauge", startAngle: isSemi ? 200 : 220, endAngle: isSemi ? -20 : -40,
			min: 0, max, progress: { show: true, width: 12, itemStyle: { color: palette.colors[0] } },
			axisLine: { lineStyle: { width: 12, color: [[1, palette.axisLine]] } },
			axisTick: { show: false }, splitLine: { show: true, length: 8, lineStyle: { color: palette.axis } },
			axisLabel: { color: palette.label, fontSize: 10, distance: 20 },
			pointer: { show: true, width: 4, itemStyle: { color: palette.colors[0] } },
			title: { show: true, offsetCenter: [0, "70%"], color: palette.label, fontSize: 13 },
			detail: { offsetCenter: [0, "45%"], color: palette.title, fontSize: 28, fontWeight: "bold" },
			data: [{ value, name: comp.title ?? "" }],
		}],
	};
}

function handleScrollRanking(comp, palette) {
	const raw = comp.data ?? [];
	const rowNum = comp.rowNum ?? raw.length;
	const sorted = [...raw].sort((a, b) => b.value - a.value).slice(0, rowNum);
	return handleCartesian({ ...comp, data: sorted }, palette);
}

function handleJText(comp, palette) {
	const text = comp.text ?? comp.title ?? "";
	const style = comp.style ?? "normal";
	const color = comp.color ?? (style === "title" ? palette.title : palette.label);
	const fontSize = style === "title" ? 20 : style === "subtitle" ? 16 : 14;
	return `<div style="color:${color};font-size:${fontSize}px;font-weight:${style === "title" || style === "subtitle" ? 600 : 400};line-height:1.4;">${text}</div>`;
}

function handleJCountTo(comp, palette) {
	const value = comp.value ?? 0;
	const title = comp.title ?? "";
	const suffix = comp.suffix ?? "";
	const color = comp.color ?? palette.title;
	return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:12px;"><span style="font-size:36px;font-weight:700;color:${color};font-variant-numeric:tabular-nums;">${value.toLocaleString()}${suffix}</span>${title ? `<span style="font-size:13px;color:${palette.label};opacity:0.85;">${title}</span>` : ""}</div>`;
}

function handleJStatsSummary(comp, palette) {
	const variant = comp.variant ?? "1";
	const items = comp.items ?? comp.data ?? [];
	if (variant === "2") {
		const html = items.map(it => `<div style="flex:1;text-align:center;padding:12px 8px;border-right:1px solid ${palette.axisLine};"><div style="font-size:24px;font-weight:700;color:${palette.title};">${it.value}${it.suffix ?? ""}</div><div style="font-size:12px;color:${palette.label};opacity:0.8;">${it.label}</div>${it.trend ? `<div style="font-size:11px;color:${it.trend.startsWith("+") ? "#7ee8a2" : "#ff6b6b"};">${it.trend}</div>` : ""}</div>`).join("");
		return `<div style="display:flex;width:100%;border:1px solid ${palette.axisLine};border-radius:8px;background:rgba(0,0,0,0.02);">${html}</div>`;
	}
	const html = items.map(it => `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 12px;border-bottom:1px solid ${palette.axisLine};"><span style="font-size:13px;color:${palette.label};">${it.label}</span><span style="font-size:16px;font-weight:600;color:${palette.value};font-variant-numeric:tabular-nums;">${it.value}${it.suffix ?? ""}</span></div>`).join("");
	return `<div style="width:100%;border:1px solid ${palette.axisLine};border-radius:8px;overflow:hidden;background:rgba(0,0,0,0.02);">${html}</div>`;
}

function handleJScrollBoard(comp, palette) {
	const title = comp.title ?? "";
	const headers = comp.headers ?? (comp.data && comp.data.columns) ?? [];
	const rows = comp.rows ?? comp.data ?? [];
	const headHtml = headers.map(h => `<th style="padding:8px 12px;font-size:12px;color:${palette.label};font-weight:600;text-align:left;background:${palette.axisLine};">${h}</th>`).join("");
	const rowHtml = rows.slice(0, 10).map(r => {
		const td = r.map(c => `<td style="padding:6px 12px;font-size:12px;color:${palette.value};border-top:1px solid ${palette.axisLine};">${c}</td>`).join("");
		return `<tr>${td}</tr>`;
	}).join("");
	return `<div style="width:100%;border:1px solid ${palette.axisLine};border-radius:8px;overflow:hidden;">${title ? `<div style="padding:8px 12px;background:${palette.axisLine};color:${palette.title};font-size:13px;font-weight:600;">${title}</div>` : ""}<table style="width:100%;border-collapse:collapse;"><thead><tr>${headHtml}</tr></thead><tbody>${rowHtml}</tbody></table></div>`;
}

// ============ 主编译入口 ============
export function compileComponent(comp, palette) {
	const warnings = [];
	const { comp: fixedComp, warnings: fixWarns } = pitfallFix(comp);
	warnings.push(...fixWarns);
	warnings.push(...layoutAdvisor(fixedComp));

	const result = { kind: "echarts", type: fixedComp.type, title: fixedComp.title, warnings };

	if (HTML_COMPONENTS.has(fixedComp.type)) {
		result.kind = "html";
		if (fixedComp.type === "JText" || fixedComp.type === "JDragDecoration") result.html = handleJText(fixedComp, palette);
		else if (fixedComp.type === "JCountTo" || fixedComp.type === "JNumber") result.html = handleJCountTo(fixedComp, palette);
		else if (fixedComp.type === "JStatsSummary") result.html = handleJStatsSummary(fixedComp, palette);
		else if (fixedComp.type === "JScrollBoard" || fixedComp.type === "JScrollTable") result.html = handleJScrollBoard(fixedComp, palette);
		else result.html = `<div style="padding:12px;border:1px dashed ${palette.axisLine};border-radius:6px;color:${palette.label};">${fixedComp.type}</div>`;
		return result;
	}

	if (ECHARTS_MAP.has(fixedComp.type)) {
		result.kind = "error";
		warnings.push(`⚠️ ${fixedComp.type} 需要中国 GeoJSON 地图数据，暂不支持。建议换 JBar/JScatter 组合`);
		return result;
	}

	if (ECHARTS_CARTESIAN.has(fixedComp.type)) { result.echartsOption = handleCartesian(fixedComp, palette); }
	else if (ECHARTS_POLAR.has(fixedComp.type)) { result.echartsOption = handlePolar(fixedComp, palette); }
	else if (ECHARTS_GAUGE.has(fixedComp.type)) { result.echartsOption = handleGauge(fixedComp, palette); }
	else if (fixedComp.type === "JScrollRankingBoard") { result.echartsOption = handleScrollRanking(fixedComp, palette); }
	else {
		result.kind = "error";
		warnings.push(`⚠️ ${fixedComp.type} 未实现对等 handler`);
		return result;
	}

	return result;
}

export function compileBigscreen(spec) {
	const paletteName = spec.palette ?? spec.page?.bg ?? "tech";
	const palette = PALETTES[paletteName] ?? PALETTES.tech;
	return {
		components: (spec.components ?? []).map(c => compileComponent(c, palette)),
		palette,
	};
}

/** 直接生成完整 HTML 大屏（iframe 预览用）。 */
export function generateBigscreenHtml(spec, { engine = "echarts" } = {}) {
	const { components, palette } = compileBigscreen(spec);
	const paletteName = spec.palette ?? "tech";
	const isScreen = (spec.page?.theme ?? "dark") === "dark";
	const css = isScreen
		? `body{background:#0a1929;color:#d4e8ff;font-family:system-ui,sans-serif;margin:0;padding:24px}.header{text-align:center;padding:24px 0;border-bottom:1px solid #1a3a5a;margin-bottom:24px}.header h1{color:#f0c040;margin:0 0 8px}.header p{color:#8ab8d0;margin:0}.grid{display:grid;gap:16px}.chart-card{background:rgba(11,30,58,0.3);border:1px solid #1a3a5a;border-radius:12px;padding:16px}.chart-card h3{margin:0 0 8px;color:${palette.subtitle};font-size:14px;font-weight:600}.chart-error{border-color:#ef4444;background:rgba(239,68,68,0.1)}`
		: `body{background:#f9fafb;color:#1f2937;font-family:system-ui,sans-serif;margin:0;padding:24px}.header{text-align:center;padding:24px 0;border-bottom:1px solid #e5e7eb;margin-bottom:24px}.header h1{color:#1f2937;margin:0 0 8px}.header p{color:#6b7280;margin:0}.grid{display:grid;gap:16px}.chart-card{background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:16px;box-shadow:0 1px 2px rgba(0,0,0,0.05)}.chart-card h3{margin:0 0 8px;color:#374151;font-size:14px;font-weight:600}.chart-error{border-color:#ef4444;background:#fef2f2}`;

	const head = `<!DOCTYPE html><html lang="zh"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${spec.page?.name ?? "数据大屏"}</title><script src="https://cdn.jsdelivr.net/npm/echarts@5.6.0/dist/echarts.min.js"></script><style>${css}</style></head><body><div class="header"><h1>${spec.page?.name ?? "数据大屏"}</h1><p>${paletteName} · ${engine.toUpperCase()} 引擎</p></div>`;

	const bodyHtml = components.map((c, i) => {
		const h = 280;
		if (c.kind === "html") return `<div class="chart-card"><h3>${c.title ?? `组件 ${i + 1}`}</h3><div style="height:${h}px;">${c.html}</div></div>`;
		if (c.kind === "error") return `<div class="chart-card chart-error"><h3>${c.title ?? `组件 ${i + 1}`}</h3><div style="height:${h}px;padding:16px;color:#ef4444;">⚠️ ${c.warnings?.join("; ")}</div></div>`;
		if (c.kind === "echarts" && c.echartsOption) {
			return `<div class="chart-card"><h3>${c.title ?? `组件 ${i + 1}`}</h3><div id="chart-${i}" style="width:100%;height:${h}px;"></div></div>`;
		}
		return "";
	}).join("");

	const gridCols = Math.min(components.filter(c => c.kind === "echarts" || c.kind === "html").length, 4);
	const gridStyle = `grid-template-columns:repeat(${Math.max(1, gridCols)}, 1fr);`;

	const js = `
echarts.registerTheme('dbx-dark', {backgroundColor:'transparent',textStyle:{color:'#d4e8ff'},color:['#00d4ff','#f0c040','#ff6b6b','#7ee8a2','#ffa726','#8ab8d0','#00ffc8','#d4a6ff'],tooltip:{backgroundColor:'rgba(11,30,58,0.85)',borderColor:'#1a3a5a',textStyle:{color:'#e0f0ff'}},legend:{textStyle:{color:'#8ab8d0'}},categoryAxis:{axisLine:{lineStyle:{color:'#1a3a5a'}},axisLabel:{color:'#8ab8d0'},splitLine:{lineStyle:{color:'rgba(26,58,90,0.33)'}}},valueAxis:{axisLine:{lineStyle:{color:'#1a3a5a'}},axisLabel:{color:'#8ab8d0'},splitLine:{lineStyle:{color:'rgba(26,58,90,0.33)'}}}});
echarts.registerTheme('dbx-light', {backgroundColor:'transparent',textStyle:{color:'#374151'},color:['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16'],tooltip:{backgroundColor:'rgba(255,255,255,0.95)',borderColor:'#e5e7eb',textStyle:{color:'#1f2937'}},legend:{textStyle:{color:'#4b5563'}},categoryAxis:{axisLine:{lineStyle:{color:'#d1d5db'}},axisLabel:{color:'#6b7280'},splitLine:{lineStyle:{color:'#f3f4f6'}}},valueAxis:{axisLine:{lineStyle:{color:'#d1d5db'}},axisLabel:{color:'#6b7280'},splitLine:{lineStyle:{color:'#f3f4f6'}}}});
(function(){
${components.map((c, i) => c.echartsOption ? `(function(){var d=document.getElementById('chart-${i}');if(d){var e=echarts.init(d,'${isScreen ? "dbx-dark" : "dbx-light"}');e.setOption(${JSON.stringify(c.echartsOption)});window.addEventListener('resize',function(){e.resize();});}})();` : `/* chart-${i}: ${c.kind} */`).join("\n")}
})();
`;

	return `${head}<div class="grid" style="${gridStyle}">${bodyHtml}</div><script>${js}</script></body></html>`;
}

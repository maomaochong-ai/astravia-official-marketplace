/**
 * dbx_chart_collection — 轻量看板/大屏生成工具。
 *
 * 接受 Chart.js charts[] 数组（与宿主 chart-renderer 的 ChartItem 格式兼容），
 * 自动 Grid 布局 + 主题样式（dashboard 浅 / screen 深 DataV），输出完整 HTML 页面。
 *
 * 与旧 dbx_dashboard / dbx_screen 的区别：
 *   - 不再执行 SQL（宿主 Agent 自己查数据）
 *   - 不再拼 preset HTML 模板（纯 Chart.js 渲染）
 *   - 不再走 Canvas / inferLayout 规则引擎
 *   - 只负责：Chart.js charts[] → Grid 布局 HTML 页面
 */

import type { PluginAgentToolRegistration } from "@astravia-org/plugin-sdk";
import { showVisualizationPreview, saveVisualizationToStore } from "../features/visualization/visualization-bridge";
import type { ChartItem } from "../domain/chart-contract";

export type ChartType = ChartItem["type"];

export interface DbxChartCollectionInput {
	/** 图表数组（Chart.js 格式，与宿主 chart-renderer 兼容） */
	charts: ChartItem[];
	/** 产物类型：dashboard (浅 QuickBI) 或 screen (深 DataV) */
	type?: "dashboard" | "screen";
	/** 页面标题 */
	title: string;
	/** 数据库连接名（用于记录来源） */
	connection_name?: string;
	/** 关联表名（用于记录来源） */
	table?: string;
	/** 布局策略：auto (响应式 grid) / grid-2 / grid-3 / grid-4 */
	layout?: "auto" | "grid-2" | "grid-3" | "grid-4";
}

/** Chart.js CDN（UMD 暴露全局 Chart，自动注册所有内置类型） */
const CHARTJS_CDN = "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js";

/**
 * 生成看板/大屏 HTML 页面（纯函数，导出以便测试）。
 * 输入: DbxChartCollectionInput（Chart.js charts[] + 主题 + 标题）
 * 输出: 完整 HTML 字符串（可直接 iframe srcDoc）
 */
export function generateHtml(input: DbxChartCollectionInput): string {
	const charts = input.charts.slice(0, 12); // 安全上限：12 个图
	const intent = input.type ?? "dashboard";
	const isScreen = intent === "screen";
	const title = input.title || "数据看板";

	// 布局列数
	const colClass =
		input.layout === "grid-2" ? "grid-template-columns: repeat(2, 1fr);"
	: input.layout === "grid-3" ? "grid-template-columns: repeat(3, 1fr);"
	: input.layout === "grid-4" ? "grid-template-columns: repeat(4, 1fr);"
	: charts.length <= 2 ? "grid-template-columns: repeat(2, 1fr);"
	: charts.length <= 4 ? "grid-template-columns: repeat(2, 1fr);"
	: charts.length <= 9 ? "grid-template-columns: repeat(3, 1fr);"
	: "grid-template-columns: repeat(4, 1fr);";

	// 主题样式
	const bgGradient = isScreen
		? "background: linear-gradient(135deg, #0c0c0c 0%, #1a1a2e 100%);"
		: "background: #f8fafc;";
	const cardBg = isScreen
		? "background: rgba(255,255,255,0.04); backdrop-filter: blur(12px);"
		: "background: #ffffff;";
	const cardBorder = isScreen
		? "border: 1px solid rgba(6,182,212,0.3);"
		: "border: 1px solid #e2e8f0;";
	const cardShadow = isScreen
		? "box-shadow: 0 0 24px rgba(6,182,212,0.15);"
		: "box-shadow: 0 1px 3px rgba(0,0,0,0.06);";
	const titleColor = isScreen ? "#a5f3fc" : "#1e293b";
	const subtitleColor = isScreen ? "#64748b" : "#64748b";
	const accentGradient = isScreen
		? "background: linear-gradient(90deg, #06b6d4, #3b82f6, #8b5cf6);"
		: "background: linear-gradient(90deg, #3b82f6, #8b5cf6);";
	const textFg = isScreen ? "#e2e8f0" : "#1e293b";
	const textMuted = isScreen ? "#94a3b8" : "#64748b";

	// 生成每个图表的 HTML + JS（单一来源，避免重复）
	const chartJsBlocks = charts.map((chart, i) => {
		const id = `chart-${i}`;
		const height = chart.height ?? (isScreen ? 280 : 250);
		return {
			html: `<div class="chart-card"><h3>${chart.title ?? `图表 ${i + 1}`}</h3>${chart.description ? `<p class="chart-desc">${chart.description}</p>` : ""}<div style="height:${height}px"><canvas id="${id}"></canvas></div></div>`,
			js: `new Chart(document.getElementById('${id}'),{type:'${chart.type}',data:${JSON.stringify(chart.data)},options:${JSON.stringify({responsive:true,maintainAspectRatio:false,plugins:{legend:{display:true,position:"bottom"},tooltip:{enabled:true}},...chart.options})}});`,
		};
	});

	return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<script src="${CHARTJS_CDN}"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;${bgGradient}color:${textFg};min-height:100vh;padding:clamp(16px,3vw,32px);}
.header{text-align:center;margin-bottom:clamp(16px,3vw,32px);}
.header h1{font-size:clamp(20px,3vw,32px);margin-bottom:8px;background:${accentGradient};-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;font-weight:600;letter-spacing:-0.5px;}
.header p{font-size:clamp(12px,1.5vw,14px);color:${subtitleColor};}
.grid{display:grid;${colClass}gap:clamp(12px,2vw,20px);max-width:${isScreen ? "1800px" : "1600px"};margin:0 auto;}
@media(max-width:768px){.grid{grid-template-columns:1fr;}}
.chart-card{${cardBg}${cardBorder}${cardShadow}border-radius:${isScreen ? "4px" : "12px"};padding:clamp(12px,2vw,20px);overflow:hidden;transition:transform .2s,box-shadow .2s;}
${isScreen ? ".chart-card{animation:fadeIn .5s ease-out forwards;opacity:0;}@keyframes fadeIn{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}.chart-card:nth-child(1){animation-delay:.1s}.chart-card:nth-child(2){animation-delay:.2s}.chart-card:nth-child(3){animation-delay:.3s}.chart-card:nth-child(4){animation-delay:.4s}.chart-card:nth-child(5){animation-delay:.5s}.chart-card:nth-child(6){animation-delay:.6s}" : ""}
.chart-card h3{font-size:clamp(12px,1.5vw,14px);margin-bottom:8px;color:${isScreen ? "#a5f3fc" : titleColor};font-weight:600;letter-spacing:.3px;}
.chart-desc{font-size:11px;color:${textMuted};margin-bottom:6px;}
</style>
</head>
<body>
<div class="header">
  <h1>${title}</h1>
  <p>${isScreen ? "数据大屏 · Auto Layout" : "企业看板 · Auto Layout"}</p>
</div>
<div class="grid">${chartJsBlocks.map((c) => c.html).join("")}</div>
<script>
${chartJsBlocks.map((c) => c.js).join("\n")}
</script>
</body>
</html>`;
}

export function createDbxChartCollectionTool(): PluginAgentToolRegistration<DbxChartCollectionInput> {
	return {
		id: "dbx_chart_collection",
		name: "dbx_chart_collection",
		label: "看板/大屏",
		description: [
			"Generate a full-page dashboard or big-screen by combining multiple Chart.js charts.",
			"Input: charts[] array (Chart.js { type, data: {labels, datasets}, options }).",
			"Output: HTML page with auto Grid layout + theme (dashboard=light, screen=dark).",
			"Use when you have multiple charts and want to package them into a shareable page.",
			"Max 12 charts. Compatible with render_chart tool's ChartItem format.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				charts: {
					type: "array",
					description: "Array of Chart.js chart items (type, data, title, options, height). Max 12.",
					items: {
						type: "object",
						properties: {
							type: { type: "string", enum: ["line", "bar", "pie", "doughnut", "polarArea", "radar", "scatter", "bubble"] },
							data: { type: "object" },
							title: { type: "string" },
							description: { type: "string" },
							height: { type: "number" },
							options: { type: "object" },
						},
						required: ["type", "data"],
					},
					minItems: 1,
					maxItems: 12,
				},
				type: { type: "string", enum: ["dashboard", "screen"], description: "Page theme. dashboard=light QuickBI, screen=dark DataV." },
				title: { type: "string", description: "Page title." },
				connection_name: { type: "string", description: "Source connection name (for tracking)." },
				table: { type: "string", description: "Source table name (for tracking)." },
				layout: { type: "string", enum: ["auto", "grid-2", "grid-3", "grid-4"], description: "Grid columns. auto=responsive." },
			},
			required: ["charts", "title"],
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"],
		handler: async ({ trigger: { input } }) => {
			const { charts, type = "dashboard", title, connection_name = "", table = "" } = input;

			if (!charts?.length) return { ok: false, error: "charts[] must be non-empty" };
			if (!title) return { ok: false, error: "title is required" };

			try {
				const trimmed = charts.slice(0, 12);
				const html = generateHtml(input);

				const viz = {
					title,
					type,
					connection: connection_name,
					table,
					html,
					chartItems: trimmed,
				};

				saveVisualizationToStore(viz);
				showVisualizationPreview(viz);

				return {
					ok: true,
					title,
					type,
					chartCount: trimmed.length,
					message: `${type === "screen" ? "大屏" : "看板"}「${title}」已生成（${trimmed.length} 个图表）。`,
				};
			} catch (error) {
				return { ok: false, error: error instanceof Error ? error.message : String(error) };
			}
		},
	};
}

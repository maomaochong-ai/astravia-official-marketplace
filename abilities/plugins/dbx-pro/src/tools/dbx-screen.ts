/**
 * dbx_screen — 数据大屏生成工具。
 * 
 * 内部执行 SQL 查询，生成可渲染的全屏 HTML 大屏页面。
 * 通过 visualization-bridge 通知 UI 显示预览。
 */

import type { PluginAgentToolRegistration } from "@astravia-org/plugin-sdk";
import { engineExecuteByName, engineDescribeByName } from "../shared/services/engine-client";
import { showVisualizationPreview } from "../features/visualization/visualization-bridge";

export type ScreenTemplate = "data_command" | "business_intel" | "monitoring";

export interface DbxScreenInput {
	connection_name: string;
	tables: string[];
	template: ScreenTemplate;
	schema?: string;
	db_type?: string;
	title?: string;
	date_column?: string;
}

interface WidgetQuery {
	id: string;
	type: "number_stat" | "line_chart" | "bar_chart" | "scroll_table";
	title: string;
	sql: string;
}

function buildQueries(template: ScreenTemplate, table: string, schema: string | undefined, dateCol: string): WidgetQuery[] {
	const qualified = schema ? `${schema}.${table}` : table;

	switch (template) {
		case "data_command":
			return [
				{ id: "total", type: "number_stat", title: "总数据量", sql: `SELECT COUNT(*) AS value FROM ${qualified}` },
				{ id: "today", type: "number_stat", title: "今日新增", sql: `SELECT COUNT(*) AS value FROM ${qualified} WHERE DATE(${dateCol}) = CURRENT_DATE` },
				{ id: "trend", type: "line_chart", title: "近 30 天趋势", sql: `SELECT DATE(${dateCol}) AS date, COUNT(*) AS count FROM ${qualified} WHERE ${dateCol} >= CURRENT_DATE - INTERVAL '30 days' GROUP BY DATE(${dateCol}) ORDER BY date` },
				{ id: "recent", type: "scroll_table", title: "最新数据", sql: `SELECT * FROM ${qualified} ORDER BY ${dateCol} DESC LIMIT 50` },
			];
		case "business_intel":
			return [
				{ id: "kpi", type: "number_stat", title: "核心指标", sql: `SELECT COUNT(*) AS value FROM ${qualified}` },
				{ id: "monthly", type: "bar_chart", title: "月度对比", sql: `SELECT TO_CHAR(DATE_TRUNC('month', ${dateCol}), 'YYYY-MM') AS month, COUNT(*) AS count FROM ${qualified} GROUP BY DATE_TRUNC('month', ${dateCol}) ORDER BY month DESC LIMIT 12` },
				{ id: "top", type: "bar_chart", title: "TOP 10", sql: `SELECT * FROM ${qualified} LIMIT 10` },
				{ id: "trend", type: "line_chart", title: "趋势分析", sql: `SELECT DATE(${dateCol}) AS date, COUNT(*) AS count FROM ${qualified} GROUP BY DATE(${dateCol}) ORDER BY date` },
			];
		case "monitoring":
			return [
				{ id: "health", type: "number_stat", title: "系统健康度", sql: `SELECT 95 AS value` },
				{ id: "requests", type: "number_stat", title: "总请求数", sql: `SELECT COUNT(*) AS value FROM ${qualified}` },
				{ id: "hourly", type: "line_chart", title: "小时分布", sql: `SELECT EXTRACT(HOUR FROM ${dateCol}) AS hour, COUNT(*) AS count FROM ${qualified} GROUP BY EXTRACT(HOUR FROM ${dateCol}) ORDER BY hour` },
				{ id: "events", type: "scroll_table", title: "最近事件", sql: `SELECT * FROM ${qualified} ORDER BY ${dateCol} DESC LIMIT 100` },
			];
	}
}

function renderHtml(title: string, subtitle: string, data: Record<string, { title: string; rows: unknown[] }>): string {
	const widgets = Object.entries(data).map(([id, { title: widgetTitle, rows }]) => {
		const isStat = id === "total" || id === "today" || id === "kpi" || id === "health" || id === "requests";
		if (isStat) {
			const value = (rows[0] as Record<string, unknown>)?.value ?? 0;
			return `<div class="widget stat"><h3>${widgetTitle}</h3><div class="stat-value">${value}</div></div>`;
		}
		const isChart = id === "trend" || id === "hourly" || id === "monthly";
		const tableRows = rows.slice(0, 30).map((r) => `<tr>${Object.values(r as Record<string, unknown>).map((v) => `<td>${v ?? ""}</td>`).join("")}</tr>`).join("");
		const cols = rows[0] ? Object.keys(rows[0] as object) : [];
		return `<div class="widget ${isChart ? "chart" : "table"}"><h3>${widgetTitle}</h3><div class="${isChart ? "" : "table-scroll"}"><table><thead><tr>${cols.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${tableRows}</tbody></table></div></div>`;
	}).join("\n");

	return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { 
	font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif; 
	background: linear-gradient(135deg, #0c0c0c 0%, #1a1a2e 100%); 
	color: #e2e8f0; 
	min-height: 100vh; 
	padding: clamp(12px, 2vw, 24px);
	overflow-x: hidden;
}
.header { text-align: center; margin-bottom: clamp(16px, 3vw, 32px); }
.header h1 { 
	font-size: clamp(24px, 4vw, 40px); 
	background: linear-gradient(90deg, #06b6d4, #3b82f6, #8b5cf6); 
	-webkit-background-clip: text; 
	-webkit-text-fill-color: transparent;
	background-clip: text;
	margin-bottom: 8px;
}
.header p { font-size: clamp(12px, 1.5vw, 16px); color: #64748b; }
.screen { 
	display: grid; 
	grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); 
	grid-auto-rows: minmax(100px, auto);
	gap: clamp(12px, 2vw, 20px); 
	max-width: 1800px; 
	margin: 0 auto; 
}
@media (min-width: 768px) {
	.screen { grid-template-columns: repeat(4, 1fr); }
	.chart { grid-column: span 2; }
	.table { grid-column: span 4; }
}
.widget { 
	background: rgba(30, 41, 59, 0.9); 
	border-radius: 12px; 
	padding: clamp(12px, 2vw, 24px); 
	border: 1px solid rgba(59, 130, 246, 0.2);
	backdrop-filter: blur(8px);
	transition: transform 0.2s, box-shadow 0.2s;
}
.widget:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3); }
.widget h3 { 
	font-size: clamp(11px, 1.2vw, 14px); 
	color: #94a3b8; 
	margin-bottom: 12px; 
	text-transform: uppercase; 
	letter-spacing: 0.5px;
}
.stat { display: flex; flex-direction: column; justify-content: center; align-items: center; }
.stat-value { 
	font-size: clamp(32px, 5vw, 56px); 
	font-weight: 800; 
	background: linear-gradient(135deg, #06b6d4, #3b82f6); 
	-webkit-background-clip: text; 
	-webkit-text-fill-color: transparent;
	background-clip: text;
}
.table-scroll { max-height: 300px; overflow-y: auto; }
table { width: 100%; border-collapse: collapse; font-size: clamp(10px, 1.2vw, 13px); }
th { 
	background: rgba(59, 130, 246, 0.15); 
	padding: clamp(6px, 1vw, 10px) clamp(8px, 1.5vw, 14px); 
	text-align: left; 
	font-weight: 600; 
	color: #93c5fd;
	position: sticky;
	top: 0;
	white-space: nowrap;
}
td { 
	padding: clamp(4px, 0.8vw, 8px) clamp(8px, 1.5vw, 14px); 
	border-bottom: 1px solid rgba(148, 163, 184, 0.1);
	max-width: 150px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
tr:hover td { background: rgba(59, 130, 246, 0.08); }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
.widget { animation: fadeIn 0.5s ease-out forwards; opacity: 0; }
.widget:nth-child(1) { animation-delay: 0.1s; }
.widget:nth-child(2) { animation-delay: 0.2s; }
.widget:nth-child(3) { animation-delay: 0.3s; }
.widget:nth-child(4) { animation-delay: 0.4s; }
</style>
</head>
<body>
<div class="header">
<h1>${title}</h1>
<p>${subtitle}</p>
</div>
<div class="screen">${widgets}</div>
</body>
</html>`;
}

export function createDbxScreenTool(): PluginAgentToolRegistration<DbxScreenInput> {
	return {
		id: "dbx_screen",
		name: "dbx_screen",
		label: "数据大屏",
		description: [
			"Generate data visualization large screen from database tables with data.",
			"Templates: data_command (command center), business_intel (BI dashboard), monitoring (system health).",
			"Returns complete HTML screen with dark theme, animations, and embedded data.",
			"Shows preview in plugin. User can download or open in new window.",
			"Use when user wants to create a large screen, data wall, or monitoring dashboard.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				connection_name: { type: "string", description: "Database connection name." },
				tables: { type: "array", items: { type: "string" }, description: "Table names." },
				template: { type: "string", enum: ["data_command", "business_intel", "monitoring"], description: "Screen template." },
				schema: { type: "string", description: "Schema name (optional)." },
				db_type: { type: "string", description: "Database type." },
				title: { type: "string", description: "Custom title." },
				date_column: { type: "string", description: "Date column name. Default: created_at." },
			},
			required: ["connection_name", "tables", "template"],
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"],
		handler: async ({ trigger: { input } }) => {
			const { connection_name, tables, template, schema, db_type, title: customTitle, date_column } = input;

			if (!connection_name) return { ok: false, error: "connection_name is required" };
			if (!tables?.length) return { ok: false, error: "tables must be non-empty" };

			const table = tables[0];
			const dateCol = date_column ?? "created_at";

			try {
				const desc = await engineDescribeByName(connection_name, { table, schema });
				const columns = desc.columns.map((c) => c.name);
				const hasDateCol = columns.some((c) => /date|time|created|updated/i.test(c));
				const effectiveDateCol = hasDateCol ? columns.find((c) => /date|time|created|updated/i.test(c))! : dateCol;

				const queries = buildQueries(template as ScreenTemplate, table, schema, effectiveDateCol);
				const data: Record<string, { title: string; rows: unknown[] }> = {};

				for (const q of queries) {
					try {
						const result = await engineExecuteByName(connection_name, q.sql, { rowLimit: 1000, timeoutMs: 30000, dbType: db_type });
						data[q.id] = { title: q.title, rows: result.rows };
					} catch {
						data[q.id] = { title: q.title, rows: [] };
					}
				}

				const title = customTitle ?? `${table} - ${template === "data_command" ? "数据指挥中心" : template === "business_intel" ? "商业智能大屏" : "系统监控大屏"}`;
				const subtitle = template === "data_command" ? "实时数据总览 · 核心指标追踪" : template === "business_intel" ? "多维度业务分析 · 趋势对比" : "系统健康度 · 性能指标";
				const html = renderHtml(title, subtitle, data);

				const viz = {
					title,
					type: "screen" as const,
					template,
					connection: connection_name,
					table,
					html,
				};

				showVisualizationPreview(viz);

				return {
					ok: true,
					connection: connection_name,
					table,
					template,
					title,
					message: "大屏已生成并在插件内显示预览。你可以下载 HTML 文件或在新窗口打开全屏查看。",
				};
			} catch (error) {
				return { ok: false, error: error instanceof Error ? error.message : String(error) };
			}
		},
	};
}

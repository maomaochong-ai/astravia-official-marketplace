/**
 * dbx_dashboard — 企业级看板生成工具。
 * 
 * 内部执行 SQL 查询，返回结构化数据供组件渲染。
 * 通过 visualization-bridge 通知 UI 显示预览。
 */

import type { PluginAgentToolRegistration } from "@astravia-org/plugin-sdk";
import { engineExecuteByName, engineDescribeByName } from "../shared/services/engine-client";
import { showVisualizationPreview, saveVisualizationToStore } from "../features/visualization/visualization-bridge";

export type DashboardTemplate = "kpi_overview" | "trend_analysis" | "data_profile";

export interface DbxDashboardInput {
	connection_name: string;
	tables: string[];
	template: DashboardTemplate;
	schema?: string;
	db_type?: string;
	date_column?: string;
}

interface ChartQuery {
	id: string;
	type: "kpi_card" | "line" | "bar" | "table";
	title: string;
	sql: string;
}

function buildQueries(template: DashboardTemplate, table: string, schema: string | undefined, dateCol: string): ChartQuery[] {
	const qualified = schema ? `${schema}.${table}` : table;

	switch (template) {
		case "kpi_overview":
			return [
				{ id: "kpi_total", type: "kpi_card", title: "总记录数", sql: `SELECT COUNT(*) AS value FROM ${qualified}` },
				{ id: "kpi_recent", type: "kpi_card", title: "近 7 天新增", sql: `SELECT COUNT(*) AS value FROM ${qualified} WHERE ${dateCol} >= CURRENT_DATE - INTERVAL '7 days'` },
				{ id: "trend", type: "line", title: "近 30 天趋势", sql: `SELECT DATE(${dateCol}) AS date, COUNT(*) AS count FROM ${qualified} WHERE ${dateCol} >= CURRENT_DATE - INTERVAL '30 days' GROUP BY DATE(${dateCol}) ORDER BY date` },
				{ id: "top", type: "bar", title: "TOP 10 分布", sql: `SELECT * FROM ${qualified} ORDER BY 1 DESC LIMIT 10` },
				{ id: "recent", type: "table", title: "最新数据", sql: `SELECT * FROM ${qualified} ORDER BY ${dateCol} DESC LIMIT 20` },
			];
		case "trend_analysis":
			return [
				{ id: "daily", type: "line", title: "日趋势", sql: `SELECT DATE(${dateCol}) AS date, COUNT(*) AS count FROM ${qualified} GROUP BY DATE(${dateCol}) ORDER BY date` },
				{ id: "weekly", type: "line", title: "周趋势", sql: `SELECT DATE_TRUNC('week', ${dateCol}) AS week, COUNT(*) AS count FROM ${qualified} GROUP BY DATE_TRUNC('week', ${dateCol}) ORDER BY week` },
				{ id: "monthly", type: "bar", title: "月趋势", sql: `SELECT DATE_TRUNC('month', ${dateCol}) AS month, COUNT(*) AS count FROM ${qualified} GROUP BY DATE_TRUNC('month', ${dateCol}) ORDER BY month` },
			];
		case "data_profile":
			return [
				{ id: "count", type: "kpi_card", title: "总行数", sql: `SELECT COUNT(*) AS value FROM ${qualified}` },
				{ id: "sample", type: "table", title: "样本数据", sql: `SELECT * FROM ${qualified} LIMIT 50` },
			];
	}
}

export function createDbxDashboardTool(): PluginAgentToolRegistration<DbxDashboardInput> {
	return {
		id: "dbx_dashboard",
		name: "dbx_dashboard",
		label: "企业看板",
		description: [
			"Generate enterprise dashboard from database tables with data.",
			"Templates: kpi_overview (KPI cards + trends), trend_analysis (time series), data_profile (statistics).",
			"Returns structured data for component rendering.",
			"Use when user wants to create a dashboard, visualize data, or analyze metrics from tables.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				connection_name: { type: "string", description: "Database connection name." },
				tables: { type: "array", items: { type: "string" }, description: "Table names." },
				template: { type: "string", enum: ["kpi_overview", "trend_analysis", "data_profile"], description: "Dashboard template." },
				schema: { type: "string", description: "Schema name (optional)." },
				db_type: { type: "string", description: "Database type (e.g., postgres, mysql)." },
				date_column: { type: "string", description: "Date column name. Default: created_at." },
			},
			required: ["connection_name", "tables", "template"],
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"],
		handler: async ({ trigger: { input } }) => {
			const { connection_name, tables, template, schema, db_type, date_column } = input;

			if (!connection_name) return { ok: false, error: "connection_name is required" };
			if (!tables?.length) return { ok: false, error: "tables must be non-empty" };

			const table = tables[0];
			const dateCol = date_column ?? "created_at";

			try {
				const desc = await engineDescribeByName(connection_name, { table, schema });
				const columns = desc.columns.map((c) => c.name);
				const hasDateCol = columns.some((c) => /date|time|created|updated/i.test(c));
				const effectiveDateCol = hasDateCol ? columns.find((c) => /date|time|created|updated/i.test(c))! : dateCol;

				const queries = buildQueries(template as DashboardTemplate, table, schema, effectiveDateCol);
				const charts = [];

				for (const q of queries) {
					try {
						const result = await engineExecuteByName(connection_name, q.sql, { rowLimit: 1000, timeoutMs: 30000, dbType: db_type });
						charts.push({
							id: q.id,
							type: q.type,
							title: q.title,
							columns: result.columns,
							rows: result.rows,
						});
					} catch {
						charts.push({
							id: q.id,
							type: q.type,
							title: q.title,
							columns: [],
							rows: [],
						});
					}
				}

				const title = `${table} - ${template === "kpi_overview" ? "KPI 总览" : template === "trend_analysis" ? "趋势分析" : "数据画像"}`;
				
				// 生成 HTML 用于预览
				const html = generatePreviewHtml(title, charts);

				const viz = {
					title,
					type: "dashboard" as const,
					template,
					connection: connection_name,
					table,
					html,
					charts, // 结构化数据
				};

				showVisualizationPreview(viz);
				saveVisualizationToStore(viz);

				return {
					ok: true,
					connection: connection_name,
					table,
					template,
					title,
					charts,
					message: "看板已生成并在插件内显示预览。",
				};
			} catch (error) {
				return { ok: false, error: error instanceof Error ? error.message : String(error) };
			}
		},
	};
}

function generatePreviewHtml(title: string, charts: Array<{ id: string; type: string; title: string; columns?: string[]; rows?: Array<Record<string, unknown>> }>): string {
	const content = charts.map((chart) => {
		if (chart.type === "kpi_card") {
			const value = chart.rows?.[0]?.value ?? 0;
			return `<div class="kpi-card"><h3>${chart.title}</h3><div class="kpi-value">${value}</div></div>`;
		}
		if (chart.type === "line" || chart.type === "bar") {
			const rows = (chart.rows ?? []).slice(0, 10).map((r) => `<tr>${Object.values(r).map((v) => `<td>${v ?? ""}</td>`).join("")}</tr>`).join("");
			const cols = chart.columns ?? [];
			return `<div class="chart-card"><h3>${chart.title}</h3><div class="table-wrapper"><table><thead><tr>${cols.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div></div>`;
		}
		const rows = (chart.rows ?? []).slice(0, 20).map((r) => `<tr>${Object.values(r).map((v) => `<td>${v ?? ""}</td>`).join("")}</tr>`).join("");
		const cols = chart.columns ?? [];
		return `<div class="table-card"><h3>${chart.title}</h3><div class="table-wrapper"><table><thead><tr>${cols.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div></div>`;
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
	background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); 
	color: #e2e8f0; 
	min-height: 100vh; 
	padding: clamp(16px, 3vw, 32px);
}
h1 { 
	text-align: center; 
	font-size: clamp(20px, 3vw, 32px); 
	margin-bottom: clamp(16px, 3vw, 32px); 
	background: linear-gradient(90deg, #3b82f6, #8b5cf6); 
	-webkit-background-clip: text; 
	-webkit-text-fill-color: transparent;
	background-clip: text;
}
.dashboard { 
	display: grid; 
	grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); 
	gap: clamp(12px, 2vw, 24px); 
	max-width: 1600px; 
	margin: 0 auto; 
}
.kpi-card { 
	background: rgba(30, 41, 59, 0.8); 
	border-radius: 12px; 
	padding: clamp(16px, 2vw, 24px); 
	border: 1px solid rgba(59, 130, 246, 0.3);
}
.kpi-card h3 { font-size: clamp(12px, 1.5vw, 14px); color: #94a3b8; margin-bottom: 8px; }
.kpi-value { font-size: clamp(24px, 4vw, 40px); font-weight: 700; color: #3b82f6; }
.chart-card, .table-card { 
	background: rgba(30, 41, 59, 0.8); 
	border-radius: 12px; 
	padding: clamp(12px, 2vw, 20px); 
	border: 1px solid rgba(139, 92, 246, 0.3);
	overflow: hidden;
}
.chart-card { grid-column: span 1; }
@media (min-width: 768px) {
	.chart-card { grid-column: span 2; }
}
@media (min-width: 1200px) {
	.dashboard { grid-template-columns: repeat(3, 1fr); }
	.chart-card { grid-column: span 2; }
	.table-card { grid-column: 1 / -1; }
}
.chart-card h3, .table-card h3 { 
	font-size: clamp(14px, 1.5vw, 16px); 
	margin-bottom: 12px; 
	color: #a5b4fc; 
}
.table-wrapper {
	overflow-x: auto;
	overflow-y: auto;
	max-height: 400px;
}
table { width: 100%; border-collapse: collapse; font-size: clamp(11px, 1.2vw, 13px); min-width: 600px; }
th { 
	background: rgba(59, 130, 246, 0.2); 
	padding: clamp(6px, 1vw, 10px) clamp(8px, 1.5vw, 14px); 
	text-align: left; 
	font-weight: 600; 
	color: #93c5fd;
	white-space: nowrap;
	position: sticky;
	top: 0;
	z-index: 10;
}
td { 
	padding: clamp(4px, 0.8vw, 8px) clamp(8px, 1.5vw, 14px); 
	border-bottom: 1px solid rgba(148, 163, 184, 0.1);
	max-width: 150px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
tr:hover td { background: rgba(59, 130, 246, 0.1); }
</style>
</head>
<body>
<h1>${title}</h1>
<div class="dashboard">${content}</div>
</body>
</html>`;
}

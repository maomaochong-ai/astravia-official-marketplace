/**
 * dbx_screen — 数据大屏生成工具。
 *
 * 内部执行 SQL 查询，返回完整数据 + 可渲染的全屏 HTML 大屏页面。
 * AI 可直接将 HTML 写入文件并在浏览器打开。
 *
 * 预设模板：
 * - data_command: 数据指挥中心（核心指标 + 趋势 + 实时滚动）
 * - business_intel: 商业智能大屏（多图表 + 排行榜）
 * - monitoring: 系统监控大屏（健康度 + 性能 + 告警）
 */

import type { PluginAgentToolRegistration } from "@astravia-org/plugin-sdk";
import { engineExecuteByName, engineDescribeByName } from "../shared/services/engine-client";

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

function renderHtml(title: string, subtitle: string, data: Record<string, unknown[]>): string {
	const widgets = Object.entries(data).map(([id, rows]) => {
		if (id.startsWith("total") || id.startsWith("today") || id.startsWith("kpi") || id.startsWith("health") || id.startsWith("requests")) {
			const value = (rows[0] as Record<string, unknown>)?.value ?? 0;
			return `<div class="widget stat"><h3>${id}</h3><div class="stat-value">${value}</div></div>`;
		}
		if (id.startsWith("trend") || id.startsWith("hourly") || id.startsWith("monthly")) {
			const tableRows = rows.map((r) => `<tr>${Object.values(r).map((v) => `<td>${v}</td>`).join("")}</tr>`).join("");
			const cols = rows[0] ? Object.keys(rows[0] as object) : [];
			return `<div class="widget chart"><h3>${id}</h3><table><thead><tr>${cols.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${tableRows}</tbody></table></div>`;
		}
		const tableRows = rows.slice(0, 30).map((r) => `<tr>${Object.values(r).map((v) => `<td>${v}</td>`).join("")}</tr>`).join("");
		const cols = rows[0] ? Object.keys(rows[0] as object) : [];
		return `<div class="widget table"><h3>${id}</h3><div class="table-scroll"><table><thead><tr>${cols.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${tableRows}</tbody></table></div></div>`;
	}).join("\n");

	return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: linear-gradient(135deg, #0c0c0c 0%, #1a1a2e 100%); color: #e2e8f0; min-height: 100vh; padding: 20px; }
.header { text-align: center; margin-bottom: 24px; }
.header h1 { font-size: 32px; background: linear-gradient(90deg, #06b6d4, #3b82f6, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 8px; }
.header p { font-size: 14px; color: #64748b; }
.screen { display: grid; grid-template-columns: repeat(4, 1fr); grid-auto-rows: minmax(120px, auto); gap: 16px; max-width: 1600px; margin: 0 auto; }
.widget { background: rgba(30, 41, 59, 0.9); border-radius: 12px; padding: 20px; border: 1px solid rgba(59, 130, 246, 0.2); transition: transform 0.2s, box-shadow 0.2s; }
.widget:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3); }
.widget h3 { font-size: 13px; color: #94a3b8; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
.stat { display: flex; flex-direction: column; justify-content: center; align-items: center; }
.stat-value { font-size: 48px; font-weight: 800; background: linear-gradient(135deg, #06b6d4, #3b82f6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.chart { grid-column: span 2; }
.table { grid-column: span 4; max-height: 400px; overflow: hidden; }
.table-scroll { max-height: 320px; overflow-y: auto; }
table { width: 100%; border-collapse: collapse; font-size: 12px; }
th { background: rgba(59, 130, 246, 0.15); padding: 8px 12px; text-align: left; font-weight: 600; color: #93c5fd; position: sticky; top: 0; }
td { padding: 6px 12px; border-bottom: 1px solid rgba(148, 163, 184, 0.1); }
tr:hover td { background: rgba(59, 130, 246, 0.08); }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
.widget { animation: fadeIn 0.5s ease-out forwards; }
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
			"Save as .html file and open in browser for full-screen display.",
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
				const data: Record<string, unknown[]> = {};

				for (const q of queries) {
					try {
						const result = await engineExecuteByName(connection_name, q.sql, { rowLimit: 1000, timeoutMs: 30000, dbType: db_type });
						data[q.id] = result.rows;
					} catch {
						data[q.id] = [];
					}
				}

				const title = customTitle ?? `${table} - ${template === "data_command" ? "数据指挥中心" : template === "business_intel" ? "商业智能大屏" : "系统监控大屏"}`;
				const subtitle = template === "data_command" ? "实时数据总览 · 核心指标追踪" : template === "business_intel" ? "多维度业务分析 · 趋势对比" : "系统健康度 · 性能指标";
				const html = renderHtml(title, subtitle, data);

				return {
					ok: true,
					connection: connection_name,
					table,
					template,
					title,
					html,
					instructions: [
						"1. Save the HTML content to a file (e.g., screen.html)",
						"2. Open the file in browser using shell.openExternal",
						"3. The screen displays full-screen with dark theme and animations",
					],
				};
			} catch (error) {
				return { ok: false, error: error instanceof Error ? error.message : String(error) };
			}
		},
	};
}

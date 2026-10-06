/**
 * dbx_dashboard — 企业级看板生成工具。
 *
 * 内部执行 SQL 查询，返回完整数据 + 可渲染的 HTML 看板页面。
 * AI 可直接将 HTML 写入文件并在浏览器打开。
 *
 * 预设模板：
 * - kpi_overview: KPI 总览（核心指标卡片 + 趋势图 + 分布图）
 * - trend_analysis: 趋势分析（多维度时间序列 + 同比环比）
 * - data_profile: 数据画像（统计摘要 + 分布分析）
 */

import type { PluginAgentToolRegistration } from "@astravia-org/plugin-sdk";
import { engineExecuteByName, engineDescribeByName } from "../shared/services/engine-client";

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
	type: "kpi_card" | "line" | "bar" | "pie" | "table";
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

function renderHtml(title: string, data: Record<string, unknown[]>): string {
	const charts = Object.entries(data).map(([id, rows]) => {
		if (id.startsWith("kpi_")) {
			const value = (rows[0] as Record<string, unknown>)?.value ?? 0;
			return `<div class="kpi-card"><h3>${id}</h3><div class="kpi-value">${value}</div></div>`;
		}
		if (id.startsWith("trend") || id.startsWith("daily") || id.startsWith("weekly") || id.startsWith("monthly")) {
			const tableRows = rows.map((r) => `<tr>${Object.values(r).map((v) => `<td>${v}</td>`).join("")}</tr>`).join("");
			const cols = rows[0] ? Object.keys(rows[0] as object) : [];
			return `<div class="chart-card"><h3>${id}</h3><table><thead><tr>${cols.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${tableRows}</tbody></table></div>`;
		}
		const tableRows = rows.slice(0, 20).map((r) => `<tr>${Object.values(r).map((v) => `<td>${v}</td>`).join("")}</tr>`).join("");
		const cols = rows[0] ? Object.keys(rows[0] as object) : [];
		return `<div class="chart-card"><h3>${id}</h3><table><thead><tr>${cols.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${tableRows}</tbody></table></div>`;
	}).join("\n");

	return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #e2e8f0; min-height: 100vh; padding: 24px; }
h1 { text-align: center; font-size: 28px; margin-bottom: 24px; background: linear-gradient(90deg, #3b82f6, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.dashboard { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; max-width: 1400px; margin: 0 auto; }
.kpi-card { background: rgba(30, 41, 59, 0.8); border-radius: 12px; padding: 24px; border: 1px solid rgba(59, 130, 246, 0.3); }
.kpi-card h3 { font-size: 14px; color: #94a3b8; margin-bottom: 8px; }
.kpi-value { font-size: 36px; font-weight: 700; color: #3b82f6; }
.chart-card { background: rgba(30, 41, 59, 0.8); border-radius: 12px; padding: 20px; border: 1px solid rgba(139, 92, 246, 0.3); grid-column: span 2; }
.chart-card h3 { font-size: 16px; margin-bottom: 12px; color: #a5b4fc; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th { background: rgba(59, 130, 246, 0.2); padding: 8px 12px; text-align: left; font-weight: 600; color: #93c5fd; }
td { padding: 6px 12px; border-bottom: 1px solid rgba(148, 163, 184, 0.1); }
tr:hover td { background: rgba(59, 130, 246, 0.1); }
</style>
</head>
<body>
<h1>${title}</h1>
<div class="dashboard">${charts}</div>
</body>
</html>`;
}

export function createDbxDashboardTool(): PluginAgentToolRegistration<DbxDashboardInput> {
	return {
		id: "dbx_dashboard",
		name: "dbx_dashboard",
		label: "企业看板",
		description: [
			"Generate enterprise dashboard from database tables with data.",
			"Templates: kpi_overview (KPI cards + trends), trend_analysis (time series), data_profile (statistics).",
			"Returns complete HTML dashboard with embedded data. Save as .html file and open in browser.",
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
				const data: Record<string, unknown[]> = {};

				for (const q of queries) {
					try {
						const result = await engineExecuteByName(connection_name, q.sql, { rowLimit: 1000, timeoutMs: 30000, dbType: db_type });
						data[q.id] = result.rows;
					} catch {
						data[q.id] = [];
					}
				}

				const title = `${table} - ${template === "kpi_overview" ? "KPI 总览" : template === "trend_analysis" ? "趋势分析" : "数据画像"}`;
				const html = renderHtml(title, data);

				return {
					ok: true,
					connection: connection_name,
					table,
					template,
					title,
					html,
					instructions: [
						"1. Save the HTML content to a file (e.g., dashboard.html)",
						"2. Open the file in browser using shell.openExternal",
						"3. The dashboard displays with dark theme and responsive layout",
					],
				};
			} catch (error) {
				return { ok: false, error: error instanceof Error ? error.message : String(error) };
			}
		},
	};
}

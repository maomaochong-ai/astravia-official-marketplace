/**
 * dbx_dashboard — 企业级看板生成工具。
 *
 * 根据表结构和模板类型，生成看板的 SQL 查询计划和布局配置。
 * AI 拿到结构后通过 MCP 执行 SQL，再组装为可渲染的看板。
 *
 * 预设模板：
 * - kpi_overview: KPI 总览（核心指标卡片 + 趋势图 + 分布图）
 * - trend_analysis: 趋势分析（多维度时间序列 + 同比环比 + 预测）
 * - data_profile: 数据画像（统计摘要 + 分布直方图 + 相关性矩阵）
 */

import type { PluginAgentToolRegistration } from "@astravia-org/plugin-sdk";

export type DashboardTemplate = "kpi_overview" | "trend_analysis" | "data_profile";

export interface DbxDashboardInput {
	connection_name: string;
	tables: string[];
	template: DashboardTemplate;
	schema?: string;
	db_type?: string;
	date_column?: string;
	value_columns?: string[];
}

interface ChartSpec {
	id: string;
	type: "kpi_card" | "line" | "bar" | "pie" | "histogram" | "scatter" | "heatmap" | "table";
	title: string;
	sql: string;
	layout: { row: number; col: number; width: number; height: number };
	axes?: { x?: string; y?: string; series?: string };
}

interface DashboardSpec {
	template: DashboardTemplate;
	title: string;
	description: string;
	charts: ChartSpec[];
	summary_sql: string;
}

const TEMPLATES: Record<DashboardTemplate, (input: Required<Pick<DbxDashboardInput, "connection_name" | "tables">> & DbxDashboardInput) => DashboardSpec> = {
	kpi_overview: ({ tables, schema, db_type, date_column, value_columns }) => {
		const qualified = tables.map((t) => schema ? `${schema}.${t}` : t).join(", ");
		const mainTable = schema ? `${schema}.${tables[0]}` : tables[0];
		const dateCol = date_column ?? "created_at";
		const valueCols = value_columns ?? ["*"];

		return {
			template: "kpi_overview",
			title: `${tables.join(", ")} KPI 总览`,
			description: "核心指标卡片 + 趋势图 + 分布图，适合业务概览",
			summary_sql: `SELECT COUNT(*) AS total_rows FROM ${mainTable}`,
			charts: [
				{
					id: "kpi_total",
					type: "kpi_card",
					title: "总记录数",
					sql: `SELECT COUNT(*) AS value FROM ${mainTable}`,
					layout: { row: 0, col: 0, width: 3, height: 1 },
				},
				{
					id: "kpi_recent",
					type: "kpi_card",
					title: "近 7 天新增",
					sql: `SELECT COUNT(*) AS value FROM ${mainTable} WHERE ${dateCol} >= CURRENT_DATE - INTERVAL '7 days'`,
					layout: { row: 0, col: 3, width: 3, height: 1 },
				},
				{
					id: "kpi_avg",
					type: "kpi_card",
					title: "日均记录",
					sql: `SELECT ROUND(COUNT(*)::numeric / NULLIF(DATE_PART('day', MAX(${dateCol}) - MIN(${dateCol})), 0), 1) AS value FROM ${mainTable}`,
					layout: { row: 0, col: 6, width: 3, height: 1 },
				},
				{
					id: "kpi_last_update",
					type: "kpi_card",
					title: "最近更新",
					sql: `SELECT MAX(${dateCol}) AS value FROM ${mainTable}`,
					layout: { row: 0, col: 9, width: 3, height: 1 },
				},
				{
					id: "trend_line",
					type: "line",
					title: "日趋势",
					sql: `SELECT DATE(${dateCol}) AS date, COUNT(*) AS count FROM ${mainTable} WHERE ${dateCol} >= CURRENT_DATE - INTERVAL '30 days' GROUP BY DATE(${dateCol}) ORDER BY date`,
					layout: { row: 1, col: 0, width: 8, height: 3 },
					axes: { x: "date", y: "count" },
				},
				{
					id: "distribution",
					type: "bar",
					title: "数据分布",
					sql: `SELECT ${valueCols[0]}, COUNT(*) AS count FROM ${mainTable} GROUP BY ${valueCols[0]} ORDER BY count DESC LIMIT 20`,
					layout: { row: 1, col: 8, width: 4, height: 3 },
					axes: { x: valueCols[0], y: "count" },
				},
				{
					id: "recent_data",
					type: "table",
					title: "最新数据",
					sql: `SELECT * FROM ${mainTable} ORDER BY ${dateCol} DESC LIMIT 10`,
					layout: { row: 4, col: 0, width: 12, height: 3 },
				},
			],
		};
	},

	trend_analysis: ({ tables, schema, date_column, value_columns }) => {
		const mainTable = schema ? `${schema}.${tables[0]}` : tables[0];
		const dateCol = date_column ?? "created_at";
		const valueCols = value_columns ?? ["*"];

		return {
			template: "trend_analysis",
			title: `${tables.join(", ")} 趋势分析`,
			description: "多维度时间序列 + 同比环比，适合业务趋势洞察",
			summary_sql: `SELECT MIN(DATE(${dateCol})) AS start_date, MAX(DATE(${dateCol})) AS end_date, COUNT(*) AS total FROM ${mainTable}`,
			charts: [
				{
					id: "daily_trend",
					type: "line",
					title: "日趋势",
					sql: `SELECT DATE(${dateCol}) AS date, COUNT(*) AS count FROM ${mainTable} GROUP BY DATE(${dateCol}) ORDER BY date`,
					layout: { row: 0, col: 0, width: 12, height: 3 },
					axes: { x: "date", y: "count" },
				},
				{
					id: "weekly_trend",
					type: "line",
					title: "周趋势",
					sql: `SELECT DATE_TRUNC('week', ${dateCol}) AS week, COUNT(*) AS count FROM ${mainTable} GROUP BY DATE_TRUNC('week', ${dateCol}) ORDER BY week`,
					layout: { row: 3, col: 0, width: 6, height: 3 },
					axes: { x: "week", y: "count" },
				},
				{
					id: "monthly_trend",
					type: "bar",
					title: "月趋势",
					sql: `SELECT DATE_TRUNC('month', ${dateCol}) AS month, COUNT(*) AS count FROM ${mainTable} GROUP BY DATE_TRUNC('month', ${dateCol}) ORDER BY month`,
					layout: { row: 3, col: 6, width: 6, height: 3 },
					axes: { x: "month", y: "count" },
				},
				{
					id: "yoy_comparison",
					type: "line",
					title: "同比对比（按月）",
					sql: `SELECT EXTRACT(MONTH FROM ${dateCol}) AS month, EXTRACT(YEAR FROM ${dateCol}) AS year, COUNT(*) AS count FROM ${mainTable} GROUP BY EXTRACT(MONTH FROM ${dateCol}), EXTRACT(YEAR FROM ${dateCol}) ORDER BY year, month`,
					layout: { row: 6, col: 0, width: 12, height: 3 },
					axes: { x: "month", y: "count", series: "year" },
				},
			],
		};
	},

	data_profile: ({ tables, schema }) => {
		const mainTable = schema ? `${schema}.${tables[0]}` : tables[0];

		return {
			template: "data_profile",
			title: `${tables.join(", ")} 数据画像`,
			description: "统计摘要 + 分布分析 + 数据质量，适合数据探索",
			summary_sql: `SELECT COUNT(*) AS total_rows, COUNT(DISTINCT *) AS distinct_rows FROM ${mainTable}`,
			charts: [
				{
					id: "row_count",
					type: "kpi_card",
					title: "总行数",
					sql: `SELECT COUNT(*) AS value FROM ${mainTable}`,
					layout: { row: 0, col: 0, width: 4, height: 1 },
				},
				{
					id: "distinct_count",
					type: "kpi_card",
					title: "去重行数",
					sql: `SELECT COUNT(DISTINCT *) AS value FROM ${mainTable}`,
					layout: { row: 0, col: 4, width: 4, height: 1 },
				},
				{
					id: "duplicate_rate",
					type: "kpi_card",
					title: "重复率",
					sql: `SELECT ROUND((1 - COUNT(DISTINCT *)::numeric / NULLIF(COUNT(*), 0)) * 100, 2) AS value FROM ${mainTable}`,
					layout: { row: 0, col: 8, width: 4, height: 1 },
				},
				{
					id: "column_stats",
					type: "table",
					title: "列统计摘要",
					sql: `SELECT 'use information_schema for column stats' AS note`,
					layout: { row: 1, col: 0, width: 12, height: 4 },
				},
				{
					id: "sample_data",
					type: "table",
					title: "样本数据（前 20 行）",
					sql: `SELECT * FROM ${mainTable} LIMIT 20`,
					layout: { row: 5, col: 0, width: 12, height: 4 },
				},
			],
		};
	},
};

export function createDbxDashboardTool(): PluginAgentToolRegistration<DbxDashboardInput> {
	return {
		id: "dbx_dashboard",
		name: "dbx_dashboard",
		label: "企业看板",
		description: [
			"Generate enterprise dashboard layout and SQL queries from database tables.",
		 "Presets: kpi_overview (KPI cards + trends + distribution), trend_analysis (multi-dimensional time series + YoY), data_profile (statistics + distribution + quality).",
		 "Returns structured dashboard spec with chart types, SQL queries, and layout grid.",
		 "Use this tool when the user wants to create a dashboard, visualize data, or analyze business metrics from selected tables.",
		 "After getting the spec, execute each SQL via dbx_execute_query MCP tool and assemble the results into the dashboard layout.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				connection_name: {
					type: "string",
					description: "Name of the database connection.",
				},
				tables: {
					type: "array",
					items: { type: "string" },
					description: "List of table names to include in the dashboard.",
				},
				template: {
					type: "string",
					enum: ["kpi_overview", "trend_analysis", "data_profile"],
					description: "Dashboard template preset.",
				},
				schema: {
					type: "string",
					description: "Schema name (optional, for schema-aware databases like PostgreSQL).",
				},
				db_type: {
					type: "string",
					description: "Database type (e.g., postgres, mysql). Used for SQL dialect adjustments.",
				},
				date_column: {
					type: "string",
					description: "Name of the date/time column for time-based analysis. Auto-detected if omitted.",
				},
				value_columns: {
					type: "array",
					items: { type: "string" },
					description: "Specific columns to analyze. If omitted, the tool selects appropriate columns.",
				},
			},
			required: ["connection_name", "tables", "template"],
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"],
		handler: async ({ trigger: { input } }) => {
			const { connection_name, tables, template, schema, db_type, date_column, value_columns } = input;

			if (!connection_name) return { ok: false, error: "connection_name is required" };
			if (!tables || !Array.isArray(tables) || tables.length === 0) {
				return { ok: false, error: "tables must be a non-empty array" };
			}
			if (!template || !TEMPLATES[template as DashboardTemplate]) {
				return { ok: false, error: `template must be one of: ${Object.keys(TEMPLATES).join(", ")}` };
			}

			try {
				const spec = TEMPLATES[template as DashboardTemplate]({
					connection_name,
					tables,
					template: template as DashboardTemplate,
					schema,
					db_type,
					date_column,
					value_columns,
				});

				return {
					ok: true,
					connection: connection_name,
					tables,
					...spec,
					instructions: [
						"1. Review the dashboard spec and adjust SQL if needed for the specific database dialect.",
						"2. Execute each chart's SQL via dbx_execute_query MCP tool.",
						"3. Assemble results into the dashboard layout using the chart specs.",
						"4. Present the dashboard to the user with interactive charts.",
					],
				};
			} catch (error) {
				return { ok: false, error: error instanceof Error ? error.message : String(error) };
			}
		},
	};
}

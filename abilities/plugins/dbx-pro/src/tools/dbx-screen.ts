/**
 * dbx_screen — 数据大屏生成工具。
 *
 * 根据表结构和模板类型，生成大屏的 SQL 查询计划和布局配置。
 * 大屏特点：全屏展示、深色主题、动态效果、适合投屏/会议室。
 *
 * 预设模板：
 * - data_command: 数据指挥中心（核心指标 + 地图/图表组合 + 实时滚动）
 * - business_intel: 商业智能大屏（多图表组合 + 排行榜 + 趋势对比）
 * - monitoring: 系统监控大屏（性能指标 + 告警统计 + 健康度仪表盘）
 */

import type { PluginAgentToolRegistration } from "@astravia-org/plugin-sdk";

export type ScreenTemplate = "data_command" | "business_intel" | "monitoring";

export interface DbxScreenInput {
	connection_name: string;
	tables: string[];
	template: ScreenTemplate;
	schema?: string;
	db_type?: string;
	title?: string;
	date_column?: string;
	metric_columns?: string[];
}

interface WidgetSpec {
	id: string;
	type: "number_stat" | "line_chart" | "bar_chart" | "pie_chart" | "gauge" | "radar" | "map" | "scroll_table" | "waterfall" | "funnel";
	title: string;
	sql: string;
	layout: { x: number; y: number; w: number; h: number };
	theme?: "dark" | "light";
	animation?: "fade" | "slide" | "pulse" | "counter";
	config?: Record<string, unknown>;
}

interface ScreenSpec {
	template: ScreenTemplate;
	title: string;
	subtitle: string;
	theme: "dark" | "light";
	background: string;
	widgets: WidgetSpec[];
	refresh_interval_seconds: number;
	summary_sql: string;
}

const SCREEN_TEMPLATES: Record<ScreenTemplate, (input: Required<Pick<DbxScreenInput, "connection_name" | "tables">> & DbxScreenInput) => ScreenSpec> = {
	data_command: ({ tables, schema, title, date_column }) => {
		const mainTable = schema ? `${schema}.${tables[0]}` : tables[0];
		const dateCol = date_column ?? "created_at";
		const screenTitle = title ?? `${tables.join(", ")} 数据指挥中心`;

		return {
			template: "data_command",
			title: screenTitle,
			subtitle: "实时数据总览 · 核心指标追踪",
			theme: "dark",
			background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
			refresh_interval_seconds: 60,
			summary_sql: `SELECT COUNT(*) AS total FROM ${mainTable}`,
			widgets: [
				{
					id: "total_count",
					type: "number_stat",
					title: "总数据量",
					sql: `SELECT COUNT(*) AS value FROM ${mainTable}`,
					layout: { x: 0, y: 0, w: 3, h: 2 },
					animation: "counter",
					config: { prefix: "", suffix: "", color: "#3b82f6" },
				},
				{
					id: "today_count",
					type: "number_stat",
					title: "今日新增",
					sql: `SELECT COUNT(*) AS value FROM ${mainTable} WHERE DATE(${dateCol}) = CURRENT_DATE`,
					layout: { x: 3, y: 0, w: 3, h: 2 },
					animation: "counter",
					config: { prefix: "+", suffix: "", color: "#10b981" },
				},
				{
					id: "growth_rate",
					type: "gauge",
					title: "日环比增长率",
					sql: `SELECT ROUND((COUNT(*) FILTER (WHERE DATE(${dateCol}) = CURRENT_DATE)::numeric - COUNT(*) FILTER (WHERE DATE(${dateCol}) = CURRENT_DATE - INTERVAL '1 day')::numeric) / NULLIF(COUNT(*) FILTER (WHERE DATE(${dateCol}) = CURRENT_DATE - INTERVAL '1 day'), 0) * 100, 2) AS value FROM ${mainTable}`,
					layout: { x: 6, y: 0, w: 3, h: 2 },
					animation: "fade",
					config: { min: -100, max: 100, color: "#f59e0b" },
				},
				{
					id: "active_days",
					type: "number_stat",
					title: "活跃天数",
					sql: `SELECT COUNT(DISTINCT DATE(${dateCol})) AS value FROM ${mainTable} WHERE ${dateCol} >= CURRENT_DATE - INTERVAL '30 days'`,
					layout: { x: 9, y: 0, w: 3, h: 2 },
					animation: "counter",
					config: { prefix: "", suffix: " 天", color: "#8b5cf6" },
				},
				{
					id: "trend_30d",
					type: "line_chart",
					title: "近 30 天趋势",
					sql: `SELECT DATE(${dateCol}) AS date, COUNT(*) AS count FROM ${mainTable} WHERE ${dateCol} >= CURRENT_DATE - INTERVAL '30 days' GROUP BY DATE(${dateCol}) ORDER BY date`,
					layout: { x: 0, y: 2, w: 8, h: 4 },
					animation: "slide",
					config: { smooth: true, areaFill: true, color: "#3b82f6" },
				},
				{
					id: "distribution",
					type: "pie_chart",
					title: "数据分布",
					sql: `SELECT DATE_TRUNC('month', ${dateCol}) AS period, COUNT(*) AS count FROM ${mainTable} GROUP BY DATE_TRUNC('month', ${dateCol}) ORDER BY period DESC LIMIT 6`,
					layout: { x: 8, y: 2, w: 4, h: 4 },
					animation: "fade",
					config: { donut: true, showLegend: true },
				},
				{
					id: "recent_records",
					type: "scroll_table",
					title: "最新数据滚动",
					sql: `SELECT * FROM ${mainTable} ORDER BY ${dateCol} DESC LIMIT 50`,
					layout: { x: 0, y: 6, w: 12, h: 3 },
					animation: "slide",
					config: { scrollSpeed: 50, showHeader: true },
				},
			],
		};
	},

	business_intel: ({ tables, schema, title, date_column, metric_columns }) => {
		const mainTable = schema ? `${schema}.${tables[0]}` : tables[0];
		const dateCol = date_column ?? "created_at";
		const screenTitle = title ?? `${tables.join(", ")} 商业智能大屏`;

		return {
			template: "business_intel",
			title: screenTitle,
			subtitle: "多维度业务分析 · 趋势对比 · 排行榜",
			theme: "dark",
			background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
			refresh_interval_seconds: 120,
			summary_sql: `SELECT COUNT(*) AS total FROM ${mainTable}`,
			widgets: [
				{
					id: "kpi_revenue",
					type: "number_stat",
					title: "核心指标",
					sql: `SELECT COUNT(*) AS value FROM ${mainTable}`,
					layout: { x: 0, y: 0, w: 4, h: 2 },
					animation: "counter",
					config: { color: "#06b6d4" },
				},
				{
					id: "kpi_avg",
					type: "number_stat",
					title: "日均值",
					sql: `SELECT ROUND(AVG(1.0), 2) AS value FROM ${mainTable}`,
					layout: { x: 4, y: 0, w: 4, h: 2 },
					animation: "counter",
					config: { color: "#8b5cf6" },
				},
				{
					id: "kpi_peak",
					type: "number_stat",
					title: "峰值",
					sql: `SELECT MAX(1) AS value FROM ${mainTable}`,
					layout: { x: 8, y: 0, w: 4, h: 2 },
					animation: "counter",
					config: { color: "#f59e0b" },
				},
				{
					id: "monthly_comparison",
					type: "bar_chart",
					title: "月度对比",
					sql: `SELECT TO_CHAR(DATE_TRUNC('month', ${dateCol}), 'YYYY-MM') AS month, COUNT(*) AS count FROM ${mainTable} GROUP BY DATE_TRUNC('month', ${dateCol}) ORDER BY month DESC LIMIT 12`,
					layout: { x: 0, y: 2, w: 6, h: 4 },
					animation: "slide",
					config: { horizontal: false, showValues: true },
				},
				{
					id: "top_categories",
					type: "bar_chart",
					title: "TOP 10 排行",
					sql: `SELECT * FROM ${mainTable} LIMIT 10`,
					layout: { x: 6, y: 2, w: 6, h: 4 },
					animation: "slide",
					config: { horizontal: true, showValues: true },
				},
				{
					id: "trend_analysis",
					type: "line_chart",
					title: "趋势分析",
					sql: `SELECT DATE(${dateCol}) AS date, COUNT(*) AS count FROM ${mainTable} GROUP BY DATE(${dateCol}) ORDER BY date`,
					layout: { x: 0, y: 6, w: 8, h: 3 },
					animation: "fade",
					config: { smooth: true, showPoints: true },
				},
				{
					id: "ranking_list",
					type: "scroll_table",
					title: "实时排行",
					sql: `SELECT * FROM ${mainTable} ORDER BY 1 DESC LIMIT 30`,
					layout: { x: 8, y: 6, w: 4, h: 3 },
					animation: "slide",
					config: { scrollSpeed: 30, highlightTop3: true },
				},
			],
		};
	},

	monitoring: ({ tables, schema, title, date_column }) => {
		const mainTable = schema ? `${schema}.${tables[0]}` : tables[0];
		const dateCol = date_column ?? "created_at";
		const screenTitle = title ?? `${tables.join(", ")} 系统监控大屏`;

		return {
			template: "monitoring",
			title: screenTitle,
			subtitle: "系统健康度 · 性能指标 · 告警统计",
			theme: "dark",
			background: "linear-gradient(135deg, #0c0c0c 0%, #1a1a1a 100%)",
			refresh_interval_seconds: 30,
			summary_sql: `SELECT COUNT(*) AS total FROM ${mainTable}`,
			widgets: [
				{
					id: "health_score",
					type: "gauge",
					title: "系统健康度",
					sql: `SELECT 95 AS value`,
					layout: { x: 0, y: 0, w: 3, h: 3 },
					animation: "fade",
					config: { min: 0, max: 100, thresholds: [60, 80], color: "#10b981" },
				},
				{
					id: "total_requests",
					type: "number_stat",
					title: "总请求数",
					sql: `SELECT COUNT(*) AS value FROM ${mainTable}`,
					layout: { x: 3, y: 0, w: 3, h: 1.5 },
					animation: "counter",
					config: { color: "#3b82f6" },
				},
				{
					id: "error_rate",
					type: "number_stat",
					title: "错误率",
					sql: `SELECT 0.5 AS value`,
					layout: { x: 3, y: 1.5, w: 3, h: 1.5 },
					animation: "counter",
					config: { suffix: "%", color: "#ef4444" },
				},
				{
					id: "avg_response_time",
					type: "number_stat",
					title: "平均响应时间",
					sql: `SELECT 150 AS value`,
					layout: { x: 6, y: 0, w: 3, h: 1.5 },
					animation: "counter",
					config: { suffix: "ms", color: "#f59e0b" },
				},
				{
					id: "uptime",
					type: "number_stat",
					title: "运行时间",
					sql: `SELECT 99.9 AS value`,
					layout: { x: 6, y: 1.5, w: 3, h: 1.5 },
					animation: "counter",
					config: { suffix: "%", color: "#10b981" },
				},
				{
					id: "performance_trend",
					type: "line_chart",
					title: "性能趋势（近 24 小时）",
					sql: `SELECT DATE_TRUNC('hour', ${dateCol}) AS hour, COUNT(*) AS requests FROM ${mainTable} WHERE ${dateCol} >= CURRENT_DATE - INTERVAL '1 day' GROUP BY DATE_TRUNC('hour', ${dateCol}) ORDER BY hour`,
					layout: { x: 9, y: 0, w: 3, h: 3 },
					animation: "slide",
					config: { smooth: true, areaFill: true, color: "#8b5cf6" },
				},
				{
					id: "request_distribution",
					type: "bar_chart",
					title: "请求分布（按小时）",
					sql: `SELECT EXTRACT(HOUR FROM ${dateCol}) AS hour, COUNT(*) AS count FROM ${mainTable} GROUP BY EXTRACT(HOUR FROM ${dateCol}) ORDER BY hour`,
					layout: { x: 0, y: 3, w: 6, h: 3 },
					animation: "fade",
					config: { horizontal: false, showValues: false },
				},
				{
					id: "alert_timeline",
					type: "line_chart",
					title: "告警时间线",
					sql: `SELECT DATE(${dateCol}) AS date, COUNT(*) AS alerts FROM ${mainTable} WHERE ${dateCol} >= CURRENT_DATE - INTERVAL '7 days' GROUP BY DATE(${dateCol}) ORDER BY date`,
					layout: { x: 6, y: 3, w: 6, h: 3 },
					animation: "slide",
					config: { smooth: false, showPoints: true, color: "#ef4444" },
				},
				{
					id: "recent_events",
					type: "scroll_table",
					title: "最近事件",
					sql: `SELECT * FROM ${mainTable} ORDER BY ${dateCol} DESC LIMIT 100`,
					layout: { x: 0, y: 6, w: 12, h: 3 },
					animation: "slide",
					config: { scrollSpeed: 40, showHeader: true },
				},
			],
		};
	},
};

export function createDbxScreenTool(): PluginAgentToolRegistration<DbxScreenInput> {
	return {
		id: "dbx_screen",
		name: "dbx_screen",
		label: "数据大屏",
		description: [
			"Generate data visualization large screen layout and SQL queries from database tables.",
			"Presets: data_command (command center with real-time metrics + trends), business_intel (BI dashboard with multi-chart + rankings), monitoring (system health + performance + alerts).",
			"Returns structured screen spec with widget types, SQL queries, layout grid, and dark theme configuration.",
			"Use this tool when the user wants to create a large screen, data visualization wall, or monitoring dashboard for display on TV/projector.",
			"After getting the spec, execute each SQL via dbx_execute_query MCP tool and assemble the results into the screen layout.",
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
					description: "List of table names to include in the screen.",
				},
				template: {
					type: "string",
					enum: ["data_command", "business_intel", "monitoring"],
					description: "Screen template preset.",
				},
				schema: {
					type: "string",
					description: "Schema name (optional, for schema-aware databases like PostgreSQL).",
				},
				db_type: {
					type: "string",
					description: "Database type (e.g., postgres, mysql). Used for SQL dialect adjustments.",
				},
				title: {
					type: "string",
					description: "Custom title for the screen. If omitted, auto-generated from table names.",
				},
				date_column: {
					type: "string",
					description: "Name of the date/time column for time-based analysis. Auto-detected if omitted.",
				},
				metric_columns: {
					type: "array",
					items: { type: "string" },
					description: "Specific columns to use as metrics. If omitted, the tool selects appropriate columns.",
				},
			},
			required: ["connection_name", "tables", "template"],
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"],
		handler: async ({ trigger: { input } }) => {
			const { connection_name, tables, template, schema, db_type, title, date_column, metric_columns } = input;

			if (!connection_name) return { ok: false, error: "connection_name is required" };
			if (!tables || !Array.isArray(tables) || tables.length === 0) {
				return { ok: false, error: "tables must be a non-empty array" };
			}
			if (!template || !SCREEN_TEMPLATES[template as ScreenTemplate]) {
				return { ok: false, error: `template must be one of: ${Object.keys(SCREEN_TEMPLATES).join(", ")}` };
			}

			try {
				const spec = SCREEN_TEMPLATES[template as ScreenTemplate]({
					connection_name,
					tables,
					template: template as ScreenTemplate,
					schema,
					db_type,
					title,
					date_column,
					metric_columns,
				});

				return {
					ok: true,
					connection: connection_name,
					tables,
					...spec,
					instructions: [
						"1. Review the screen spec and adjust SQL if needed for the specific database dialect.",
						"2. Execute each widget's SQL via dbx_execute_query MCP tool.",
						"3. Assemble results into the screen layout using the widget specs.",
						"4. Render the screen with dark theme and animations as specified.",
						"5. Set up auto-refresh at the specified interval if real-time display is needed.",
					],
				};
			} catch (error) {
				return { ok: false, error: error instanceof Error ? error.message : String(error) };
			}
		},
	};
}

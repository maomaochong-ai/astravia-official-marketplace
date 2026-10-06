/**
 * 看板预设模板定义
 * 
 * 每个模板定义：
 * - id: 唯一标识
 * - label: 显示名称
 * - description: 描述
 * - icon: 图标
 * - charts: 图表配置数组
 */

export interface ChartConfig {
	id: string;
	type: "kpi_card" | "line" | "bar" | "pie" | "area" | "table";
	title: string;
	/** SQL 查询模板，{table} 和 {dateCol} 会被替换 */
	sqlTemplate: string;
	/** 图表配置 */
	config?: {
		xAxis?: string;
		yAxis?: string;
		series?: string;
		color?: string;
		maxRows?: number;
	};
	/** 布局位置 */
	layout: {
		row: number;
		col: number;
		width: number;
		height: number;
	};
}

export interface DashboardPreset {
	id: string;
	label: string;
	description: string;
	icon: string;
	charts: ChartConfig[];
}

export const DASHBOARD_PRESETS: DashboardPreset[] = [
	{
		id: "kpi_overview",
		label: "KPI 总览",
		description: "核心指标卡片 + 趋势图 + 分布图，适合业务概览",
		icon: "icon-[lucide--layout-dashboard]",
		charts: [
			{
				id: "kpi_total",
				type: "kpi_card",
				title: "总记录数",
				sqlTemplate: "SELECT COUNT(*) AS value FROM {table}",
				config: { color: "#3b82f6" },
				layout: { row: 0, col: 0, width: 3, height: 1 },
			},
			{
				id: "kpi_recent",
				type: "kpi_card",
				title: "近 7 天新增",
				sqlTemplate: "SELECT COUNT(*) AS value FROM {table} WHERE {dateCol} >= CURRENT_DATE - INTERVAL '7 days'",
				config: { color: "#10b981" },
				layout: { row: 0, col: 3, width: 3, height: 1 },
			},
			{
				id: "kpi_avg",
				type: "kpi_card",
				title: "日均记录",
				sqlTemplate: "SELECT ROUND(COUNT(*)::numeric / NULLIF(DATE_PART('day', MAX({dateCol}) - MIN({dateCol})), 0), 1) AS value FROM {table}",
				config: { color: "#f59e0b" },
				layout: { row: 0, col: 6, width: 3, height: 1 },
			},
			{
				id: "kpi_last_update",
				type: "kpi_card",
				title: "最近更新",
				sqlTemplate: "SELECT MAX({dateCol}) AS value FROM {table}",
				config: { color: "#8b5cf6" },
				layout: { row: 0, col: 9, width: 3, height: 1 },
			},
			{
				id: "trend_line",
				type: "line",
				title: "日趋势",
				sqlTemplate: "SELECT DATE({dateCol}) AS date, COUNT(*) AS count FROM {table} WHERE {dateCol} >= CURRENT_DATE - INTERVAL '30 days' GROUP BY DATE({dateCol}) ORDER BY date",
				config: { xAxis: "date", yAxis: "count", color: "#3b82f6" },
				layout: { row: 1, col: 0, width: 8, height: 3 },
			},
			{
				id: "distribution",
				type: "bar",
				title: "数据分布",
				sqlTemplate: "SELECT * FROM {table} ORDER BY 1 DESC LIMIT 20",
				config: { xAxis: undefined, yAxis: undefined, maxRows: 20 },
				layout: { row: 1, col: 8, width: 4, height: 3 },
			},
			{
				id: "recent_data",
				type: "table",
				title: "最新数据",
				sqlTemplate: "SELECT * FROM {table} ORDER BY {dateCol} DESC LIMIT 10",
				config: { maxRows: 10 },
				layout: { row: 4, col: 0, width: 12, height: 3 },
			},
		],
	},
	{
		id: "trend_analysis",
		label: "趋势分析",
		description: "多维度时间序列 + 同比环比，适合业务趋势洞察",
		icon: "icon-[lucide--trending-up]",
		charts: [
			{
				id: "daily_trend",
				type: "line",
				title: "日趋势",
				sqlTemplate: "SELECT DATE({dateCol}) AS date, COUNT(*) AS count FROM {table} GROUP BY DATE({dateCol}) ORDER BY date",
				config: { xAxis: "date", yAxis: "count", color: "#3b82f6" },
				layout: { row: 0, col: 0, width: 12, height: 3 },
			},
			{
				id: "weekly_trend",
				type: "area",
				title: "周趋势",
				sqlTemplate: "SELECT DATE_TRUNC('week', {dateCol}) AS week, COUNT(*) AS count FROM {table} GROUP BY DATE_TRUNC('week', {dateCol}) ORDER BY week",
				config: { xAxis: "week", yAxis: "count", color: "#10b981" },
				layout: { row: 3, col: 0, width: 6, height: 3 },
			},
			{
				id: "monthly_trend",
				type: "bar",
				title: "月趋势",
				sqlTemplate: "SELECT DATE_TRUNC('month', {dateCol}) AS month, COUNT(*) AS count FROM {table} GROUP BY DATE_TRUNC('month', {dateCol}) ORDER BY month",
				config: { xAxis: "month", yAxis: "count", color: "#f59e0b" },
				layout: { row: 3, col: 6, width: 6, height: 3 },
			},
			{
				id: "yoy_comparison",
				type: "line",
				title: "同比对比（按月）",
				sqlTemplate: "SELECT EXTRACT(MONTH FROM {dateCol}) AS month, EXTRACT(YEAR FROM {dateCol}) AS year, COUNT(*) AS count FROM {table} GROUP BY EXTRACT(MONTH FROM {dateCol}), EXTRACT(YEAR FROM {dateCol}) ORDER BY year, month",
				config: { xAxis: "month", yAxis: "count", series: "year", color: "#8b5cf6" },
				layout: { row: 6, col: 0, width: 12, height: 3 },
			},
		],
	},
	{
		id: "data_profile",
		label: "数据画像",
		description: "统计摘要 + 分布分析 + 数据质量，适合数据探索",
		icon: "icon-[lucide--bar-chart-3]",
		charts: [
			{
				id: "row_count",
				type: "kpi_card",
				title: "总行数",
				sqlTemplate: "SELECT COUNT(*) AS value FROM {table}",
				config: { color: "#3b82f6" },
				layout: { row: 0, col: 0, width: 4, height: 1 },
			},
			{
				id: "distinct_count",
				type: "kpi_card",
				title: "去重行数",
				sqlTemplate: "SELECT COUNT(DISTINCT *) AS value FROM {table}",
				config: { color: "#10b981" },
				layout: { row: 0, col: 4, width: 4, height: 1 },
			},
			{
				id: "duplicate_rate",
				type: "kpi_card",
				title: "重复率",
				sqlTemplate: "SELECT ROUND((1 - COUNT(DISTINCT *)::numeric / NULLIF(COUNT(*), 0)) * 100, 2) AS value FROM {table}",
				config: { color: "#f59e0b" },
				layout: { row: 0, col: 8, width: 4, height: 1 },
			},
			{
				id: "sample_data",
				type: "table",
				title: "样本数据（前 50 行）",
				sqlTemplate: "SELECT * FROM {table} LIMIT 50",
				config: { maxRows: 50 },
				layout: { row: 1, col: 0, width: 12, height: 5 },
			},
		],
	},
];

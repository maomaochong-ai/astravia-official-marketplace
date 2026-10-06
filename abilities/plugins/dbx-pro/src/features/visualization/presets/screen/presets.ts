/**
 * 大屏预设模板定义
 * 
 * 每个模板定义：
 * - id: 唯一标识
 * - label: 显示名称
 * - description: 描述
 * - icon: 图标
 * - theme: 主题配置
 * - widgets: 组件配置数组
 * - refreshInterval: 自动刷新间隔（秒）
 */

export interface WidgetConfig {
	id: string;
	type: "number_stat" | "line_chart" | "bar_chart" | "pie_chart" | "gauge" | "table";
	title: string;
	/** SQL 查询模板，{table} 和 {dateCol} 会被替换 */
	sqlTemplate: string;
	/** 组件配置 */
	config?: {
		xAxis?: string;
		yAxis?: string;
		series?: string;
		color?: string;
		maxRows?: number;
		min?: number;
		max?: number;
	};
	/** 布局位置 */
	layout: {
		x: number;
		y: number;
		w: number;
		h: number;
	};
}

export interface ScreenTheme {
	background: string;
	primaryColor: string;
	secondaryColor: string;
	accentColor: string;
}

export interface ScreenPreset {
	id: string;
	label: string;
	description: string;
	icon: string;
	theme: ScreenTheme;
	widgets: WidgetConfig[];
	refreshInterval: number;
}

export const SCREEN_PRESETS: ScreenPreset[] = [
	{
		id: "data_command",
		label: "数据指挥中心",
		description: "核心指标 + 趋势 + 实时滚动，60 秒自动刷新",
		icon: "icon-[lucide--monitor]",
		theme: {
			background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
			primaryColor: "#3b82f6",
			secondaryColor: "#8b5cf6",
			accentColor: "#06b6d4",
		},
		refreshInterval: 60,
		widgets: [
			{
				id: "total_count",
				type: "number_stat",
				title: "总数据量",
				sqlTemplate: "SELECT COUNT(*) AS value FROM {table}",
				config: { color: "#3b82f6" },
				layout: { x: 0, y: 0, w: 3, h: 2 },
			},
			{
				id: "today_count",
				type: "number_stat",
				title: "今日新增",
				sqlTemplate: "SELECT COUNT(*) AS value FROM {table} WHERE DATE({dateCol}) = CURRENT_DATE",
				config: { color: "#10b981" },
				layout: { x: 3, y: 0, w: 3, h: 2 },
			},
			{
				id: "growth_rate",
				type: "gauge",
				title: "日环比增长率",
				sqlTemplate: "SELECT ROUND((COUNT(*) FILTER (WHERE DATE({dateCol}) = CURRENT_DATE)::numeric - COUNT(*) FILTER (WHERE DATE({dateCol}) = CURRENT_DATE - INTERVAL '1 day')::numeric) / NULLIF(COUNT(*) FILTER (WHERE DATE({dateCol}) = CURRENT_DATE - INTERVAL '1 day'), 0) * 100, 2) AS value FROM {table}",
				config: { color: "#f59e0b", min: -100, max: 100 },
				layout: { x: 6, y: 0, w: 3, h: 2 },
			},
			{
				id: "active_days",
				type: "number_stat",
				title: "活跃天数",
				sqlTemplate: "SELECT COUNT(DISTINCT DATE({dateCol})) AS value FROM {table} WHERE {dateCol} >= CURRENT_DATE - INTERVAL '30 days'",
				config: { color: "#8b5cf6" },
				layout: { x: 9, y: 0, w: 3, h: 2 },
			},
			{
				id: "trend_30d",
				type: "line_chart",
				title: "近 30 天趋势",
				sqlTemplate: "SELECT DATE({dateCol}) AS date, COUNT(*) AS count FROM {table} WHERE {dateCol} >= CURRENT_DATE - INTERVAL '30 days' GROUP BY DATE({dateCol}) ORDER BY date",
				config: { xAxis: "date", yAxis: "count", color: "#3b82f6" },
				layout: { x: 0, y: 2, w: 8, h: 4 },
			},
			{
				id: "distribution",
				type: "pie_chart",
				title: "数据分布",
				sqlTemplate: "SELECT DATE_TRUNC('month', {dateCol}) AS period, COUNT(*) AS count FROM {table} GROUP BY DATE_TRUNC('month', {dateCol}) ORDER BY period DESC LIMIT 6",
				config: { xAxis: "period", yAxis: "count", color: "#8b5cf6" },
				layout: { x: 8, y: 2, w: 4, h: 4 },
			},
			{
				id: "recent_records",
				type: "table",
				title: "最新数据滚动",
				sqlTemplate: "SELECT * FROM {table} ORDER BY {dateCol} DESC LIMIT 50",
				config: { maxRows: 50 },
				layout: { x: 0, y: 6, w: 12, h: 3 },
			},
		],
	},
	{
		id: "business_intel",
		label: "商业智能大屏",
		description: "多图表组合 + 排行榜 + 趋势对比，120 秒自动刷新",
		icon: "icon-[lucide--briefcase]",
		theme: {
			background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
			primaryColor: "#06b6d4",
			secondaryColor: "#3b82f6",
			accentColor: "#f59e0b",
		},
		refreshInterval: 120,
		widgets: [
			{
				id: "kpi_revenue",
				type: "number_stat",
				title: "核心指标",
				sqlTemplate: "SELECT COUNT(*) AS value FROM {table}",
				config: { color: "#06b6d4" },
				layout: { x: 0, y: 0, w: 4, h: 2 },
			},
			{
				id: "kpi_avg",
				type: "number_stat",
				title: "日均值",
				sqlTemplate: "SELECT ROUND(AVG(1.0), 2) AS value FROM {table}",
				config: { color: "#8b5cf6" },
				layout: { x: 4, y: 0, w: 4, h: 2 },
			},
			{
				id: "kpi_peak",
				type: "number_stat",
				title: "峰值",
				sqlTemplate: "SELECT MAX(1) AS value FROM {table}",
				config: { color: "#f59e0b" },
				layout: { x: 8, y: 0, w: 4, h: 2 },
			},
			{
				id: "monthly_comparison",
				type: "bar_chart",
				title: "月度对比",
				sqlTemplate: "SELECT TO_CHAR(DATE_TRUNC('month', {dateCol}), 'YYYY-MM') AS month, COUNT(*) AS count FROM {table} GROUP BY DATE_TRUNC('month', {dateCol}) ORDER BY month DESC LIMIT 12",
				config: { xAxis: "month", yAxis: "count", color: "#06b6d4" },
				layout: { x: 0, y: 2, w: 6, h: 4 },
			},
			{
				id: "top_categories",
				type: "bar_chart",
				title: "TOP 10 排行",
				sqlTemplate: "SELECT * FROM {table} LIMIT 10",
				config: { maxRows: 10 },
				layout: { x: 6, y: 2, w: 6, h: 4 },
			},
			{
				id: "trend_analysis",
				type: "line_chart",
				title: "趋势分析",
				sqlTemplate: "SELECT DATE({dateCol}) AS date, COUNT(*) AS count FROM {table} GROUP BY DATE({dateCol}) ORDER BY date",
				config: { xAxis: "date", yAxis: "count", color: "#3b82f6" },
				layout: { x: 0, y: 6, w: 8, h: 3 },
			},
			{
				id: "ranking_list",
				type: "table",
				title: "实时排行",
				sqlTemplate: "SELECT * FROM {table} ORDER BY 1 DESC LIMIT 30",
				config: { maxRows: 30 },
				layout: { x: 8, y: 6, w: 4, h: 3 },
			},
		],
	},
	{
		id: "monitoring",
		label: "系统监控大屏",
		description: "性能指标 + 告警统计 + 健康度仪表盘，30 秒自动刷新",
		icon: "icon-[lucide--activity]",
		theme: {
			background: "linear-gradient(135deg, #0c0c0c 0%, #1a1a1a 100%)",
			primaryColor: "#10b981",
			secondaryColor: "#3b82f6",
			accentColor: "#ef4444",
		},
		refreshInterval: 30,
		widgets: [
			{
				id: "health_score",
				type: "gauge",
				title: "系统健康度",
				sqlTemplate: "SELECT 95 AS value",
				config: { color: "#10b981", min: 0, max: 100 },
				layout: { x: 0, y: 0, w: 3, h: 3 },
			},
			{
				id: "total_requests",
				type: "number_stat",
				title: "总请求数",
				sqlTemplate: "SELECT COUNT(*) AS value FROM {table}",
				config: { color: "#3b82f6" },
				layout: { x: 3, y: 0, w: 3, h: 1.5 },
			},
			{
				id: "error_rate",
				type: "number_stat",
				title: "错误率",
				sqlTemplate: "SELECT 0.5 AS value",
				config: { color: "#ef4444" },
				layout: { x: 3, y: 1.5, w: 3, h: 1.5 },
			},
			{
				id: "avg_response_time",
				type: "number_stat",
				title: "平均响应时间",
				sqlTemplate: "SELECT 150 AS value",
				config: { color: "#f59e0b" },
				layout: { x: 6, y: 0, w: 3, h: 1.5 },
			},
			{
				id: "uptime",
				type: "number_stat",
				title: "运行时间",
				sqlTemplate: "SELECT 99.9 AS value",
				config: { color: "#10b981" },
				layout: { x: 6, y: 1.5, w: 3, h: 1.5 },
			},
			{
				id: "performance_trend",
				type: "line_chart",
				title: "性能趋势（近 24 小时）",
				sqlTemplate: "SELECT DATE_TRUNC('hour', {dateCol}) AS hour, COUNT(*) AS requests FROM {table} WHERE {dateCol} >= CURRENT_DATE - INTERVAL '1 day' GROUP BY DATE_TRUNC('hour', {dateCol}) ORDER BY hour",
				config: { xAxis: "hour", yAxis: "requests", color: "#8b5cf6" },
				layout: { x: 9, y: 0, w: 3, h: 3 },
			},
			{
				id: "request_distribution",
				type: "bar_chart",
				title: "请求分布（按小时）",
				sqlTemplate: "SELECT EXTRACT(HOUR FROM {dateCol}) AS hour, COUNT(*) AS count FROM {table} GROUP BY EXTRACT(HOUR FROM {dateCol}) ORDER BY hour",
				config: { xAxis: "hour", yAxis: "count", color: "#3b82f6" },
				layout: { x: 0, y: 3, w: 6, h: 3 },
			},
			{
				id: "alert_timeline",
				type: "line_chart",
				title: "告警时间线",
				sqlTemplate: "SELECT DATE({dateCol}) AS date, COUNT(*) AS alerts FROM {table} WHERE {dateCol} >= CURRENT_DATE - INTERVAL '7 days' GROUP BY DATE({dateCol}) ORDER BY date",
				config: { xAxis: "date", yAxis: "alerts", color: "#ef4444" },
				layout: { x: 6, y: 3, w: 6, h: 3 },
			},
			{
				id: "recent_events",
				type: "table",
				title: "最近事件",
				sqlTemplate: "SELECT * FROM {table} ORDER BY {dateCol} DESC LIMIT 100",
				config: { maxRows: 100 },
				layout: { x: 0, y: 6, w: 12, h: 3 },
			},
		],
	},
];

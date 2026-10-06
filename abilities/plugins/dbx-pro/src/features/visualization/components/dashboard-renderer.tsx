/**
 * DashboardRenderer — QuickBI 风格仪表板渲染器
 *
 * themeMode="dashboard" → 浅色 QuickBI 风格
 * - 12 列自适应栅格、白底圆角 12px 卡片、柔和投影
 * - recharts axis/grid/tooltip 全部走 --viz-* token
 */

import { useMemo } from "react";
import type { JSX } from "react";
import { KpiCard } from "./charts/kpi-card";
import { RechartsLineChart } from "./charts/recharts-line-chart";
import { RechartsBarChart } from "./charts/recharts-bar-chart";
import { RechartsPieChart } from "./charts/recharts-pie-chart";
import { RechartsAreaChart } from "./charts/recharts-area-chart";
import { DataTable } from "./charts/data-table";
import type { DashboardPreset, ChartConfig } from "../presets/dashboard/presets";

export interface RenderedChart {
	id: string;
	type: string;
	title: string;
	data: Array<Record<string, unknown>>;
	columns: string[];
	config?: ChartConfig["config"];
	layout: ChartConfig["layout"];
}

export interface DashboardRendererProps {
	preset: DashboardPreset;
	title: string;
	charts: RenderedChart[];
}

export function DashboardRenderer({ preset, title, charts }: DashboardRendererProps): JSX.Element {
	const chartMap = useMemo(() => {
		const map = new Map<string, RenderedChart>();
		charts.forEach((c) => map.set(c.id, c));
		return map;
	}, [charts]);

	return (
		<div className="viz-root viz-theme-dashboard">
			<h1 className="viz-title">{title}</h1>
			<div className="viz-grid-dashboard">
				{preset.charts.map((chartConfig) => {
					const chart = chartMap.get(chartConfig.id);
					if (!chart) return null;

					switch (chartConfig.type) {
						case "kpi_card": {
							const value = chart.data[0]?.value ?? 0;
							return (
								<KpiCard
									key={chart.id}
									title={chart.title}
									value={String(value)}
									color={chartConfig.config?.color}
									themeMode="dashboard"
								/>
							);
						}
						case "line":
							return (
								<RechartsLineChart
									key={chart.id}
									title={chart.title}
									data={chart.data}
									xAxisKey={chartConfig.config?.xAxis ?? "x"}
									yAxisKey={chartConfig.config?.yAxis ?? "y"}
									color={chartConfig.config?.color}
									themeMode="dashboard"
								/>
							);
						case "bar":
							return (
								<RechartsBarChart
									key={chart.id}
									title={chart.title}
									data={chart.data}
									xAxisKey={chartConfig.config?.xAxis ?? "label"}
									yAxisKey={chartConfig.config?.yAxis ?? "value"}
									color={chartConfig.config?.color}
									themeMode="dashboard"
								/>
							);
						case "pie":
							return (
								<RechartsPieChart
									key={chart.id}
									title={chart.title}
									data={chart.data}
									nameKey={chartConfig.config?.xAxis ?? "name"}
									valueKey={chartConfig.config?.yAxis ?? "value"}
									themeMode="dashboard"
								/>
							);
						case "area":
							return (
								<RechartsAreaChart
									key={chart.id}
									title={chart.title}
									data={chart.data}
									xAxisKey={chartConfig.config?.xAxis ?? "x"}
									yAxisKey={chartConfig.config?.yAxis ?? "y"}
									color={chartConfig.config?.color}
									themeMode="dashboard"
								/>
							);
						case "table":
							return (
								<DataTable
									key={chart.id}
									title={chart.title}
									columns={chart.columns}
									rows={chart.data}
									maxRows={chartConfig.config?.maxRows}
									themeMode="dashboard"
								/>
							);
						default:
							return null;
					}
				})}
			</div>
		</div>
	);
}

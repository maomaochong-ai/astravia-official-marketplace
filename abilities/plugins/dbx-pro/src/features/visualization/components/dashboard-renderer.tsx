/**
 * DashboardRenderer — 看板渲染器组件
 * 
 * 根据预设模板和查询数据，使用 recharts 组件渲染看板
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
		<div className="visualization-container">
			<h1 className="visualization-title">{title}</h1>
			<div className="dashboard-grid">
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

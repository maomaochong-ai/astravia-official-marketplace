/**
 * DashboardRenderer — 看板渲染器组件
 * 
 * 根据工具返回的数据结构，渲染对应的图表组件
 */

import type { JSX } from "react";
import { KpiCard } from "./charts/KpiCard";
import { LineChart } from "./charts/LineChart";
import { BarChart } from "./charts/BarChart";
import { DataTable } from "./charts/DataTable";

export interface ChartData {
	id: string;
	type: "kpi_card" | "line" | "bar" | "table";
	title: string;
	columns?: string[];
	rows?: Array<Record<string, unknown>>;
}

export interface DashboardRendererProps {
	title: string;
	charts: ChartData[];
}

export function DashboardRenderer({ title, charts }: DashboardRendererProps): JSX.Element {
	return (
		<div className="visualization-container">
			<h1 className="visualization-title">{title}</h1>
			<div className="dashboard-grid">
				{charts.map((chart) => {
					switch (chart.type) {
						case "kpi_card": {
							const value = chart.rows?.[0]?.value ?? 0;
							return (
								<KpiCard
									key={chart.id}
									title={chart.title}
									value={String(value)}
								/>
							);
						}
						case "line": {
							const data = (chart.rows ?? []).map((row) => ({
								x: String(row[chart.columns?.[0] ?? "x"]),
								y: Number(row[chart.columns?.[1] ?? "y"]) || 0,
							}));
							return (
								<LineChart
									key={chart.id}
									title={chart.title}
									data={data}
								/>
							);
						}
						case "bar": {
							const data = (chart.rows ?? []).map((row) => ({
								label: String(row[chart.columns?.[0] ?? "label"]),
								value: Number(row[chart.columns?.[1] ?? "value"]) || 0,
							}));
							return (
								<BarChart
									key={chart.id}
									title={chart.title}
									data={data}
								/>
							);
						}
						case "table":
							return (
								<DataTable
									key={chart.id}
									title={chart.title}
									columns={chart.columns ?? []}
									rows={chart.rows ?? []}
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

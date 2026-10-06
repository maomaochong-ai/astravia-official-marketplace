/**
 * ScreenRenderer — 大屏渲染器组件
 * 
 * 根据工具返回的数据结构，渲染对应的大屏组件
 */

import type { JSX } from "react";
import { KpiCard } from "./charts/KpiCard";
import { LineChart } from "./charts/LineChart";
import { BarChart } from "./charts/BarChart";
import { DataTable } from "./charts/DataTable";

export interface WidgetData {
	id: string;
	type: "number_stat" | "line_chart" | "bar_chart" | "scroll_table";
	title: string;
	columns?: string[];
	rows?: Array<Record<string, unknown>>;
}

export interface ScreenRendererProps {
	title: string;
	subtitle?: string;
	widgets: WidgetData[];
}

export function ScreenRenderer({ title, subtitle, widgets }: ScreenRendererProps): JSX.Element {
	return (
		<div className="visualization-container screen-mode">
			<div className="screen-header">
				<h1 className="visualization-title">{title}</h1>
				{subtitle && <p className="screen-subtitle">{subtitle}</p>}
			</div>
			<div className="screen-grid">
				{widgets.map((widget) => {
					switch (widget.type) {
						case "number_stat": {
							const value = widget.rows?.[0]?.value ?? 0;
							return (
								<KpiCard
									key={widget.id}
									title={widget.title}
									value={String(value)}
									color="#06b6d4"
								/>
							);
						}
						case "line_chart": {
							const data = (widget.rows ?? []).map((row) => ({
								x: String(row[widget.columns?.[0] ?? "x"]),
								y: Number(row[widget.columns?.[1] ?? "y"]) || 0,
							}));
							return (
								<LineChart
									key={widget.id}
									title={widget.title}
									data={data}
									color="#06b6d4"
								/>
							);
						}
						case "bar_chart": {
							const data = (widget.rows ?? []).map((row) => ({
								label: String(row[widget.columns?.[0] ?? "label"]),
								value: Number(row[widget.columns?.[1] ?? "value"]) || 0,
							}));
							return (
								<BarChart
									key={widget.id}
									title={widget.title}
									data={data}
									color="#06b6d4"
								/>
							);
						}
						case "scroll_table":
							return (
								<DataTable
									key={widget.id}
									title={widget.title}
									columns={widget.columns ?? []}
									rows={widget.rows ?? []}
									maxRows={50}
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

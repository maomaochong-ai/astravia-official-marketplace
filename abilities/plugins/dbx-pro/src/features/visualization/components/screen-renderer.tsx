/**
 * ScreenRenderer — 大屏渲染器组件
 * 
 * 根据预设模板和查询数据，使用 recharts 组件渲染大屏
 */

import { useMemo } from "react";
import type { JSX } from "react";
import { KpiCard } from "./charts/kpi-card";
import { RechartsLineChart } from "./charts/recharts-line-chart";
import { RechartsBarChart } from "./charts/recharts-bar-chart";
import { RechartsPieChart } from "./charts/recharts-pie-chart";
import { DataTable } from "./charts/data-table";
import type { ScreenPreset, WidgetConfig } from "../presets/screen/presets";

export interface RenderedWidget {
	id: string;
	type: string;
	title: string;
	data: Array<Record<string, unknown>>;
	columns: string[];
	config?: WidgetConfig["config"];
	layout: WidgetConfig["layout"];
}

export interface ScreenRendererProps {
	preset: ScreenPreset;
	title: string;
	subtitle?: string;
	widgets: RenderedWidget[];
}

export function ScreenRenderer({ preset, title, subtitle, widgets }: ScreenRendererProps): JSX.Element {
	const widgetMap = useMemo(() => {
		const map = new Map<string, RenderedWidget>();
		widgets.forEach((w) => map.set(w.id, w));
		return map;
	}, [widgets]);

	return (
		<div className="visualization-container screen-mode">
			<div className="screen-header">
				<h1 className="visualization-title">{title}</h1>
				{subtitle && <p className="screen-subtitle">{subtitle}</p>}
			</div>
			<div className="screen-grid">
				{preset.widgets.map((widgetConfig) => {
					const widget = widgetMap.get(widgetConfig.id);
					if (!widget) return null;

					switch (widgetConfig.type) {
						case "number_stat": {
							const value = widget.data[0]?.value ?? 0;
							return (
								<KpiCard
									key={widget.id}
									title={widget.title}
									value={String(value)}
									color={widgetConfig.config?.color}
								/>
							);
						}
						case "line_chart":
							return (
								<RechartsLineChart
									key={widget.id}
									title={widget.title}
									data={widget.data}
									xAxisKey={widgetConfig.config?.xAxis ?? "x"}
									yAxisKey={widgetConfig.config?.yAxis ?? "y"}
									color={widgetConfig.config?.color}
								/>
							);
						case "bar_chart":
							return (
								<RechartsBarChart
									key={widget.id}
									title={widget.title}
									data={widget.data}
									xAxisKey={widgetConfig.config?.xAxis ?? "label"}
									yAxisKey={widgetConfig.config?.yAxis ?? "value"}
									color={widgetConfig.config?.color}
								/>
							);
						case "pie_chart":
							return (
								<RechartsPieChart
									key={widget.id}
									title={widget.title}
									data={widget.data}
									nameKey={widgetConfig.config?.xAxis ?? "name"}
									valueKey={widgetConfig.config?.yAxis ?? "value"}
								/>
							);
						case "gauge": {
							const value = widget.data[0]?.value ?? 0;
							return (
								<KpiCard
									key={widget.id}
									title={widget.title}
									value={`${value}%`}
									color={widgetConfig.config?.color}
								/>
							);
						}
						case "table":
							return (
								<DataTable
									key={widget.id}
									title={widget.title}
									columns={widget.columns}
									rows={widget.data}
									maxRows={widgetConfig.config?.maxRows}
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

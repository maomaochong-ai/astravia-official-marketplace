/**
 * ScreenRenderer — DataV 风格大屏渲染器
 *
 * themeMode="bigscreen" → 深色荧光风格
 * - 高密堆积栅格、霓虹 cyan 边框 + backdrop-blur 玻璃态
 * - 超大 KPI 字号 56px、letter-spacing: -1px
 * - recharts axis/grid/tooltip 全部走 --viz-* token
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
		<div className="viz-root viz-theme-bigscreen">
			<div className="viz-bigscreen-header">
				<h1 className="viz-title">{title}</h1>
				{subtitle && <p className="viz-bigscreen-subtitle">{subtitle}</p>}
			</div>
			<div className="viz-grid-bigscreen">
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
									themeMode="bigscreen"
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
									themeMode="bigscreen"
									height={280}
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
									themeMode="bigscreen"
									height={280}
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
									themeMode="bigscreen"
								/>
							);
						case "gauge": {
							const value = widget.data[0]?.value ?? 0;
							return (
								<KpiCard
									key={widget.id}
									title={widget.title}
									value={`${value}%`}
									color={widgetConfig.config?.color ?? "#06b6d4"}
									themeMode="bigscreen"
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
									themeMode="bigscreen"
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

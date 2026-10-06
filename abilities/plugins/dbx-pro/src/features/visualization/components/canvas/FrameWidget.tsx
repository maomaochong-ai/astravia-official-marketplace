/**
 * FrameWidget — Canvas 里的单个 widget 容器
 *
 * 负责：
 *  - 按 col/row/colSpan/rowSpan 在 CSS Grid 里定位
 *  - skeleton 骨架状态（dashboard 灰 shimmer / bigscreen 暗 glow）
 *  - ready 状态渲染实际图表组件（复用 dashboard-renderer / screen-renderer 的 chart 路由）
 */

import { type JSX } from "react";
import type { VizIntent, WidgetSpec } from "./types";
import { KpiCard } from "../charts/kpi-card";
import { GaugeCard } from "../charts/gauge-card";
import { RechartsLineChart } from "../charts/recharts-line-chart";
import { RechartsBarChart } from "../charts/recharts-bar-chart";
import { RechartsPieChart } from "../charts/recharts-pie-chart";
import { RechartsAreaChart } from "../charts/recharts-area-chart";
import { DataTable } from "../charts/data-table";

interface FrameWidgetProps {
	spec: WidgetSpec;
	intent: VizIntent;
	/** 该 widget 应该消费的数据 */
	data: Array<Record<string, unknown>>;
	columns: string[];
}

export function FrameWidget({ spec, intent, data, columns }: FrameWidgetProps): JSX.Element {
	const themeMode = intent === "dashboard" ? "dashboard" : "bigscreen";

	const gridStyle = {
		gridColumn: `${spec.col + 1} / span ${spec.colSpan}`,
		gridRow: `${spec.row + 1} / span ${spec.rowSpan}`,
	};

	// Skeleton 状态
	if (spec.status === "skeleton") {
		return (
			<div style={gridStyle} className={`viz-skeleton viz-skeleton--${intent}`}>
				<div className="viz-skeleton__bar" />
				<div className="viz-skeleton__body" />
			</div>
		);
	}

	// Ready 状态：渲染对应图表
	const chart = renderChart(spec, themeMode as "dashboard" | "bigscreen", data, columns);

	return (
		<div style={gridStyle} className={`viz-card viz-card--${themeMode} viz-frame-widget`}>
			{chart}
		</div>
	);
}

function renderChart(
	spec: WidgetSpec,
	themeMode: "dashboard" | "bigscreen",
	data: Array<Record<string, unknown>>,
	columns: string[],
): JSX.Element {
	// v0.0.97: 空数据占位符（FilterBar 过滤可能把 rows 全筛光）
	if (data.length === 0) {
		return (
			<div className="viz-widget-empty">
				<span className="viz-widget-empty__icon icon-[lucide--filter-x] h-4 w-4" />
				<span>筛选无匹配数据</span>
			</div>
		);
	}

	const common = { themeMode };

	switch (spec.kind) {
		case "kpi": {
			const col = spec.dataRef.trim();
			const val = data.reduce<number>((sum, r) => sum + (Number(r[col]) || 0), 0);
			return <KpiCard title={spec.title} value={String(val.toLocaleString())} {...common} />;
		}
		case "line":
			return (
				<RechartsLineChart
					title={spec.title}
					data={data}
					xAxisKey={columns[0]}
					yAxisKey={columns[1] ?? columns[0]}
					{...common}
				/>
			);
		case "bar":
			return (
				<RechartsBarChart
					title={spec.title}
					data={data}
					xAxisKey={columns[0]}
					yAxisKey={columns[1] ?? columns[0]}
					{...common}
				/>
			);
		case "pie":
			return (
				<RechartsPieChart
					title={spec.title}
					data={data}
					nameKey={columns[0]}
					valueKey={columns[1] ?? columns[0]}
					{...common}
				/>
			);
		case "area":
			return (
				<RechartsAreaChart
					title={spec.title}
					data={data}
					xAxisKey={columns[0]}
					yAxisKey={columns[1] ?? columns[0]}
					{...common}
				/>
			);
		case "gauge": {
			const col = spec.dataRef.trim();
			// Gauge 值：取第一行作为 ratio（0.0-1.0）；如果列有多行，取平均值
			let raw: number;
			if (data.length === 0) {
				raw = 0;
			} else {
				const sum = data.reduce<number>((s, r) => s + (Number(r[col]) || 0), 0);
				raw = sum / data.length;
			}
			return <GaugeCard title={spec.title} value={raw} themeMode={themeMode} />;
		}
		case "table":
			return (
				<DataTable
					title={spec.title}
					columns={columns}
					rows={data}
					maxRows={50}
					{...common}
				/>
			);
	}
}

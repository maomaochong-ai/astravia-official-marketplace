/**
 * RechartsLineChart — 折线图（主题感知）
 */

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { JSX } from "react";

export interface RechartsLineChartProps {
	title: string;
	data: Array<Record<string, unknown>>;
	xAxisKey: string;
	yAxisKey: string;
	seriesKey?: string;
	color?: string;
	height?: number;
	themeMode?: "dashboard" | "bigscreen";
}

export function RechartsLineChart({
	title,
	data,
	xAxisKey,
	yAxisKey,
	seriesKey,
	color = "#3b82f6",
	height = 250,
}: RechartsLineChartProps): JSX.Element {
	return (
		<div className="viz-card viz-card--chart">
			<h3>{title}</h3>
			<div className="viz-chart-inner" style={{ height }}>
				<ResponsiveContainer>
					<LineChart data={data}>
						<CartesianGrid strokeDasharray="3 3" stroke="var(--viz-grid)" />
						<XAxis dataKey={xAxisKey} stroke="var(--viz-axis)" style={{ fontSize: 11 }} />
						<YAxis stroke="var(--viz-axis)" style={{ fontSize: 11 }} />
						<Tooltip />
						{seriesKey ? <Legend /> : null}
						<Line type="monotone" dataKey={yAxisKey} stroke={color} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
					</LineChart>
				</ResponsiveContainer>
			</div>
		</div>
	);
}

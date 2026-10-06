/**
 * RechartsBarChart — 柱状图（主题感知）
 * recharts 颜色由父级 .viz-root 的 CSS token 覆盖控制
 */

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { JSX } from "react";

export interface RechartsBarChartProps {
	title: string;
	data: Array<Record<string, unknown>>;
	xAxisKey: string;
	yAxisKey: string;
	seriesKey?: string;
	color?: string;
	height?: number;
	horizontal?: boolean;
	themeMode?: "dashboard" | "bigscreen";
}

export function RechartsBarChart({
	title,
	data,
	xAxisKey,
	yAxisKey,
	seriesKey,
	color = "#8b5cf6",
	height = 250,
	horizontal = false,
}: RechartsBarChartProps): JSX.Element {
	return (
		<div className="viz-card viz-card--chart">
			<h3>{title}</h3>
			<div className="viz-chart-inner" style={{ height }}>
				<ResponsiveContainer>
					<BarChart data={data} layout={horizontal ? "vertical" : "horizontal"}>
						<CartesianGrid strokeDasharray="3 3" stroke="var(--viz-grid)" />
						{horizontal ? (
							<>
								<XAxis type="number" stroke="var(--viz-axis)" style={{ fontSize: 11 }} />
								<YAxis type="category" dataKey={xAxisKey} stroke="var(--viz-axis)" style={{ fontSize: 11 }} width={100} />
							</>
						) : (
							<>
								<XAxis dataKey={xAxisKey} stroke="var(--viz-axis)" style={{ fontSize: 11 }} />
								<YAxis stroke="var(--viz-axis)" style={{ fontSize: 11 }} />
							</>
						)}
						<Tooltip />
						{seriesKey ? <Legend /> : null}
						<Bar dataKey={yAxisKey} fill={color} radius={[4, 4, 0, 0]} />
					</BarChart>
				</ResponsiveContainer>
			</div>
		</div>
	);
}

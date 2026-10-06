/**
 * RechartsLineChart — 使用 recharts 的折线图组件
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
		<div className="chart-card">
			<h3>{title}</h3>
			<div style={{ width: "100%", height }}>
				<ResponsiveContainer>
					<LineChart data={data}>
						<CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
						<XAxis
							dataKey={xAxisKey}
							stroke="#94a3b8"
							style={{ fontSize: 11 }}
						/>
						<YAxis
							stroke="#94a3b8"
							style={{ fontSize: 11 }}
						/>
						<Tooltip
							contentStyle={{
								backgroundColor: "rgba(30, 41, 59, 0.95)",
								border: "1px solid rgba(59, 130, 246, 0.3)",
								borderRadius: 8,
								color: "#e2e8f0",
								fontSize: 12,
							}}
						/>
						{seriesKey ? (
							<Legend />
						) : null}
						<Line
							type="monotone"
							dataKey={yAxisKey}
							stroke={color}
							strokeWidth={2}
							dot={{ r: 3 }}
							activeDot={{ r: 5 }}
						/>
					</LineChart>
				</ResponsiveContainer>
			</div>
		</div>
	);
}

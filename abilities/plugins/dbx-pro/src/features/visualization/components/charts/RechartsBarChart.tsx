/**
 * RechartsBarChart — 使用 recharts 的柱状图组件
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
		<div className="chart-card">
			<h3>{title}</h3>
			<div style={{ width: "100%", height }}>
				<ResponsiveContainer>
					<BarChart
						data={data}
						layout={horizontal ? "vertical" : "horizontal"}
					>
						<CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
						{horizontal ? (
							<>
								<XAxis type="number" stroke="#94a3b8" style={{ fontSize: 11 }} />
								<YAxis type="category" dataKey={xAxisKey} stroke="#94a3b8" style={{ fontSize: 11 }} width={100} />
							</>
						) : (
							<>
								<XAxis dataKey={xAxisKey} stroke="#94a3b8" style={{ fontSize: 11 }} />
								<YAxis stroke="#94a3b8" style={{ fontSize: 11 }} />
							</>
						)}
						<Tooltip
							contentStyle={{
								backgroundColor: "rgba(30, 41, 59, 0.95)",
								border: "1px solid rgba(139, 92, 246, 0.3)",
								borderRadius: 8,
								color: "#e2e8f0",
								fontSize: 12,
							}}
						/>
						{seriesKey ? <Legend /> : null}
						<Bar
							dataKey={yAxisKey}
							fill={color}
							radius={[4, 4, 0, 0]}
						/>
					</BarChart>
				</ResponsiveContainer>
			</div>
		</div>
	);
}

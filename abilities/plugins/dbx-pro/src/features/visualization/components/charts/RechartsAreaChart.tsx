/**
 * RechartsAreaChart — 使用 recharts 的面积图组件
 */

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { JSX } from "react";

export interface RechartsAreaChartProps {
	title: string;
	data: Array<Record<string, unknown>>;
	xAxisKey: string;
	yAxisKey: string;
	color?: string;
	height?: number;
}

export function RechartsAreaChart({
	title,
	data,
	xAxisKey,
	yAxisKey,
	color = "#10b981",
	height = 250,
}: RechartsAreaChartProps): JSX.Element {
	return (
		<div className="chart-card">
			<h3>{title}</h3>
			<div style={{ width: "100%", height }}>
				<ResponsiveContainer>
					<AreaChart data={data}>
						<defs>
							<linearGradient id={`gradient-${title}`} x1="0" y1="0" x2="0" y2="1">
								<stop offset="5%" stopColor={color} stopOpacity={0.3} />
								<stop offset="95%" stopColor={color} stopOpacity={0} />
							</linearGradient>
						</defs>
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
								border: "1px solid rgba(16, 185, 129, 0.3)",
								borderRadius: 8,
								color: "#e2e8f0",
								fontSize: 12,
							}}
						/>
						<Area
							type="monotone"
							dataKey={yAxisKey}
							stroke={color}
							fill={`url(#gradient-${title})`}
							strokeWidth={2}
						/>
					</AreaChart>
				</ResponsiveContainer>
			</div>
		</div>
	);
}

/**
 * RechartsAreaChart — 面积图（主题感知）
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
	themeMode?: "dashboard" | "bigscreen";
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
		<div className="viz-card viz-card--chart">
			<h3>{title}</h3>
			<div className="viz-chart-inner" style={{ height }}>
				<ResponsiveContainer>
					<AreaChart data={data}>
						<defs>
							<linearGradient id={`gradient-${title}`} x1="0" y1="0" x2="0" y2="1">
								<stop offset="5%" stopColor={color} stopOpacity={0.3} />
								<stop offset="95%" stopColor={color} stopOpacity={0} />
							</linearGradient>
						</defs>
						<CartesianGrid strokeDasharray="3 3" stroke="var(--viz-grid)" />
						<XAxis dataKey={xAxisKey} stroke="var(--viz-axis)" style={{ fontSize: 11 }} />
						<YAxis stroke="var(--viz-axis)" style={{ fontSize: 11 }} />
						<Tooltip />
						<Area type="monotone" dataKey={yAxisKey} stroke={color} fill={`url(#gradient-${title})`} strokeWidth={2} />
					</AreaChart>
				</ResponsiveContainer>
			</div>
		</div>
	);
}

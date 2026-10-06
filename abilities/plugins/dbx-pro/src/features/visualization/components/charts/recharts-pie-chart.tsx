/**
 * RechartsPieChart — 饼图/环形图（主题感知）
 */

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { JSX } from "react";

export interface RechartsPieChartProps {
	title: string;
	data: Array<Record<string, unknown>>;
	nameKey: string;
	valueKey: string;
	colors?: string[];
	height?: number;
	themeMode?: "dashboard" | "bigscreen";
}

const DASHBOARD_COLORS = ["#3b82f6", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444"];
const BIGSCREEN_COLORS = ["#06b6d4", "#3b82f6", "#22d3ee", "#60a5fa", "#818cf8", "#34d399"];

export function RechartsPieChart({
	title,
	data,
	nameKey,
	valueKey,
	colors,
	height = 250,
	themeMode = "dashboard",
}: RechartsPieChartProps): JSX.Element {
	const palette = colors ?? (themeMode === "bigscreen" ? BIGSCREEN_COLORS : DASHBOARD_COLORS);

	return (
		<div className="viz-card viz-card--chart">
			<h3>{title}</h3>
			<div className="viz-chart-inner" style={{ height }}>
				<ResponsiveContainer>
					<PieChart>
						<Pie
							data={data}
							dataKey={valueKey}
							nameKey={nameKey}
							cx="50%"
							cy="50%"
							outerRadius="80%"
							fill="#8884d8"
							label={({ name, percent }) => `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`}
							labelLine={false}
						>
							{data.map((_, index) => (
								<Cell key={`cell-${index}`} fill={palette[index % palette.length]} />
							))}
						</Pie>
						<Tooltip />
						<Legend />
					</PieChart>
				</ResponsiveContainer>
			</div>
		</div>
	);
}

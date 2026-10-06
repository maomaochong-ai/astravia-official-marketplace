/**
 * RechartsPieChart — 使用 recharts 的饼图组件
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
}

const DEFAULT_COLORS = ["#3b82f6", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444"];

export function RechartsPieChart({
	title,
	data,
	nameKey,
	valueKey,
	colors = DEFAULT_COLORS,
	height = 250,
}: RechartsPieChartProps): JSX.Element {
	return (
		<div className="chart-card">
			<h3>{title}</h3>
			<div style={{ width: "100%", height }}>
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
							label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
							labelLine={false}
						>
							{data.map((_, index) => (
								<Cell
									key={`cell-${index}`}
									fill={colors[index % colors.length]}
								/>
							))}
						</Pie>
						<Tooltip
							contentStyle={{
								backgroundColor: "rgba(30, 41, 59, 0.95)",
								border: "1px solid rgba(59, 130, 246, 0.3)",
								borderRadius: 8,
								color: "#e2e8f0",
								fontSize: 12,
							}}
						/>
						<Legend />
					</PieChart>
				</ResponsiveContainer>
			</div>
		</div>
	);
}

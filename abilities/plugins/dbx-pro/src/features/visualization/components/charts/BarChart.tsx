/**
 * BarChart — 柱状图组件（纯 CSS 实现）
 */

import { useMemo } from "react";
import type { JSX } from "react";

export interface BarChartProps {
	title: string;
	data: Array<{ label: string; value: number }>;
	color?: string;
	horizontal?: boolean;
}

export function BarChart({ title, data, color = "#8b5cf6", horizontal = false }: BarChartProps): JSX.Element {
	const { bars, max } = useMemo(() => {
		if (data.length === 0) {
			return { bars: [], max: 1 };
		}
		const max = Math.max(...data.map((d) => d.value));
		const bars = data.map((d) => ({
			...d,
			percentage: (d.value / max) * 100,
		}));
		return { bars, max };
	}, [data]);

	return (
		<div className="chart-card">
			<h3>{title}</h3>
			<div className={`bar-chart ${horizontal ? "horizontal" : "vertical"}`}>
				{bars.map((bar, i) => (
					<div key={i} className="bar-item">
						<div className="bar-label">{bar.label}</div>
						<div className="bar-track">
							<div
								className="bar-fill"
								style={{
									width: horizontal ? `${bar.percentage}%` : undefined,
									height: horizontal ? undefined : `${bar.percentage}%`,
									backgroundColor: color,
								}}
							/>
						</div>
						<div className="bar-value">{bar.value}</div>
					</div>
				))}
			</div>
		</div>
	);
}

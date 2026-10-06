/**
 * LineChart — 折线图组件（纯 SVG 实现）
 */

import { useMemo } from "react";
import type { JSX } from "react";

export interface LineChartProps {
	title: string;
	data: Array<{ x: string | number; y: number }>;
	color?: string;
	showArea?: boolean;
}

export function LineChart({ title, data, color = "#3b82f6", showArea = true }: LineChartProps): JSX.Element {
	const { path, areaPath, points, xLabels, yLabels, viewBox } = useMemo(() => {
		if (data.length === 0) {
			return { path: "", areaPath: "", points: [], xLabels: [], yLabels: [], viewBox: "0 0 100 100" };
		}

		const width = 100;
		const height = 100;
		const padding = { top: 10, right: 10, bottom: 20, left: 30 };
		const chartWidth = width - padding.left - padding.right;
		const chartHeight = height - padding.top - padding.bottom;

		const maxY = Math.max(...data.map((d) => d.y));
		const minY = Math.min(...data.map((d) => d.y));
		const rangeY = maxY - minY || 1;

		const points = data.map((d, i) => ({
			x: padding.left + (i / Math.max(data.length - 1, 1)) * chartWidth,
			y: padding.top + chartHeight - ((d.y - minY) / rangeY) * chartHeight,
		}));

		const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
		const areaPath = `${path} L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${points[0].x} ${padding.top + chartHeight} Z`;

		const xLabels = data.filter((_, i) => i % Math.ceil(data.length / 5) === 0).map((d) => String(d.x));
		const yLabels = [minY, minY + rangeY / 2, maxY].map((v) => v.toFixed(0));

		return { path, areaPath, points, xLabels, yLabels, viewBox: `0 0 ${width} ${height}` };
	}, [data]);

	return (
		<div className="chart-card">
			<h3>{title}</h3>
			<div className="chart-container">
				<svg viewBox={viewBox} className="chart-svg" preserveAspectRatio="none">
					{showArea && <path d={areaPath} fill={color} opacity="0.1" />}
					<path d={path} fill="none" stroke={color} strokeWidth="2" />
					{points.map((p, i) => (
						<circle key={i} cx={p.x} cy={p.y} r="2" fill={color} />
					))}
				</svg>
				<div className="chart-labels">
					<div className="y-labels">
						{yLabels.map((label, i) => (
							<span key={i}>{label}</span>
						))}
					</div>
					<div className="x-labels">
						{xLabels.map((label, i) => (
							<span key={i}>{label}</span>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}

/**
 * KpiCard — KPI 指标卡片（主题感知）
 * themeMode: "dashboard" = QuickBI 浅色; "bigscreen" = DataV 深色荧光
 */

import type { JSX } from "react";

export interface KpiCardProps {
	title: string;
	value: string | number;
	icon?: string;
	color?: string;
	themeMode?: "dashboard" | "bigscreen";
}

export function KpiCard({ title, value, icon, color, themeMode = "dashboard" }: KpiCardProps): JSX.Element {
	return (
		<div className={`viz-card viz-card--kpi viz-kpi-card-${themeMode}`}>
			<div className="viz-kpi-header">
				{icon && <span className={`viz-kpi-icon ${icon}`} />}
				<h3>{title}</h3>
			</div>
			<div className="viz-kpi-value" style={color ? { color } : undefined}>
				{value}
			</div>
		</div>
	);
}

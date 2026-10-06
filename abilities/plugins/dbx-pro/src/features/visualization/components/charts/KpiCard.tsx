/**
 * KpiCard — KPI 指标卡片组件
 */

import type { JSX } from "react";

export interface KpiCardProps {
	title: string;
	value: string | number;
	icon?: string;
	color?: string;
}

export function KpiCard({ title, value, icon, color = "#3b82f6" }: KpiCardProps): JSX.Element {
	return (
		<div className="kpi-card">
			<div className="kpi-header">
				{icon && <span className={`kpi-icon ${icon}`} />}
				<h3>{title}</h3>
			</div>
			<div className="kpi-value" style={{ color }}>
				{value}
			</div>
		</div>
	);
}

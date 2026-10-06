/**
 * GaugeCard — 仪表盘（主题感知，纯 SVG 弧）
 *
 * 仅用于 BigScreen (bigscreen intent)。Dashboard 即使推断出 gauge 也走 KPI fallback。
 * 半圆弧（180°）：灰底弧 + 彩色值弧 + 中心百分比文字。
 * 颜色走 --viz-palette-1 token（两套主题都有）。
 */

import type { JSX } from "react";

export interface GaugeCardProps {
	title: string;
	/** 0.0-1.0 */
	value: number;
	themeMode: "dashboard" | "bigscreen";
}

export function GaugeCard({ title, value, themeMode }: GaugeCardProps): JSX.Element {
	// clamp
	const v = Math.max(0, Math.min(1, value));
	const percent = Math.round(v * 100);

	// SVG 弧计算（半圆：-π 到 0，SVG y 轴倒置所以用 π 到 0）
	const cx = 50;
	const cy = 70; // 圆心偏下，给弧留空间
	const r = 42;
	const startAngle = Math.PI; // 左端点
	const endAngle = 0;
	const sweepAngle = startAngle - (startAngle - endAngle) * v; // 从左向右扫

	const polarToCart = (angle: number) => [cx + r * Math.cos(angle), cy - r * Math.sin(angle)];
	const [x1, y1] = polarToCart(startAngle);
	const [x2, y2] = polarToCart(endAngle);
	const [xv, yv] = polarToCart(sweepAngle);

	// 大弧标志：扫过 > 180° → 1，否则 0（半圆永远 0，除非 value > 0.5 且 sweep > π 扫过）
	const largeArc = v > 0.5 ? 1 : 0;

	// 背景弧（完整半圆）
	const bgPath = `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
	// 值弧
	const valuePath = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${xv} ${yv}`;

	return (
		<div className={`viz-card viz-card--gauge viz-gauge-card-${themeMode}`}>
			<div className="viz-gauge-title">{title}</div>
			<div className="viz-gauge-svg-wrap">
				<svg viewBox="0 0 100 85" className="viz-gauge-svg">
					{/* 背景弧 */}
					<path d={bgPath} className="viz-gauge-arc-bg" fill="none" />
					{/* 值弧 */}
					<path d={valuePath} className="viz-gauge-arc-value" fill="none" />
				</svg>
				<div className="viz-gauge-center-text">
					<span className="viz-gauge-percent">{percent}</span>
					<span className="viz-gauge-pct">%</span>
				</div>
			</div>
		</div>
	);
}

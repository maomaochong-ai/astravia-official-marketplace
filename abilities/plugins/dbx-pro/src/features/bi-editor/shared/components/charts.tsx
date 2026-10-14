/**
 * charts.tsx — 画布内嵌迷你图表（纯 SVG / divs，无外部图表库）。
 *
 * 颜色策略：默认系列色走 CSS 变量 `var(--color-series-N)`（由 style.css 的 @theme inline
 * 映射到 --dbx-series-N，因此画布调色板能一次换掉所有图表配色）。
 * 注意：SVG 的 presentation attribute 不接受 var()，所以颜色一律通过 style={{ stroke/fill }} 下传。
 *
 * 面积 / 折线 / 柱 / 条 / 箱线 / 环形 / 漏斗 / 仪表 / Sparkline / 图表外框 / 无数据占位
 */

import type { ReactNode } from "react";

// ── 颜色 ──
// 默认系列色用 CSS 变量；node-card.tsx 的 TONE 是另一套（节点语义色），两者分工不同。
export const SERIES = [
	"var(--color-series-1)",
	"var(--color-series-2)",
	"var(--color-series-3)",
	"var(--color-series-4)",
];
export const seriesColor = (i: number) => SERIES[i % SERIES.length];

/** y 轴刻度值数组。 */
export function ticks(min: number, max: number, count = 4): number[] {
	const step = (max - min) / (count - 1);
	return Array.from({ length: count }, (_, i) => Math.round(step * (count - 1 - i) + min));
}

/** y% 从顶边算起（与 AreaChart 内部映射算式同用）。 */
export function yPercent(v: number, min: number, max: number): number {
	const span = max - min || 1;
	return 94 - ((v - min) / span) * 88;
}

// ── 面积图 / 折线图 ──
interface AreaChartProps {
	values: number[];
	stroke?: string;
	fill?: string;
	className?: string;
	gridLines?: number[];
	grid?: boolean;
	domain?: [number, number];
	dash?: boolean;
}

export function AreaChart({
	values,
	stroke = SERIES[0],
	fill,
	className = "h-full w-full",
	gridLines = [25, 50, 75],
	grid = true,
	domain,
	dash = false,
}: AreaChartProps) {
	const [min, max] = domain ?? [Math.min(...values), Math.max(...values)];
	const span = max - min || 1;
	const points = values.map((v, i) => {
		const x = values.length > 1 ? (i / (values.length - 1)) * 100 : 0;
		const y = 100 - ((v - min) / span) * 88 - 6;
		return [x, y] as const;
	});
	const line = points
		.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
		.join(" ");
	return (
		<svg viewBox="0 0 100 100" preserveAspectRatio="none" className={className}>
			{grid ? gridLines.map((y) => (
				<line key={y} x1="0" y1={y} x2="100" y2={y}
					stroke="currentColor" strokeOpacity="0.15" strokeWidth="0.5" />
			)) : null}
			<path d={`${line} L100,100 L0,100 Z`} style={{ fill: fill ?? stroke }} opacity="0.16" />
			<path d={line} fill="none" style={{ stroke }} strokeDasharray={dash ? "4 3" : undefined} strokeWidth="1.75" />
		</svg>
	);
}

// ── Sparkline ──
interface SparklineProps {
	values: number[];
	stroke?: string;
	className?: string;
}

export function Sparkline({ values, stroke = SERIES[0], className = "h-8 w-full" }: SparklineProps) {
	const max = Math.max(...values);
	const min = Math.min(...values);
	const span = max - min || 1;
	const d = values.map((v, i) => {
		const x = (i / (values.length - 1)) * 100;
		const y = 28 - ((v - min) / span) * 26 - 1;
		return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
	}).join(" ");
	return (
		<svg viewBox="0 0 100 30" preserveAspectRatio="none" className={className}>
			<path d={d} fill="none" style={{ stroke }} strokeWidth="1.5" />
		</svg>
	);
}

// ── 柱状图（竖直） ──
interface BarsProps {
	values: number[];
	className?: string;
	tone?: string;
	gap?: string;
}

export function Bars({ values, className = "h-16", tone = "bg-series-1", gap = "gap-1" }: BarsProps) {
	const max = Math.max(...values);
	return (
		<div className={`flex items-end ${gap} ${className}`}>
			{values.map((v, i) => (
				<div key={i} className={`flex-1 rounded-t-[2px] ${tone}`}
					style={{ height: `${Math.max(4, (v / max) * 100)}%` }} />
			))}
		</div>
	);
}

// ── 条形图（水平排名） ──
interface HBarRow { label: string; value: number; text: string }

export function HBars({ rows, className = "", tone = "bg-series-1" }: { rows: HBarRow[]; className?: string; tone?: string }) {
	const max = Math.max(...rows.map((r) => r.value));
	return (
		<div className={`flex flex-col gap-2 ${className}`}>
			{rows.map((r) => (
				<div key={r.label} className="flex items-center gap-2">
					<span className="w-9 shrink-0 truncate text-[11px] text-muted">{r.label}</span>
					<span className="flex min-w-0 flex-1 items-center">
						<span className={`h-2.5 rounded-r-[2px] ${tone}`}
							style={{ width: `${Math.max(3, (r.value / max) * 100)}%` }} />
					</span>
					<span className="shrink-0 font-mono text-[11px] tabular-nums text-surface-foreground">{r.text}</span>
				</div>
			))}
		</div>
	);
}

// ── 环形图（conic-gradient + mask） ──
interface DonutSegment { value: number; color: string }

export function Donut({
	segments, size = 96, thickness = 14, holeFill = "var(--color-surface)", className = "",
}: {
	segments: DonutSegment[];
	size?: number; thickness?: number; holeFill?: string; className?: string;
}) {
	const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
	let acc = 0;
	const stops = segments.map((s) => {
		const from = (acc / total) * 100;
		acc += s.value;
		return `${s.color} ${from.toFixed(2)}% ${((acc / total) * 100).toFixed(2)}%`;
	}).join(", ");
	const mask = `radial-gradient(farthest-side, transparent calc(100% - ${thickness}px), rgb(0 0 0) calc(100% - ${thickness}px))`;
	return (
		<span className={`relative shrink-0 rounded-full ${className}`}
			style={{ width: size, height: size, background: `conic-gradient(${stops})`, maskImage: mask, WebkitMaskImage: mask }}>
			<span className="absolute inset-0 m-auto rounded-full"
				style={{ background: holeFill, width: size - thickness * 2, height: size - thickness * 2 }} />
		</span>
	);
}

// ── 漏斗图 ──
interface FunnelStage { label: string; value: number; text: string }

export function Funnel({ stages, className = "" }: { stages: FunnelStage[]; className?: string }) {
	const max = stages[0].value;
	return (
		<div className={`flex flex-col items-center gap-1 ${className}`}>
			{stages.map((s) => (
				<span key={s.label}
					className="flex h-[22px] min-w-0 items-center justify-between gap-1 overflow-hidden rounded-[3px] bg-series-1/25 px-2 text-[10px] whitespace-nowrap"
					style={{ width: `${Math.max(30, (s.value / max) * 100)}%` }}>
					<span className="truncate text-surface-foreground">{s.label}</span>
					<span className="shrink-0 font-mono tabular-nums text-muted">{s.text}</span>
				</span>
			))}
		</div>
	);
}

// ── 仪表盘（半环形） ──
export function Gauge({ value, className = "h-[72px] w-[132px]", tone = SERIES[0] }: { value: number; className?: string; tone?: string }) {
	const r = 50, cx = 60, cy = 56;
	const len = Math.PI * r;
	const d = `M${cx - r},${cy} A${r},${r} 0 0 1 ${cx + r},${cy}`;
	return (
		<svg viewBox="0 0 120 61" className={className}>
			<path d={d} fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="9" strokeLinecap="round" />
			<path d={d} fill="none" style={{ stroke: tone }} strokeWidth="9" strokeLinecap="round"
				strokeDasharray={`${((value / 100) * len).toFixed(1)} ${len.toFixed(1)}`} />
		</svg>
	);
}

// ── 折线图（带网格，不填充） ──
interface LineChartProps {
	values: number[];
	stroke?: string;
	className?: string;
	gridLines?: number[];
	grid?: boolean;
	domain?: [number, number];
	dot?: boolean;
}

export function LineChart({
	values,
	stroke = SERIES[1],
	className = "h-full w-full",
	gridLines = [25, 50, 75],
	grid = true,
	domain,
	dot = false,
}: LineChartProps) {
	const [min, max] = domain ?? [values.length ? Math.min(...values) : 0, values.length ? Math.max(...values) : 1];
	const span = max - min || 1;
	const points = values.map((v, i) => {
		const x = values.length > 1 ? (i / (values.length - 1)) * 100 : 50;
		const y = 100 - ((v - min) / span) * 88 - 6;
		return [x, y] as const;
	});
	const line = points
		.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
		.join(" ");
	return (
		<svg viewBox="0 0 100 100" preserveAspectRatio="none" className={className}>
			{grid ? gridLines.map((y) => (
				<line key={y} x1="0" y1={y} x2="100" y2={y}
					stroke="currentColor" strokeOpacity="0.15" strokeWidth="0.5" />
			)) : null}
			<path d={line} fill="none" style={{ stroke }} strokeWidth="1.75" />
			{dot ? points.map(([x, y], i) => (
				<circle key={i} cx={x} cy={y} r="1.6" style={{ fill: stroke }} />
			)) : null}
		</svg>
	);
}

// ── 柱状图（SVG，带基线；负值按 0 处理） ──
interface BarChartProps {
	values: number[];
	tone?: string;
	className?: string;
	/** 柱间留白占单个槽位的百分比（0-60）。 */
	gap?: number;
}

export function BarChart({ values, tone = SERIES[1], className = "h-full w-full", gap = 18 }: BarChartProps) {
	const max = values.length ? Math.max(0, ...values) : 0;
	const slot = 100 / Math.max(1, values.length);
	const barWidth = slot * (1 - Math.min(60, Math.max(0, gap)) / 100);
	return (
		<svg viewBox="0 0 100 100" preserveAspectRatio="none" className={className}>
			<line x1="0" y1="99.5" x2="100" y2="99.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="0.5" />
			{values.map((v, i) => {
				const height = max > 0 ? Math.max(1, (Math.max(0, v) / max) * 96) : 1;
				return (
					<rect key={i}
						x={(i * slot + (slot - barWidth) / 2).toFixed(2)}
						y={(100 - height).toFixed(2)}
						width={barWidth.toFixed(2)}
						height={height.toFixed(2)}
						rx="0.5"
						style={{ fill: tone }} />
				);
			})}
		</svg>
	);
}

// ── 箱线图（五数概括；竖向，箱宽随组数自适应） ──
interface BoxplotProps {
	groups: { label: string; min: number; q1: number; median: number; q3: number; max: number }[];
	className?: string;
	tone?: string;
}

export function Boxplot({ groups, className = "h-full w-full", tone = SERIES[2] }: BoxplotProps) {
	const spread = groups.flatMap((g) => [g.min, g.max]);
	const min = spread.length ? Math.min(...spread) : 0;
	const max = spread.length ? Math.max(...spread) : 1;
	const span = max - min || 1;
	const yOf = (v: number) => 100 - ((v - min) / span) * 88 - 6;
	const slot = 100 / Math.max(1, groups.length);
	const half = slot * 0.28;
	return (
		<svg viewBox="0 0 100 100" preserveAspectRatio="none" className={className}>
			{groups.map((g, i) => {
				const cx = slot * (i + 0.5);
				const yMin = yOf(g.min);
				const yMax = yOf(g.max);
				const yQ1 = yOf(g.q1);
				const yQ3 = yOf(g.q3);
				const boxTop = Math.min(yQ1, yQ3);
				const boxHeight = Math.max(0.8, Math.abs(yQ3 - yQ1));
				return (
					<g key={`${g.label}-${i}`}>
						{/* 上下须 + 端帽 */}
						<line x1={cx} y1={yMin} x2={cx} y2={yMax}
							style={{ stroke: tone }} strokeWidth="1" vectorEffect="non-scaling-stroke" />
						<line x1={cx - half} y1={yMin} x2={cx + half} y2={yMin}
							style={{ stroke: tone }} strokeWidth="1" vectorEffect="non-scaling-stroke" />
						<line x1={cx - half} y1={yMax} x2={cx + half} y2={yMax}
							style={{ stroke: tone }} strokeWidth="1" vectorEffect="non-scaling-stroke" />
						{/* 四分位箱 + 中位线 */}
						<rect x={cx - half} y={boxTop} width={half * 2} height={boxHeight}
							style={{ fill: tone }} fillOpacity="0.22" vectorEffect="non-scaling-stroke" />
						<line x1={cx - half} y1={yOf(g.median)} x2={cx + half} y2={yOf(g.median)}
							style={{ stroke: tone }} strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
					</g>
				);
			})}
		</svg>
	);
}

// ── 散点图（x = index, y = values；支持多维度 values[][] 但迷你图只用一维） ──
interface ScatterChartProps {
	values: number[];
	tone?: string;
	className?: string;
	domain?: [number, number];
}

export function ScatterChart({
	values, tone = SERIES[0], className = "h-full w-full", domain,
}: ScatterChartProps) {
	if (values.length === 0) {
		return (
			<svg viewBox="0 0 100 100" preserveAspectRatio="none" className={className}>
				<text x="50" y="54" textAnchor="middle" fontSize="6" fill="currentColor" fillOpacity="0.35">
					无数据
				</text>
			</svg>
		);
	}
	const [min, max] = domain ?? [Math.min(...values), Math.max(...values)];
	const span = max - min || 1;
	const points = values.map((v, i) => {
		const x = values.length > 1 ? (i / (values.length - 1)) * 96 + 2 : 50;
		const y = 94 - ((v - min) / span) * 88 - 2;
		return { x, y };
	});
	return (
		<svg viewBox="0 0 100 100" preserveAspectRatio="none" className={className}>
			{/* 网格 */}
			{[25, 50, 75].map((y) => (
				<line key={y} x1="0" y1={y} x2="100" y2={y}
					stroke="currentColor" strokeOpacity="0.12" strokeWidth="0.5" />
			))}
			{/* 点 */}
			{points.map((p, i) => (
				<g key={i}>
					<circle cx={p.x} cy={p.y} r="2.6" style={{ fill: tone }} fillOpacity="0.22" />
					<circle cx={p.x} cy={p.y} r="1.4" style={{ fill: tone }} />
				</g>
			))}
		</svg>
	);
}

// ── 雷达图（values 是各维度数值，labels 是轴名；迷你图里轴名压缩成首字） ──
interface RadarChartProps {
	values: number[];
	labels?: string[];
	tone?: string;
	className?: string;
	domain?: [number, number];
}

export function RadarChart({
	values, labels = [], tone = SERIES[0], className = "h-full w-full", domain,
}: RadarChartProps) {
	const n = values.length;
	if (n < 3) {
		return (
			<svg viewBox="0 0 100 100" preserveAspectRatio="none" className={className}>
				<text x="50" y="54" textAnchor="middle" fontSize="6" fill="currentColor" fillOpacity="0.35">
					需 ≥3 维度
				</text>
			</svg>
		);
	}
	const [min, max] = domain ?? [Math.min(...values), Math.max(...values)];
	const span = max - min || 1;
	const cx = 50, cy = 50, R = 36;
	// 极坐标 → 画布坐标（从正上方开始，顺时针）
	const angle = (i: number) => (-Math.PI / 2) + (i / n) * Math.PI * 2;
	const axisPt = (i: number, r: number) => ({
		x: cx + Math.cos(angle(i)) * r,
		y: cy + Math.sin(angle(i)) * r,
	});
	// 数据点
	const pts = values.map((v, i) => {
		const r = ((v - min) / span) * R;
		return axisPt(i, r);
	});
	const polygon = pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
	// 网格（3 层同心多边形）
	const gridLevels = [0.33, 0.66, 1];
	const axisPaths = Array.from({ length: n }, (_, i) => {
		const p = axisPt(i, R);
		return `M${cx},${cy} L${p.x.toFixed(2)},${p.y.toFixed(2)}`;
	}).join(" ");
	return (
		<svg viewBox="0 0 100 100" preserveAspectRatio="none" className={className}>
			{/* 同心网格 */}
			{gridLevels.map((lv, li) => {
				const poly = Array.from({ length: n }, (_, i) => {
					const p = axisPt(i, R * lv);
					return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
				}).join(" ");
				return <polygon key={li} points={poly} fill="none" stroke="currentColor" strokeOpacity="0.14" strokeWidth="0.5" />;
			})}
			{/* 轴线 */}
			<path d={axisPaths} fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="0.5" />
			{/* 数据多边形 */}
			<polygon points={polygon} style={{ fill: tone }} fillOpacity="0.22" stroke={tone} strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
			{/* 数据点 */}
			{pts.map((p, i) => (
				<circle key={i} cx={p.x} cy={p.y} r="1.5" style={{ fill: tone }} />
			))}
			{/* 轴名（迷你图里只显示首字或缩写） */}
			{labels.slice(0, n).map((l, i) => {
				const p = axisPt(i, R + 7);
				return (
					<text key={i} x={p.x} y={p.y + 1.8} fontSize="4" textAnchor="middle"
						fill="currentColor" fillOpacity="0.5">
						{l.slice(0, 4)}
					</text>
				);
			})}
		</svg>
	);
}

// ── 图表外框（标题 / 角标 + 自适应高度的图表区） ──
export function ChartFrame({
	title,
	hint,
	height,
	children,
}: {
	title?: string;
	hint?: string;
	/** 图表区最小高度（px），实际高度由卡片剩余空间决定。 */
	height?: number;
	children: ReactNode;
}) {
	return (
		<div className="flex min-h-0 flex-1 flex-col gap-1">
			{title || hint ? (
				<div className="flex items-center justify-between gap-2 text-[10px] text-muted">
					<span className="min-w-0 truncate">{title}</span>
					{hint ? <span className="shrink-0 font-mono tabular-nums">{hint}</span> : null}
				</div>
			) : null}
			<div className="min-h-0 flex-1" style={height ? { minHeight: height } : undefined}>{children}</div>
		</div>
	);
}

// ── 无数据占位（宁可空着，也不画伪随机数据） ──
export function EmptyChart({
	message = "无数据",
	hint,
	className = "",
}: {
	message?: string;
	hint?: string;
	className?: string;
}) {
	return (
		<div className={`flex h-full min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-[4px] border border-dashed border-border bg-surface-raised/40 px-2 text-center ${className}`}>
			<span className="text-[10px] text-muted">{message}</span>
			{hint ? <span className="text-[9px] text-faint">{hint}</span> : null}
		</div>
	);
}

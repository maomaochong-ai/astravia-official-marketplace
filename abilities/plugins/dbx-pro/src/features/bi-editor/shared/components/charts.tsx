/**
 * charts.tsx — 画布内嵌迷你图表（纯 SVG / divs，无外部图表库）。
 *
 * 颜色策略：与 node-card.tsx TONE 对齐的硬编码 hex，
 * 后续接入主题系统时改成 CSS var 即可。
 *
 * 面积 / 柱 / 条 / 环形 / 漏斗 / 仪表 / Sparkline
 */

// ── 颜色（与 node-card.tsx TONE 同值）──
export const SERIES = ["#3b82f6", "#10b981", "#f59e0b", "#f97316"];
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
			<path d={`${line} L100,100 L0,100 Z`} fill={fill ?? stroke} opacity="0.16" />
			<path d={line} fill="none" stroke={stroke} strokeDasharray={dash ? "4 3" : undefined} strokeWidth="1.75" />
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
			<path d={d} fill="none" stroke={stroke} strokeWidth="1.5" />
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

export function Bars({ values, className = "h-16", tone = "bg-[#3b82f6]", gap = "gap-1" }: BarsProps) {
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

export function HBars({ rows, className = "", tone = "bg-[#3b82f6]" }: { rows: HBarRow[]; className?: string; tone?: string }) {
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
					className="flex h-[22px] min-w-0 items-center justify-between gap-1 overflow-hidden rounded-[3px] bg-[#3b82f6]/25 px-2 text-[10px] whitespace-nowrap"
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
			<path d={d} fill="none" stroke={tone} strokeWidth="9" strokeLinecap="round"
				strokeDasharray={`${((value / 100) * len).toFixed(1)} ${len.toFixed(1)}`} />
		</svg>
	);
}

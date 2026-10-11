/**
 * The dashboard's figures, drawn from divs and inline SVG geometry — no chart
 * library, no icon font. adr-0009 §0.5 keeps eleven self-built Chart.js figures
 * as the cheap default route; these are the shapes the M5 editor drops on the
 * canvas: 面积 / 柱 / 条 / 环形 / 漏斗 / 仪表.
 *
 * Every colour comes from a theme token, so a page's `palette` swap is a token
 * swap and nothing else.
 */

const SERIES = [
	"var(--color-series-1)",
	"var(--color-series-2)",
	"var(--color-series-3)",
	"var(--color-series-4)",
];

export const seriesColor = (i: number) => SERIES[i % SERIES.length];

/** Rough y-axis ticks for a value range — no axis library either. */
export function ticks(min: number, max: number, count = 4) {
	const step = (max - min) / (count - 1);
	return Array.from({ length: count }, (_, i) => Math.round(step * (count - 1 - i) + min));
}

export function AreaChart({
	values,
	stroke = "var(--color-series-1)",
	dash = false,
	fill,
	className = "h-full w-full",
	gridLines = [25, 50, 75],
	grid = true,
	domain,
}: {
	values: number[];
	stroke?: string;
	fill?: string;
	className?: string;
	grid?: boolean;
	/** 横向网格线的 y%（0–100，自顶边）；由调用方按 yPercent() 算出以对齐刻度 */
	gridLines?: number[];
	/** shared min/max — two series on one axis must be normalised together */
	domain?: [number, number];
	/** 上一周期对比线：同轴、虚线、不填充 */
	dash?: boolean;
}) {
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
			{grid
				? gridLines.map((y) => (
						<line
							key={y}
							x1="0"
							y1={y}
							x2="100"
							y2={y}
							stroke="var(--color-screen-line)"
							strokeWidth="1"
							vectorEffect="non-scaling-stroke"
						/>
					))
				: null}
			<path d={`${line} L100,100 L0,100 Z`} fill={fill ?? stroke} opacity="0.16" />
			<path
				d={line}
				fill="none"
				stroke={stroke}
				strokeDasharray={dash ? "4 3" : undefined}
				strokeWidth="1.75"
				vectorEffect="non-scaling-stroke"
			/>
		</svg>
	);
}

/** 值与绘图区高度对齐：y% 从顶边算起，与 AreaChart 的映射同一套算式。 */
export function yPercent(v: number, min: number, max: number) {
	const span = max - min || 1;
	return 94 - ((v - min) / span) * 88;
}

export function Sparkline({
	values,
	stroke = "var(--color-series-1)",
	className = "h-8 w-full",
}: {
	values: number[];
	stroke?: string;
	className?: string;
}) {
	const max = Math.max(...values);
	const min = Math.min(...values);
	const span = max - min || 1;
	const d = values
		.map((v, i) => {
			const x = (i / (values.length - 1)) * 100;
			const y = 28 - ((v - min) / span) * 26 - 1;
			return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
		})
		.join(" ");
	return (
		<svg viewBox="0 0 100 30" preserveAspectRatio="none" className={className}>
			<path d={d} fill="none" stroke={stroke} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
		</svg>
	);
}

export function Bars({
	values,
	className = "h-16",
	tone = "bg-series-1",
	gap = "gap-1",
}: {
	values: number[];
	className?: string;
	tone?: string;
	gap?: string;
}) {
	const max = Math.max(...values);
	return (
		<div className={`flex items-end ${gap} ${className}`}>
			{values.map((v, i) => (
				<div
					key={i}
					className={`flex-1 rounded-t-[2px] ${tone}`}
					style={{ height: `${Math.max(4, (v / max) * 100)}%` }}
				/>
			))}
		</div>
	);
}

/** Horizontal bars — the ranking shape. Bars grow from the left rule. */
export function HBars({
	rows,
	className = "",
	tone = "bg-series-1",
}: {
	rows: { label: string; value: number; text: string }[];
	className?: string;
	tone?: string;
}) {
	const max = Math.max(...rows.map((r) => r.value));
	return (
		<div className={`flex flex-col gap-2 ${className}`}>
			{rows.map((r) => (
				<div key={r.label} className="flex items-center gap-2">
					<span className="w-9 shrink-0 truncate text-[11px] text-muted">{r.label}</span>
					<span className="flex min-w-0 flex-1 items-center">
						<span
							className={`h-2.5 rounded-r-[2px] ${tone}`}
							style={{ width: `${Math.max(3, (r.value / max) * 100)}%` }}
						/>
					</span>
					<span className="shrink-0 font-mono text-[11px] tabular-nums text-surface-foreground">
						{r.text}
					</span>
				</div>
			))}
		</div>
	);
}

export function Donut({
	segments,
	size = 96,
	thickness = 14,
	holeFill = "var(--color-surface)",
	className = "",
}: {
	segments: { value: number; color: string }[];
	size?: number;
	thickness?: number;
	holeFill?: string;
	className?: string;
}) {
	const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
	let acc = 0;
	const stops = segments
		.map((s) => {
			const from = (acc / total) * 100;
			acc += s.value;
			return `${s.color} ${from.toFixed(2)}% ${((acc / total) * 100).toFixed(2)}%`;
		})
		.join(", ");
	const mask = `radial-gradient(farthest-side, transparent calc(100% - ${thickness}px), rgb(0 0 0) calc(100% - ${thickness}px))`;
	return (
		<span
			className={`relative shrink-0 rounded-full ${className}`}
			style={{
				width: size,
				height: size,
				background: `conic-gradient(${stops})`,
				maskImage: mask,
				WebkitMaskImage: mask,
			}}
		>
			<span
				className="absolute inset-0 m-auto rounded-full"
				style={{ background: holeFill, width: size - thickness * 2, height: size - thickness * 2 }}
			/>
		</span>
	);
}

/** Conversion funnel: each stage is a bar whose width is its share of stage 1. */
export function Funnel({
	stages,
	className = "",
}: {
	stages: { label: string; value: number; text: string }[];
	className?: string;
}) {
	const max = stages[0].value;
	return (
		<div className={`flex flex-col items-center gap-1 ${className}`}>
			{stages.map((s) => (
				<span
					key={s.label}
					className="flex h-[22px] min-w-0 items-center justify-between gap-1 overflow-hidden rounded-[3px] bg-series-1/25 px-2 text-[10px] whitespace-nowrap"
					style={{ width: `${Math.max(30, (s.value / max) * 100)}%` }}
				>
					<span className="truncate text-surface-foreground">{s.label}</span>
					<span className="shrink-0 font-mono tabular-nums text-muted">{s.text}</span>
				</span>
			))}
		</div>
	);
}

/** Half-ring gauge, 0–100. */
export function Gauge({
	value,
	className = "h-[72px] w-[132px]",
	tone = "var(--color-series-1)",
}: {
	value: number;
	className?: string;
	tone?: string;
}) {
	const r = 50;
	const cx = 60;
	const cy = 56;
	const len = Math.PI * r;
	const d = `M${cx - r},${cy} A${r},${r} 0 0 1 ${cx + r},${cy}`;
	return (
		<svg viewBox="0 0 120 61" className={className}>
			<path d={d} fill="none" stroke="var(--color-border)" strokeWidth="9" strokeLinecap="round" />
			<path
				d={d}
				fill="none"
				stroke={tone}
				strokeWidth="9"
				strokeLinecap="round"
				strokeDasharray={`${((value / 100) * len).toFixed(1)} ${len.toFixed(1)}`}
			/>
		</svg>
	);
}

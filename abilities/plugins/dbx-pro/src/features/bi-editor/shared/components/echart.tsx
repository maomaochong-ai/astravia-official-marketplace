/**
 * echart.tsx — ECharts 容器（画布节点内嵌用）。
 *
 * 只做三件事：初始化实例、跟随容器尺寸 resize、option 变化时全量替换。
 * 不在这里做取数或折算，option 由 chart-option.ts 的纯函数产出。
 *
 * 调色板：画布系列色是 CSS 变量（var(--color-series-N)），canvas 渲染读不到，
 * 所以挂载时从计算样式读实际色值传给 option 工厂；主题/调色板变更时重新读。
 */

import { useEffect, useRef, useState, type JSX } from "react";
import { applyPalette, FALLBACK_PALETTE } from "../../canvas/lib/chart-option";
import * as echarts from "echarts/core";
import {
	BarChart,
	LineChart,
	PieChart,
	ScatterChart,
	RadarChart,
	FunnelChart,
	GaugeChart,
	HeatmapChart,
	TreemapChart,
	SankeyChart,
} from "echarts/charts";
import {
	GridComponent,
	TooltipComponent,
	LegendComponent,
	RadarComponent,
	VisualMapComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([
	BarChart,
	LineChart,
	PieChart,
	ScatterChart,
	RadarChart,
	FunnelChart,
	GaugeChart,
	HeatmapChart,
	TreemapChart,
	SankeyChart,
	GridComponent,
	TooltipComponent,
	LegendComponent,
	RadarComponent,
	VisualMapComponent,
	CanvasRenderer,
]);

/** 从元素上读系列色；取不到（未定义变量 / 测试环境）时用兜底色。 */
export function readPalette(el: HTMLElement | null): string[] {
	if (!el || typeof getComputedStyle !== "function") return FALLBACK_PALETTE;
	let computed: CSSStyleDeclaration;
	try {
		computed = getComputedStyle(el);
	} catch {
		return FALLBACK_PALETTE;
	}
	const colors: string[] = [];
	for (let i = 1; i <= 4; i += 1) {
		const raw = computed.getPropertyValue(`--color-series-${i}`).trim();
		// 变量未解析时 getPropertyValue 会原样返回 "var(--dbx-series-1)"，这种值不能给 canvas 用。
		if (raw && !raw.startsWith("var(")) colors.push(raw);
	}
	return colors.length > 0 ? colors : FALLBACK_PALETTE;
}

export interface EChartProps {
	/** 语义层产出的 option（buildChartOption 的返回值）。 */
	option: Record<string, unknown> | null;
	className?: string;
	/** 无障碍名称，画布节点里用节点标题。 */
	ariaLabel?: string;
}

export function EChart({ option, className = "h-full w-full", ariaLabel }: EChartProps): JSX.Element {
	const hostRef = useRef<HTMLDivElement | null>(null);
	const chartRef = useRef<echarts.ECharts | null>(null);
	const [palette, setPalette] = useState<string[]>(FALLBACK_PALETTE);
	/** 上一次送进实例的 option 签名，避免拖拽重渲染时反复 setOption。 */
	const appliedRef = useRef<string>("");

	useEffect(() => {
		const host = hostRef.current;
		if (!host) return;
		const instance = echarts.init(host, undefined, { renderer: "canvas" });
		chartRef.current = instance;

		let frame = 0;
		const observer = typeof ResizeObserver === "function"
			? new ResizeObserver(() => {
				// ResizeObserver 在布局阶段触发，延后一帧避免 "ResizeObserver loop" 警告。
				cancelAnimationFrame(frame);
				frame = requestAnimationFrame(() => instance.resize());
			})
			: null;
		observer?.observe(host);

		return () => {
			cancelAnimationFrame(frame);
			observer?.disconnect();
			instance.dispose();
			chartRef.current = null;
		};
	}, []);

	useEffect(() => {
		setPalette(readPalette(hostRef.current));
	}, []);

	useEffect(() => {
		const instance = chartRef.current;
		if (!instance || !option) return;
		const merged = applyPalette(option, palette);
		const signature = JSON.stringify(merged);
		if (signature === appliedRef.current) return;
		appliedRef.current = signature;
		// notMerge=true：切换图表类型时清掉上一种图的轴 / 系列残留。
		instance.setOption(merged, true);
	}, [option, palette]);

	return <div ref={hostRef} className={className} role="img" aria-label={ariaLabel} />;
}

/** 供测试与调用方判断：该类节点是否走 ECharts 渲染。 */
export const ECHARTS_KINDS = new Set([
	"chart-bar",
	"chart-line",
	"chart-area",
	"chart-pie",
	"chart-donut",
	"chart-scatter",
	"chart-radar",
	"chart-funnel",
	"chart-gauge",
	"chart-heatmap",
	"chart-treemap",
	"chart-sankey",
	"chart-waterfall",
	"chart-combo",
]);

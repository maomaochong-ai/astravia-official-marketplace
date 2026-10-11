/**
 * ChartItemRenderer — 在宿主 UI 里直接渲染单个 ChartItem（不再套 iframe）。
 *
 * 渲染引擎：ECharts（ADR-0010b）。
 *
 * 支持两种 ChartItem 格式：
 *   ① 旧格式：Chart.js 风格 { type: "bar"|"line"|..., data: {labels, datasets}, ... }
 *      走 chartItemToEChartsOption 转换 → 生成 ECharts option → setOption
 *   ② 新格式：JimuBI 组件 JSON { cfg: { option, chartData, chart:{subclass}, w, h, ... } }
 *      cfg.option 是 compileBigscreen 输出的完整 ECharts option（已注入 theme/series/axis），
 *      直接 inst.setOption(item.cfg.option) 渲染，不再二次转换
 *
 * 关键判断：item.cfg?.option 存在 → JimuBI 格式；否则 → 旧 Chart.js 格式。
 */

import { useEffect, useRef, useState, type JSX } from "react";
import type { ChartItem } from "../../../domain/chart-contract";
import { createEChartsInstance, ensureEChartsRuntime, type EChartsInstance } from "../chart-runtime-browser";
import { chartItemToEChartsOption } from "../../../tools/dbx-chart-collection";

interface Props {
	item: ChartItem & { cfg?: Record<string, unknown> };
	isScreen: boolean;
}

/** JimuBI 格式检测：item 带 cfg.option → 直接 setOption 渲染完整 ECharts config。 */
function isJimuBIFormat(item: ChartItem & { cfg?: unknown }): boolean {
	const cfg = (item as { cfg?: { option?: unknown } }).cfg;
	return !!cfg && typeof cfg === "object" && "option" in cfg;
}

export function ChartItemRenderer({ item, isScreen }: Props): JSX.Element {
	const divRef = useRef<HTMLDivElement>(null);
	const instanceRef = useRef<EChartsInstance | null>(null);
	const [runtimeMissing, setRuntimeMissing] = useState(false);

	useEffect(() => {
		let cancelled = false;
		ensureEChartsRuntime(isScreen).then((ok) => {
			if (cancelled) return;
			if (!ok) { setRuntimeMissing(true); return; }
			setRuntimeMissing(false);
			const div = divRef.current;
			if (!div) return;
			const inst = createEChartsInstance(div, isScreen);
			if (!inst) { setRuntimeMissing(true); return; }
			instanceRef.current = inst;

			// 两条路径：JimuBI 直传 vs 旧 Chart.js 转换
			let echartsOpt: unknown;
			if (isJimuBIFormat(item)) {
				// 新格式：cfg.option 已是完整 ECharts option，直接 setOption
				const cfg = (item as unknown as { cfg?: { option?: unknown } }).cfg;
				echartsOpt = cfg?.option ?? {};
			} else {
				// 旧格式：先经 chartItemToEChartsOption 转换
				echartsOpt = (chartItemToEChartsOption as (c: ChartItem, d: unknown) => unknown)(item, item.data);
			}
			try {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any — ECharts setOption 第二参数 notMerge 类型定义缺失
				(inst.setOption as any)(echartsOpt, true);
			} catch (e) {
				console.error("[ChartItemRenderer] setOption failed:", e);
			}

			const onResize = () => inst.resize();
			window.addEventListener("resize", onResize);
			return () => {
				window.removeEventListener("resize", onResize);
				inst.dispose();
				instanceRef.current = null;
			};
		});
		return () => { cancelled = true; instanceRef.current?.dispose(); instanceRef.current = null; };
	}, [item, isScreen]);

	// JimuBI 格式优先用 cfg.w/cfg.h ，否则用 item.height
	let height = item.height ?? (isScreen ? 280 : 250);
	if (isJimuBIFormat(item)) {
		const cfgH = (item as { cfg?: { h?: number } }).cfg?.h;
		if (cfgH && cfgH > 0) height = cfgH;
	}

	return (
		<div className="viz-canvas" style={{ height }}>
			{runtimeMissing ? (
				<div className="viz-canvas-error">
					<strong>图表运行时未就绪</strong>
					<span>ECharts 未能加载，导出的 HTML 不受影响。</span>
				</div>
			) : (
				<div ref={divRef} style={{ width: "100%", height: "100%" }} />
			)}
		</div>
	);
}

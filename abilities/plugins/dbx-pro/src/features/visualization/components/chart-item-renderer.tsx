/**
 * ChartItemRenderer — 在宿主 UI 里直接渲染单个 ChartItem（不再套 iframe）。
 *
 * 渲染引擎已从 Chart.js 切换为 ECharts（ADR-0010b）。
 * 数据由调用方算好后传进来，本组件只负责画。
 * 运行时与 defaults 复用 chart-runtime-browser，
 * 保证「筛选后的图」和「导出的 HTML」是同一个样子（ADR-0009 §10 验收 ⑤）。
 */

import { useEffect, useRef, useState, type JSX } from "react";
import type { ChartItem } from "../../../domain/chart-contract";
import { createEChartsInstance, ensureEChartsRuntime, type EChartsInstance } from "../chart-runtime-browser";
import { chartItemToEChartsOption } from "../../../tools/dbx-chart-collection";

interface Props {
	item: ChartItem;
	isScreen: boolean;
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

			const echartsOpt = chartItemToEChartsOption(item, item.data);

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

	const height = item.height ?? (isScreen ? 280 : 250);

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

/** chartItemToEChartsOption 已直接 import，无需额外适配器。 */

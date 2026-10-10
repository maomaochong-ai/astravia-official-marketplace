/**
 * ChartItemRenderer — 在宿主 UI 里直接渲染单个 ChartItem（不再套 iframe）。
 *
 * 数据由调用方算好（筛选后的行 → resolveChartItems）后传进来，本组件只负责画。
 * 运行时与 defaults 复用 chart-runtime-browser（也就是导出产物用的那一份），
 * 保证「筛选后的图」和「导出的 HTML」是同一个样子（ADR-0009 §10 验收 ⑤）。
 */

import { useEffect, useRef, useState, type JSX } from "react";
import type { ChartItem } from "../../../domain/chart-contract";
import { getChartRuntime, mergeChartOptions } from "../chart-runtime-browser";

interface Props {
	item: ChartItem;
	isScreen: boolean;
}

export function ChartItemRenderer({ item, isScreen }: Props): JSX.Element {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [runtimeMissing, setRuntimeMissing] = useState(false);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ChartCtor = getChartRuntime(isScreen);
		if (!ChartCtor) {
			setRuntimeMissing(true);
			return;
		}
		setRuntimeMissing(false);
		const chart = new ChartCtor(canvas, {
			type: item.type,
			data: item.data,
			options: mergeChartOptions(item.options),
		});
		return () => chart.destroy();
	}, [item, isScreen]);

	// 与 tools/dbx-chart-collection 的 buildChartArea 保持同一个默认高度
	const height = item.height ?? (isScreen ? 280 : 250);

	return (
		<div className="viz-canvas" style={{ height }}>
			{runtimeMissing ? (
				<div className="viz-canvas-error">
					<strong>图表运行时未就绪</strong>
					<span>Chart.js 未能加载，导出的 HTML 不受影响。</span>
				</div>
			) : (
				<canvas ref={canvasRef} />
			)}
		</div>
	);
}

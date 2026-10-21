/**
 * chart-tile.ts — 单个图表节点的「数据 → option」推导（看板预览浮层与图表放大浮层共用）。
 *
 * 两者都要把节点结果折算成 ECharts option：语义层产帧 → 判别该图是否走 ECharts →
 * 有帧则构 option，否则返回 null（调用方据此回退到帧数字 / 「无数据」兜底）。
 * 抽成此函数避免在看板预览与图表放大多处复制同一段推导。
 */
import { ECHARTS_KINDS } from "../../shared/components/echart";
import type { NodeResult } from "../hooks/use-canvas-execution";
import { buildChartOption, parseChartStyle } from "./chart-option";
import { resolveNodeChartData, type NodeChartData } from "./node-chart-data";

export interface ChartTile {
	data: NodeChartData;
	option: ReturnType<typeof buildChartOption> | null;
}

export function buildChartTile(
	kind: string,
	values: Record<string, unknown> = {},
	self: NodeResult | null | undefined = null,
	upstream: NodeResult | null | undefined = null,
): ChartTile {
	const data = resolveNodeChartData(kind, values, self, upstream);
	const option = data.frame && ECHARTS_KINDS.has(kind)
		? buildChartOption(kind, data.frame, parseChartStyle(values))
		: null;
	return { data, option };
}
/**
 * visualization-html — 按需生成产物 HTML。
 *
 * M1 起 html 不再是存储的事实源：带 datasets 的产物只落库数据，
 * HTML 在「导出 / 新标签打开」时才由 chartItems 现生成（ADR-0009 §4.1、§5.2）。
 * 旧产物（html 已落库的只读快照）直接返回原值，不重新生成 —— 内容与当初所见一致。
 *
 * 这里刻意复用 dbx_chart_collection 的 generateHtml：导出路径和 Agent 生成路径
 * 必须是同一份 shell + defaults 实现，否则 UI 内渲染与导出会出现视觉漂移。
 */

import type { ChartItem, Visualization } from "../../domain/chart-contract";
import { generateHtml } from "../../tools/dbx-chart-collection";

/** v1 只读快照可能只有 html 没有图表项，那种产物无法重生成。 */
export function canBuildVisualizationHtml(chartItems: readonly ChartItem[]): boolean {
	return chartItems.length > 0;
}

/**
 * 由图表项现生成 HTML。
 *
 * `chartItems` 缺省用产物自带的；详情抽屉会传入「当前筛选后的图表项」，
 * 于是导出的就是用户此刻看到的那张图，而不是筛选前的快照。
 */
export function buildVisualizationHtml(
	viz: Visualization,
	chartItems: readonly ChartItem[] = viz.chartItems,
): string {
	return generateHtml({
		charts: [...chartItems],
		type: viz.type,
		title: viz.title,
		connection_name: viz.connection,
		table: viz.table,
	});
}

/**
 * 取可用的 HTML：优先落库的（旧产物），否则按当前图表项现生成。
 * 两者都没有时抛错，由调用方转成用户可见的提示。
 */
export function resolveVisualizationHtml(
	viz: Visualization,
	chartItems: readonly ChartItem[] = viz.chartItems,
): string {
	if (viz.html) return viz.html;
	if (!canBuildVisualizationHtml(chartItems)) throw new Error("该产物既没有 HTML，也没有可用的图表项");
	return buildVisualizationHtml(viz, chartItems);
}

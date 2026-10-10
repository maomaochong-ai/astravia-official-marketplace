/**
 * figure-registry — 不走 Chart.js 的图表类型登记处，也是这段渲染逻辑的逃生口。
 *
 * 三种渲染结果（Chart.js canvas / 自有 figure / 未注册类型的提示卡）都在这里定：
 * `isFigureType` 给调用方分派，`renderFigure` 出片段。
 *
 * 扩展方式：写一个 `(item, context) => string` 的渲染器，在这里登记一行，
 * 再把类型加进 `ChartItemType` 与 dbx_chart_collection 的参数枚举。
 * **不接受 Agent 传来的自定义 HTML/SVG** —— 片段最终会被 innerHTML 进宿主页面和
 * 导出产物，只能由本仓库的代码生成（ADR-0009 §9 M2）。
 */

import type { ChartItem } from "../../../domain/chart-contract";
import { renderBoxplotFigure } from "./boxplot-figure";
import type { FigureContext, FigureRenderer } from "./figure-context";
import { renderFunnelFigure } from "./funnel-figure";
import { readFigureOptions } from "./figure-options";
import { getFigurePalette } from "./figure-palette";
import { figureNoticeHtml } from "./figure-text";
import { renderMetricFigure } from "./metric-figure";

export const FIGURE_RENDERERS: Record<string, FigureRenderer> = {
	funnel: renderFunnelFigure,
	metric: renderMetricFigure,
	boxplot: renderBoxplotFigure,
};

/** 已注册的自有渲染类型（不含 Chart.js 的 8 种）。 */
export const FIGURE_TYPES: readonly string[] = Object.keys(FIGURE_RENDERERS);

export function isFigureType(type: string): boolean {
	return Object.prototype.hasOwnProperty.call(FIGURE_RENDERERS, type);
}

/**
 * 渲染一个 figure 片段（**只有卡片内容**，不含 .chart-card 外壳与标题）。
 * 未注册的类型返回一张可见的提示卡，而不是留一块空白 canvas。
 */
export function renderFigure(item: ChartItem, options: { isScreen: boolean }): string {
	const palette = getFigurePalette(options.isScreen);
	const height = item.height ?? (options.isScreen ? 280 : 250);
	const renderer = FIGURE_RENDERERS[item.type as string];

	if (!renderer) {
		return figureNoticeHtml(palette, `当前版本不支持该图表类型：${item.type}`, {
			detail: `已注册的自有类型：${FIGURE_TYPES.join(" / ")}`,
			height,
		});
	}

	const context: FigureContext = {
		isScreen: options.isScreen,
		palette,
		options: readFigureOptions(item),
		height,
	};
	return renderer(item, context);
}

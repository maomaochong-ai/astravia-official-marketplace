/**
 * figure-context — 渲染器签名与上下文。
 *
 * 单独一个文件是为了断开循环依赖：registry 依赖各渲染器，
 * 各渲染器只依赖这里的**类型**。
 */

import type { ChartItem } from "../../../domain/chart-contract";
import type { FigureOptions } from "./figure-options";
import type { FigurePalette } from "./figure-palette";

export interface FigureContext {
	/** 深色大屏主题 */
	isScreen: boolean;
	palette: FigurePalette;
	options: FigureOptions;
	/** 图表区域高度，与 Chart.js 路径 canvas 的高度同口径 */
	height: number;
}

/** 渲染器只返回**卡片内容**，卡片外壳（标题 / 描述 / 边框）由调用方负责。 */
export type FigureRenderer = (item: ChartItem, context: FigureContext) => string;

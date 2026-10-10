/**
 * FigureItemRenderer — 渲染不走 Chart.js 的 figure 类型（漏斗 / 指标卡 / 箱形图）。
 *
 * 片段由 figure-registry 生成，和导出产物里嵌进去的是**同一个函数、同一段字符串**
 * （ADR-0009 §10 ⑤），所以 UI 侧不需要另写一套样式，也不会有两处渲染对不上的问题。
 * 片段只包含卡片内容，卡片外壳仍由 ChartGrid 负责。
 */

import type { JSX } from "react";
import type { ChartItem } from "../../../domain/chart-contract";
import { renderFigure } from "../figures/figure-registry";

interface Props {
	item: ChartItem;
	isScreen: boolean;
}

export function FigureItemRenderer({ item, isScreen }: Props): JSX.Element {
	return <div className="viz-figure" dangerouslySetInnerHTML={{ __html: renderFigure(item, { isScreen }) }} />;
}

/**
 * ChartGrid — 在宿主 UI 里铺开一组 ChartItem 的网格。
 *
 * 与 dbx_chart_collection 生成的 HTML 是同一个布局模型（列数取自
 * resolveGridColumnCount，卡片样式取自 themes/*.css 的 .chart-card），
 * 差别只有两点，都是为了在抽屉这种窄容器里不出横向溢出：
 *   - 列宽用 minmax(0, 1fr) 而不是 1fr（Chart.js 会写死 canvas 宽度，1fr 会被撑破）
 *   - 不套 iframe，直接就地渲染 canvas
 *
 * 数据格式错误的图不静默成白板：走与导出产物一致的错误卡片。
 */

import type { JSX } from "react";
import type { ChartItem } from "../../../domain/chart-contract";
import { normalizeChartData, resolveGridColumnCount, validateChartData } from "../../../tools/dbx-chart-collection";
import { isFigureType } from "../figures/figure-registry";
import { ChartItemRenderer } from "./chart-item-renderer";
import { FigureItemRenderer } from "./figure-item-renderer";

interface Props {
	items: ChartItem[];
	isScreen: boolean;
	/** 产物带 datasets 时，没绑定 source 的图要说明它不随筛选变化。 */
	showUnboundHint?: boolean;
	layout?: "auto" | "grid-2" | "grid-3" | "grid-4";
}

export function ChartGrid({ items, isScreen, showUnboundHint = false, layout = "auto" }: Props): JSX.Element {
	const columns = resolveGridColumnCount(layout, items.length);

	return (
		<div className="viz-grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
			{items.map((item, index) => {
				const normalized = normalizeChartData(item.data, item.type);
				const valid = validateChartData(normalized);
				const height = item.height ?? (isScreen ? 280 : 250);
				return (
					<div className="viz-canvas-card" key={item.title ?? `chart-${index}`}>
						<h3 className="viz-canvas-title">{item.title ?? `图表 ${index + 1}`}</h3>
						{item.description ? <p className="viz-canvas-desc">{item.description}</p> : null}
						{showUnboundHint && !item.source ? (
							<p className="viz-canvas-note">该图表未绑定数据集，不随筛选变化</p>
						) : null}
						{!valid.ok ? (
							<div className="viz-canvas-error" style={{ height }}>
								<strong>⚠️ 图表数据格式错误</strong>
								<span>{valid.reason}</span>
								<span>AI 未正确将查询结果转为 Chart.js {"{ datasets: [...] }"} 格式</span>
							</div>
						) : isFigureType(item.type) ? (
							<FigureItemRenderer item={{ ...item, data: normalized as Record<string, unknown> }} isScreen={isScreen} />
						) : (
							<ChartItemRenderer item={{ ...item, data: normalized as Record<string, unknown> }} isScreen={isScreen} />
						)}
					</div>
				);
			})}
		</div>
	);
}

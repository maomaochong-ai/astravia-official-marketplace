/**
 * ChartGrid — 在宿主 UI 里铺开一组图表的网格。
 *
 * 支持两种 ChartItem 格式：
 *   ① 旧 Chart.js 格式  → normalize + validate → 渲染
 *   ② 新大屏组件 JSON 格式（item.cfg?.option 存在）→ 跳过 normalize/validate，直接渲染
 *
 * 布局模型：
 *   - 列数：resolveGridColumnCount (与 dbx-chart-collection 导出的 HTML 一致)
 *   - 列宽：minmax(0, 1fr) 避免 iframe 撑破抽屉窄容器
 *   - 不套 iframe，直接就地渲染 canvas
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
	showUnboundHint?: boolean;
	layout?: "auto" | "grid-2" | "grid-3" | "grid-4";
}

/** 检测大屏组件 JSON 格式 — item 带 cfg.option（compileBigscreen 输出）。 */
function isScreenItem(item: ChartItem): boolean {
	const cfg = (item as { cfg?: unknown }).cfg;
	return !!cfg && typeof cfg === "object" && "option" in (cfg as Record<string, unknown>);
}

export function ChartGrid({ items, isScreen, showUnboundHint = false, layout = "auto" }: Props): JSX.Element {
	const columns = resolveGridColumnCount(layout, items.length);

	return (
		<div className="viz-grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
			{items.map((item, index) => {
				const screenFormat = isScreenItem(item);
				// 大屏格式跳过 normalize/validate — 数据已在 cfg.option.series.data 里
				const normalized = screenFormat ? item.data : normalizeChartData(item.data, item.type);
				const valid = screenFormat ? { ok: true, reason: "" } : validateChartData(normalized);

				// 大屏格式优先用 cfg.h 高度
				let height = item.height ?? (isScreen ? 280 : 250);
				if (screenFormat) {
					const cfgH = (item as { cfg?: { h?: number } }).cfg?.h;
					if (cfgH && cfgH > 0) height = cfgH;
				}

				const title = screenFormat
					? (item.title ?? (item as { title?: string }).title ?? `组件 ${index + 1}`)
					: (item.title ?? `图表 ${index + 1}`);

				return (
					<div className="viz-canvas-card" key={`${title}-${index}`}>
						<h3 className="viz-canvas-title">{title}</h3>
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
							<FigureItemRenderer item={{ ...item, data: (normalized ?? item.data) as Record<string, unknown> }} isScreen={isScreen} />
						) : (
							<ChartItemRenderer item={{ ...item, data: normalized as Record<string, unknown> }} isScreen={isScreen} />
						)}
					</div>
				);
			})}
		</div>
	);
}

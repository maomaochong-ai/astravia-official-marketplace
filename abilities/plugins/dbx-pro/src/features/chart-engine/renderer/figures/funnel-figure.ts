/**
 * funnel-figure — 漏斗图。
 *
 * 为什么不用 Chart.js 插件、也不用 SVG 梯形：
 *  - 导出必须是**单个离线 HTML**，多一份 vendored UMD 就多一份体积和溯源成本（M2 决定零新增依赖）；
 *  - SVG 梯形在数值接近时标签会挤在一起，小数值那一段窄到看不清字；
 *  - 居中的横向条 + 右侧数值列，宽度本身表达衰减，任何数据分布下都可读。
 *
 * 数据契约与 Chart.js 类型一致：`{ labels, datasets: [{ label, data }] }`，
 * **只取第一条 series**（所以 funnel 在 chart-source 的 SINGLE_SERIES_TYPES 里），
 * 顺序按 labels 原样，不做排序 —— 漏斗的顺序就是业务阶段顺序，由 SQL 决定。
 */

import type { ChartItem } from "../../../domain/chart-contract";
import type { FigureContext } from "./figure-context";
import { seriesColor } from "./figure-palette";
import { readFigureLabels, readFigureSeries } from "./figure-series";
import { escapeHtml, figureNoticeHtml, formatFigureNumber } from "./figure-text";

export function renderFunnelFigure(item: ChartItem, context: FigureContext): string {
	const { palette, options, isScreen } = context;
	const first = readFigureSeries(item)[0];
	const labels = readFigureLabels(item, first?.values.length ?? 0);

	if (labels.length === 0) {
		return figureNoticeHtml(palette, "漏斗图没有可用数据", {
			detail: "需要 { labels: [...], datasets: [{ data: [...] }] }",
			height: context.height,
		});
	}

	const values = labels.map((_, i) => first?.values[i] ?? null);
	const usable = values.filter((v): v is number => v !== null);
	if (usable.length === 0) {
		return figureNoticeHtml(palette, "漏斗图没有可用的数值", {
			detail: "datasets[0].data 里没有数字",
			height: context.height,
		});
	}

	const max = Math.max(...usable);
	const head = values.find((v): v is number => v !== null && v > 0) ?? 0;
	const barHeight = isScreen ? 26 : 22;

	const rows = labels.map((label, i) => {
		const value = values[i];
		const width = value !== null && value > 0 && max > 0 ? Math.max((value / max) * 100, 1.5) : 0;
		const valueText = value === null ? "—" : formatFigureNumber(value, options.digits) + (options.unit ?? "");
		const percentText =
			options.showPercent && value !== null && head > 0
				? `占首段 ${((value / head) * 100).toFixed(1)}%`
				: "";
		return (
			`<div style="display:flex;align-items:center;gap:10px;min-width:0">` +
			`<span title="${escapeHtml(label)}" style="flex:0 0 96px;text-align:right;font-size:12px;color:${palette.text};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(label)}</span>` +
			`<span style="flex:1 1 auto;min-width:0;display:flex;justify-content:center">` +
			`<span style="display:block;width:${width.toFixed(2)}%;height:${barHeight}px;border-radius:4px;background:${seriesColor(palette, i)}"></span>` +
			`</span>` +
			`<span style="flex:0 0 120px;min-width:0;display:flex;flex-direction:column;line-height:1.25">` +
			`<span style="font-size:13px;font-weight:600;color:${palette.text}">${escapeHtml(valueText)}</span>` +
			(percentText ? `<span style="font-size:10px;color:${palette.muted}">${escapeHtml(percentText)}</span>` : "") +
			`</span>` +
			`</div>`
		);
	});

	return `<div class="dbx-figure dbx-figure-funnel" style="display:flex;flex-direction:column;gap:8px">${rows.join("")}</div>`;
}

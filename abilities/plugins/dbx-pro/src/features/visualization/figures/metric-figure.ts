/**
 * metric-figure — 指标卡（单值 / 多口径）。
 *
 * 纯 DOM，不塞进 Chart.js：一个数值没有坐标系，用图表库画只会得到一张空 canvas
 * 加一圈用不上的坐标轴（ADR-0009 §9 M2 第 2 条）。
 *
 * 数据契约与 Chart.js 类型一致：`{ labels, datasets: [{ label, data }] }`
 *  - 每个 label 一张卡（labels = 指标名或维度值）
 *  - `datasets[0].data[i]` 是主数值（大字号）
 *  - `datasets[1..]` 是次要口径，逐行列出；第一条同时用来算环比
 *
 * 字号固定（26 / 大屏 30）而不是 clamp()/vw：卡片宽度取决于 Grid 列数和
 * 抽屉宽度，vw 会让 UI 里的字号跟导出页对不上。
 */

import type { ChartItem } from "../../../domain/chart-contract";
import type { FigureContext } from "./figure-context";
import type { FigurePalette } from "./figure-palette";
import { readFigureLabels, readFigureSeries } from "./figure-series";
import { escapeHtml, figureNoticeHtml, formatFigureNumber } from "./figure-text";

function formatValue(value: number | null, palette: FigurePalette, digits?: number, unit?: string): string {
	if (value === null) return "—";
	return formatFigureNumber(value, digits) + (unit ?? "");
}

export function renderMetricFigure(item: ChartItem, context: FigureContext): string {
	const { palette, options, isScreen } = context;
	const series = readFigureSeries(item);
	const labels = readFigureLabels(item, series[0]?.values.length ?? 0);

	if (labels.length === 0 || series.length === 0) {
		return figureNoticeHtml(palette, "指标卡没有可用数据", {
			detail: "需要 { labels: [...], datasets: [{ label, data: [...] }] }",
			height: context.height,
		});
	}

	const valueSize = isScreen ? 30 : 26;

	const cards = labels.map((label, i) => {
		const primary = series[0].values[i] ?? null;
		const secondary = series.slice(1).map((s, idx) => ({
			label: s.label || `口径 ${idx + 2}`,
			value: s.values[i] ?? null,
		}));
		const base = secondary[0];
		const delta =
			options.showDelta && base && primary !== null && base.value !== null && base.value !== 0
				? (primary - base.value) / Math.abs(base.value)
				: null;

		const deltaHtml =
			delta === null
				? ""
				: `<div style="margin-top:6px;font-size:11px;color:${delta >= 0 ? palette.up : palette.down}">` +
					`<span style="font-weight:600">${delta >= 0 ? "▲" : "▼"} ${(Math.abs(delta) * 100).toFixed(1)}%</span>` +
					`<span style="color:${palette.muted}"> 较 ${escapeHtml(base.label)}</span>` +
					`</div>`;

		const secondaryHtml =
			secondary.length === 0
				? ""
				: `<div style="margin-top:6px;display:flex;flex-direction:column;gap:2px">` +
					secondary
						.map(
							(row) =>
								`<div style="font-size:11px;color:${palette.muted};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">` +
								`${escapeHtml(row.label)} ${escapeHtml(formatValue(row.value, palette, options.digits, options.unit))}</div>`,
						)
						.join("") +
					`</div>`;

		return (
			`<div style="padding:14px 16px;box-sizing:border-box;min-width:0;border-radius:8px;background:${palette.surface};border:1px solid ${palette.surfaceBorder}">` +
			`<div title="${escapeHtml(label)}" style="font-size:11px;letter-spacing:.4px;color:${palette.muted};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(label)}</div>` +
			`<div title="${escapeHtml(formatValue(primary, palette, options.digits, options.unit))}" style="margin-top:4px;font-size:${valueSize}px;font-weight:700;line-height:1.2;color:${palette.text};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">` +
			`${escapeHtml(formatValue(primary, palette, options.digits, options.unit))}</div>` +
			deltaHtml +
			secondaryHtml +
			`</div>`
		);
	});

	const caption = series[0].label
		? `<div style="font-size:11px;color:${palette.muted};margin-bottom:8px">${escapeHtml(series[0].label)}</div>`
		: "";

	return (
		`<div class="dbx-figure dbx-figure-metric">` +
		caption +
		`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px">${cards.join("")}</div>` +
		`</div>`
	);
}

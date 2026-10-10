/**
 * figure-series — 把 `ChartItem.data` 读成 figure 需要的 (labels, series) 结构。
 *
 * figure 与 Chart.js 共用同一份 data 契约：`{ labels: [...], datasets: [{ label, data }] }`。
 * 这里是**唯一**的解释入口 —— 三个渲染器都从这里拿数据，
 * 「labels 缺失按索引补」这类容错只写一遍。
 */

import type { ChartItem } from "../../../domain/chart-contract";
import { toFiniteNumber } from "./figure-text";

export interface FigureSeries {
	/** series 名（datasets[i].label），用于指标卡的次要口径行 */
	label: string;
	/** 与 labels 等长；非数值位置为 null */
	values: (number | null)[];
}

function rawDatasets(item: ChartItem): unknown[] {
	const data = (item.data ?? {}) as Record<string, unknown>;
	return Array.isArray(data.datasets) ? (data.datasets as unknown[]) : [];
}

/**
 * 读分类轴标签。AI 常忘 labels —— 缺省时按 fallbackLength 补 1..n，
 * 与 normalizeChartData 的修正口径一致。
 */
export function readFigureLabels(item: ChartItem, fallbackLength = 0): string[] {
	const data = (item.data ?? {}) as Record<string, unknown>;
	const raw = Array.isArray(data.labels) ? (data.labels as unknown[]) : [];
	if (raw.length > 0) return raw.map((label) => String(label ?? ""));
	return Array.from({ length: Math.max(0, fallbackLength) }, (_, i) => String(i + 1));
}

/** 读数值 series（跳过非对象 dataset，非数值位置记 null）。 */
export function readFigureSeries(item: ChartItem): FigureSeries[] {
	const series: FigureSeries[] = [];
	for (const raw of rawDatasets(item)) {
		if (!raw || typeof raw !== "object") continue;
		const ds = raw as Record<string, unknown>;
		const values = Array.isArray(ds.data) ? (ds.data as unknown[]) : [];
		series.push({
			label: typeof ds.label === "string" ? ds.label : "",
			values: values.map(toFiniteNumber),
		});
	}
	return series;
}

/** 读第一条 dataset 的原始 data 数组 —— 箱形图这类条目本身是结构体/数组的类型用它。 */
export function readFirstSeriesEntries(item: ChartItem): unknown[] {
	const first = rawDatasets(item)[0];
	if (!first || typeof first !== "object") return [];
	const values = (first as Record<string, unknown>).data;
	return Array.isArray(values) ? (values as unknown[]) : [];
}

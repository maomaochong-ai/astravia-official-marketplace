/**
 * chart-source — 从 DatasetSpec.rows 重新映射出 Chart.js data。
 *
 * 筛选要「重绘但不重跑 SQL」，就必须有一条从「行」到「图表数据」的显式映射。
 * 映射由 ChartItem.source 声明，没有声明的图是静态快照，原样返回自己的 data。
 *
 * 只做「列 → labels / series」，不做聚合、不做计算字段（ADR-0009 §6 第 3 条）。
 * 重建时按序保留原 dataset 上的样式（背景色 / 描边 / 类型覆盖），
 * 否则一次筛选就会把 AI 调好的配色洗掉。
 */

import type { ChartFilter, ChartItem, ChartSource, DatasetSpec } from "./chart-contract";
import { applyFilters, filtersForDataset } from "./dataset-filter";

/**
 * 单 dataset 承载所有数据点的图表类型，不能多 series。
 * funnel 从 M2 起走自有渲染器，但同样只读 datasets[0]（漏斗就是一条链路）。
 */
const SINGLE_SERIES_TYPES: ReadonlySet<string> = new Set(["pie", "doughnut", "polarArea", "funnel"]);

/**
 * 取该图当前应渲染的 data。
 *
 * `rows === undefined` 表示「数据集没有可用的行」（例如体积降级后只留了 sql），
 * 此时保留原有 data，避免把图清空成空白。
 */
export function resolveChartData(
	item: ChartItem,
	rows: readonly Record<string, unknown>[] | undefined,
): Record<string, unknown> {
	const source = item.source;
	if (!source || rows === undefined) return item.data;
	if (!source.labelColumn || !Array.isArray(source.valueColumns) || source.valueColumns.length === 0) {
		return item.data;
	}
	return buildChartJsData(item, source, rows);
}

export function buildChartJsData(
	item: ChartItem,
	source: ChartSource,
	rows: readonly Record<string, unknown>[],
): Record<string, unknown> {
	const labels = rows.map((row) => formatLabel(row[source.labelColumn]));
	const columns = SINGLE_SERIES_TYPES.has(item.type)
		? source.valueColumns.slice(0, 1)
		: source.valueColumns;
	const previous = readDatasets(item.data);

	const datasets = columns.map((column, index) => {
		const style = previous[index];
		const data = rows.map((row) => toChartNumber(row[column]));
		return style ? { ...style, label: column, data } : { label: column, data };
	});

	return { labels, datasets };
}

function readDatasets(data: Record<string, unknown>): Record<string, unknown>[] {
	const datasets = (data as { datasets?: unknown }).datasets;
	if (!Array.isArray(datasets)) return [];
	return datasets.filter(
		(entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null && !Array.isArray(entry),
	);
}

function formatLabel(value: unknown): string {
	return value === null || value === undefined ? "" : String(value);
}

/** 与 dbx-chart-collection 的 normalizeChartData 同口径：能转数值就转，否则保持原值。 */
function toChartNumber(value: unknown): unknown {
	const numeric = Number(value);
	return Number.isFinite(numeric) ? numeric : value;
}

/**
 * 丢掉指向不存在数据集的 source。
 *
 * 留着这种 source 比不绑定更糟：图上会挂着一份“看起来可筛选、实际永远不动”的数据，
 * 而用户无从区分。调用方拿 unboundCount 给一句可见的提示。
 */
export function pruneUnboundSources(
	chartItems: readonly ChartItem[],
	datasets: readonly { id: string }[],
): { items: ChartItem[]; unboundCount: number } {
	const known = new Set(datasets.map((dataset) => dataset.id));
	let unboundCount = 0;
	const items = chartItems.map((item) => {
		if (!item.source || known.has(item.source.datasetId)) return item;
		unboundCount += 1;
		const { source: _dropped, ...rest } = item;
		return rest;
	});
	return { items, unboundCount };
}

/**
 * 把一个产物的【图表项 + 数据集 + 筛选】算成可以交给 Chart.js 的图表项。
 *
 * 筛选只作用于这里：不重跑 SQL、不改聚合口径，换筛选就是重新走一遍这个纯函数。
 * 数据集 rows 被体积降级清空（`rows: []` 但 `rowCount > 0`）时跳过滤，
 * 让图表保留原有快照而不是被空数组洗白。
 */
export function resolveChartItems(
	chartItems: readonly ChartItem[],
	datasets: readonly DatasetSpec[],
	filters: readonly ChartFilter[] = [],
): ChartItem[] {
	if (datasets.length === 0) return [...chartItems];
	const rowsByDataset = new Map<string, Record<string, unknown>[]>();
	for (const dataset of datasets) {
		if (dataset.rows.length === 0 && dataset.rowCount > 0) continue;
		rowsByDataset.set(dataset.id, applyFilters(dataset.rows, dataset.columns, filtersForDataset(filters, dataset.id)));
	}
	return chartItems.map((item) => {
		const rows = item.source ? rowsByDataset.get(item.source.datasetId) : undefined;
		return { ...item, data: resolveChartData(item, rows) };
	});
}

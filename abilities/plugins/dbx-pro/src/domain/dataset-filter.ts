/**
 * dataset-filter — 产物级筛选的求值（纯函数）。
 *
 * 语义（ADR-0009 §6 第 2 条）：筛选默认在**前端**过滤 `DatasetSpec.rows`，
 * 不重跑 SQL，聚合口径不变。因此这里只做「行级取舍」，不做聚合、不做重算。
 *
 *   - 空数组 / 全部未生效 → 原样返回所有行
 *   - 多个 filter 之间是 AND；单个 filter 内 values 与 min/max 同时存在也是 AND
 *   - `column` 不在 `columns` 里 → 跳过该条件，不报错（跨数据集筛选只作用于命中者）
 *   - `values` 为空集合 → 该条件未生效，**不是**「过滤掉所有行」
 *   - 单元格为 null / undefined → 任何生效条件都判为不匹配（NULL 不满足 = 比较）
 */

import type { ChartFilter } from "./chart-contract";

/** 这个条件是否会真的过滤掉行。全空的条件是 no-op。 */
export function isFilterActive(filter: ChartFilter): boolean {
	if (Array.isArray(filter.values) && filter.values.length > 0) return true;
	return filter.min !== undefined || filter.max !== undefined;
}

/** 行是否满足单个条件（不含「列是否存在」的判断）。 */
export function matchesFilter(value: unknown, filter: ChartFilter): boolean {
	if (value === null || value === undefined) return false;

	if (Array.isArray(filter.values) && filter.values.length > 0) {
		const target = String(value);
		if (!filter.values.some((candidate) => String(candidate) === target)) return false;
	}

	if (filter.min !== undefined && compareValue(value, filter.min) < 0) return false;
	if (filter.max !== undefined && compareValue(value, filter.max) > 0) return false;
	return true;
}

/** 行是否满足全部生效条件。 */
export function matchesFilters(
	row: Record<string, unknown>,
	columns: readonly string[],
	filters: readonly ChartFilter[],
): boolean {
	for (const filter of filters) {
		if (!isFilterActive(filter)) continue;
		if (!columns.includes(filter.column)) continue;
		if (!matchesFilter(row[filter.column], filter)) return false;
	}
	return true;
}

/** 过滤后的行（新数组；无生效条件时返回输入行的浅拷贝）。 */
export function applyFilters(
	rows: readonly Record<string, unknown>[],
	columns: readonly string[],
	filters: readonly ChartFilter[],
): Record<string, unknown>[] {
	if (!Array.isArray(filters) || !filters.some(isFilterActive)) return [...rows];
	return rows.filter((row) => matchesFilters(row, columns, filters));
}

/** 只保留作用于指定数据集的条件（条目的 datasetId 缺省时视为作用于所有数据集）。 */
export function filtersForDataset(filters: readonly ChartFilter[], datasetId: string): ChartFilter[] {
	return filters.filter((filter) => !filter.datasetId || filter.datasetId === datasetId);
}

/** 数值比数值；其它（含 ISO 日期字符串）按字符串比较 —— 两者都是闭区间。 */
function compareValue(value: unknown, bound: number | string): number {
	if (typeof value === "number") {
		const numeric = typeof bound === "number" ? bound : Number(bound);
		if (Number.isFinite(numeric)) return value - numeric;
	}
	const left = String(value);
	const right = String(bound);
	if (left === right) return 0;
	return left < right ? -1 : 1;
}

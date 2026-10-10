/**
 * dataset-spec — DatasetSpec 的规范化、裁剪与体积估算。
 *
 * 纯函数层：不依赖 React、宿主存储与数据库，可以直接单元测试。
 *
 * 体积保护（ADR-0009 §5.3 的三级降级）在这里实现：
 *   1. 行数裁剪 —— normalizeDatasetSpec() 落盘前裁到 DATASET_ROW_LIMIT
 *   2. 列裁剪   —— fitDatasetSpec() 只留图表真正引用的列
 *   3. 只留 sql —— 仍超限则丢掉 rows，UI 标注「需要重新取数」而不是伪造数据
 */

import type { ChartItem, DatasetSpec } from "./chart-contract";

/** 单个数据集落盘的行数上限。与 dbx_query_full 的默认 maxRows 保持一致。 */
export const DATASET_ROW_LIMIT = 2000;

/** 单条产物的落盘体积上限（估算值，字节）。超出后按 fitDatasetSpec 降级。 */
export const DATASET_STORE_BYTE_LIMIT = 2 * 1024 * 1024;

/** 规范化输入：字段全部宽松，容忍 AI / 旧产物给过来的残缺结构。 */
export interface DatasetSpecInput {
	id?: unknown;
	title?: unknown;
	connection?: unknown;
	table?: unknown;
	sql?: unknown;
	columns?: unknown;
	rows?: unknown;
	rowCount?: unknown;
	fetchedAt?: unknown;
}

/** 降级档位；`none` 表示原样保留。 */
export type DatasetDegradeReason = "none" | "columns-pruned" | "sql-only";

export interface FitDatasetResult {
	spec: DatasetSpec;
	degraded: DatasetDegradeReason;
	bytes: number;
}

function isPlainRow(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string {
	return typeof value === "string" ? value : "";
}

/** FNV-1a 32 位；用于在没有 id 时派生一个稳定 id（同一份数据总是得到同一个 id）。 */
function fnv1a(text: string): string {
	let hash = 0x811c9dc5;
	for (let i = 0; i < text.length; i += 1) {
		hash ^= text.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193) >>> 0;
	}
	return hash.toString(16).padStart(8, "0");
}

function inferColumns(rows: Record<string, unknown>[]): string[] {
	const columns: string[] = [];
	const seen = new Set<string>();
	for (const row of rows) {
		for (const key of Object.keys(row)) {
			if (seen.has(key)) continue;
			seen.add(key);
			columns.push(key);
		}
	}
	return columns;
}

/**
 * 补齐身份字段并把 rows 裁到上限。
 *
 * `rowCount` 保留 **SQL 完整结果行数**（大于 rows.length 时如实体现），
 * UI 据此显示「筛选后 N 行 / 全部 M 行」—— 两者混为一谈会让用户基于错误口径决策。
 */
export function normalizeDatasetSpec(
	input: DatasetSpecInput,
	options: { fetchedAt?: number; rowLimit?: number } = {},
): DatasetSpec {
	const allRows = Array.isArray(input.rows) ? input.rows.filter(isPlainRow) : [];
	const rowLimit = options.rowLimit ?? DATASET_ROW_LIMIT;
	const rows = allRows.length > rowLimit ? allRows.slice(0, rowLimit) : allRows;

	const declaredColumns = Array.isArray(input.columns)
		? input.columns.filter((column): column is string => typeof column === "string" && column.length > 0)
		: [];
	const columns = declaredColumns.length > 0 ? declaredColumns : inferColumns(rows);

	const declaredRowCount =
		typeof input.rowCount === "number" && Number.isFinite(input.rowCount) ? input.rowCount : 0;
	const rowCount = Math.max(declaredRowCount, allRows.length);

	const connection = asString(input.connection);
	const table = asString(input.table);
	const sql = asString(input.sql);
	const id = asString(input.id) || `ds-${fnv1a(`${connection}\u0000${table}\u0000${sql}`)}`;
	const title = asString(input.title) || table || connection || id;
	const fetchedAt =
		typeof input.fetchedAt === "number" && Number.isFinite(input.fetchedAt)
			? input.fetchedAt
			: (options.fetchedAt ?? Date.now());

	return { id, title, connection, table, sql, columns, rows, rowCount, fetchedAt };
}

/** UTF-8 字节长度；手写以避免依赖 TextEncoder 与代理对处理差异。 */
export function utf8ByteLength(text: string): number {
	let bytes = 0;
	for (let i = 0; i < text.length; i += 1) {
		const code = text.charCodeAt(i);
		if (code < 0x80) {
			bytes += 1;
		} else if (code < 0x800) {
			bytes += 2;
		} else if (code >= 0xd800 && code <= 0xdbff) {
			bytes += 4;
			i += 1;
		} else {
			bytes += 3;
		}
	}
	return bytes;
}

/** 落盘体积估算（与 JSON.stringify 的实际写入量同口径）。 */
export function estimateDatasetBytes(spec: DatasetSpec): number {
	return utf8ByteLength(JSON.stringify(spec));
}

/** 某个数据集被哪些列真正引用（来自 ChartItem.source）。没有任何图引用时返回空数组。 */
export function collectReferencedColumns(chartItems: readonly ChartItem[], datasetId: string): string[] {
	const referenced = new Set<string>();
	for (const item of chartItems) {
		const source = item.source;
		if (!source || source.datasetId !== datasetId) continue;
		if (source.labelColumn) referenced.add(source.labelColumn);
		for (const column of source.valueColumns ?? []) {
			if (column) referenced.add(column);
		}
	}
	return [...referenced];
}

function pruneColumns(spec: DatasetSpec, keep: string[]): DatasetSpec {
	const columns = spec.columns.filter((column) => keep.includes(column));
	const rows = spec.rows.map((row) => {
		const next: Record<string, unknown> = {};
		for (const column of columns) next[column] = row[column];
		return next;
	});
	return { ...spec, columns, rows };
}

/**
 * 把数据集压到体积上限内。
 *
 * 列裁剪只在**能确定引用集合**时才做：`referencedColumns` 为空说明没有任何图声明
 * 依赖这个数据集，此时裁剪会把用户数据删掉却换不来收益，因此直接跳过。
 */
export function fitDatasetSpec(
	spec: DatasetSpec,
	referencedColumns: readonly string[],
	byteLimit: number = DATASET_STORE_BYTE_LIMIT,
): FitDatasetResult {
	const bytes = estimateDatasetBytes(spec);
	if (bytes <= byteLimit) return { spec, degraded: "none", bytes };

	let current = spec;
	const keep = referencedColumns.filter((column) => spec.columns.includes(column));
	if (keep.length > 0 && keep.length < spec.columns.length) {
		const pruned = pruneColumns(spec, keep);
		const prunedBytes = estimateDatasetBytes(pruned);
		if (prunedBytes <= byteLimit) return { spec: pruned, degraded: "columns-pruned", bytes: prunedBytes };
		current = pruned;
	}

	const sqlOnly: DatasetSpec = { ...current, rows: [] };
	return { spec: sqlOnly, degraded: "sql-only", bytes: estimateDatasetBytes(sqlOnly) };
}

/** 一批数据集的降级结果，供工具给用户一句可见的说明。 */
export interface PreparedDatasets {
	datasets: DatasetSpec[];
	degraded: { title: string; reason: DatasetDegradeReason }[];
}

/**
 * 工具入口用的一步到位封装：规范化 → 按图表实际引用的列做体积降级。
 * 图表没有用 source 声明引用的列时，宁可退到「只存 sql」也不猜着删列。
 */
export function prepareDatasets(
	inputs: readonly DatasetSpecInput[],
	chartItems: readonly ChartItem[],
	byteLimit: number = DATASET_STORE_BYTE_LIMIT,
): PreparedDatasets {
	const datasets: DatasetSpec[] = [];
	const degraded: { title: string; reason: DatasetDegradeReason }[] = [];
	for (const input of inputs) {
		const spec = normalizeDatasetSpec(input);
		const fit = fitDatasetSpec(spec, collectReferencedColumns(chartItems, spec.id), byteLimit);
		datasets.push(fit.spec);
		if (fit.degraded !== "none") degraded.push({ title: fit.spec.title, reason: fit.degraded });
	}
	return { datasets, degraded };
}

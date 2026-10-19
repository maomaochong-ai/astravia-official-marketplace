/**
 * chart-spec.ts — 图表语义层（纯函数，无 React、无副作用）。
 *
 * 把「结果集 + 图表配置」折算成图表能直接消费的 categories / series：
 *   维度（可多级 · 可时间粒度）→ 分组
 *   度量（聚合方式 + 数值格式）→ 系列
 *   过滤 → 先于分组生效
 *   排序 / TopN → 后于分组生效
 *
 * 三条硬约束：
 *   1. 配置只从节点 values 里的 JSON 字段解析，解析失败按「未配置」处理，不抛错——面板写坏一条不该炸掉整张画布。
 *   2. 分组顺序稳定：未指定排序时按首次出现顺序，切换配置不会让图例乱跳。
 *   3. 空值 / 非数值参与 count 但不参与 sum/avg 等数值聚合（与 SQL 的 NULL 语义一致）。
 */

import type { NodeResult } from "../hooks/use-canvas-execution";

// ── 配置类型 ──

export type AggKind = "sum" | "avg" | "count" | "countDistinct" | "min" | "max" | "median";

/** 时间粒度：把日期列折叠到年 / 季 / 月 / 周 / 日 / 小时，用于趋势图。 */
export type TimeGrain = "none" | "year" | "quarter" | "month" | "week" | "day" | "hour";

export type FilterOp =
	| "eq"
	| "neq"
	| "gt"
	| "gte"
	| "lt"
	| "lte"
	| "contains"
	| "notContains"
	| "isNull"
	| "notNull";

export type NumberFormat = "auto" | "plain" | "thousand" | "percent" | "currency" | "compact";

export interface DimensionSpec {
	field: string;
	/** 仅日期类字段有意义；none 表示原样使用。 */
	grain?: TimeGrain;
}

export interface MeasureSpec {
	field: string;
	agg: AggKind;
	format?: NumberFormat;
}

export interface FilterSpec {
	field: string;
	op: FilterOp;
	/** 数值比较会先尝试转数字；isNull / notNull 忽略此值。 */
	value?: string;
}

export interface SortSpec {
	by: "dimension" | "measure";
	/** by=dimension 时是维度下标；by=measure 时是度量下标。 */
	index: number;
	dir: "asc" | "desc";
}

export interface ChartSpec {
	dimensions: DimensionSpec[];
	measures: MeasureSpec[];
	filters: FilterSpec[];
	sort: SortSpec | null;
	/** TopN；null 表示不截断。 */
	limit: number | null;
}

// ── 选项常量（属性面板与校验共用同一份，避免两处漂移） ──

export const AGG_OPTIONS: { value: AggKind; label: string }[] = [
	{ value: "sum", label: "求和" },
	{ value: "avg", label: "平均" },
	{ value: "count", label: "计数" },
	{ value: "countDistinct", label: "去重计数" },
	{ value: "max", label: "最大值" },
	{ value: "min", label: "最小值" },
	{ value: "median", label: "中位数" },
];

export const GRAIN_OPTIONS: { value: TimeGrain; label: string }[] = [
	{ value: "none", label: "原样" },
	{ value: "year", label: "年" },
	{ value: "quarter", label: "季度" },
	{ value: "month", label: "月" },
	{ value: "week", label: "周" },
	{ value: "day", label: "日" },
	{ value: "hour", label: "小时" },
];

export const FILTER_OP_OPTIONS: { value: FilterOp; label: string }[] = [
	{ value: "eq", label: "等于" },
	{ value: "neq", label: "不等于" },
	{ value: "gt", label: "大于" },
	{ value: "gte", label: "大于等于" },
	{ value: "lt", label: "小于" },
	{ value: "lte", label: "小于等于" },
	{ value: "contains", label: "包含" },
	{ value: "notContains", label: "不包含" },
	{ value: "notNull", label: "非空" },
	{ value: "isNull", label: "为空" },
];

export const FORMAT_OPTIONS: { value: NumberFormat; label: string }[] = [
	{ value: "auto", label: "自动" },
	{ value: "plain", label: "整数" },
	{ value: "thousand", label: "千分位" },
	{ value: "compact", label: "万 / 亿" },
	{ value: "percent", label: "百分比" },
	{ value: "currency", label: "金额" },
];

const AGGS = new Set<string>(AGG_OPTIONS.map((o) => o.value));
const GRAINS = new Set<string>(GRAIN_OPTIONS.map((o) => o.value));
const OPS = new Set<string>(FILTER_OP_OPTIONS.map((o) => o.value));
const FORMATS = new Set<string>(FORMAT_OPTIONS.map((o) => o.value));

// ── 解析 ──

function asRecord(raw: unknown): Record<string, unknown> | null {
	if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
	if (typeof raw === "string" && raw.trim()) {
		try {
			const parsed = JSON.parse(raw);
			return parsed && typeof parsed === "object" && !Array.isArray(parsed)
				? (parsed as Record<string, unknown>)
				: null;
		} catch {
			return null;
		}
	}
	return null;
}

/** JSON 数组字段：既接受已解析数组，也接受面板存下来的 JSON 字符串；坏值返回空数组。 */
export function parseJsonArray(raw: unknown): unknown[] {
	if (Array.isArray(raw)) return raw;
	if (typeof raw === "string" && raw.trim()) {
		try {
			const parsed = JSON.parse(raw);
			return Array.isArray(parsed) ? parsed : [];
		} catch {
			return [];
		}
	}
	return [];
}

function str(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

export function parseDimensions(raw: unknown): DimensionSpec[] {
	const out: DimensionSpec[] = [];
	for (const item of parseJsonArray(raw)) {
		const rec = asRecord(item);
		if (!rec) continue;
		const field = str(rec.field);
		if (!field) continue;
		const grain = str(rec.grain);
		out.push({ field, grain: GRAINS.has(grain) ? (grain as TimeGrain) : "none" });
	}
	return out;
}

export function parseMeasures(raw: unknown): MeasureSpec[] {
	const out: MeasureSpec[] = [];
	for (const item of parseJsonArray(raw)) {
		const rec = asRecord(item);
		if (!rec) continue;
		const field = str(rec.field);
		if (!field) continue;
		const agg = str(rec.agg);
		const format = str(rec.format);
		out.push({
			field,
			agg: AGGS.has(agg) ? (agg as AggKind) : "sum",
			format: FORMATS.has(format) ? (format as NumberFormat) : "auto",
		});
	}
	return out;
}

export function parseFilters(raw: unknown): FilterSpec[] {
	const out: FilterSpec[] = [];
	for (const item of parseJsonArray(raw)) {
		const rec = asRecord(item);
		if (!rec) continue;
		const field = str(rec.field);
		if (!field) continue;
		const op = str(rec.op);
		out.push({
			field,
			op: OPS.has(op) ? (op as FilterOp) : "eq",
			value: typeof rec.value === "number" ? String(rec.value) : str(rec.value),
		});
	}
	return out;
}

export function parseSort(raw: unknown): SortSpec | null {
	// 面板用简单的 asc / desc 下拉时，语义 = 按第一个度量排序。
	if (raw === "asc" || raw === "desc") return { by: "measure", index: 0, dir: raw };
	const rec = asRecord(raw);
	if (!rec) return null;
	const by = str(rec.by);
	const dir = str(rec.dir);
	if (by !== "dimension" && by !== "measure") return null;
	const index = Number(rec.index);
	if (!Number.isInteger(index) || index < 0) return null;
	return { by, index, dir: dir === "asc" ? "asc" : "desc" };
}

/** 从节点 values 解析整份图表配置。 */
export function parseChartSpec(values: Record<string, unknown> = {}): ChartSpec {
	const limitRaw = values.limit;
	const limit = Number(limitRaw);
	return {
		dimensions: parseDimensions(values.dimensions),
		measures: parseMeasures(values.measures),
		filters: parseFilters(values.filters),
		sort: parseSort(values.sort),
		limit: Number.isFinite(limit) && limit > 0 ? Math.trunc(limit) : null,
	};
}

/** 配置是否已启用语义层（至少配了一个度量）。 */
export function hasSemanticConfig(spec: ChartSpec): boolean {
	return spec.measures.length > 0;
}

// ── 单元格取值 ──

const NULLISH = (v: unknown): boolean => v === null || v === undefined || v === "";

function numeric(v: unknown): number | null {
	if (NULLISH(v)) return null;
	const n = Number(v);
	return Number.isFinite(n) ? n : null;
}

// ── 时间粒度 ──

/** 宽松解析日期：Date / 时间戳（秒或毫秒）/ ISO 与常见日期串。 */
export function toDate(value: unknown): Date | null {
	if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
	if (typeof value === "number") {
		// 10 位按秒、13 位按毫秒；更短的当作年份之外的相对值，直接拒绝。
		const ms = value < 1e11 ? value * 1000 : value;
		const d = new Date(ms);
		return Number.isNaN(d.getTime()) ? null : d;
	}
	if (typeof value !== "string") return null;
	const raw = value.trim();
	if (!raw) return null;
	if (/^\d{10}$/.test(raw)) return toDate(Number(raw));
	if (/^\d{13}$/.test(raw)) return toDate(Number(raw));
	// `2025-01-15 13:20:00`：Safari / 部分环境不接受空格分隔，替换成 T。
	const normalized = raw.replace(" ", "T");
	const d = new Date(normalized);
	return Number.isNaN(d.getTime()) ? null : d;
}

const pad2 = (n: number): string => String(n).padStart(2, "0");

/** ISO 周序号（周一为一周之始，含跨年周）。 */
function isoWeek(d: Date): { year: number; week: number } {
	const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
	const day = t.getUTCDay() || 7;
	t.setUTCDate(t.getUTCDate() + 4 - day);
	const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
	const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
	return { year: t.getUTCFullYear(), week };
}

/** 把单元格按粒度折叠成可排序、可读的标签；解析不出日期时原样返回。 */
export function bucketTime(value: unknown, grain: TimeGrain = "none"): string {
	if (grain === "none") return NULLISH(value) ? "" : String(value);
	const d = toDate(value);
	if (!d) return NULLISH(value) ? "" : String(value);
	const y = d.getFullYear();
	switch (grain) {
		case "year":
			return String(y);
		case "quarter":
			return `${y}-Q${Math.floor(d.getMonth() / 3) + 1}`;
		case "month":
			return `${y}-${pad2(d.getMonth() + 1)}`;
		case "week": {
			const { year, week } = isoWeek(d);
			return `${year}-W${pad2(week)}`;
		}
		case "day":
			return `${y}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
		case "hour":
			return `${y}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:00`;
		default:
			return String(value);
	}
}

// ── 过滤 ──

/** 数值优先比较：两侧都能转数字时按数值，否则按字符串。 */
function compareValues(cell: unknown, needle: string): number {
	const a = numeric(cell);
	const b = numeric(needle);
	if (a !== null && b !== null) return a - b;
	const as = NULLISH(cell) ? "" : String(cell);
	return as.localeCompare(needle, "zh-CN");
}

export function matchFilter(cell: unknown, filter: FilterSpec): boolean {
	const needle = (filter.value ?? "").trim();
	switch (filter.op) {
		case "isNull":
			return NULLISH(cell);
		case "notNull":
			return !NULLISH(cell);
		case "contains":
			return !NULLISH(cell) && String(cell).toLowerCase().includes(needle.toLowerCase());
		case "notContains":
			return NULLISH(cell) || !String(cell).toLowerCase().includes(needle.toLowerCase());
		case "eq":
			// 空筛选值视为「不过滤」——面板刚加一行还没填值时不该把数据清空。
			return needle === "" || String(cell ?? "") === needle;
		case "neq":
			return needle === "" || String(cell ?? "") !== needle;
		case "gt":
			return !NULLISH(cell) && compareValues(cell, needle) > 0;
		case "gte":
			return !NULLISH(cell) && compareValues(cell, needle) >= 0;
		case "lt":
			return !NULLISH(cell) && compareValues(cell, needle) < 0;
		case "lte":
			return !NULLISH(cell) && compareValues(cell, needle) <= 0;
		default:
			return true;
	}
}

export function applyFilters(
	rows: Record<string, unknown>[],
	filters: FilterSpec[],
): Record<string, unknown>[] {
	const active = filters.filter((f) => f.field);
	if (active.length === 0) return rows;
	return rows.filter((row) => active.every((f) => matchFilter(row[f.field], f)));
}

// ── 聚合 ──

export function aggregate(values: unknown[], agg: AggKind): number {
	const nums = values.map(numeric).filter((n): n is number => n !== null);
	switch (agg) {
		case "count":
			// count 统计非空单元格数（与 SQL COUNT(col) 一致）。
			return values.filter((v) => !NULLISH(v)).length;
		case "countDistinct": {
			const seen = new Set<string>();
			for (const v of values) {
				if (!NULLISH(v)) seen.add(String(v));
			}
			return seen.size;
		}
		default:
			break;
	}
	if (nums.length === 0) return 0;
	switch (agg) {
		case "sum":
			return nums.reduce((a, b) => a + b, 0);
		case "avg":
			return nums.reduce((a, b) => a + b, 0) / nums.length;
		case "min":
			return Math.min(...nums);
		case "max":
			return Math.max(...nums);
		case "median": {
			const sorted = [...nums].sort((a, b) => a - b);
			const mid = Math.floor(sorted.length / 2);
			return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
		}
		default:
			return 0;
	}
}

// ── 格式化 ──

function trimFixed(n: number, digits: number): string {
	const fixed = n.toFixed(digits);
	return fixed.replace(/\.?0+$/, "") || "0";
}

/** 图表标签用的数值格式化；`auto` 千分位 + 最多两位小数。 */
export function formatNumber(value: number | null | undefined, format: NumberFormat = "auto"): string {
	if (value === null || value === undefined || !Number.isFinite(value)) return "—";
	switch (format) {
		case "plain":
			return String(Math.round(value));
		case "thousand":
			return value.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
		case "percent":
			return `${trimFixed(value * 100, 2)}%`;
		case "currency":
			return `¥${value.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
		case "compact": {
			const abs = Math.abs(value);
			if (abs >= 1e8) return `${trimFixed(value / 1e8, 2)}亿`;
			if (abs >= 1e4) return `${trimFixed(value / 1e4, 2)}万`;
			return trimFixed(value, 2);
		}
		default:
			return value.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
	}
}

// ── 折算 ──

export interface SeriesData {
	/** 图例名：度量别名或「聚合(字段)」。 */
	name: string;
	data: number[];
	format: NumberFormat;
}

export interface ChartFrame {
	categories: string[];
	series: SeriesData[];
	/** 过滤后的明细行（表格 / 明细类节点用）。 */
	rows: Record<string, unknown>[];
	/** 明细列（过滤后仍保留原表列顺序）。 */
	columns: string[];
	/** 每组按全部过滤行算出的首度量汇总，KPI 用。 */
	total: number;
	/** 首度量的显示名。 */
	measureLabel: string;
	/** 参与分组的维度字段（已按粒度折叠）。 */
	dimensionLabels: string[];
}

function measureLabel(measure: MeasureSpec): string {
	const aggLabel = AGG_OPTIONS.find((o) => o.value === measure.agg)?.label ?? measure.agg;
	// 单度量的 sum 直接用字段名，卡片上更好读；其它聚合保留语义，避免误读。
	if (measure.agg === "sum") return measure.field;
	return `${aggLabel}(${measure.field})`;
}

function dimensionKey(row: Record<string, unknown>, dimensions: DimensionSpec[]): string {
	return dimensions
		.map((d) => bucketTime(row[d.field], d.grain ?? "none"))
		.join(" / ");
}

/**
 * 把结果集折算成图表数据。
 *
 * @param result 结果集（未过滤）
 * @param spec   图表配置；measures 为空时返回空 frame（调用方回退到旧的字段映射）
 */
export function buildFrame(result: NodeResult, spec: ChartSpec): ChartFrame {
	const columns = result.columns ?? [];
	const rows = applyFilters(result.rows ?? [], spec.filters);
	const measures = spec.measures.filter((m) => m.field);
	const dimensions = spec.dimensions.filter((d) => d.field);

	const empty: ChartFrame = {
		categories: [],
		series: [],
		rows,
		columns,
		total: 0,
		measureLabel: "",
		dimensionLabels: dimensions.map((d) => d.field),
	};
	if (measures.length === 0) return empty;

	const primary = measures[0];
	// 总计用「全部过滤行」算，不是分组后求和——否则 avg / 去重计数会算错。
	const total = aggregate(rows.map((r) => r[primary.field]), primary.agg);

	// 无维度 → 单类别占位，便于 KPI / 单一饼图仍能渲染。
	if (dimensions.length === 0) {
		return {
			...empty,
			categories: ["全部"],
			series: measures.map((m) => ({
				name: measureLabel(m),
				data: [aggregate(rows.map((r) => r[m.field]), m.agg)],
				format: m.format ?? "auto",
			})),
			total,
			measureLabel: measureLabel(primary),
		};
	}

	// 分组：Map 保留首次出现顺序，避免未排序时图例抖动。
	const buckets = new Map<string, Record<string, unknown>[]>();
	for (const row of rows) {
		const key = dimensionKey(row, dimensions);
		const bucket = buckets.get(key);
		if (bucket) bucket.push(row);
		else buckets.set(key, [row]);
	}

	let categories = [...buckets.keys()];
	let series = measures.map((m) => ({
		name: measureLabel(m),
		data: categories.map((key) => aggregate((buckets.get(key) ?? []).map((r) => r[m.field]), m.agg)),
		format: m.format ?? "auto",
	}));

	// 排序：维度按标签、度量按数值；两个数组同步重排，系列不会与类别错位。
	const order = categories.map((_, i) => i);
	const sort = spec.sort;
	if (sort) {
		const dir = sort.dir === "asc" ? 1 : -1;
		if (sort.by === "dimension") {
			order.sort((a, b) => categories[a].localeCompare(categories[b], "zh-CN") * dir);
		} else {
			const column = series[Math.min(sort.index, series.length - 1)]?.data ?? [];
			order.sort((a, b) => ((column[a] ?? 0) - (column[b] ?? 0)) * dir);
		}
		categories = order.map((i) => categories[i]);
		series = series.map((s) => ({ ...s, data: order.map((i) => s.data[i] ?? 0) }));
	}

	const limit = spec.limit ?? 0;
	if (limit > 0 && categories.length > limit) {
		categories = categories.slice(0, limit);
		series = series.map((s) => ({ ...s, data: s.data.slice(0, limit) }));
	}

	return {
		categories,
		series,
		rows,
		columns,
		total,
		measureLabel: measureLabel(primary),
		dimensionLabels: dimensions.map((d) => d.field),
	};
}

/** 表格类节点：把过滤后的明细裁成前 N 行 + 显示列。 */
export function frameTable(frame: ChartFrame, limit = 100): {
	columns: string[];
	rows: Record<string, unknown>[];
	truncated: boolean;
} {
	const rows = frame.rows.slice(0, Math.max(0, limit));
	return { columns: frame.columns, rows, truncated: frame.rows.length > rows.length };
}

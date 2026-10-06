/**
 * infer-layout — 规则引擎（ADR-0005 §4 Step 1-3）
 *
 * 从 SQL 执行结果集推断 LayoutSpec：
 *   Step 1 — Schema 分析：每列打 role tag
 *   Step 2 — 图表类型选择（规则优先）
 *   Step 3 — 栅格布局打包（12 列，KPI/中等/宽三档）
 *
 * 纯函数，可独立测试。
 */

import type { ColumnMeta, ColumnRole, LayoutSpec, VizIntent, WidgetSpec } from "./types";

export interface InferInput {
	columns?: string[];
	rows?: Record<string, unknown>[];
	/** v0.0.94: 多数据源路径（优先于此） */
	dataSources?: Array<{ id: string; label: string; columns: string[]; rows: Record<string, unknown>[] }>;
	intent?: VizIntent;
}

export interface InferOptions {
	intent?: VizIntent;
}

// ─── Step 1: Schema 分析 ─────────────────────────────────────

const TIME_PATTERNS = /(date|time|dt|day|month|year|created|updated|timestamp|_at$)/i;
const ID_PATTERNS = /(_id$|^id$|pk$|uuid|guid)/i;
const MEASURE_PATTERNS = /(count|sum|avg|total|amount|gmv|revenue|price|qty|quantity|amount|rate|ratio|pct|percentage|score|rank|level)/i;

function inferColumnRole(name: string, values: unknown[]): ColumnRole {
	// 先看名字 hint
	if (TIME_PATTERNS.test(name)) return "time";
	if (ID_PATTERNS.test(name)) return "id";
	if (MEASURE_PATTERNS.test(name)) return "measure";

	// 再看值的分布
	const numericCount = values.filter((v) => typeof v === "number").length;
	if (numericCount / Math.max(values.length, 1) > 0.7) {
		// 数值列 → 区分 measure vs categorical vs id
		const unique = new Set(values.filter((v) => v !== null && v !== undefined)).size;
		if (unique <= 20) return "categorical";
		if (unique >= values.length * 0.9) return "id";
		return "measure";
	}

	// 非数值 → dimension / categorical
	const unique = new Set(values.filter((v) => v !== null && v !== undefined)).size;
	if (unique <= 20) return "categorical";
	return "dimension";
}

export function inferSchema(columns: string[], rows: Record<string, unknown>[]): ColumnMeta[] {
	return columns.map((name) => {
		const values = rows.map((r) => r[name]);
		const role = inferColumnRole(name, values);
		const cardinality = new Set(values.filter((v) => v !== null && v !== undefined)).size;
		return { name, type: typeof values[0], role, cardinality };
	});
}

// ─── Step 2: 图表类型推断 ─────────────────────────────────────

export interface ChartCandidate {
	kind: WidgetSpec["kind"];
	dataRef: string;
	title: string;
	colSpan: number;
	rowSpan: number;
	/** v0.0.94: 该候选属于哪个数据源（可选，legacy 单数据源路径不带） */
	dataSourceId?: string;
}

function chartOptions(meta: ColumnMeta[], intent: VizIntent): ChartCandidate[] {
	const measures = meta.filter((m) => m.role === "measure");
	const times = meta.filter((m) => m.role === "time");
	const categoricals = meta.filter((m) => m.role === "categorical");
	const dimensions = meta.filter((m) => m.role === "dimension");
	const allDims = [...categoricals, ...dimensions];

	const candidates: ChartCandidate[] = [];

	// KPI 卡：每个 measure 独立一张
	measures.forEach((m) => {
		candidates.push({
			kind: "kpi",
			dataRef: m.name,
			title: humanize(m.name),
			colSpan: intent === "dashboard" ? 3 : 2,
			rowSpan: intent === "dashboard" ? 1 : 1,
		});
	});

	// 时间序列图（有 time + measure）
	if (times.length >= 1 && measures.length >= 1) {
		candidates.push({
			kind: "line",
			dataRef: `${times[0].name} × ${measures.slice(0, 2).map((m) => m.name).join(",")}`,
			title: `${humanize(measures[0].name)} 趋势`,
			colSpan: intent === "dashboard" ? 6 : 6,
			rowSpan: intent === "dashboard" ? 2 : 2,
		});
	}

	// 柱状图（categorical + measure）
	if (categoricals.length >= 1 && measures.length >= 1) {
		candidates.push({
			kind: "bar",
			dataRef: `${categoricals[0].name} × ${measures[0].name}`,
			title: `${humanize(measures[0].name)} by ${humanize(categoricals[0].name)}`,
			colSpan: intent === "dashboard" ? 6 : 4,
			rowSpan: intent === "dashboard" ? 2 : 2,
		});
	}

	// 饼图（单个 categorical 分布）
	if (categoricals.length >= 1 && measures.length >= 1 && categoricals[0].cardinality! <= 8) {
		candidates.push({
			kind: "pie",
			dataRef: `${categoricals[0].name} × ${measures[0].name}`,
			title: `${humanize(categoricals[0].name)} 占比`,
			colSpan: intent === "dashboard" ? 3 : 3,
			rowSpan: intent === "dashboard" ? 2 : 2,
		});
	}

	// 数据表（兜底：当 measures 少或列多时）
	if (allDims.length >= 1 && measures.length >= 1 && candidates.length <= 3) {
		candidates.push({
			kind: "table",
			dataRef: meta.map((m) => m.name).join(", "),
			title: "明细数据",
			colSpan: intent === "dashboard" ? 12 : 12,
			rowSpan: intent === "dashboard" ? 2 : 3,
		});
	}

	return candidates;
}

function humanize(name: string): string {
	// gmv → GMV, order_date → Order Date, total_revenue → Total Revenue
	return name
		.replace(/_/g, " ")
		.replace(/\b\w/g, (c) => c.toUpperCase())
		.replace(/\bGmv\b/g, "GMV")
		.replace(/\bId\b/g, "ID");
}

// ─── Step 3: 栅格布局打包 ─────────────────────────────────────

const COLS = 12;

function packGrid(candidates: ChartCandidate[]): WidgetSpec[] {
	// 贪心：从上到下从左到右填入
	const grid: Array<Array<{ row: number; col: number; colSpan: number; rowSpan: number } | null>> = [];
	const used: boolean[][] = [];

	// 初始化空网格（预估 10 行）
	const EST_ROWS = 20;
	for (let r = 0; r < EST_ROWS; r++) {
		used[r] = new Array(COLS).fill(false);
	}

	function findPosition(colSpan: number, rowSpan: number): { row: number; col: number } | null {
		for (let r = 0; r < EST_ROWS - rowSpan; r++) {
			for (let c = 0; c <= COLS - colSpan; c++) {
				let ok = true;
				for (let dr = 0; dr < rowSpan && ok; dr++) {
					for (let dc = 0; dc < colSpan && ok; dc++) {
						if (used[r + dr][c + dc]) ok = false;
					}
				}
				if (ok) return { row: r, col: c };
			}
		}
		return null;
	}

	const widgets: WidgetSpec[] = [];
	candidates.forEach((c, i) => {
		const pos = findPosition(c.colSpan, c.rowSpan);
		if (!pos) return; // 超出画布范围，跳过

		for (let dr = 0; dr < c.rowSpan; dr++) {
			for (let dc = 0; dc < c.colSpan; dc++) {
				used[pos.row + dr][pos.col + dc] = true;
			}
		}

		widgets.push({
			id: `widget-${i}`,
			kind: c.kind,
			col: pos.col,
			row: pos.row,
			colSpan: c.colSpan,
			rowSpan: c.rowSpan,
			title: c.title,
			dataRef: c.dataRef,
			status: "ready",
			dataSourceId: c.dataSourceId,
		});
	});

	return widgets;
}

// ─── 入口 ─────────────────────────────────────────────────────

export function inferLayout(input: InferInput, options: InferOptions = {}): LayoutSpec {
	// v0.0.94: 多数据源路径优先
	if (input.dataSources && input.dataSources.length > 0) {
		return inferLayoutFromDataSources(input.dataSources, options.intent);
	}
	const columns = input.columns ?? [];
	const rows = input.rows ?? [];
	return inferLayoutSingle(columns, rows, options.intent);
}

/** 传统单数据源路径（legacy 兼容） */
function inferLayoutSingle(columns: string[], rows: Record<string, unknown>[], intentHint?: VizIntent): LayoutSpec {
	const intent: VizIntent = intentHint ?? inferIntent(columns, rows);
	const meta = inferSchema(columns, rows);
	const candidates = chartOptions(meta, intent);
	const widgets = packGrid(candidates);

	return {
		intent,
		layout: { cols: COLS, rowHeight: intent === "dashboard" ? 140 : 120, gap: 16 },
		widgets: widgets.map((w) => ({ ...w, dataSourceId: undefined })),
	};
}

/** v0.0.94 多数据源路径：每个 source 独立推断图表候选，合并后统一栅格打包 */
function inferLayoutFromDataSources(
	dataSources: Array<{ id: string; label: string; columns: string[]; rows: Record<string, unknown>[] }>,
	intentHint?: VizIntent,
): LayoutSpec {
	// 取行数最多的数据源来启发 intent
	const largest = dataSources.reduce((a, b) => (b.rows.length > a.rows.length ? b : a));
	const intent: VizIntent = intentHint ?? inferIntent(largest.columns, largest.rows);

	const allCandidates: Array<ChartCandidate & { dataSourceId: string }> = [];
	for (const src of dataSources) {
		const meta = inferSchema(src.columns, src.rows);
		const srcCandidates = chartOptions(meta, intent);
		for (const c of srcCandidates) {
			allCandidates.push({ ...c, dataSourceId: src.id });
		}
	}

	// 统一栅格打包（所有数据源的候选 widget 竞争同一个 12 列画布）
	// packGrid 已经把 ChartCandidate.dataSourceId 原样带到 WidgetSpec
	const widgets = packGrid(allCandidates);

	return {
		intent,
		layout: { cols: COLS, rowHeight: intent === "dashboard" ? 140 : 120, gap: 16 },
		widgets,
	};
}

/** 启发式判断 intent：全是小卡 → dashboard，大宽表+高密 → bigscreen */
function inferIntent(columns: string[], rows: Record<string, unknown>[]): VizIntent {
	const rowCount = rows.length;
	const hasTime = columns.some((c) => TIME_PATTERNS.test(c));
	const hasId = columns.some((c) => ID_PATTERNS.test(c));
	// 数据量大、有 time 序列 → bigscreen 监控风格；否则默认 dashboard
	if (rowCount > 200 && hasTime && !hasId) return "bigscreen";
	return "dashboard";
}

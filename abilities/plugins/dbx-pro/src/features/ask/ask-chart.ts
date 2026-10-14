/**
 * ask-chart.ts — 问数结果 → 图表的纯映射层（无 React、无副作用）。
 *
 * 两件事，都是「语义边界比功能重要」的地方：
 *   1. 意图 → 图型：对齐 Quick BI 智能问数的默认图型约定
 *      （趋势→折线、占比→饼、排行→条形、明细→明细表、单值→KPI、转化→漏斗）。
 *      模型给的 chartKind 不可信（可能编造），这里做归一 + 兜底。
 *   2. 结果集 → 图表序列：只做「列 → 标签 / 数值」的搬运与数值强转，
 *      不做聚合、补零或排序 —— 编造的零点和真实数据长得一样，会让用户以为查到了。
 *      数值非有限的行整行丢弃，labels / values 永远同长度同顺序。
 */

import type { AskChartKind, AskResult } from "./ask-types.ts";

export const CHART_KIND_LABELS: Record<AskChartKind, string> = {
	"chart-line": "折线图",
	"chart-bar": "条形图",
	"chart-donut": "饼图",
	"chart-kpi": "指标卡",
	"chart-funnel": "漏斗图",
	"chart-table": "明细表",
};

/** 面板里可切换的全部图型（顺序 = 下拉顺序）。 */
export const ASK_CHART_KINDS: AskChartKind[] = [
	"chart-line",
	"chart-bar",
	"chart-donut",
	"chart-kpi",
	"chart-funnel",
	"chart-table",
];

/**
 * 图型 → 画布节点 kind。
 *
 * 两者同名，但不能直接透传：画布 NODE_TEMPLATES 里没有 chart-table，
 * 而 node-graph 的图表渲染器在不认识 kind 时会落到“默认画折线”分支 ——
 * 那样一个明细表落画布就变成一条凭空的趋势线。所以明细表返回 null，
 * 由调用方只落数据源节点，不要给它编一个图表节点。
 */
export function toCanvasKind(kind: AskChartKind): string | null {
	return kind === "chart-table" ? null : kind;
}

/**
 * 模型可能给出的别名 → 归一图型。
 */
const CHART_KIND_ALIASES: Record<string, AskChartKind> = {
	line: "chart-line",
	"chart-line": "chart-line",
	折线图: "chart-line",
	折线: "chart-line",
	趋势图: "chart-line",
	bar: "chart-bar",
	column: "chart-bar",
	"chart-bar": "chart-bar",
	条形图: "chart-bar",
	柱状图: "chart-bar",
	柱形图: "chart-bar",
	排行图: "chart-bar",
	pie: "chart-donut",
	donut: "chart-donut",
	"chart-pie": "chart-donut",
	"chart-donut": "chart-donut",
	饼图: "chart-donut",
	环形图: "chart-donut",
	占比图: "chart-donut",
	kpi: "chart-kpi",
	"chart-kpi": "chart-kpi",
	指标卡: "chart-kpi",
	单值: "chart-kpi",
	funnel: "chart-funnel",
	"chart-funnel": "chart-funnel",
	漏斗图: "chart-funnel",
	table: "chart-table",
	"chart-table": "chart-table",
	明细表: "chart-table",
	表格: "chart-table",
};

/** 归一模型给出的 chartKind；无法识别时回退到意图推断，再回退折线图。 */
export function normalizeChartKind(raw: unknown, fallbackText = ""): AskChartKind {
	if (typeof raw === "string") {
		const key = raw.trim().toLowerCase().replace(/\s+/g, "");
		const hit = CHART_KIND_ALIASES[key];
		if (hit) return hit;
	}
	return intentToChartKind(fallbackText);
}

/** 关键词 → 默认图型。顺序 = 优先级，先命中先赢。 */
const INTENT_RULES: Array<{ kind: AskChartKind; words: string[] }> = [
	{ kind: "chart-table", words: ["明细", "清单", "明细表", "原始数据", "每一行", "逐条", "列出全部", "列表"] },
	{ kind: "chart-funnel", words: ["漏斗", "转化率", "转化路径", "流失", "环节"] },
	{ kind: "chart-kpi", words: ["总共", "总数", "合计", "总计", "一共", "单值", "总量", "多少条", "有多少", "总计是"] },
	{ kind: "chart-donut", words: ["占比", "份额", "比例", "构成", "结构", "分布", "各占"] },
	{ kind: "chart-bar", words: ["排行", "排名", "top", "前几", "前10", "前 10", "最高", "最低", "最多", "最少", "对比"] },
	{ kind: "chart-line", words: ["趋势", "走势", "变化", "环比", "同比", "每日", "每天", "按天", "按周", "按月", "近7", "近 7", "近14", "近 14", "近30", "近 30"] },
];

/** 自然语言意图 → 默认图型（Quick BI 的默认图型约定）。 */
export function intentToChartKind(text: string): AskChartKind {
	const lower = String(text ?? "").toLowerCase();
	for (const rule of INTENT_RULES) {
		for (const word of rule.words) {
			if (lower.includes(word)) return rule.kind;
		}
	}
	return "chart-line";
}

export interface AskSeries {
	labels: string[];
	values: number[];
	labelField: string | null;
	valueField: string | null;
	/** 被丢弃的行数（数值非有限），面板要如实告诉用户。 */
	skipped: number;
}

const MAX_POINTS = 200;

function isNumericCell(cell: unknown): boolean {
	if (typeof cell === "number") return Number.isFinite(cell);
	if (typeof cell !== "string") return false;
	const text = cell.trim();
	if (!text) return false;
	return Number.isFinite(Number(text.replace(/,/g, "")));
}

/**
 * 单元格 → 数值。空串必须返回 NaN 而不是 0：
 * 0 会被画成真实的「零值」，而空单元格只是「没取到值」，两者对业务是两回事。
 */
function toNumber(cell: unknown): number {
	if (typeof cell === "number") return cell;
	if (typeof cell === "string") {
		const text = cell.trim();
		if (!text) return Number.NaN;
		return Number(text.replace(/,/g, ""));
	}
	return Number.NaN;
}

function mostlyNumeric(result: AskResult, column: string): boolean {
	const rows = result.rows.slice(0, 50);
	if (rows.length === 0) return false;
	let numeric = 0;
	let present = 0;
	for (const row of rows) {
		const cell = row[column];
		if (cell === null || cell === undefined || cell === "") continue;
		present += 1;
		if (isNumericCell(cell)) numeric += 1;
	}
	return present > 0 && numeric / present >= 0.6;
}

/**
 * 结果集 → 图表序列。
 *
 * 维度 = 第一个「非数值为主」的列（没有就取第一列）；数值 = 第一个「数值为主」列。
 * KPI / 漏斗 / 明细表也需要这个搬运：KPI 取首行数值，漏斗/条形取标签+数值对。
 */
export function pickChartSeries(result: AskResult | null, kind: AskChartKind): AskSeries {
	const empty: AskSeries = { labels: [], values: [], labelField: null, valueField: null, skipped: 0 };
	if (!result || result.columns.length === 0 || result.rows.length === 0) return empty;
	// 明细表不做维度/数值的搬运，直接原样渲染表格。
	if (kind === "chart-table") return empty;

	const columns = result.columns;
	let valueField: string | null = null;
	for (const column of columns) {
		if (!mostlyNumeric(result, column)) continue;
		// 维度列往后排：先找「数值列」时跳过第一个非数值列已足够，这里额外避免
		// 把纯 ID 列（整数但唯一）当数值 —— 唯一性交给调用方，这里只保证有值。
		valueField = column;
		break;
	}
	if (!valueField) return { ...empty, labelField: columns[0] ?? null };

	let labelField: string | null = null;
	for (const column of columns) {
		if (column === valueField) continue;
		if (!mostlyNumeric(result, column)) {
			labelField = column;
			break;
		}
	}
	if (!labelField) labelField = columns.find((c) => c !== valueField) ?? null;

	const labels: string[] = [];
	const values: number[] = [];
	let skipped = 0;
	for (const row of result.rows) {
		const value = toNumber(row[valueField]);
		if (!Number.isFinite(value)) {
			skipped += 1;
			continue;
		}
		if (labels.length >= MAX_POINTS) break;
		labels.push(labelField ? formatCell(row[labelField]) : String(labels.length + 1));
		values.push(value);
	}
	return { labels, values, labelField, valueField, skipped };
}

/** 单元格 → 展示文本。日期按天截断，长文本截断，空值统一成破折号。 */
export function formatCell(value: unknown): string {
	if (value === null || value === undefined) return "—";
	if (typeof value === "number") return formatNumber(value);
	if (typeof value === "boolean") return value ? "是" : "否";
	if (value instanceof Date) return value.toISOString().slice(0, 10);
	const text = String(value).replace(/\s+/g, " ").trim();
	if (!text) return "—";
	return text.length > 60 ? `${text.slice(0, 57)}…` : text;
}

/** 数字 → 展示文本：千分位；|n| ≥ 100 时不留小数（表格里的金额不该有噪声小数）。 */
export function formatNumber(n: number): string {
	if (!Number.isFinite(n)) return "—";
	const digits = Math.abs(n) >= 100 ? 0 : 2;
	const [int, frac] = String(Number(n.toFixed(digits))).split(".");
	const sign = int.startsWith("-") ? "-" : "";
	const body = sign ? int.slice(1) : int;
	const grouped = body.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
	return frac ? `${sign}${grouped}.${frac}` : `${sign}${grouped}`;
}

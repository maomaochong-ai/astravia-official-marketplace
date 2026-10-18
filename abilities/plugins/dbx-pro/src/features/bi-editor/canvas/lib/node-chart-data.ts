/**
 * node-chart-data.ts — 画布图表节点的「图表数据」解析层（纯函数，无 React、无副作用）。
 *
 * 画布节点渲染只认这一条数据入口：把节点自身结果或上游数据源结果，按属性面板里配置的字段
 * （NODE_SCHEMA 的 xField / yField / category / value / stageField / valueField / geoField /
 * indicatorField / valueFields）映射成迷你图渲染器能直接吃的形状。
 *
 * 三条硬约束：
 *   1. 解析不出来就如实返回 no-result / field-missing / unsupported，绝不回退到哈希占位序列——
 *      伪随机数据看起来像真数据，会让用户误以为查询成功。
 *   2. 只做「列 → 标签 / 数值」的搬运与数值强转，不做聚合、计算字段或排序（与 ADR-0009 §6 一致）。
 *   3. labels / values 永远同长度、同顺序，limit 截断在两个数组上同步生效。
 */

import type { NodeResult } from "../hooks/use-canvas-execution";
import { buildFrame, hasSemanticConfig, parseChartSpec, type ChartFrame } from "./chart-spec";

export type ChartDataStatus = "ok" | "no-result" | "field-missing" | "unsupported";

/** 箱线图分组：五数概括（最小 / 下四分位 / 中位数 / 上四分位 / 最大）。 */
export interface BoxplotGroup {
	label: string;
	min: number;
	q1: number;
	median: number;
	q3: number;
	max: number;
}

export interface NodeChartData {
	status: ChartDataStatus;
	/** 数据来自哪里：节点自身结果 / 上游结果；没有数据时为 null。 */
	source: "self" | "upstream" | null;
	labels: string[];
	values: number[];
	/** 箱线图分组；其它图表类型或未解析成功时为空数组。 */
	boxGroups: BoxplotGroup[];
	/** 实际参与映射的列名，供卡片「维度 / 数值」映射行展示。 */
	labelField: string | null;
	valueField: string | null;
	/** 结果集行数（截断前），供卡片「结果集」行展示。 */
	rowCount: number;
	/** 面向用户的一句话说明；解析成功时为空串。 */
	note: string;
	/** 语义层产出（维度 / 度量 / 过滤 / 排序 / TopN）；未配置度量时 null。 */
	frame: ChartFrame | null;
}

/** 每类图表用哪些字段当维度 / 数值（键名严格取自 node-schema.ts，不改名）。 */
interface FieldSpec {
	/** 维度字段的 values 键；null 表示该类型不需要维度（KPI 大数字）。 */
	label: string | null;
	/** 数值字段的 values 键。 */
	value: string | null;
	/** 数值字段是逗号分隔的多列（雷达图 valueFields），取第一个真实存在的列。 */
	multiValue?: boolean;
	/** 暂无渲染器接入的类型：如实告知用户，不静默降级成别的图。 */
	unsupported?: string;
}

const FIELD_SPECS: Record<string, FieldSpec> = {
	"chart-line": { label: "xField", value: "yField" },
	"chart-bar": { label: "xField", value: "yField" },
	"chart-boxplot": { label: "xField", value: "yField" },
	"chart-scatter": { label: "xField", value: "yField", unsupported: "散点图尚未接入" },
	"chart-pie": { label: "category", value: "value" },
	"chart-donut": { label: "category", value: "value" },
	"chart-funnel": { label: "stageField", value: "valueField" },
	"chart-map": { label: "geoField", value: "valueField", unsupported: "地图尚未接入" },
	"chart-radar": { label: "indicatorField", value: "valueFields", multiValue: true, unsupported: "雷达图尚未接入" },
	"chart-kpi": { label: null, value: "valueField" },
	// 语义层新增类型：字段名沿用同一套，未配度量时仍可按 xField / yField 降级渲染。
	"chart-area": { label: "xField", value: "yField" },
	"chart-heatmap": { label: "xField", value: "yField" },
	"chart-treemap": { label: "category", value: "value" },
	"chart-sankey": { label: "xField", value: "yField" },
	"chart-waterfall": { label: "xField", value: "yField" },
	"chart-combo": { label: "xField", value: "yField" },
	"chart-gauge": { label: null, value: "valueField" },
};

const DEFAULT_LIMIT = 14;
/** 完全没有可用结果时的引导文案。 */
const NO_RESULT_NOTE = "无数据 · 连接数据源节点后运行";
/** 有结果集但一行都没有时的文案（区别于「没连数据源」）。 */
const EMPTY_RESULT_NOTE = "无数据 · 查询结果为空";

function emptyResult(status: ChartDataStatus, note: string): NodeChartData {
	return {
		status,
		source: null,
		labels: [],
		values: [],
		boxGroups: [],
		labelField: null,
		valueField: null,
		rowCount: 0,
		note,
		frame: null,
	};
}

/** 结果集可用：没报错，且至少解析出列。 */
function usable(result: NodeResult | null | undefined): result is NodeResult {
	return !!result && !result.error && result.columns.length > 0;
}

interface PickedSource {
	result: NodeResult;
	source: "self" | "upstream";
}

/** 只有真正带回行的结果才算「有数据」——空结果集继续往下找上游。 */
function pickSource(
	result: NodeResult | null | undefined,
	source: "self" | "upstream",
): PickedSource | null {
	return usable(result) && result.rows.length > 0 ? { result, source } : null;
}

/** 数值单元格判定：空值与非数值串都不算。 */
function isNumericCell(cell: unknown): boolean {
	if (cell === null || cell === undefined || cell === "") return false;
	const n = Number(cell);
	return Number.isFinite(n);
}

/** 数值强转：与 use-canvas-execution 的 extractSeries 保持一致（Number() 后判有限，否则 0）。 */
function toNumber(cell: unknown): number {
	const n = Number(cell);
	return Number.isFinite(n) ? n : 0;
}

/** 某列是否「多数是数值」——阈值取一半，样本只有一行时也能给出结论。 */
function mostlyNumeric(result: NodeResult, column: string): boolean {
	const total = result.rows.length;
	if (total === 0) return false;
	let numeric = 0;
	for (const row of result.rows) {
		if (isNumericCell(row[column])) numeric += 1;
	}
	return numeric * 2 >= total;
}

/** 字段配置值：只认非空字符串，属性面板里的空白输入等同于「未配置」。 */
function configuredField(values: Record<string, unknown>, key: string | null): string {
	if (!key) return "";
	const raw = values[key];
	return typeof raw === "string" ? raw.trim() : "";
}

interface FieldResolution {
	field: string | null;
	error: string | null;
}

function resolveLabelField(
	spec: FieldSpec,
	values: Record<string, unknown>,
	result: NodeResult,
): FieldResolution {
	const configured = configuredField(values, spec.label);
	if (configured) {
		return result.columns.includes(configured)
			? { field: configured, error: null }
			: { field: null, error: `字段 ${configured} 不在结果列中` };
	}
	// 未配置：第一个非数值列当维度；整张表都是数值时退回第一列，保证仍有标签可读。
	const inferred = result.columns.find((column) => !mostlyNumeric(result, column));
	return { field: inferred ?? result.columns[0] ?? null, error: null };
}

function resolveValueField(
	spec: FieldSpec,
	values: Record<string, unknown>,
	result: NodeResult,
	labelField: string | null,
): FieldResolution {
	const configured = configuredField(values, spec.value);
	if (spec.multiValue) {
		const names = configured ? configured.split(",").map((name) => name.trim()).filter(Boolean) : [];
		if (names.length > 0) {
			const hit = names.find((name) => result.columns.includes(name));
			return hit
				? { field: hit, error: null }
				: { field: null, error: `字段 ${names.join("、")} 不在结果列中` };
		}
	} else if (configured) {
		return result.columns.includes(configured)
			? { field: configured, error: null }
			: { field: null, error: `字段 ${configured} 不在结果列中` };
	}
	// 未配置（或雷达图多值一个都没命中但也没配）→ 第一个以数值为主的列；
	// 排除已当作维度的那一列，避免「同一个列既是维度又是数值」（如单行的 month="01"）。
	const inferred = result.columns.find((column) => column !== labelField && mostlyNumeric(result, column));
	return inferred ? { field: inferred, error: null } : { field: null, error: "结果列中没有数值列" };
}

/** 线性插值分位数（与 Excel / R-7 一致）。 */
function quantile(sorted: number[], p: number): number {
	if (sorted.length === 0) return 0;
	if (sorted.length === 1) return sorted[0];
	const idx = (sorted.length - 1) * p;
	const lo = Math.floor(idx);
	const hi = Math.ceil(idx);
	if (lo === hi) return sorted[lo];
	return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/** 按维度列把行分组，逐组算数值列的五数概括（组序 = 首次出现顺序）。 */
function buildBoxGroups(result: NodeResult, labelField: string | null, valueField: string): BoxplotGroup[] {
	const buckets = new Map<string, number[]>();
	for (const row of result.rows) {
		const key = labelField ? String(row[labelField] ?? "") : valueField;
		const bucket = buckets.get(key);
		if (bucket) bucket.push(toNumber(row[valueField]));
		else buckets.set(key, [toNumber(row[valueField])]);
	}
	return [...buckets.entries()].map(([label, raw]) => {
		const sorted = [...raw].sort((a, b) => a - b);
		return {
			label,
			min: sorted[0],
			q1: quantile(sorted, 0.25),
			median: quantile(sorted, 0.5),
			q3: quantile(sorted, 0.75),
			max: sorted[sorted.length - 1],
		};
	});
}

/**
 * 解析一个图表节点要渲染的数据。
 *
 * @param kind    节点 kind（chart-bar / chart-line / …）
 * @param values  属性面板写入的字段（NodePos.values）
 * @param self    节点自身的结果集（nodeResults[id]），优先于上游
 * @param upstream 上游数据源结果（getUpstreamData(id, links, nodes)）
 * @param limit   最多取多少行 / 多少个箱线分组
 */
export function resolveNodeChartData(
	kind: string,
	values: Record<string, unknown> = {},
	self: NodeResult | null | undefined = null,
	upstream: NodeResult | null | undefined = null,
	limit = DEFAULT_LIMIT,
): NodeChartData {
	const spec = FIELD_SPECS[kind];
	if (!spec) {
		return emptyResult("unsupported", kind.startsWith("chart-") ? "该图表类型尚未接入" : "非图表节点");
	}
	// 已配置度量的节点走语义层：渲染器支持比旧字段映射更多的图表类型，
	// 旧路径里的 unsupported 不再适用（散点 / 雷达现在都能画）。
	const chartSpec = parseChartSpec(values);
	const semantic = hasSemanticConfig(chartSpec) && kind !== "chart-boxplot";
	if (!semantic && spec.unsupported) return emptyResult("unsupported", spec.unsupported);

	const picked = pickSource(self, "self") ?? pickSource(upstream, "upstream");
	if (!picked) {
		const hasResult = usable(self) || usable(upstream);
		return emptyResult("no-result", hasResult ? EMPTY_RESULT_NOTE : NO_RESULT_NOTE);
	}
	const { result, source } = picked;

	if (semantic) {
		const frame = buildFrame(result, chartSpec);
		const first = frame.series[0];
		return {
			status: "ok",
			source,
			// labels / values 继续填首度量的结果，旧调用方（卡片映射行、测试）不用改。
			labels: frame.categories,
			values: first?.data ?? [],
			boxGroups: [],
			labelField: frame.dimensionLabels[0] ?? null,
			valueField: chartSpec.measures[0]?.field ?? null,
			rowCount: result.rows.length,
			note: "",
			frame,
		};
	}

	// KPI 只要一个数值，不需要维度列。
	const label = spec.label === null ? { field: null, error: null } : resolveLabelField(spec, values, result);
	if (label.error) return emptyResult("field-missing", label.error);
	const value = resolveValueField(spec, values, result, label.field);
	if (value.error) return emptyResult("field-missing", value.error);
	if (!value.field) return emptyResult("field-missing", "结果列中没有数值列");

	const labelField = label.field;
	const valueField = value.field;
	const count = Number.isFinite(limit) ? Math.max(0, Math.trunc(limit)) : DEFAULT_LIMIT;

	if (kind === "chart-boxplot") {
		const boxGroups = buildBoxGroups(result, labelField, valueField).slice(0, count);
		return {
			status: "ok",
			source,
			labels: boxGroups.map((group) => group.label),
			values: boxGroups.map((group) => group.median),
			boxGroups,
			labelField,
			valueField,
			rowCount: result.rows.length,
			note: "",
			frame: null,
		};
	}

	const labels = labelField ? result.rows.map((row) => String(row[labelField] ?? "")) : [];
	const numbers = result.rows.map((row) => toNumber(row[valueField]));
	return {
		status: "ok",
		source,
		labels: labels.slice(0, count),
		values: numbers.slice(0, count),
		boxGroups: [],
		labelField,
		valueField,
		rowCount: result.rows.length,
		note: "",
		frame: null,
	};
}

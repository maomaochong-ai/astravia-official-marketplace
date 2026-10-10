/**
 * figure-options — 读取 `ChartItem.options.figure`。
 *
 * figure 类型不经过 Chart.js，它们的展示参数没法和 Chart.js options 混放，
 * 统一收在 `options.figure` 下（ADR-0009 §9 M2）。这是**唯一**的读取入口：
 * 集中校验，非法值静默回退到默认，不让一个手写的 options 把图表搞崩。
 *
 * 原生 8 种类型忽略这一节（Chart.js 也不认识它，无害）。
 */

import type { ChartItem } from "../../../domain/chart-contract";

export interface FigureOptions {
	/** 数值后缀，如 "万元" / "%" / "单" */
	unit?: string;
	/** 小数位；未给则最多保留 2 位且不补零 */
	digits?: number;
	/** 指标卡是否显示环比（默认 true） */
	showDelta: boolean;
	/** 漏斗是否显示「占首段 x%」（默认 true） */
	showPercent: boolean;
	/** 箱形图纵轴下界（与 max 同时有效时才生效） */
	min?: number;
	/** 箱形图纵轴上界 */
	max?: number;
}

const DIGITS_MIN = 0;
const DIGITS_MAX = 6;

function readOptionalNumber(raw: unknown): number | undefined {
	if (typeof raw === "number" && Number.isFinite(raw)) return raw;
	if (typeof raw === "string" && raw.trim() !== "") {
		const n = Number(raw);
		return Number.isFinite(n) ? n : undefined;
	}
	return undefined;
}

export function readFigureOptions(item: ChartItem): FigureOptions {
	const raw = (item.options as Record<string, unknown> | undefined)?.figure;
	const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

	const digits = readOptionalNumber(source.digits);
	return {
		unit: typeof source.unit === "string" && source.unit !== "" ? source.unit : undefined,
		digits: digits === undefined ? undefined : Math.min(DIGITS_MAX, Math.max(DIGITS_MIN, Math.round(digits))),
		showDelta: source.showDelta !== false,
		showPercent: source.showPercent !== false,
		min: readOptionalNumber(source.min),
		max: readOptionalNumber(source.max),
	};
}

/**
 * infer-schema — 列角色推断（v0.0.103 从 infer-layout.ts 抽离）
 *
 * 轻量 schema 分析，仅服务于 FilterBar 等前端编辑场景。
 * 完整的 Canvas 规则引擎（inferLayout / packGrid）已删除。
 */

export type ColumnRole = "time" | "measure" | "categorical" | "dimension" | "id";

export interface ColumnMeta {
	name: string;
	type: string;
	role: ColumnRole;
	cardinality?: number;
}

const TIME_PATTERNS = /(date|time|dt|day|month|year|created|updated|timestamp|_at$)/i;
const ID_PATTERNS = /(_id$|^id$|pk$|uuid|guid)/i;
const MEASURE_PATTERNS = /(count|sum|avg|total|amount|gmv|revenue|price|qty|quantity|rate|ratio|pct|percentage|score|rank|level|accuracy|coverage|completion|percent)/i;

function inferColumnRole(name: string, values: unknown[]): ColumnRole {
	if (TIME_PATTERNS.test(name)) return "time";
	if (ID_PATTERNS.test(name)) return "id";
	if (MEASURE_PATTERNS.test(name)) return "measure";

	const numericCount = values.filter((v) => typeof v === "number").length;
	if (numericCount / Math.max(values.length, 1) > 0.7) {
		const unique = new Set(values.filter((v) => v !== null && v !== undefined)).size;
		if (unique <= 20) return "categorical";
		if (unique >= values.length * 0.9) return "id";
		return "measure";
	}

	const unique = new Set(values.filter((v) => v !== null && v !== undefined)).size;
	if (unique <= 20) return "categorical";
	return "dimension";
}

/** 从列名 + 样例行推断每列的角色和基数。 */
export function inferSchema(columns: string[], rows: Record<string, unknown>[]): ColumnMeta[] {
	return columns.map((name) => {
		const values = rows.map((r) => r[name]);
		const role = inferColumnRole(name, values);
		const cardinality = new Set(values.filter((v) => v !== null && v !== undefined)).size;
		return { name, type: typeof values[0], role, cardinality };
	});
}

/**
 * parse-rest-json.ts — 把任意 JSON 响应折成表格（纯函数）。
 *
 * REST 接口的返回结构千差万别，这里按常见形态兜底：
 *   本身就是数组 → 按对象数组处理
 *   { data | rows | items | results | list: [...] } → 取该数组
 *   单个对象 → 一行
 *   标量数组 → 单列 value
 * 不做字段映射猜测，也不补默认值：拿不到行就返回空表，由调用方报错。
 */

export interface ParsedTable {
	columns: string[];
	rows: Record<string, unknown>[];
	/** 被截断时的原始行数；未截断为 null。 */
	truncatedFrom: number | null;
}

const LIKELY_ARRAYS = ["data", "rows", "items", "results", "list", "records", "values"];

function findArray(payload: unknown): unknown[] | null {
	if (Array.isArray(payload)) return payload;
	if (!payload || typeof payload !== "object") return null;
	const rec = payload as Record<string, unknown>;
	for (const key of LIKELY_ARRAYS) {
		if (Array.isArray(rec[key])) return rec[key] as unknown[];
	}
	// 只有一层嵌套时再找一次，避免为了未知包装层直接判空。
	for (const value of Object.values(rec)) {
		if (value && typeof value === "object" && !Array.isArray(value)) {
			const nested = findArray(value);
			if (nested) return nested;
		}
	}
	return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === "object" && !Array.isArray(value);
}

export function parseRestJson(payload: unknown, maxRows = 1000): ParsedTable {
	const list = findArray(payload);

	if (list) {
		const objects = list.filter(isRecord);
		const scalars = list.filter((item) => !isRecord(item));
		const total = list.length;
		const limited = list.slice(0, maxRows);

		if (objects.length === 0) {
			if (scalars.length === 0) return { columns: [], rows: [], truncatedFrom: null };
			const rows = limited.map((value) => ({ value: value as unknown }));
			return { columns: ["value"], rows, truncatedFrom: total > maxRows ? total : null };
		}

		const columns: string[] = [];
		for (const item of objects) {
			for (const key of Object.keys(item)) {
				if (!columns.includes(key)) columns.push(key);
			}
		}
		const rows = limited.filter(isRecord).map((item) => {
			const row: Record<string, unknown> = {};
			for (const key of columns) row[key] = item[key] ?? null;
			return row;
		});
		return { columns, rows, truncatedFrom: total > maxRows ? total : null };
	}

	if (isRecord(payload)) {
		return { columns: Object.keys(payload), rows: [payload], truncatedFrom: null };
	}

	if (payload === null || payload === undefined) return { columns: [], rows: [], truncatedFrom: null };
	return { columns: ["value"], rows: [{ value: payload }], truncatedFrom: null };
}

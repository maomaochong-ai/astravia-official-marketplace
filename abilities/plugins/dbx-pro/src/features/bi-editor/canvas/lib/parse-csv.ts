/**
 * parse-csv.ts — 粘贴文本的 CSV / TSV 解析（纯函数）。
 *
 * 支持：逗号或制表符分隔、双引号包裹（含 `""` 转义与字段内换行）、
 * 首行表头、CRLF / LF、BOM。不做类型推断——单元格一律保留原始字符串，
 * 数值换算交给图表语义层（它本来就按需 Number()）。
 */

export interface ParsedCsv {
	columns: string[];
	rows: Record<string, unknown>[];
	/** 表头被用作列名时给出的提示；空串表示无需提示。 */
	note: string;
}

const SEPARATORS = [",", "\t", ";"] as const;

/** 依据首行里出现次数最多的候选分隔符判断（引号外的字符才算）。 */
function detectSeparator(text: string): string {
	const firstLine = text.slice(0, text.indexOf("\n") === -1 ? text.length : text.indexOf("\n"));
	let best: string = ",";
	let bestCount = 0;
	for (const sep of SEPARATORS) {
		let count = 0;
		let quoted = false;
		for (let i = 0; i < firstLine.length; i += 1) {
			const ch = firstLine[i];
			if (ch === '"') quoted = !quoted;
			else if (!quoted && ch === sep) count += 1;
		}
		if (count > bestCount) {
			best = sep;
			bestCount = count;
		}
	}
	return best;
}

/** 按 RFC 4180 拆行：引号内的换行不算行边界。 */
function splitRecords(text: string, sep: string): string[][] {
	const records: string[][] = [];
	let record: string[] = [];
	let cell = "";
	let quoted = false;

	for (let i = 0; i < text.length; i += 1) {
		const ch = text[i];
		if (quoted) {
			if (ch === '"') {
				if (text[i + 1] === '"') {
					cell += '"';
					i += 1;
				} else {
					quoted = false;
				}
			} else {
				cell += ch;
			}
			continue;
		}
		if (ch === '"') {
			quoted = true;
		} else if (ch === sep) {
			record.push(cell);
			cell = "";
		} else if (ch === "\n") {
			record.push(cell);
			records.push(record);
			record = [];
			cell = "";
		} else if (ch !== "\r") {
			cell += ch;
		}
	}
	if (cell !== "" || record.length > 0) {
		record.push(cell);
		records.push(record);
	}
	return records;
}

/** 给空表头补名，并保证列名唯一（重名的加 `_2`）。 */
function normalizeHeader(cells: string[], width: number): string[] {
	const out: string[] = [];
	const seen = new Map<string, number>();
	for (let i = 0; i < width; i += 1) {
		const base = (cells[i] ?? "").trim() || `col_${i + 1}`;
		const count = (seen.get(base) ?? 0) + 1;
		seen.set(base, count);
		out.push(count === 1 ? base : `${base}_${count}`);
	}
	return out;
}

export function parseCsv(text: string, hasHeader = true): ParsedCsv {
	const clean = text.replace(/^\uFEFF/, "");
	if (!clean.trim()) return { columns: [], rows: [], note: "内容为空" };

	const sep = detectSeparator(clean);
	const records = splitRecords(clean, sep).filter((r) => r.some((c) => c.trim() !== ""));
	if (records.length === 0) return { columns: [], rows: [], note: "没有可用数据行" };

	const width = records.reduce((max, r) => Math.max(max, r.length), 0);
	const header = hasHeader ? normalizeHeader(records[0] ?? [], width) : normalizeHeader([], width);
	const body = hasHeader ? records.slice(1) : records;

	const rows = body.map((cells) => {
		const row: Record<string, unknown> = {};
		for (let i = 0; i < width; i += 1) row[header[i]] = cells[i] ?? "";
		return row;
	});

	return {
		columns: header,
		rows,
		note: hasHeader ? "" : "未使用表头，列名为 col_1…col_N",
	};
}

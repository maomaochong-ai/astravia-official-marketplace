/**
 * 结果导出 — 纯函数：单元格文本化、TSV / CSV / JSON 序列化。
 * 无 DOM / 无副作用，供 ResultGrid 的复制与导出复用，可独立单测。
 */

export function cellText(value: unknown): string {
	if (value === null || value === undefined) return "";
	if (typeof value === "object") return JSON.stringify(value);
	return String(value);
}

export function toTsv(cols: string[], rows: Record<string, unknown>[]): string {
	const lines = [cols.join("\t")];
	for (const row of rows) lines.push(cols.map((c) => cellText(row[c]).replaceAll("\t", " ")).join("\t"));
	return lines.join("\n");
}

function csvEscape(value: string): string {
	return /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export function toCsv(cols: string[], rows: Record<string, unknown>[]): string {
	const lines = [cols.map(csvEscape).join(",")];
	for (const row of rows) lines.push(cols.map((c) => csvEscape(cellText(row[c]))).join(","));
	return `\uFEFF${lines.join("\r\n")}`;
}

/**
 * 导出为 JSON 数组格式（每行一个对象）。
 */
export function toJson(cols: string[], rows: Record<string, unknown>[]): string {
	const result = rows.map((row) => {
		const obj: Record<string, unknown> = {};
		for (const col of cols) {
			obj[col] = row[col];
		}
		return obj;
	});
	return JSON.stringify(result, null, 2);
}

/**
 * 导出为 JSON Lines 格式（每行一个 JSON 对象，无缩进）。
 */
export function toJsonLines(cols: string[], rows: Record<string, unknown>[]): string {
	return rows.map((row) => {
		const obj: Record<string, unknown> = {};
		for (const col of cols) {
			obj[col] = row[col];
		}
		return JSON.stringify(obj);
	}).join("\n");
}

/**
 * 导出为 Markdown 表格格式。
 */
export function toMarkdown(cols: string[], rows: Record<string, unknown>[]): string {
	const lines: string[] = [];
	// 表头
	lines.push("| " + cols.join(" | ") + " |");
	// 分隔线
	lines.push("| " + cols.map(() => "---").join(" | ") + " |");
	// 数据行
	for (const row of rows) {
		lines.push("| " + cols.map((c) => cellText(row[c]).replaceAll("|", "\\|")).join(" | ") + " |");
	}
	return lines.join("\n");
}

/**
 * 导出为 HTML 表格格式。
 */
export function toHtml(cols: string[], rows: Record<string, unknown>[]): string {
	const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
	const lines: string[] = ["<table>", "  <thead>", "    <tr>"];
	for (const col of cols) {
		lines.push(`      <th>${escapeHtml(col)}</th>`);
	}
	lines.push("    </tr>", "  </thead>", "  <tbody>");
	for (const row of rows) {
		lines.push("    <tr>");
		for (const col of cols) {
			lines.push(`      <td>${escapeHtml(cellText(row[col]))}</td>`);
		}
		lines.push("    </tr>");
	}
	lines.push("  </tbody>", "</table>");
	return lines.join("\n");
}

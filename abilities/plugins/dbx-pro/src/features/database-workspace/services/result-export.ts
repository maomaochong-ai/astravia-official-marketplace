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
 * 导出为 SQL INSERT 语句（对齐 dbx 桌面壳的 SQL 导出）。
 *
 * 表名缺省用 query_result；null → NULL，数字 / 布尔裸写，其余按字符串字面量。
 * 方言差异：MySQL 系用反引号 + 单引号转义，其余走标准双引号标识符 / 单引号字符串。
 */
export function toSqlInsert(
	cols: string[],
	rows: Record<string, unknown>[],
	tableName = "query_result",
	dialect: "mysql" | "standard" = "standard",
): string {
	const quoteId = (name: string): string =>
		dialect === "mysql"
			? `\`${name.replaceAll("`", "``")}\``
			: /^[A-Za-z_][A-Za-z0-9_$]*$/.test(name)
				? name
				: `"${name.replaceAll('"', '""')}"`;
	// 限定名（schema.table）按段分别加引号，不能把 "a.b" 整体当成一个标识符。
	const qualifiedTable = tableName.split(".").map(quoteId).join(".");
	const literal = (value: unknown): string => {
		if (value === null || value === undefined) return "NULL";
		if (typeof value === "number" && Number.isFinite(value)) return String(value);
		if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
		if (typeof value === "object") return `'${JSON.stringify(value).replaceAll("'", "''")}'`;
		return `'${String(value).replaceAll("'", "''")}'`;
	};
	const head = `INSERT INTO ${qualifiedTable} (${cols.map(quoteId).join(", ")}) VALUES`;
	if (rows.length === 0) return `-- ${tableName}: 0 行，无数据可导出\n${head};`;
	// 多行 VALUES：一行一个元组，元组之间逗号分隔，语句末尾一个分号（否则第 2 行起是语法错误）。
	const tuples = rows.map((row) => `  (${cols.map((c) => literal(row[c])).join(", ")})`);
	return `${head}\n${tuples.join(",\n")};`;
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

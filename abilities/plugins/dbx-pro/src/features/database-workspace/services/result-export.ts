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
 * 分块文本导出器 —— 「导出全部」按引擎页（每块最多 1000 行）拉取，
 * 边拉边序列化，避免 rows 全量数组与整份文本同时在内存里翻倍。
 * XLSX 是二进制 ZIP 结构无法流式，走全量 toXlsx。
 */
export type TextExportKind = "csv" | "json" | "jsonl" | "md" | "html" | "sql" | "txt";

export interface ChunkedTextExport {
	/** 追加一块数据行（列在构造时已固定，与各块同源）。 */
	push(rows: Record<string, unknown>[]): void;
	/** 最终文本（仅在所有块 push 完后调用一次）。 */
	content(): string;
}

export function createChunkedTextExport(
	kind: TextExportKind,
	cols: string[],
	options: { tableName?: string; dialect?: "mysql" | "standard" } = {},
): ChunkedTextExport {
	const parts: string[] = [];
	let pushed = 0;

	switch (kind) {
		case "csv": {
			parts.push(`\uFEFF${cols.map(csvEscape).join(",")}`);
			return {
				push(rows) {
					for (const row of rows) parts.push(cols.map((c) => csvEscape(cellText(row[c]))).join(","));
					pushed += rows.length;
				},
				content: () => parts.join("\r\n"),
			};
		}
		case "txt": {
			parts.push(cols.join("\t"));
			return {
				push(rows) {
					for (const row of rows) {
						parts.push(cols.map((c) => cellText(row[c]).replaceAll("\t", " ")).join("\t"));
					}
					pushed += rows.length;
				},
				content: () => parts.join("\n"),
			};
		}
		case "jsonl": {
			return {
				push(rows) {
					for (const row of rows) {
						const obj: Record<string, unknown> = {};
						for (const col of cols) obj[col] = row[col];
						parts.push(JSON.stringify(obj));
					}
					pushed += rows.length;
				},
				content: () => parts.join("\n"),
			};
		}
		case "json": {
			// 与 toJson 保持一致的 2 空格缩进：每个对象整体缩进一级，对象间逗号分隔。
			return {
				push(rows) {
					for (const row of rows) {
						const obj: Record<string, unknown> = {};
						for (const col of cols) obj[col] = row[col];
						parts.push(`  ${JSON.stringify(obj, null, 2).replaceAll("\n", "\n  ")}`);
					}
					pushed += rows.length;
				},
				content: () => `[\n${parts.join(",\n")}\n]`,
			};
		}
		case "md": {
			parts.push(`| ${cols.join(" | ")} |`);
			parts.push(`| ${cols.map(() => "---").join(" | ")} |`);
			return {
				push(rows) {
					for (const row of rows) {
						parts.push(`| ${cols.map((c) => cellText(row[c]).replaceAll("|", "\\|")).join(" | ")} |`);
					}
					pushed += rows.length;
				},
				content: () => parts.join("\n"),
			};
		}
		case "html": {
			const escapeHtml = (s: string) =>
				s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
			parts.push("<table>", "  <thead>", "    <tr>");
			for (const col of cols) parts.push(`      <th>${escapeHtml(col)}</th>`);
			parts.push("    </tr>", "  </thead>", "  <tbody>");
			return {
				push(rows) {
					for (const row of rows) {
						parts.push("    <tr>");
						for (const col of cols) {
							parts.push(`      <td>${escapeHtml(cellText(row[col]))}</td>`);
						}
						parts.push("    </tr>");
					}
					pushed += rows.length;
				},
				content: () => {
					parts.push("  </tbody>", "</table>");
					return parts.join("\n");
				},
			};
		}
		case "sql": {
			const tableName = options.tableName || "query_result";
			const dialect = options.dialect ?? "standard";
			const quoteId = (name: string): string =>
				dialect === "mysql"
					? `\`${name.replaceAll("`", "``")}\``
					: /^[A-Za-z_][A-Za-z0-9_$]*$/.test(name)
						? name
						: `"${name.replaceAll('"', '""')}"`;
			const qualifiedTable = tableName.split(".").map(quoteId).join(".");
			const literal = (value: unknown): string => {
				if (value === null || value === undefined) return "NULL";
				if (typeof value === "number" && Number.isFinite(value)) return String(value);
				if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
				if (typeof value === "object") return `'${JSON.stringify(value).replaceAll("'", "''")}'`;
				return `'${String(value).replaceAll("'", "''")}'`;
			};
			parts.push(`INSERT INTO ${qualifiedTable} (${cols.map(quoteId).join(", ")}) VALUES`);
			return {
				push(rows) {
					for (const row of rows) {
						parts.push(`  (${cols.map((c) => literal(row[c])).join(", ")})`);
					}
					pushed += rows.length;
				},
				content: () =>
					pushed === 0
						? `-- ${tableName}: 0 行，无数据可导出\n${parts[0]};`
						: `${parts[0]}\n${parts.slice(1).join(",\n")};`,
			};
		}
	}
	// 穷尽性检查：新增文本格式时这里会编译报错，提醒补分支。
	const exhaustive: never = kind;
	throw new Error(`不支持的文本导出格式：${String(exhaustive)}`);
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

/**
 * 表 DDL 生成 — 引擎只暴露 /describe（列结构），没有独立的 SHOW CREATE 端点，
 * 这里按列元数据生成一份最佳 effort 的 CREATE TABLE 语句，用于表属性 DDL 页签。
 *
 * 与真实 SHOW CREATE 的差异：不含索引 / 约束 / 表注释 / 引擎参数（describe 拿不到），
 * 调用方需在界面上如实标注「根据列结构生成」。
 */

import type { EngineColumn } from "../state/workbench-types";

/** 仅在标识符含非法字符或大小写敏感时加双引号，其余保持裸名（与树里生成的 SQL 口径一致）。 */
function quoteIdent(name: string): string {
	return /^[A-Za-z_][A-Za-z0-9_$]*$/.test(name) ? name : `"${name.replace(/"/g, '""')}"`;
}

function columnLine(col: EngineColumn): string {
	const parts = [quoteIdent(col.name), col.type || "TEXT"];
	if (!col.nullable) parts.push("NOT NULL");
	if (col.hasDefault && col.defaultValue !== "") {
		const d = col.defaultValue.trim();
		// 函数调用 / 类型转换（nextval(...)、'x'::regclass）保持原样；
		// 数字、NULL、布尔、CURRENT_* 也保持裸值；其余按字符串字面量处理。
		const isBare =
			/^-?\d/.test(d) ||
			/^(null|true|false|current_timestamp|current_date|current_time)/i.test(d) ||
			d.includes("(") ||
			d.includes("::");
		parts.push(`DEFAULT ${isBare ? d : `'${d.replace(/'/g, "''")}'`}`);
	}
	return `  ${parts.join(" ")}`;
}

/** 根据列结构构建 CREATE TABLE 语句。 */
export function buildCreateTableSql(qualifiedName: string, columns: EngineColumn[]): string {
	const lines = columns.map(columnLine);
	const pkCols = columns.filter((c) => c.isPrimaryKey).map((c) => quoteIdent(c.name));
	if (pkCols.length > 0) {
		lines.push(`  PRIMARY KEY (${pkCols.join(", ")})`);
	}
	return `CREATE TABLE ${qualifiedName} (\n${lines.join(",\n")}\n);`;
}

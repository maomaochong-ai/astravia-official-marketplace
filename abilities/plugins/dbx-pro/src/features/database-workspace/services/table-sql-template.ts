/**
 * 按表真实列结构（/describe）生成 DML / DDL 模板。
 *
 * 替代此前写死 `column1 / value1` 的 demo 模板，对齐 dbx 桌面壳
 * 「生成 SQL」语义：模板语句，值部分给占位符 / 示例字面量，用户改完再执行。
 */

import type { EngineColumn } from "../state/workbench-types";
import { buildCreateTableSql } from "./table-ddl.ts";

export type TableSqlKind = "select" | "insert" | "update" | "delete" | "create" | "alter" | "drop";

function quoteIdent(name: string): string {
	return /^[A-Za-z_][A-Za-z0-9_$]*$/.test(name) ? name : `"${name.replace(/"/g, '""')}"`;
}

/** 按列类型给一个示例字面量（仅用于 INSERT 模板的初始值）。 */
function sampleLiteral(type: string): string {
	const t = type.toLowerCase();
	if (/int|serial|number|decimal|numeric|float|double|real/.test(t)) return "0";
	if (/bool|bit/.test(t)) return "false";
	if (/date$|date\b/.test(t) && !/time/.test(t)) return "'2026-01-01'";
	if (/timestamp|datetime|time\b/.test(t)) return "CURRENT_TIMESTAMP";
	if (/json/.test(t)) return "'{}'";
	if (/blob|binary|bytea/.test(t)) return "''";
	return "''";
}

/** UPDATE 的 SET 占位值：有默认值用默认值，否则按类型给示例。 */
function updateValue(col: EngineColumn): string {
	if (col.hasDefault && col.defaultValue.trim()) return col.defaultValue.trim();
	return sampleLiteral(col.type);
}

export interface GenerateContext {
	qualifiedName: string;
	dbType?: string;
	columns: EngineColumn[];
}

/**
 * 新建表模板：连接 / schema 节点的「新建表」入口用它预置一个新 tab。
 *
 * schema 一律写进限定名：未限定的 `CREATE TABLE t` 会落到**连接会话**的
 * search_path（PG 默认 `"$user", public`），与树里看到的 schema 可能不是同一个 ——
 * 结果是建完表在树里能看到、按裸表名查询却报 `relation "t" does not exist`。
 * 从 schema 节点进入时带上 schema，是这里唯一能替用户消掉那个坑的地方。
 */
export function buildNewTableTemplate(opts: { schema?: string; table?: string } = {}): string {
	const parts = [opts.schema, opts.table ?? "new_table"].filter((p): p is string => Boolean(p && p.trim()));
	return `CREATE TABLE ${parts.map(quoteIdent).join(".")} (\n  id INTEGER PRIMARY KEY\n);`;
}

export function generateTableSql(kind: TableSqlKind, ctx: GenerateContext): string {
	const { qualifiedName: table, columns, dbType } = ctx;
	const cols = columns;
	const pk = cols.filter((c) => c.isPrimaryKey);

	switch (kind) {
		case "select": {
			// 列数适中时列出真实列名；过多则用 *，避免模板过长。
			const selectList = cols.length > 0 && cols.length <= 30
				? cols.map((c) => quoteIdent(c.name)).join(", ")
				: "*";
			return `SELECT ${selectList}\nFROM ${table}\nLIMIT 100;`;
		}
		case "insert": {
			if (cols.length === 0) return `INSERT INTO ${table}\nVALUES ();`;
			const names = cols.map((c) => quoteIdent(c.name)).join(", ");
			const values = cols.map((c) => sampleLiteral(c.type)).join(", ");
			return `INSERT INTO ${table} (${names})\nVALUES (${values});`;
		}
		case "update": {
			// SET 取第一个非主键列；WHERE 用主键，没有主键则给通用占位。
			const setCol = cols.find((c) => !c.isPrimaryKey);
			const where = pk.length > 0
				? pk.map((c) => `${quoteIdent(c.name)} = ${sampleLiteral(c.type)}`).join(" AND ")
				: "condition";
			const setLine = setCol
				? `${quoteIdent(setCol.name)} = ${updateValue(setCol)}`
				: "column = value";
			return `UPDATE ${table}\nSET ${setLine}\nWHERE ${where};`;
		}
		case "delete": {
			const where = pk.length > 0
				? pk.map((c) => `${quoteIdent(c.name)} = ${sampleLiteral(c.type)}`).join(" AND ")
				: "condition";
			return `DELETE FROM ${table}\nWHERE ${where};`;
		}
		case "create": {
			// 与表属性 DDL 页同一套 CREATE TABLE 生成，保持单一口径。
			// describe 失败拿不到列时给通用占位，避免输出语法不完整的空列清单。
			if (cols.length === 0) {
				return `CREATE TABLE ${table} (\n  id INTEGER PRIMARY KEY\n);`;
			}
			return buildCreateTableSql(table, cols);
		}
		case "alter": {
			// 对齐 dbx 方言：Oracle 系 ADD (...)，SQL Server 无 COLUMN 关键字。
			const type = (dbType ?? "").toLowerCase();
			const addClause = /sqlserver|mssql|kingbase/.test(type) ? "ADD" : "ADD COLUMN";
			return `ALTER TABLE ${table}\n${addClause} new_column VARCHAR(100);`;
		}
		case "drop":
		default:
			return `DROP TABLE IF EXISTS ${table};`;
	}
}

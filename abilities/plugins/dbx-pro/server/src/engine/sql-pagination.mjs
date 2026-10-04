/**
 * SQL 服务端分页 — 子查询包裹 + 方言相关的 LIMIT/OFFSET。
 *
 * dbx-mcp 的 execute_query 只接受 max_rows、没有 offset 参数，且发布制品
 * 每个结果集硬上限 100 行。要翻到 100 行之后，只能在 SQL 层重写：
 * 把原查询包成派生表，再按方言加分页子句，每次仍只取一页（≤100 行），
 * 因此不触碰结果集上限。
 *
 * 纯函数模块，不接触引擎 / 网络，便于单测。
 */

import { splitStatements } from "./sql-safety.mjs";

/** 支持子查询分页的 SQL 方言（SQL 均为 SELECT 透传）。 */
const PAGED_DIALECTS = new Set([
	"postgresql",
	"pg",
	"mysql",
	"mariadb",
	"sqlite",
	"mssql",
	"sqlserver",
]);

export function supportsPagination(dbType) {
	return PAGED_DIALECTS.has(String(dbType ?? "").trim().toLowerCase());
}

/** 去掉末尾分号，保证包进派生表时语法正确。 */
function innerSql(sql) {
	return sql.trim().replace(/;+\s*$/, "");
}

/**
 * 判断一条 SQL 能否做服务端分页，保守策略：
 * - 仅允许单条语句（多语句无法整体翻页）
 * - 必须以 SELECT / WITH 开头（SHOW / EXPLAIN / DDL / DML 不支持）
 * - 已自带分页子句（LIMIT / OFFSET / FETCH / TOP n）时不介入，
 *   避免改写用户明确指定的范围。
 */
export function canPaginate(sql) {
	const statements = splitStatements(sql);
	if (statements.length !== 1) return false;
	const s = statements[0];
	if (!/^(SELECT|WITH)\b/i.test(s)) return false;
	if (/\b(?:LIMIT|OFFSET|FETCH)\b/i.test(s)) return false;
	if (/\bTOP\s+\d+/i.test(s)) return false;
	return true;
}

/**
 * 构造某一页的 SQL。
 * - PostgreSQL / MySQL / SQLite：派生表 + LIMIT n OFFSET m
 * - MSSQL：OFFSET/FETCH（必须带 ORDER BY，用 ORDER BY (SELECT NULL) 占位）
 */
export function buildPagedSql(sql, dbType, limit, offset) {
	const inner = innerSql(sql);
	const type = String(dbType ?? "").trim().toLowerCase();
	if (type === "mssql" || type === "sqlserver") {
		return (
			`SELECT * FROM (${inner}) AS _dbx_page ` +
			`ORDER BY (SELECT NULL) OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`
		);
	}
	return `SELECT * FROM (${inner}) AS _dbx_page LIMIT ${limit} OFFSET ${offset}`;
}

/** 构造总数统计 SQL（派生表外包 COUNT；四种方言通用，MSSQL 无需 ORDER BY）。 */
export function buildCountSql(sql) {
	const inner = innerSql(sql);
	return `SELECT COUNT(*) AS _dbx_total FROM (${inner}) AS _dbx_count`;
}

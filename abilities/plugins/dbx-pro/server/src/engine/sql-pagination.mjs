/**
 * SQL 服务端分页 — 子查询包裹 + 方言相关的 LIMIT/OFFSET。
 * dbx-mcp 的 execute_query 只接受 max_rows、没有 offset 参数。要翻到一页之后，
 * 只能在 SQL 层重写：把原查询包成派生表，再按方言加分页子句，每次仍只取一页
 * （≤ ENGINE_ROW_CAP），因此不触碰宿主单次结果上限。
 *
 * 纯函数模块，不接触引擎 / 网络，便于单测。
 */

import { splitStatements } from "./sql-safety.mjs";

/**
 * 支持 `SELECT * FROM (…) AS _dbx_page LIMIT n OFFSET m` 的方言。
 *
 * 键名是插件实际发来的 db_type（见 domain/connection-config.ts 的 DB_TYPE_MANIFEST），
 * 不是方言显示名 —— 例如 PostgreSQL 的 db_type 是 `postgres` 而非 `postgresql`。
 * 宁可漏（就落回客户端分页，结果正确，只是翻页不省流量），不可错：把不支持的方言
 * 当支持会直接生成非法 SQL，反而把原本能跑的查询弄挂。
 */
const PAGED_DIALECTS = new Set([
	// MySQL 系（含 MySQL 协议的国产/云库）
	"mysql",
	"mariadb",
	"starrocks",
	"doris",
	"databend",
	"oceanbase",
	// PostgreSQL 系（含 fork）
	"postgres",
	"postgresql",
	"pg",
	"aurora-postgresql",
	"redshift",
	"kingbase",
	"highgo",
	"vastbase",
	"gaussdb",
	"opengauss",
	// SQLite 系
	"sqlite",
	"cloudflare-d1",
	"duckdb",
	"rqlite",
	"turso",
	// 标准 LIMIT/OFFSET
	"clickhouse",
	"bigquery",
	"snowflake",
	"trino",
	"prestosql",
	// OFFSET/FETCH（见 buildPagedSql）
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

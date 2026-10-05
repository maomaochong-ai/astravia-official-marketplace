/**
 * 结果网格第二排 WHERE / ORDER BY 的 SQL 包装。
 *
 * 不解析用户 SQL 是否已含 WHERE，统一把原查询包成派生表再追加子句，
 * 与引擎服务端分页（LIMIT/OFFSET 改写作用于外层）兼容。
 * 仅支持单条 SELECT / WITH；不满足返回 null，由调用方提示。
 */

export function buildFilteredSql(baseSql: string, where: string, orderBy: string): string | null {
	const base = baseSql.trim().replace(/;+\s*$/, "");
	if (!base || !/^(select|with)\b/i.test(base) || /;\s/.test(base)) return null;
	const clauses: string[] = [];
	const w = where.trim();
	const o = orderBy.trim();
	if (w) clauses.push(`WHERE ${w}`);
	if (o) clauses.push(`ORDER BY ${o}`);
	if (clauses.length === 0) return null;
	return `SELECT * FROM (\n${base}\n) AS dbx_filt\n${clauses.join("\n")}`;
}

/**
 * 结果来源表解析 — 从 SQL 里取出「结果来自哪张表」。
 *
 * 只做浅解析（首个 FROM 子句的 [schema.]table），够用于结果面板头与表属性按钮；
 * 真正的语法分析在引擎侧，这里解析不出就返回 null，调用方回落到连接名。
 */

export interface SqlTableRef {
	schema?: string;
	tableName: string;
}

/** 解析 SELECT 的首个 FROM 目标；解析失败返回 null。 */
export function parseTableRef(sql: string | null | undefined): SqlTableRef | null {
	if (!sql) return null;
	const match = /FROM\s+["`]?([\w$]+)(?:\s*\.\s*["`]?([\w$]+))?["`]?/i.exec(sql);
	if (!match) return null;
	const first = match[1];
	const second = match[2];
	if (second) return { schema: first, tableName: second };
	return { tableName: first };
}

/** 限定名标签：schema.table / table；无来源时返回空串。 */
export function formatTableRef(ref: SqlTableRef | null): string {
	if (!ref) return "";
	return ref.schema ? `${ref.schema}.${ref.tableName}` : ref.tableName;
}

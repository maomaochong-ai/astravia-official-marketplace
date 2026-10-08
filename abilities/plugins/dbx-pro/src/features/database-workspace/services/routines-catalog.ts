/**
 * 例程目录 — 连接树「存储过程 / 函数」分组的数据来源。
 *
 * 引擎没有独立的例程路由。这里复用既有读路径（/query）发目录 SQL：
 * 读操作零提权，也不需要服务端新增接口，和「列出 schema / 表」是同一套语义。
 *
 * 方言覆盖有意保守：只列举真的能查到例程的目录视图，拿不准就返回 unsupported，
 * 让调用方直接隐藏分组节点 —— 空分组、点开报错的分组都比「不显示」更容易误导用户。
 */

import { engineExecuteByName } from "../../../shared/services/engine-client";

export interface RoutineInfo {
	schema: string;
	name: string;
	/** FUNCTION / PROCEDURE；目录拿不到时为空串。 */
	kind: string;
	/** 实参签名（只有 PG 目录能拿到，其他方言为空）。 */
	args: string;
}

export interface RoutineLoadResult {
	/** 当前方言是否有例程目录可查；false 时调用方不应渲染分组节点。 */
	supported: boolean;
	routines: RoutineInfo[];
}

/** 单次取回的例程上限：几百个例程就够定位了，超出的部分不该拖垮树。 */
const ROUTINE_ROW_LIMIT = 500;
const ROUTINE_TIMEOUT_MS = 20_000;

/**
 * PG 家族：pg_proc 能给出实参签名，是唯一能显示签名的一类。
 * redshift / greenplum 不在其中 —— 它们没有 prokind，宁可不显示分组。
 */
const POSTGRES_FAMILY = /postgres|gaussdb|opengauss|kingbase|vastbase|highgo/;
/** information_schema.routines 可用的方言。 */
const ANSI_ROUTINES = /mysql|mariadb|tidb|sqlserver/;

function escapeLiteral(value: string): string {
	return value.replace(/'/g, "''");
}

/**
 * 例程目录 SQL；方言不支持时返回 null（调用方据此隐藏分组节点）。
 * schema 为空表示不限 schema（无 schema 层的库）。
 */
export function routinesCatalogSql(dbType: string | undefined, schema?: string): string | null {
	const dialect = String(dbType ?? "").toLowerCase();
	const scope = schema && schema.trim() ? schema.trim() : "";
	if (POSTGRES_FAMILY.test(dialect)) {
		const filter = scope ? `\n  AND n.nspname = '${escapeLiteral(scope)}'` : "";
		return [
			"SELECT n.nspname AS schema_name,",
			"       p.proname AS routine_name,",
			"       CASE p.prokind WHEN 'p' THEN 'PROCEDURE' WHEN 'f' THEN 'FUNCTION'",
			"            WHEN 'a' THEN 'AGGREGATE' WHEN 'w' THEN 'WINDOW' ELSE '' END AS routine_kind,",
			"       pg_get_function_identity_arguments(p.oid) AS routine_args",
			"FROM pg_catalog.pg_proc p",
			"JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace",
			"WHERE n.nspname NOT IN ('information_schema','pg_catalog')",
			"  AND n.nspname NOT LIKE 'pg_temp%'",
			"  AND n.nspname NOT LIKE 'pg_toast_temp%'" + filter,
			"ORDER BY n.nspname, p.proname",
		].join("\n");
	}
	if (ANSI_ROUTINES.test(dialect)) {
		const filter = scope ? `\nWHERE routine_schema = '${escapeLiteral(scope)}'` : "";
		return [
			"SELECT routine_schema AS schema_name,",
			"       routine_name AS routine_name,",
			"       routine_type AS routine_kind,",
			"       '' AS routine_args",
			"FROM information_schema.routines" + filter,
			"ORDER BY routine_schema, routine_name",
		].join("\n");
	}
	return null;
}

/** 目录行 → 例程列表；同名重载（PG 特有）按签名去重后都保留。 */
export function parseRoutines(rows: Record<string, unknown>[]): RoutineInfo[] {
	const seen = new Set<string>();
	const out: RoutineInfo[] = [];
	for (const row of rows) {
		const name = text(row.routine_name);
		if (!name) continue;
		const schema = text(row.schema_name);
		const kind = text(row.routine_kind).toUpperCase();
		const args = text(row.routine_args);
		const dedupeKey = `${schema}\u0000${name}\u0000${args}`;
		if (seen.has(dedupeKey)) continue;
		seen.add(dedupeKey);
		out.push({ schema, name, kind, args });
	}
	return out;
}

function text(value: unknown): string {
	return value === null || value === undefined ? "" : String(value);
}

/** 树节点标签：带实参签名的函数才能区分同名重载。 */
export function routineLabel(routine: RoutineInfo): string {
	return routine.args ? `${routine.name}(${routine.args})` : `${routine.name}()`;
}

/** 例程在树里的唯一标识：同名重载靠签名区分。 */
export function routineKeyName(routine: RoutineInfo): string {
	return routine.args ? `${routine.name}(${routine.args})` : routine.name;
}

/**
 * 调用模板：只给「怎么调用」的骨架。
 * 参数值必须由用户填，所以签名留在注释里，不把 `f(a integer)` 当成可执行 SQL 发出去。
 */
export function buildRoutineCallTemplate(routine: Pick<RoutineInfo, "schema" | "name" | "kind" | "args">): string {
	const target = routine.schema ? `${routine.schema}.${routine.name}` : routine.name;
	const kindLabel = routine.kind === "PROCEDURE" ? "存储过程" : routine.kind === "FUNCTION" ? "函数" : "例程";
	const head = `-- ${kindLabel} ${target}${routine.args ? `(${routine.args})` : "()"}`;
	return routine.kind === "PROCEDURE" ? `${head}\nCALL ${target}();` : `${head}\nSELECT * FROM ${target}();`;
}

export async function loadRoutines(
	connectionName: string,
	schema: string | undefined,
	dbType: string | undefined,
): Promise<RoutineLoadResult> {
	const sql = routinesCatalogSql(dbType, schema);
	if (!sql) return { supported: false, routines: [] };
	const outcome = await engineExecuteByName(connectionName, sql, {
		rowLimit: ROUTINE_ROW_LIMIT,
		timeoutMs: ROUTINE_TIMEOUT_MS,
		dbType,
	});
	return { supported: true, routines: parseRoutines(outcome.rows) };
}

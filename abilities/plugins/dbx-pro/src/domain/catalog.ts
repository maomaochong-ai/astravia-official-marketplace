/**
 * 数据库目录 introspection SQL 生成器。
 *
 * 引擎没有独立的 list_databases / list_schemas 工具，目录枚举和子对象
 * 枚举都通过只读的 information_schema / 系统表查询完成。这层封装把
 * 各 family 的 introspection SQL 集中起来，对外暴露稳定的纯函数。
 */

import type { CatalogFamily } from "./connection-config";

export type TableObjectKind = "column" | "index" | "constraint" | "foreign-key" | "trigger" | "partition";

export interface CatalogScope {
	schema?: string;
	database?: string;
}

const SCHEMA_SYSTEM = new Set(["information_schema", "pg_catalog", "pg_toast"]);
const DATABASE_SYSTEM = new Set(["information_schema", "performance_schema", "mysql", "sys"]);

export function escapeSqlLiteral(value: string): string {
	return `'${value.replaceAll("'", "''")}'`;
}

export function listSchemasSql(): string {
	return "SELECT schema_name AS name FROM information_schema.schemata ORDER BY schema_name";
}

export function listDatabasesSql(): string {
	return "SELECT schema_name AS name FROM information_schema.schemata ORDER BY schema_name";
}

export function filterSystemNames(family: CatalogFamily, names: string[]): string[] {
	const system = family === "schemas" ? SCHEMA_SYSTEM : DATABASE_SYSTEM;
	const kept = names.filter((n) => {
		if (system.has(n)) return false;
		if (family === "schemas" && n.startsWith("pg_")) return false;
		return true;
	});
	kept.sort();
	if (family === "schemas") {
		const idx = kept.indexOf("public");
		if (idx > 0) {
			kept.splice(idx, 1);
			kept.unshift("public");
		}
	}
	return kept;
}

export function listTablesInScopeSql(family: CatalogFamily, scope: CatalogScope): string {
	if (family === "schemas" && scope.schema) {
		const s = escapeSqlLiteral(scope.schema);
		return `SELECT table_name AS name, table_type FROM information_schema.tables WHERE table_schema = ${s} ORDER BY table_name`;
	}
	if (family === "databases" && scope.database) {
		const d = escapeSqlLiteral(scope.database);
		return `SELECT table_name AS name, table_type FROM information_schema.tables WHERE table_schema = ${d} ORDER BY table_name`;
	}
	return "SELECT table_name AS name, table_type FROM information_schema.tables ORDER BY table_name";
}

/**
 * flat family 的表清单。
 * flat 引擎各自有私有系统表，与 information_schema 无关；这里只给已直连支持的引擎，
 * 其余返回 null（调用方据此显示「需引擎支持」而不是拿错误 SQL 去撞库）。
 */
export function listFlatTablesSql(dbType: string): string | null {
	if (dbType === "sqlite") {
		return "SELECT name AS table_name, type AS table_type FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY name";
	}
	return null;
}

/** 单表的列清单（flat family）。键名与 information_schema 分支保持一致，面板无需分支。 */
export function flatColumnsSql(dbType: string, table: string): string | null {
	if (dbType !== "sqlite") return null;
	const t = escapeSqlLiteral(table);
	return `SELECT name AS column_name, type AS data_type, CASE WHEN "notnull" = 1 THEN 'NO' ELSE 'YES' END AS is_nullable, dflt_value AS column_default FROM pragma_table_info(${t}) ORDER BY cid`;
}

/** 单表的索引清单（flat family）。输出 name / is_unique，与 information_schema 分支的 name 对齐。 */
export function listFlatIndexesSql(dbType: string, table: string): string | null {
	if (dbType !== "sqlite") return null;
	const t = escapeSqlLiteral(table);
	return `SELECT name AS name, CASE WHEN "unique" = 1 THEN 'YES' ELSE 'NO' END AS is_unique FROM pragma_index_list(${t}) ORDER BY name`;
}

/**
 * 表级子对象 introspection SQL（索引/约束/触发器/FK/分区）。
 * flat family 各引擎系统表差异大，返回 null 表示该引擎暂不支持。
 */
export function tableObjectSql(
	family: CatalogFamily,
	kind: TableObjectKind,
	table: string,
	scope?: CatalogScope,
): string | null {
	const t = escapeSqlLiteral(table);

	if (family === "schemas") {
		const schema = scope?.schema;
		if (!schema) return null;
		const s = escapeSqlLiteral(schema);
		switch (kind) {
			case "column":
				return `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = ${s} AND table_name = ${t} ORDER BY ordinal_position`;
			case "index":
				return `SELECT indexname AS name FROM pg_indexes WHERE schemaname = ${s} AND tablename = ${t} ORDER BY indexname`;
			case "constraint":
				return `SELECT constraint_name AS name, constraint_type FROM information_schema.table_constraints WHERE table_schema = ${s} AND table_name = ${t} AND constraint_type <> 'FOREIGN KEY' ORDER BY constraint_name`;
			case "foreign-key":
				return `SELECT constraint_name AS name FROM information_schema.table_constraints WHERE table_schema = ${s} AND table_name = ${t} AND constraint_type = 'FOREIGN KEY' ORDER BY constraint_name`;
			case "trigger":
				return `SELECT trigger_name AS name FROM information_schema.triggers WHERE event_object_schema = ${s} AND event_object_table = ${t} ORDER BY trigger_name`;
			case "partition":
				return `SELECT child.relname AS name FROM pg_inherits i JOIN pg_class child ON child.oid = i.inhrelid JOIN pg_class parent ON parent.oid = i.inhparent JOIN pg_namespace ns ON ns.oid = parent.relnamespace WHERE ns.nspname = ${s} AND parent.relname = ${t} ORDER BY child.relname`;
		}
		return null;
	}

	if (family === "databases") {
		const db = scope?.database;
		if (!db) return null;
		const d = escapeSqlLiteral(db);
		switch (kind) {
			case "column":
				return `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = ${d} AND table_name = ${t} ORDER BY ordinal_position`;
			case "index":
				return `SELECT DISTINCT index_name AS name FROM information_schema.statistics WHERE table_schema = ${d} AND table_name = ${t} ORDER BY index_name`;
			case "constraint":
				return `SELECT constraint_name AS name, constraint_type FROM information_schema.table_constraints WHERE table_schema = ${d} AND table_name = ${t} AND constraint_type <> 'FOREIGN KEY' ORDER BY constraint_name`;
			case "foreign-key":
				return `SELECT DISTINCT constraint_name AS name FROM information_schema.table_constraints WHERE table_schema = ${d} AND table_name = ${t} AND constraint_type = 'FOREIGN KEY' ORDER BY constraint_name`;
			case "trigger":
				return `SELECT trigger_name AS name FROM information_schema.triggers WHERE trigger_schema = ${d} AND event_object_table = ${t} ORDER BY trigger_name`;
			case "partition":
				return `SELECT partition_name AS name FROM information_schema.partitions WHERE table_schema = ${d} AND table_name = ${t} AND partition_name IS NOT NULL ORDER BY partition_name`;
		}
		return null;
	}

	return null;
}

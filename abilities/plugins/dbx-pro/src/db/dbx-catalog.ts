/**
 * dbx-pro 的数据库目录 introspection SQL — 从旧项目 database-catalog.ts 移植。
 *
 * 所有查询都是通过 dbx query 执行的只读 SQL，不需要特殊 CLI 子命令。
 * family 由 db_type 推断：
 *   "schemas"   — PostgreSQL 系（pg_*），按 schema 分层
 *   "databases" — MySQL 系，按 database 分层
 *   "flat"      — SQLite / DuckDB / ClickHouse / Redis / MongoDB ... 单库无中间层
 */

export type CatalogFamily = "schemas" | "databases" | "flat";

export type TableObjectKind = "index" | "constraint" | "foreign-key" | "trigger" | "partition";

export interface CatalogScope {
	schema?: string;
	database?: string;
}

const SCHEMA_SYSTEM = new Set(["information_schema", "pg_catalog", "pg_toast"]);
const DATABASE_SYSTEM = new Set(["information_schema", "performance_schema", "mysql", "sys"]);

/**
 * 根据 db_type 推断 catalog family：
 * - postgres / redshift  → schemas
 * - mysql / mariadb / percona → databases
 * - sqlite / duckdb / clickhouse / mongodb / redis / elasticsearch / ... → flat
 */
export function inferFamily(dbType: string): CatalogFamily {
	switch (dbType.toLowerCase()) {
		case "postgres": case "postgresql": case "psql": case "redshift":
			return "schemas";
		case "mysql": case "mariadb": case "percona":
			return "databases";
		default:
			return "flat";
	}
}

export function escapeSqlLiteral(value: string): string {
	return `'${value.replaceAll("'", "''")}'`;
}

/**
 * 列出 schemas（schemas family）——通过 information_schema.schemata
 */
export function listSchemasSql(): string {
	return "SELECT schema_name AS name FROM information_schema.schemata ORDER BY schema_name";
}

/**
 * 列出 databases（databases family）
 */
export function listDatabasesSql(): string {
	return "SELECT schema_name AS name FROM information_schema.schemata ORDER BY schema_name";
}

/**
 * 过滤系统对象
 */
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

/**
 * 列出指定 scope 下的表（information_schema.tables）
 */
export function listTablesInScopeSql(family: CatalogFamily, scope: CatalogScope): string {
	if (family === "schemas" && scope.schema) {
		const s = escapeSqlLiteral(scope.schema);
		return `SELECT table_name AS name, table_type FROM information_schema.tables WHERE table_schema = ${s} ORDER BY table_name`;
	}
	if (family === "databases" && scope.database) {
		const d = escapeSqlLiteral(scope.database);
		return `SELECT table_name AS name, table_type FROM information_schema.tables WHERE table_schema = ${d} ORDER BY table_name`;
	}
	// flat: 不限制 schema
	return "SELECT table_name AS name, table_type FROM information_schema.tables ORDER BY table_name";
}

/**
 * 表级子对象 introspection SQL（索引/约束/触发器/FK/分区）
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

	// flat: 各引擎系统表差异太大，不枚举
	return null;
}

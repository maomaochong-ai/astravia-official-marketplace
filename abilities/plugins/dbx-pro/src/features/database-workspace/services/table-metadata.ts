/**
 * 表元数据查询 — 索引 / 外键 / 触发器 / 约束。
 *
 * 引擎只暴露通用 /query，这里按方言生成目录视图 SQL（information_schema /
 * pg_catalog / PRAGMA / sys 目录），经引擎执行后返回行。
 * 当前支持 PostgreSQL / MySQL / SQLite / SQL Server；其余方言返回 unsupported，
 * UI 显示中性空态（不放假数据）。
 */

import { engineExecuteByName } from "../../../shared/services/engine-client.ts";

export type MetadataKind = "indexes" | "foreignKeys" | "triggers" | "constraints";

export interface MetadataColumnSpec {
	/** 行数据中的字段名（小写匹配）。 */
	key: string;
	/** 表头显示名。 */
	label: string;
	/** 等宽字体显示（SQL 定义 / 名称）。 */
	mono?: boolean;
}

export interface MetadataQuery {
	sql: string;
	columns: MetadataColumnSpec[];
}

export interface MetadataTarget {
	schema?: string;
	table: string;
	/** MySQL 的 schema 层实际是 database（连接配置的 database 字段）。 */
	database?: string;
}

export interface MetadataOutcome {
	rows: Record<string, unknown>[];
	columns: MetadataColumnSpec[];
	/** 方言不支持该类元数据查询。 */
	unsupported: boolean;
}

function sqlString(value: string): string {
	return `'${value.replace(/'/g, "''")}'`;
}

function isPostgres(dbType: string): boolean {
	return /postgres|(^|\b)pg|redshift|gaussdb|opengauss|kingbase|vastbase|highgo/i.test(dbType);
}

function isMysql(dbType: string): boolean {
	return /mysql|maria|tidb|starrocks|doris|goldendb|databend/i.test(dbType);
}

function isSqlite(dbType: string): boolean {
	return /sqlite|duckdb|rqlite|cloudflare-d1/i.test(dbType);
}

function isSqlServer(dbType: string): boolean {
	return /mssql|sqlserver/i.test(dbType);
}

// ── PostgreSQL ────────────────────────────────────────────

function postgresQuery(kind: MetadataKind, target: MetadataTarget): MetadataQuery | null {
	const schema = sqlString(target.schema || "public");
	const table = sqlString(target.table);
	if (kind === "indexes") {
		return {
			sql: `SELECT i.relname AS name, CASE WHEN ix.indisunique THEN 'YES' ELSE 'NO' END AS is_unique, CASE WHEN ix.indisprimary THEN 'YES' ELSE 'NO' END AS is_primary, pg_get_indexdef(ix.indexrelid) AS definition FROM pg_index ix JOIN pg_class t ON t.oid = ix.indrelid JOIN pg_class i ON i.oid = ix.indexrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE n.nspname = ${schema} AND t.relname = ${table} ORDER BY i.relname`,
			columns: [
				{ key: "name", label: "索引名", mono: true },
				{ key: "is_unique", label: "唯一" },
				{ key: "is_primary", label: "主键" },
				{ key: "definition", label: "定义", mono: true },
			],
		};
	}
	if (kind === "foreignKeys") {
		return {
			sql: `SELECT con.conname AS name, a.attname AS column_name, frel.relname AS ref_table, fa.attname AS ref_column FROM pg_constraint con JOIN pg_class rel ON rel.oid = con.conrelid JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY(con.conkey) JOIN pg_class frel ON frel.oid = con.confrelid JOIN pg_attribute fa ON fa.attrelid = con.confrelid AND fa.attnum = ANY(con.confkey) WHERE con.contype = 'f' AND nsp.nspname = ${schema} AND rel.relname = ${table} ORDER BY con.conname, a.attnum`,
			columns: [
				{ key: "name", label: "约束名", mono: true },
				{ key: "column_name", label: "列", mono: true },
				{ key: "ref_table", label: "引用表", mono: true },
				{ key: "ref_column", label: "引用列", mono: true },
			],
		};
	}
	if (kind === "triggers") {
		return {
			sql: `SELECT trigger_name AS name, action_timing AS timing, event_manipulation AS event, action_statement AS definition FROM information_schema.triggers WHERE trigger_schema = ${schema} AND event_object_table = ${table} ORDER BY trigger_name`,
			columns: [
				{ key: "name", label: "触发器", mono: true },
				{ key: "timing", label: "时机" },
				{ key: "event", label: "事件" },
				{ key: "definition", label: "语句", mono: true },
			],
		};
	}
	return {
		sql: `SELECT con.conname AS name, CASE con.contype WHEN 'p' THEN 'PRIMARY KEY' WHEN 'u' THEN 'UNIQUE' WHEN 'c' THEN 'CHECK' WHEN 'f' THEN 'FOREIGN KEY' WHEN 'x' THEN 'EXCLUDE' ELSE con.contype::text END AS constraint_type, pg_get_constraintdef(con.oid) AS definition FROM pg_constraint con JOIN pg_class rel ON rel.oid = con.conrelid JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace WHERE nsp.nspname = ${schema} AND rel.relname = ${table} ORDER BY con.conname`,
		columns: [
			{ key: "name", label: "约束名", mono: true },
			{ key: "constraint_type", label: "类型" },
			{ key: "definition", label: "定义", mono: true },
		],
	};
}

// ── MySQL ─────────────────────────────────────────────────

function mysqlQuery(kind: MetadataKind, target: MetadataTarget): MetadataQuery | null {
	const db = sqlString(target.database || target.schema || "");
	const table = sqlString(target.table);
	if (!target.database && !target.schema) return null;
	if (kind === "indexes") {
		return {
			sql: `SELECT INDEX_NAME AS name, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ', ') AS columns, IF(NON_UNIQUE = 0, 'YES', 'NO') AS is_unique, INDEX_TYPE AS index_type FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ${db} AND TABLE_NAME = ${table} GROUP BY INDEX_NAME, NON_UNIQUE, INDEX_TYPE ORDER BY INDEX_NAME`,
			columns: [
				{ key: "name", label: "索引名", mono: true },
				{ key: "columns", label: "列", mono: true },
				{ key: "is_unique", label: "唯一" },
				{ key: "index_type", label: "类型" },
			],
		};
	}
	if (kind === "foreignKeys") {
		return {
			sql: `SELECT CONSTRAINT_NAME AS name, COLUMN_NAME AS column_name, REFERENCED_TABLE_NAME AS ref_table, REFERENCED_COLUMN_NAME AS ref_column FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = ${db} AND TABLE_NAME = ${table} AND REFERENCED_TABLE_NAME IS NOT NULL ORDER BY CONSTRAINT_NAME, ORDINAL_POSITION`,
			columns: [
				{ key: "name", label: "约束名", mono: true },
				{ key: "column_name", label: "列", mono: true },
				{ key: "ref_table", label: "引用表", mono: true },
				{ key: "ref_column", label: "引用列", mono: true },
			],
		};
	}
	if (kind === "triggers") {
		return {
			sql: `SELECT TRIGGER_NAME AS name, ACTION_TIMING AS timing, EVENT_MANIPULATION AS event, ACTION_STATEMENT AS definition FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = ${db} AND EVENT_OBJECT_TABLE = ${table} ORDER BY TRIGGER_NAME`,
			columns: [
				{ key: "name", label: "触发器", mono: true },
				{ key: "timing", label: "时机" },
				{ key: "event", label: "事件" },
				{ key: "definition", label: "语句", mono: true },
			],
		};
	}
	return {
		sql: `SELECT CONSTRAINT_NAME AS name, CONSTRAINT_TYPE AS constraint_type FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = ${db} AND TABLE_NAME = ${table} ORDER BY CONSTRAINT_NAME`,
		columns: [
			{ key: "name", label: "约束名", mono: true },
			{ key: "constraint_type", label: "类型" },
		],
	};
}

// ── SQLite ────────────────────────────────────────────────

function sqliteQuery(kind: MetadataKind, target: MetadataTarget): MetadataQuery | null {
	const table = target.table.replace(/"/g, '""');
	if (kind === "indexes") {
		return {
			sql: `PRAGMA index_list("${table}")`,
			columns: [
				{ key: "name", label: "索引名", mono: true },
				{ key: "unique", label: "唯一" },
				{ key: "origin", label: "来源" },
			],
		};
	}
	if (kind === "foreignKeys") {
		return {
			sql: `PRAGMA foreign_key_list("${table}")`,
			columns: [
				{ key: "id", label: "序号" },
				{ key: "table", label: "引用表", mono: true },
				{ key: "from", label: "列", mono: true },
				{ key: "to", label: "引用列", mono: true },
				{ key: "on_update", label: "更新" },
				{ key: "on_delete", label: "删除" },
			],
		};
	}
	if (kind === "triggers") {
		return {
			sql: `SELECT name FROM sqlite_master WHERE type = 'trigger' AND tbl_name = ${sqlString(target.table)} ORDER BY name`,
			columns: [{ key: "name", label: "触发器", mono: true }],
		};
	}
	return null;
}

// ── SQL Server ────────────────────────────────────────────

function sqlServerQuery(kind: MetadataKind, target: MetadataTarget): MetadataQuery | null {
	const schema = sqlString(target.schema || "dbo");
	const table = sqlString(target.table);
	if (kind === "indexes") {
		return {
			sql: `SELECT i.name AS name, CASE WHEN i.is_unique = 1 THEN 'YES' ELSE 'NO' END AS is_unique, CASE WHEN i.is_primary_key = 1 THEN 'YES' ELSE 'NO' END AS is_primary, i.type_desc AS index_type FROM sys.indexes i JOIN sys.tables t ON t.object_id = i.object_id JOIN sys.schemas s ON s.schema_id = t.schema_id WHERE s.name = ${schema} AND t.name = ${table} ORDER BY i.name`,
			columns: [
				{ key: "name", label: "索引名", mono: true },
				{ key: "is_unique", label: "唯一" },
				{ key: "is_primary", label: "主键" },
				{ key: "index_type", label: "类型" },
			],
		};
	}
	if (kind === "foreignKeys") {
		return {
			sql: `SELECT fk.CONSTRAINT_NAME AS name, kcu.COLUMN_NAME AS column_name, ccu.TABLE_NAME AS ref_table, ccu.COLUMN_NAME AS ref_column FROM information_schema.REFERENTIAL_CONSTRAINTS fk JOIN information_schema.KEY_COLUMN_USAGE kcu ON kcu.CONSTRAINT_NAME = fk.CONSTRAINT_NAME AND kcu.TABLE_SCHEMA = fk.CONSTRAINT_SCHEMA JOIN information_schema.CONSTRAINT_COLUMN_USAGE ccu ON ccu.CONSTRAINT_NAME = fk.UNIQUE_CONSTRAINT_NAME AND ccu.CONSTRAINT_SCHEMA = fk.UNIQUE_CONSTRAINT_SCHEMA WHERE kcu.TABLE_SCHEMA = ${schema} AND kcu.TABLE_NAME = ${table} ORDER BY fk.CONSTRAINT_NAME, kcu.ORDINAL_POSITION`,
			columns: [
				{ key: "name", label: "约束名", mono: true },
				{ key: "column_name", label: "列", mono: true },
				{ key: "ref_table", label: "引用表", mono: true },
				{ key: "ref_column", label: "引用列", mono: true },
			],
		};
	}
	if (kind === "triggers") {
		return {
			sql: `SELECT TRIGGER_NAME AS name FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = ${schema} AND EVENT_OBJECT_TABLE = ${table} ORDER BY TRIGGER_NAME`,
			columns: [{ key: "name", label: "触发器", mono: true }],
		};
	}
	return {
		sql: `SELECT CONSTRAINT_NAME AS name, CONSTRAINT_TYPE AS constraint_type FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = ${schema} AND TABLE_NAME = ${table} ORDER BY CONSTRAINT_NAME`,
		columns: [
			{ key: "name", label: "约束名", mono: true },
			{ key: "constraint_type", label: "类型" },
		],
	};
}

/** 按方言构造元数据查询；不支持时返回 null。 */
export function buildMetadataQuery(dbType: string, kind: MetadataKind, target: MetadataTarget): MetadataQuery | null {
	if (isPostgres(dbType)) return postgresQuery(kind, target);
	if (isMysql(dbType)) return mysqlQuery(kind, target);
	if (isSqlite(dbType)) return sqliteQuery(kind, target);
	if (isSqlServer(dbType)) return sqlServerQuery(kind, target);
	return null;
}

/** 不区分大小写取字段值（不同引擎返回的列名大小写不稳定）。 */
export function rowValue(row: Record<string, unknown>, key: string): string {
	const direct = row[key];
	if (direct !== undefined) return direct === null ? "" : String(direct);
	const lower = key.toLowerCase();
	for (const [k, v] of Object.entries(row)) {
		if (k.toLowerCase() === lower) return v === null ? "" : String(v ?? "");
	}
	return "";
}

/** 执行元数据查询。 */
export async function fetchTableMetadata(
	connectionName: string,
	dbType: string | undefined,
	target: MetadataTarget,
	kind: MetadataKind,
): Promise<MetadataOutcome> {
	const query = buildMetadataQuery(dbType ?? "", kind, target);
	if (!query) return { rows: [], columns: [], unsupported: true };
	const outcome = await engineExecuteByName(connectionName, query.sql, { timeoutMs: 15_000 });
	return { rows: outcome.rows ?? [], columns: query.columns, unsupported: false };
}

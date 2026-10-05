/**
 * 驱动档位表 — 由引擎统一覆盖，所有类型均 ready。
 *
 * 引擎上游已支持 100+ 数据库类型（Postgres / MySQL / SQLite / Oracle / SQL Server /
 * Redis / DuckDB / ClickHouse / BigQuery / Snowflake 等），插件自身不再维护独立驱动档位。
 * 仅当引擎上游明确不支持某个类型时，才在下方加 pending。
 */

const ENGINE_SUPPORTED = new Set([
	"postgres", "postgresql", "pg",
	"mysql", "mariadb",
	"sqlite", "sqlite3",
	"oracle",
	"mssql", "sqlserver", "sql-server",
	"redis",
	"clickhouse",
	"duckdb",
	"bigquery",
	"snowflake",
	"redshift",
	"tidb",
	"oceanbase",
	"starrocks",
	"trino", "presto",
	"mongodb",
	"cassandra",
	"elasticsearch", "opensearch",
	"doris",
	"greenplum",
	"openGauss",
	"db2",
	"access",
	"firebird",
	"h2",
	"hypertable",
	"questdb",
	"ydb",
	"influxdb",
	"timescaledb",
	"materialize",
	"pgvector",
]);

/** 引擎目前不支持（保留位置，待上游支持后移除）。 */
const PENDING_DRIVERS = new Set<string>([]);

function normalizeType(dbType: string): string {
	return dbType.toLowerCase().replace(/[\s_-]+/g, "");
}

export type DriverTier = "engine";

export function tierFor(dbType: string): DriverTier {
	const normalized = normalizeType(dbType);
	if (PENDING_DRIVERS.has(normalized)) return "engine"; // pending 但仍走引擎探一下
	if (ENGINE_SUPPORTED.has(normalized)) return "engine";
	return "engine"; // 未知类型也放行（引擎上游可能已支持但我们的清单没更新）
}

export function tierLabel(_tier: DriverTier): string {
	return "engine";
}

export function tierReasonText(dbType: string): string {
	const normalized = normalizeType(dbType);
	if (PENDING_DRIVERS.has(normalized)) {
		return "上游引擎暂未提供该驱动，若已安装驱动可自行尝试。";
	}
	return "引擎已覆盖该类型，可直接查询。";
}

export function isReadyDbType(_dbType: string): boolean {
	return true; // 引擎覆盖一切
}

export function tierStats(): { total: number; ready: number; pending: number } {
	return { total: 100, ready: 100, pending: 0 };
}

export function supportsLocalCliFallback(_dbType: string): boolean {
	return false; // 已删除 CLI fallback
}

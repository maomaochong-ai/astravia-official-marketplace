/** dbx-pro 的类型定义 */

export type DbType =
	| "postgres" | "mysql" | "sqlite" | "redshift" | "clickhouse"
	| "sqlserver" | "mongodb" | "oracle" | "duckdb" | "redis"
	| "elasticsearch" | "snowflake" | "trino" | "prestosql" | "hive"
	| "doris" | "starrocks" | "databend" | "cloudflare-d1" | "rqlite"
	| "qdrant" | "milvus" | "weaviate" | "chromadb" | "influxdb"
	| "questdb" | "tdengine" | "neo4j" | "cassandra" | "bigquery"
	| "manticoresearch" | "kingbase" | "dameng" | "highgo" | "vastbase"
	| "gaussdb" | "oceanbase-oracle" | "opengauss" | "access" | "h2"
	| "firebird" | "exasol" | "vertica" | "teradata" | "saphana"
	| "db2" | "informix" | "iris" | "iotdb" | "zookeeper"
	| "etcd" | "kylin" | "sundb" | "oscar" | "xugu" | "gbase" | "jdbc" | "mq"
	| string;

/** dbx ConnectionConfig 的完整字段（和 Rust 侧完全对齐，但全部可选） */
export interface DbConnection {
	id: string;
	name: string;
	db_type: DbType;
	host: string;
	port: number;
	username: string;
	password: string;
	database?: string;
	note?: string;
	color?: string;
	ssl?: boolean;
	is_production?: boolean;
	read_only?: boolean;
	connect_timeout_secs?: number;
	query_timeout_secs?: number;
	url_params?: string;
	connection_string?: string;
	[key: string]: unknown; // dbx 其他可选字段
}

export interface DbColumn {
	name: string;
	data_type: string;
	is_nullable: boolean;
	is_primary_key: boolean;
	column_default?: string | null;
	comment?: string | null;
}

export interface DbTableInfo {
	name: string;
	table_type: string; // "table" | "view" | "materialized_view" | ...
}

export interface DbQueryResult {
	connection: string;
	columns: string[];
	rows: Record<string, unknown>[];
	row_count: number;
}

export type RunState =
	| { kind: "idle" }
	| { kind: "running" }
	| { kind: "result"; data: DbQueryResult; elapsedMs: number; allowWrites: boolean }
	| { kind: "error"; message: string; code?: string };

/** SQL 写保护安全闸 */
export interface WriteGuard {
	allowWrites: boolean;
	allowDangerous: boolean; // DDL（DROP/ALTER/TRUNCATE）
}

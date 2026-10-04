/**
 * 数据库连接配置模型。
 *
 * 类型字段完整对齐 dbx 引擎的 `ConnectionConfig` 序列化形态（Rust serde rename_all = camelCase）。
 * 84 种受支持数据库的清单从 dbx 引擎内置 manifest 提取，字段含默认端口、family 分类和能力标记。
 */

export type DbType = string;

export type CatalogFamily = "schemas" | "databases" | "flat";

export interface DbTypeManifestEntry {
	dbType: DbType;
	label: string;
	dialect: string;
	defaultPort: number;
	runtimeMode: "native" | "bridge" | string;
	mcpMode: "direct" | "bridge" | string;
	schemaAware: boolean;
	treeSchema: boolean;
	tableDataEdit: boolean;
	sqlExplain: boolean;
	family: CatalogFamily;
	order: number;
}

/**
 * 完整数据库类型 manifest（84 种）。顺序按 dbx 引擎 order 字段，
 * 同一 order 内按 label 字母序。
 */
export const DB_TYPE_MANIFEST: DbTypeManifestEntry[] = [
	{ dbType: "mysql", label: "MySQL", dialect: "MySQL", defaultPort: 3306, runtimeMode: "native", mcpMode: "direct", schemaAware: false, treeSchema: false, tableDataEdit: true, sqlExplain: true, family: "schemas", order: 10 },
	{ dbType: "mariadb", label: "MariaDB", dialect: "MariaDB", defaultPort: 3306, runtimeMode: "native", mcpMode: "direct", schemaAware: false, treeSchema: false, tableDataEdit: true, sqlExplain: true, family: "schemas", order: 11 },
	{ dbType: "postgres", label: "PostgreSQL", dialect: "PostgreSQL", defaultPort: 5432, runtimeMode: "native", mcpMode: "direct", schemaAware: true, treeSchema: true, tableDataEdit: true, sqlExplain: true, family: "schemas", order: 20 },
	{ dbType: "redshift", label: "Amazon Redshift", dialect: "Redshift", defaultPort: 5439, runtimeMode: "native", mcpMode: "direct", schemaAware: true, treeSchema: true, tableDataEdit: true, sqlExplain: true, family: "schemas", order: 21 },
	{ dbType: "aurora-postgresql", label: "Amazon Aurora PostgreSQL", dialect: "PostgreSQL", defaultPort: 5432, runtimeMode: "native", mcpMode: "direct", schemaAware: true, treeSchema: true, tableDataEdit: true, sqlExplain: true, family: "schemas", order: 22 },
	{ dbType: "sqlite", label: "SQLite", dialect: "SQLite", defaultPort: 0, runtimeMode: "native", mcpMode: "direct", schemaAware: false, treeSchema: false, tableDataEdit: true, sqlExplain: false, family: "flat", order: 30 },
	{ dbType: "cloudflare-d1", label: "Cloudflare D1", dialect: "SQLite", defaultPort: 0, runtimeMode: "native", mcpMode: "direct", schemaAware: false, treeSchema: false, tableDataEdit: false, sqlExplain: false, family: "flat", order: 31 },
	{ dbType: "duckdb", label: "DuckDB", dialect: "DuckDB", defaultPort: 0, runtimeMode: "native", mcpMode: "direct", schemaAware: true, treeSchema: false, tableDataEdit: true, sqlExplain: true, family: "flat", order: 32 },
	{ dbType: "rqlite", label: "RQLite", dialect: "SQLite", defaultPort: 4001, runtimeMode: "native", mcpMode: "direct", schemaAware: false, treeSchema: false, tableDataEdit: true, sqlExplain: false, family: "flat", order: 33 },
	{ dbType: "sqlserver", label: "SQL Server", dialect: "SQLServer", defaultPort: 1433, runtimeMode: "native", mcpMode: "direct", schemaAware: true, treeSchema: false, tableDataEdit: true, sqlExplain: true, family: "schemas", order: 40 },
	{ dbType: "clickhouse", label: "ClickHouse", dialect: "ClickHouse", defaultPort: 8123, runtimeMode: "native", mcpMode: "direct", schemaAware: true, treeSchema: false, tableDataEdit: true, sqlExplain: true, family: "flat", order: 50 },
	{ dbType: "mongodb", label: "MongoDB", dialect: "MongoDB", defaultPort: 27017, runtimeMode: "bridge", mcpMode: "bridge", schemaAware: false, treeSchema: false, tableDataEdit: false, sqlExplain: false, family: "flat", order: 60 },
	{ dbType: "redis", label: "Redis", dialect: "Redis", defaultPort: 6379, runtimeMode: "native", mcpMode: "direct", schemaAware: false, treeSchema: false, tableDataEdit: false, sqlExplain: false, family: "flat", order: 70 },
	{ dbType: "elasticsearch", label: "Elasticsearch", dialect: "Elasticsearch", defaultPort: 9200, runtimeMode: "bridge", mcpMode: "bridge", schemaAware: false, treeSchema: false, tableDataEdit: false, sqlExplain: false, family: "flat", order: 80 },
	{ dbType: "snowflake", label: "Snowflake", dialect: "Snowflake", defaultPort: 443, runtimeMode: "bridge", mcpMode: "bridge", schemaAware: true, treeSchema: true, tableDataEdit: true, sqlExplain: true, family: "schemas", order: 90 },
	{ dbType: "oracle", label: "Oracle", dialect: "Oracle", defaultPort: 1521, runtimeMode: "native", mcpMode: "direct", schemaAware: true, treeSchema: false, tableDataEdit: true, sqlExplain: true, family: "schemas", order: 100 },
	{ dbType: "trino", label: "Trino", dialect: "Trino", defaultPort: 8080, runtimeMode: "native", mcpMode: "direct", schemaAware: true, treeSchema: true, tableDataEdit: false, sqlExplain: true, family: "schemas", order: 110 },
	{ dbType: "prestosql", label: "PrestoSQL", dialect: "PrestoSQL", defaultPort: 8080, runtimeMode: "native", mcpMode: "direct", schemaAware: true, treeSchema: true, tableDataEdit: false, sqlExplain: true, family: "schemas", order: 111 },
	{ dbType: "hive", label: "Apache Hive", dialect: "Hive", defaultPort: 10000, runtimeMode: "bridge", mcpMode: "bridge", schemaAware: true, treeSchema: true, tableDataEdit: false, sqlExplain: true, family: "schemas", order: 120 },
	{ dbType: "spark", label: "Apache Spark", dialect: "Spark", defaultPort: 10000, runtimeMode: "bridge", mcpMode: "bridge", schemaAware: true, treeSchema: true, tableDataEdit: false, sqlExplain: true, family: "schemas", order: 121 },
	{ dbType: "doris", label: "Apache Doris", dialect: "Doris", defaultPort: 9030, runtimeMode: "native", mcpMode: "direct", schemaAware: true, treeSchema: false, tableDataEdit: true, sqlExplain: true, family: "schemas", order: 130 },
	{ dbType: "starrocks", label: "StarRocks", dialect: "StarRocks", defaultPort: 9030, runtimeMode: "native", mcpMode: "direct", schemaAware: true, treeSchema: false, tableDataEdit: true, sqlExplain: true, family: "schemas", order: 131 },
	{ dbType: "databend", label: "Databend", dialect: "Databend", defaultPort: 8000, runtimeMode: "native", mcpMode: "direct", schemaAware: true, treeSchema: false, tableDataEdit: true, sqlExplain: true, family: "schemas", order: 132 },
	{ dbType: "influxdb", label: "InfluxDB", dialect: "InfluxDB", defaultPort: 8086, runtimeMode: "bridge", mcpMode: "bridge", schemaAware: false, treeSchema: false, tableDataEdit: false, sqlExplain: false, family: "flat", order: 140 },
	{ dbType: "neo4j", label: "Neo4j", dialect: "Neo4j", defaultPort: 7687, runtimeMode: "bridge", mcpMode: "bridge", schemaAware: false, treeSchema: false, tableDataEdit: false, sqlExplain: false, family: "flat", order: 150 },
	{ dbType: "qdrant", label: "Qdrant", dialect: "Qdrant", defaultPort: 6333, runtimeMode: "bridge", mcpMode: "bridge", schemaAware: false, treeSchema: false, tableDataEdit: false, sqlExplain: false, family: "flat", order: 160 },
	{ dbType: "milvus", label: "Milvus", dialect: "Milvus", defaultPort: 19530, runtimeMode: "bridge", mcpMode: "bridge", schemaAware: false, treeSchema: false, tableDataEdit: false, sqlExplain: false, family: "flat", order: 161 },
	{ dbType: "weaviate", label: "Weaviate", dialect: "Weaviate", defaultPort: 8080, runtimeMode: "bridge", mcpMode: "bridge", schemaAware: false, treeSchema: false, tableDataEdit: false, sqlExplain: false, family: "flat", order: 162 },
	{ dbType: "chromadb", label: "ChromaDB", dialect: "ChromaDB", defaultPort: 8000, runtimeMode: "bridge", mcpMode: "bridge", schemaAware: false, treeSchema: false, tableDataEdit: false, sqlExplain: false, family: "flat", order: 163 },
	{ dbType: "manticoresearch", label: "ManticoreSearch", dialect: "ManticoreSearch", defaultPort: 9312, runtimeMode: "native", mcpMode: "direct", schemaAware: false, treeSchema: false, tableDataEdit: true, sqlExplain: false, family: "flat", order: 170 },
	{ dbType: "kingbase", label: "KingbaseES", dialect: "PostgreSQL", defaultPort: 54321, runtimeMode: "native", mcpMode: "direct", schemaAware: true, treeSchema: true, tableDataEdit: true, sqlExplain: true, family: "schemas", order: 180 },
	{ dbType: "dameng", label: "Dameng", dialect: "Oracle", defaultPort: 5236, runtimeMode: "native", mcpMode: "direct", schemaAware: true, treeSchema: false, tableDataEdit: true, sqlExplain: true, family: "schemas", order: 181 },
	{ dbType: "highgo", label: "HighGo", dialect: "PostgreSQL", defaultPort: 5866, runtimeMode: "native", mcpMode: "direct", schemaAware: true, treeSchema: true, tableDataEdit: true, sqlExplain: true, family: "schemas", order: 182 },
	{ dbType: "vastbase", label: "Vastbase", dialect: "PostgreSQL", defaultPort: 5432, runtimeMode: "native", mcpMode: "direct", schemaAware: true, treeSchema: true, tableDataEdit: true, sqlExplain: true, family: "schemas", order: 183 },
	{ dbType: "gaussdb", label: "GaussDB", dialect: "PostgreSQL", defaultPort: 5432, runtimeMode: "native", mcpMode: "direct", schemaAware: true, treeSchema: true, tableDataEdit: true, sqlExplain: true, family: "schemas", order: 184 },
	{ dbType: "opengauss", label: "openGauss", dialect: "PostgreSQL", defaultPort: 5432, runtimeMode: "native", mcpMode: "direct", schemaAware: true, treeSchema: true, tableDataEdit: true, sqlExplain: true, family: "schemas", order: 185 },
	{ dbType: "oceanbase-oracle", label: "OceanBase Oracle", dialect: "Oracle", defaultPort: 2883, runtimeMode: "native", mcpMode: "direct", schemaAware: true, treeSchema: false, tableDataEdit: true, sqlExplain: true, family: "schemas", order: 186 },
	{ dbType: "access", label: "Microsoft Access", dialect: "Access", defaultPort: 0, runtimeMode: "native", mcpMode: "direct", schemaAware: false, treeSchema: false, tableDataEdit: true, sqlExplain: false, family: "flat", order: 200 },
	{ dbType: "h2", label: "H2", dialect: "H2", defaultPort: 9092, runtimeMode: "native", mcpMode: "direct", schemaAware: true, treeSchema: false, tableDataEdit: true, sqlExplain: true, family: "schemas", order: 201 },
	{ dbType: "firebird", label: "Firebird", dialect: "Firebird", defaultPort: 3050, runtimeMode: "native", mcpMode: "direct", schemaAware: true, treeSchema: false, tableDataEdit: true, sqlExplain: true, family: "schemas", order: 202 },
	{ dbType: "exasol", label: "Exasol", dialect: "Exasol", defaultPort: 8563, runtimeMode: "native", mcpMode: "direct", schemaAware: true, treeSchema: false, tableDataEdit: true, sqlExplain: true, family: "schemas", order: 203 },
	{ dbType: "vertica", label: "Vertica", dialect: "Vertica", defaultPort: 5433, runtimeMode: "native", mcpMode: "direct", schemaAware: true, treeSchema: false, tableDataEdit: true, sqlExplain: true, family: "schemas", order: 204 },
	{ dbType: "saphana", label: "SAP HANA", dialect: "HANA", defaultPort: 30015, runtimeMode: "native", mcpMode: "direct", schemaAware: true, treeSchema: false, tableDataEdit: true, sqlExplain: true, family: "schemas", order: 205 },
	{ dbType: "teradata", label: "Teradata", dialect: "Teradata", defaultPort: 1025, runtimeMode: "native", mcpMode: "direct", schemaAware: true, treeSchema: true, tableDataEdit: true, sqlExplain: true, family: "schemas", order: 206 },
	{ dbType: "db2", label: "IBM DB2", dialect: "DB2", defaultPort: 50000, runtimeMode: "native", mcpMode: "direct", schemaAware: true, treeSchema: false, tableDataEdit: true, sqlExplain: true, family: "schemas", order: 207 },
	{ dbType: "informix", label: "Informix", dialect: "Informix", defaultPort: 9088, runtimeMode: "native", mcpMode: "direct", schemaAware: true, treeSchema: false, tableDataEdit: true, sqlExplain: true, family: "schemas", order: 208 },
	{ dbType: "bigquery", label: "Google BigQuery", dialect: "BigQuery", defaultPort: 443, runtimeMode: "bridge", mcpMode: "bridge", schemaAware: true, treeSchema: true, tableDataEdit: false, sqlExplain: true, family: "schemas", order: 210 },
	{ dbType: "cassandra", label: "Apache Cassandra", dialect: "Cassandra", defaultPort: 9042, runtimeMode: "bridge", mcpMode: "bridge", schemaAware: true, treeSchema: false, tableDataEdit: false, sqlExplain: false, family: "schemas", order: 220 },
	{ dbType: "kylin", label: "Apache Kylin", dialect: "Kylin", defaultPort: 7070, runtimeMode: "bridge", mcpMode: "bridge", schemaAware: true, treeSchema: false, tableDataEdit: false, sqlExplain: false, family: "schemas", order: 221 },
	{ dbType: "sundb", label: "SunDB", dialect: "MySQL", defaultPort: 3306, runtimeMode: "native", mcpMode: "direct", schemaAware: false, treeSchema: false, tableDataEdit: true, sqlExplain: true, family: "schemas", order: 230 },
	{ dbType: "oscar", label: "OSCAR", dialect: "PostgreSQL", defaultPort: 5432, runtimeMode: "native", mcpMode: "direct", schemaAware: true, treeSchema: true, tableDataEdit: true, sqlExplain: true, family: "schemas", order: 231 },
	{ dbType: "xugu", label: "Xugu", dialect: "PostgreSQL", defaultPort: 5131, runtimeMode: "native", mcpMode: "direct", schemaAware: true, treeSchema: true, tableDataEdit: true, sqlExplain: true, family: "schemas", order: 232 },
	{ dbType: "iotdb", label: "Apache IoTDB", dialect: "IoTDB", defaultPort: 6667, runtimeMode: "bridge", mcpMode: "bridge", schemaAware: false, treeSchema: false, tableDataEdit: false, sqlExplain: false, family: "flat", order: 240 },
	{ dbType: "etcd", label: "etcd", dialect: "etcd", defaultPort: 2379, runtimeMode: "bridge", mcpMode: "bridge", schemaAware: false, treeSchema: false, tableDataEdit: false, sqlExplain: false, family: "flat", order: 250 },
	{ dbType: "zookeeper", label: "ZooKeeper", dialect: "ZooKeeper", defaultPort: 2181, runtimeMode: "bridge", mcpMode: "bridge", schemaAware: false, treeSchema: false, tableDataEdit: false, sqlExplain: false, family: "flat", order: 251 },
	{ dbType: "nacos", label: "Nacos", dialect: "Nacos", defaultPort: 8848, runtimeMode: "bridge", mcpMode: "bridge", schemaAware: false, treeSchema: false, tableDataEdit: false, sqlExplain: false, family: "flat", order: 252 },
	{ dbType: "iris", label: "InterSystems IRIS", dialect: "IRIS", defaultPort: 52773, runtimeMode: "native", mcpMode: "direct", schemaAware: true, treeSchema: false, tableDataEdit: true, sqlExplain: true, family: "schemas", order: 260 },
	{ dbType: "turso", label: "Turso", dialect: "SQLite", defaultPort: 443, runtimeMode: "bridge", mcpMode: "bridge", schemaAware: false, treeSchema: false, tableDataEdit: false, sqlExplain: false, family: "flat", order: 270 },
	{ dbType: "influxdb3", label: "InfluxDB 3", dialect: "InfluxDB", defaultPort: 8086, runtimeMode: "bridge", mcpMode: "bridge", schemaAware: false, treeSchema: false, tableDataEdit: false, sqlExplain: false, family: "flat", order: 271 },
	{ dbType: "questdb", label: "QuestDB", dialect: "QuestDB", defaultPort: 8812, runtimeMode: "native", mcpMode: "direct", schemaAware: false, treeSchema: false, tableDataEdit: true, sqlExplain: true, family: "flat", order: 272 },
	{ dbType: "nebula", label: "NebulaGraph", dialect: "NebulaGraph", defaultPort: 9669, runtimeMode: "bridge", mcpMode: "bridge", schemaAware: false, treeSchema: false, tableDataEdit: false, sqlExplain: false, family: "flat", order: 281 },
	{ dbType: "meilisearch", label: "Meilisearch", dialect: "Meilisearch", defaultPort: 7700, runtimeMode: "bridge", mcpMode: "bridge", schemaAware: false, treeSchema: false, tableDataEdit: false, sqlExplain: false, family: "flat", order: 290 },
	{ dbType: "solr", label: "Apache Solr", dialect: "Solr", defaultPort: 8983, runtimeMode: "bridge", mcpMode: "bridge", schemaAware: false, treeSchema: false, tableDataEdit: false, sqlExplain: false, family: "flat", order: 291 },
	{ dbType: "easysearch", label: "Easysearch", dialect: "Elasticsearch", defaultPort: 9200, runtimeMode: "bridge", mcpMode: "bridge", schemaAware: false, treeSchema: false, tableDataEdit: false, sqlExplain: false, family: "flat", order: 292 },
	{ dbType: "mq", label: "Apache RocketMQ", dialect: "RocketMQ", defaultPort: 9876, runtimeMode: "bridge", mcpMode: "bridge", schemaAware: false, treeSchema: false, tableDataEdit: false, sqlExplain: false, family: "flat", order: 300 },
	{ dbType: "mqtt", label: "MQTT Broker", dialect: "MQTT", defaultPort: 1883, runtimeMode: "bridge", mcpMode: "bridge", schemaAware: false, treeSchema: false, tableDataEdit: false, sqlExplain: false, family: "flat", order: 301 },
	{ dbType: "hbase", label: "Apache HBase", dialect: "HBase", defaultPort: 16010, runtimeMode: "bridge", mcpMode: "bridge", schemaAware: false, treeSchema: false, tableDataEdit: false, sqlExplain: false, family: "flat", order: 310 },
	{ dbType: "ignite", label: "Apache Ignite", dialect: "Ignite", defaultPort: 10800, runtimeMode: "bridge", mcpMode: "bridge", schemaAware: true, treeSchema: false, tableDataEdit: false, sqlExplain: false, family: "schemas", order: 320 },
	{ dbType: "ignite3", label: "Apache Ignite 3", dialect: "Ignite", defaultPort: 10800, runtimeMode: "bridge", mcpMode: "bridge", schemaAware: true, treeSchema: false, tableDataEdit: false, sqlExplain: false, family: "schemas", order: 321 },
	{ dbType: "impala", label: "Apache Impala", dialect: "Impala", defaultPort: 21050, runtimeMode: "bridge", mcpMode: "bridge", schemaAware: true, treeSchema: false, tableDataEdit: false, sqlExplain: true, family: "schemas", order: 322 },
	{ dbType: "kyuubi", label: "Apache Kyuubi", dialect: "Hive", defaultPort: 10009, runtimeMode: "bridge", mcpMode: "bridge", schemaAware: true, treeSchema: false, tableDataEdit: false, sqlExplain: true, family: "schemas", order: 323 },
	{ dbType: "dynamodb", label: "Amazon DynamoDB", dialect: "DynamoDB", defaultPort: 443, runtimeMode: "bridge", mcpMode: "bridge", schemaAware: false, treeSchema: false, tableDataEdit: false, sqlExplain: false, family: "flat", order: 330 },
	{ dbType: "salesforce", label: "Salesforce", dialect: "Salesforce", defaultPort: 443, runtimeMode: "bridge", mcpMode: "bridge", schemaAware: false, treeSchema: false, tableDataEdit: false, sqlExplain: false, family: "flat", order: 331 },
	{ dbType: "databricks", label: "Databricks", dialect: "Databricks", defaultPort: 443, runtimeMode: "bridge", mcpMode: "bridge", schemaAware: true, treeSchema: true, tableDataEdit: false, sqlExplain: true, family: "schemas", order: 332 },
	{ dbType: "spanner", label: "Google Cloud Spanner", dialect: "Spanner", defaultPort: 443, runtimeMode: "bridge", mcpMode: "bridge", schemaAware: true, treeSchema: false, tableDataEdit: false, sqlExplain: true, family: "schemas", order: 333 },
	{ dbType: "victoriametrics", label: "VictoriaMetrics", dialect: "VictoriaMetrics", defaultPort: 8428, runtimeMode: "bridge", mcpMode: "bridge", schemaAware: false, treeSchema: false, tableDataEdit: false, sqlExplain: false, family: "flat", order: 340 },
	{ dbType: "transwarp", label: "Transwarp", dialect: "Hive", defaultPort: 10000, runtimeMode: "bridge", mcpMode: "bridge", schemaAware: true, treeSchema: false, tableDataEdit: false, sqlExplain: false, family: "schemas", order: 350 },
	{ dbType: "kwdb", label: "KWDB", dialect: "MySQL", defaultPort: 3306, runtimeMode: "native", mcpMode: "direct", schemaAware: false, treeSchema: false, tableDataEdit: true, sqlExplain: true, family: "schemas", order: 351 },
	{ dbType: "gbase", label: "GBase", dialect: "MySQL", defaultPort: 9088, runtimeMode: "native", mcpMode: "direct", schemaAware: false, treeSchema: false, tableDataEdit: true, sqlExplain: true, family: "schemas", order: 352 },
	{ dbType: "goldendb", label: "GoldenDB", dialect: "MySQL", defaultPort: 3306, runtimeMode: "native", mcpMode: "direct", schemaAware: false, treeSchema: false, tableDataEdit: true, sqlExplain: true, family: "schemas", order: 353 },
	{ dbType: "uds", label: "UDS", dialect: "PostgreSQL", defaultPort: 5432, runtimeMode: "native", mcpMode: "direct", schemaAware: true, treeSchema: true, tableDataEdit: true, sqlExplain: true, family: "schemas", order: 354 },
	{ dbType: "yashandb", label: "YashanDB", dialect: "Oracle", defaultPort: 1521, runtimeMode: "native", mcpMode: "direct", schemaAware: true, treeSchema: false, tableDataEdit: true, sqlExplain: true, family: "schemas", order: 355 },
	{ dbType: "tdengine", label: "TDengine", dialect: "TDengine", defaultPort: 6030, runtimeMode: "native", mcpMode: "direct", schemaAware: false, treeSchema: false, tableDataEdit: true, sqlExplain: true, family: "flat", order: 360 },
	{ dbType: "consul", label: "HashiCorp Consul", dialect: "Consul", defaultPort: 8500, runtimeMode: "bridge", mcpMode: "bridge", schemaAware: false, treeSchema: false, tableDataEdit: false, sqlExplain: false, family: "flat", order: 370 },
	{ dbType: "argo", label: "ArgoDB", dialect: "Hive", defaultPort: 10000, runtimeMode: "bridge", mcpMode: "bridge", schemaAware: true, treeSchema: false, tableDataEdit: false, sqlExplain: false, family: "schemas", order: 380 },
];

/** 按 dbType 查找 manifest 条目 */
export function findDbType(dbType: DbType): DbTypeManifestEntry | undefined {
	return DB_TYPE_MANIFEST.find((e) => e.dbType === dbType);
}

/** 给定类型推断 catalog family */
export function inferCatalogFamily(dbType: DbType): CatalogFamily {
	return findDbType(dbType)?.family ?? "flat";
}

/** 给定类型推断默认端口 */
export function defaultPortFor(dbType: DbType): number {
	return findDbType(dbType)?.defaultPort ?? 0;
}

/** 给定类型推断是否支持 EXPLAIN ANALYZE */
export function supportsExplain(dbType: DbType): boolean {
	return findDbType(dbType)?.sqlExplain ?? false;
}

/** 给定类型推断是否支持 inline cell editing */
export function supportsTableDataEdit(dbType: DbType): boolean {
	return findDbType(dbType)?.tableDataEdit ?? false;
}

/** 给定类型推断 runtimeMode */
export function runtimeModeFor(dbType: DbType): "native" | "bridge" | string {
	return findDbType(dbType)?.runtimeMode ?? "native";
}

/**
 * 数据库连接配置 — 与 dbx 引擎 ConnectionConfig 对齐的扁平结构。
 * 所有字段按可选处理，序列化时按 camelCase 输出。
 */
export interface DbConnection {
	id: string;
	name: string;
	db_type: DbType;
	host: string;
	port: number;
	username: string;
	password: string;
	database?: string;
	/**
	 * 默认 schema。对象浏览的起始 scope：展开连接节点时优先用它，
	 * 避免每次都落在库的默认 schema（如 PG 的 public）上。
	 */
	schema?: string;
	note?: string;
	color?: string;
	ssl?: boolean;
	is_production?: boolean;
	read_only?: boolean;
	connect_timeout_secs?: number;
	query_timeout_secs?: number;
	url_params?: string;
	connection_string?: string;
	[key: string]: unknown;
}

/** 表列元信息 */
export interface DbColumn {
	name: string;
	data_type: string;
	is_nullable: boolean;
	is_primary_key: boolean;
	column_default?: string | null;
	comment?: string | null;
}

/** 表/视图基本信息 */
export interface DbTableInfo {
	name: string;
	table_type: string;
}

/** 查询结果 */
export interface DbQueryResult {
	connection: string;
	columns: string[];
	rows: Record<string, unknown>[];
	row_count: number;
	/** 执行失败时的原因；成功时缺省。带 error 的结果集 columns/rows 为空。 */
	error?: string;
	/** 成功但有需要告知用户的情况时给出（例如多语句只展示了最后一个结果集）。 */
	note?: string;
}

/** SQL 执行运行状态 */
export type RunState =
	| { kind: "idle" }
	| { kind: "running" }
	| { kind: "result"; data: DbQueryResult; elapsedMs: number; allowWrites: boolean }
	| { kind: "error"; message: string; code?: string };

/** 写保护确认所需上下文 */
export interface WriteGuard {
	allowWrites: boolean;
	allowDangerous: boolean;
}

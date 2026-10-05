/**
 * 数据库真实图标映射 — 从网络获取的官方图标 URL。
 * 
 * 使用各数据库官方提供的图标资源，提升视觉识别度。
 */

export interface DatabaseIconInfo {
	url: string;
	color: string;
}

/**
 * 数据库图标 URL 映射。
 * 优先使用官方图标，fallback 到 simple-icons CDN。
 */
export const DATABASE_ICONS: Record<string, DatabaseIconInfo> = {
	// 关系型数据库
	mysql: { url: "https://cdn.simpleicons.org/mysql/4479A1", color: "#4479A1" },
	postgres: { url: "https://cdn.simpleicons.org/postgresql/4169E1", color: "#4169E1" },
	mariadb: { url: "https://cdn.simpleicons.org/mariadb/003545", color: "#003545" },
	sqlite: { url: "https://cdn.simpleicons.org/sqlite/003B57", color: "#003B57" },
	sqlserver: { url: "https://cdn.simpleicons.org/microsoftsqlserver/CC2927", color: "#CC2927" },
	oracle: { url: "https://cdn.simpleicons.org/oracle/F80000", color: "#F80000" },
	db2: { url: "https://cdn.simpleicons.org/ibm/052FAD", color: "#052FAD" },
	
	// NoSQL 数据库
	mongodb: { url: "https://cdn.simpleicons.org/mongodb/47A248", color: "#47A248" },
	redis: { url: "https://cdn.simpleicons.org/redis/DC382D", color: "#DC382D" },
	elasticsearch: { url: "https://cdn.simpleicons.org/elasticsearch/005571", color: "#005571" },
	cassandra: { url: "https://cdn.simpleicons.org/apachecassandra/1287B1", color: "#1287B1" },
	neo4j: { url: "https://cdn.simpleicons.org/neo4j/008CC1", color: "#008CC1" },
	
	// 分析型数据库
	clickhouse: { url: "https://cdn.simpleicons.org/clickhouse/FFCC00", color: "#FFCC00" },
	snowflake: { url: "https://cdn.simpleicons.org/snowflake/29B5E8", color: "#29B5E8" },
	bigquery: { url: "https://cdn.simpleicons.org/googlebigquery/669DF6", color: "#669DF6" },
	doris: { url: "https://cdn.simpleicons.org/apachedoris/00B8A9", color: "#00B8A9" },
	starrocks: { url: "https://cdn.simpleicons.org/starrocks/FF6A00", color: "#FF6A00" },
	
	// 其他数据库
	duckdb: { url: "https://cdn.simpleicons.org/duckdb/FFC107", color: "#FFC107" },
	cockroachdb: { url: "https://cdn.simpleicons.org/cockroachlabs/6933FF", color: "#6933FF" },
	timescaledb: { url: "https://cdn.simpleicons.org/timescale/00407F", color: "#004040" },
	citus: { url: "https://cdn.simpleicons.org/postgresql/4169E1", color: "#4169E1" },
	greenplum: { url: "https://cdn.simpleicons.org/greenplum/00BFB3", color: "#00BFB3" },
	vertica: { url: "https://cdn.simpleicons.org/vertica/00ADEF", color: "#00ADEF" },
	databricks: { url: "https://cdn.simpleicons.org/databricks/FF3621", color: "#FF3621" },
	athena: { url: "https://cdn.simpleicons.org/amazonaws/FF9900", color: "#FF9900" },
	presto: { url: "https://cdn.simpleicons.org/presto/5F122A", color: "#5F122A" },
	trino: { url: "https://cdn.simpleicons.org/trino/1299B3", color: "#1299B3" },
	druid: { url: "https://cdn.simpleicons.org/apachedruid/2CE5F9", color: "#2CE5F9" },
	pinot: { url: "https://cdn.simpleicons.org/apachepinot/1299B3", color: "#1299B3" },
	
	// 云数据库
	aurora: { url: "https://cdn.simpleicons.org/amazonaws/FF9900", color: "#FF9900" },
	redshift: { url: "https://cdn.simpleicons.org/amazonredshift/8C4FFF", color: "#8C4FFF" },
	neptune: { url: "https://cdn.simpleicons.org/amazonaws/FF9900", color: "#FF9900" },
	documentdb: { url: "https://cdn.simpleicons.org/amazonaws/FF9900", color: "#FF9900" },
	keyspaces: { url: "https://cdn.simpleicons.org/amazonaws/FF9900", color: "#FF9900" },
	timestream: { url: "https://cdn.simpleicons.org/amazonaws/FF9900", color: "#FF9900" },
	
	// 消息队列
	kafka: { url: "https://cdn.simpleicons.org/apachekafka/231F20", color: "#231F20" },
	rabbitmq: { url: "https://cdn.simpleicons.org/rabbitmq/FF6600", color: "#FF6600" },
	pulsar: { url: "https://cdn.simpleicons.org/apachepulsar/188FFF", color: "#188FFF" },
	rocketmq: { url: "https://cdn.simpleicons.org/apacherocketmq/D77310", color: "#D77310" },
	
	// 搜索引擎
	solr: { url: "https://cdn.simpleicons.org/apachesolr/D9411E", color: "#D9411E" },
	meilisearch: { url: "https://cdn.simpleicons.org/meilisearch/FF5E94", color: "#FF5E94" },
	typesense: { url: "https://cdn.simpleicons.org/typesense/18B8E5", color: "#18B8E5" },
	
	// 时序数据库
	influxdb: { url: "https://cdn.simpleicons.org/influxdb/22ADF6", color: "#22ADF6" },
	questdb: { url: "https://cdn.simpleicons.org/questdb/1A1A1A", color: "#1A1A1A" },
	tdengine: { url: "https://cdn.simpleicons.org/tdengine/0076FF", color: "#0076FF" },
	
	// 图数据库
	arangodb: { url: "https://cdn.simpleicons.org/arangodb/3499B3", color: "#3499B3" },
	orientdb: { url: "https://cdn.simpleicons.org/orientdb/1A1A1A", color: "#1A1A1A" },
	
	// 向量数据库
	pinecone: { url: "https://cdn.simpleicons.org/pinecone/000000", color: "#000000" },
	weaviate: { url: "https://cdn.simpleicons.org/weaviate/DE6A00", color: "#DE6A00" },
	qdrant: { url: "https://cdn.simpleicons.org/qdrant/FF4A3D", color: "#FF4A3D" },
	milvus: { url: "https://cdn.simpleicons.org/milvus/000000", color: "#000000" },
	chroma: { url: "https://cdn.simpleicons.org/chroma/FF6B6B", color: "#FF6B6B" },
};

/**
 * 获取数据库图标 URL。
 * 如果找不到对应的图标，返回 null。
 */
export function getDatabaseIconUrl(dbType: string): string | null {
	const normalized = dbType.toLowerCase().replace(/[^a-z0-9]/g, "");
	return DATABASE_ICONS[normalized]?.url ?? null;
}

/**
 * 获取数据库图标颜色。
 */
export function getDatabaseIconColor(dbType: string): string {
	const normalized = dbType.toLowerCase().replace(/[^a-z0-9]/g, "");
	return DATABASE_ICONS[normalized]?.color ?? "#6B7280";
}

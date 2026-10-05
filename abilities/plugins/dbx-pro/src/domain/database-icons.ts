/**
 * 数据库图标映射 — 提供真实数据库品牌图标。
 * 
 * 优先使用 simple-icons CDN，失败时回退到本地 SVG 或颜色方块。
 */

export interface DatabaseIconInfo {
	/** 图标 URL（CDN 或本地） */
	url: string;
	/** 主题色（用于 fallback 方块） */
	color: string;
	/** 简短标识（2-3 字符，用于最终 fallback） */
	badge: string;
}

/**
 * 数据库图标映射表。
 * 包含 50+ 种主流数据库的品牌图标和主题色。
 */
export const DATABASE_ICONS: Record<string, DatabaseIconInfo> = {
	// 关系型数据库
	mysql: { url: "https://cdn.simpleicons.org/mysql/4479A1", color: "#4479A1", badge: "MY" },
	postgres: { url: "https://cdn.simpleicons.org/postgresql/4169E1", color: "#4169E1", badge: "PG" },
	mariadb: { url: "https://cdn.simpleicons.org/mariadb/003545", color: "#003545", badge: "MA" },
	sqlite: { url: "https://cdn.simpleicons.org/sqlite/003B57", color: "#003B57", badge: "SL" },
	sqlserver: { url: "https://cdn.simpleicons.org/microsoftsqlserver/CC2927", color: "#CC2927", badge: "MS" },
	oracle: { url: "https://cdn.simpleicons.org/oracle/F80000", color: "#F80000", badge: "OR" },
	db2: { url: "https://cdn.simpleicons.org/ibm/052FAD", color: "#052FAD", badge: "DB" },
	
	// NoSQL 数据库
	mongodb: { url: "https://cdn.simpleicons.org/mongodb/47A248", color: "#47A248", badge: "MG" },
	redis: { url: "https://cdn.simpleicons.org/redis/DC382D", color: "#DC382D", badge: "RD" },
	elasticsearch: { url: "https://cdn.simpleicons.org/elasticsearch/005571", color: "#005571", badge: "ES" },
	cassandra: { url: "https://cdn.simpleicons.org/apachecassandra/1287B1", color: "#1287B1", badge: "CA" },
	neo4j: { url: "https://cdn.simpleicons.org/neo4j/008CC1", color: "#008CC1", badge: "N4" },
	
	// 分析型数据库
	clickhouse: { url: "https://cdn.simpleicons.org/clickhouse/FFCC00", color: "#FFCC00", badge: "CH" },
	snowflake: { url: "https://cdn.simpleicons.org/snowflake/29B5E8", color: "#29B5E8", badge: "SF" },
	bigquery: { url: "https://cdn.simpleicons.org/googlebigquery/669DF6", color: "#669DF6", badge: "BQ" },
	doris: { url: "https://cdn.simpleicons.org/apachedoris/00B8A9", color: "#00B8A9", badge: "DO" },
	starrocks: { url: "https://cdn.simpleicons.org/starrocks/FF6A00", color: "#FF6A00", badge: "SR" },
	
	// 其他数据库
	duckdb: { url: "https://cdn.simpleicons.org/duckdb/FFC107", color: "#FFC107", badge: "DK" },
	cockroachdb: { url: "https://cdn.simpleicons.org/cockroachlabs/6933FF", color: "#6933FF", badge: "CR" },
	timescaledb: { url: "https://cdn.simpleicons.org/timescale/00407F", color: "#004040", badge: "TS" },
	citus: { url: "https://cdn.simpleicons.org/postgresql/4169E1", color: "#4169E1", badge: "CT" },
	greenplum: { url: "https://cdn.simpleicons.org/greenplum/00BFB3", color: "#00BFB3", badge: "GP" },
	vertica: { url: "https://cdn.simpleicons.org/vertica/00ADEF", color: "#00ADEF", badge: "VT" },
	databricks: { url: "https://cdn.simpleicons.org/databricks/FF3621", color: "#FF3621", badge: "DB" },
	athena: { url: "https://cdn.simpleicons.org/amazonaws/FF9900", color: "#FF9900", badge: "AT" },
	presto: { url: "https://cdn.simpleicons.org/presto/5F122A", color: "#5F122A", badge: "PR" },
	trino: { url: "https://cdn.simpleicons.org/trino/1299B3", color: "#1299B3", badge: "TR" },
	druid: { url: "https://cdn.simpleicons.org/apachedruid/2CE5F9", color: "#2CE5F9", badge: "DR" },
	pinot: { url: "https://cdn.simpleicons.org/apachepinot/1299B3", color: "#1299B3", badge: "PN" },
	
	// 云数据库
	aurora: { url: "https://cdn.simpleicons.org/amazonaws/FF9900", color: "#FF9900", badge: "AU" },
	redshift: { url: "https://cdn.simpleicons.org/amazonredshift/8C4FFF", color: "#8C4FFF", badge: "RS" },
	neptune: { url: "https://cdn.simpleicons.org/amazonaws/FF9900", color: "#FF9900", badge: "NP" },
	documentdb: { url: "https://cdn.simpleicons.org/amazonaws/FF9900", color: "#FF9900", badge: "DD" },
	keyspaces: { url: "https://cdn.simpleicons.org/amazonaws/FF9900", color: "#FF9900", badge: "KS" },
	timestream: { url: "https://cdn.simpleicons.org/amazonaws/FF9900", color: "#FF9900", badge: "TM" },
	
	// 消息队列
	kafka: { url: "https://cdn.simpleicons.org/apachekafka/231F20", color: "#231F20", badge: "KF" },
	rabbitmq: { url: "https://cdn.simpleicons.org/rabbitmq/FF6600", color: "#FF6600", badge: "RM" },
	pulsar: { url: "https://cdn.simpleicons.org/apachepulsar/188FFF", color: "#188FFF", badge: "PS" },
	rocketmq: { url: "https://cdn.simpleicons.org/apacherocketmq/D77310", color: "#D77310", badge: "RK" },
	
	// 搜索引擎
	solr: { url: "https://cdn.simpleicons.org/apachesolr/D9411E", color: "#D9411E", badge: "SO" },
	meilisearch: { url: "https://cdn.simpleicons.org/meilisearch/FF5E94", color: "#FF5E94", badge: "MS" },
	typesense: { url: "https://cdn.simpleicons.org/typesense/18B8E5", color: "#18B8E5", badge: "TY" },
	
	// 时序数据库
	influxdb: { url: "https://cdn.simpleicons.org/influxdb/22ADF6", color: "#22ADF6", badge: "IF" },
	questdb: { url: "https://cdn.simpleicons.org/questdb/1A1A1A", color: "#1A1A1A", badge: "QU" },
	tdengine: { url: "https://cdn.simpleicons.org/tdengine/0076FF", color: "#0076FF", badge: "TD" },
	
	// 图数据库
	arangodb: { url: "https://cdn.simpleicons.org/arangodb/3499B3", color: "#3499B3", badge: "AR" },
	orientdb: { url: "https://cdn.simpleicons.org/orientdb/1A1A1A", color: "#1A1A1A", badge: "OR" },
	
	// 向量数据库
	pinecone: { url: "https://cdn.simpleicons.org/pinecone/000000", color: "#000000", badge: "PC" },
	weaviate: { url: "https://cdn.simpleicons.org/weaviate/DE6A00", color: "#DE6A00", badge: "WV" },
	qdrant: { url: "https://cdn.simpleicons.org/qdrant/FF4A3D", color: "#FF4A3D", badge: "QR" },
	milvus: { url: "https://cdn.simpleicons.org/milvus/000000", color: "#000000", badge: "MV" },
	chroma: { url: "https://cdn.simpleicons.org/chroma/FF6B6B", color: "#FF6B6B", badge: "CR" },
};

/**
 * 获取数据库图标信息。
 * 如果找不到对应的图标，返回 null（调用方需要处理 fallback）。
 */
export function getDatabaseIconInfo(dbType: string): DatabaseIconInfo | null {
	const normalized = dbType.toLowerCase().replace(/[^a-z0-9]/g, "");
	return DATABASE_ICONS[normalized] ?? null;
}

/**
 * 获取数据库图标 URL。
 * 如果找不到对应的图标，返回 null。
 */
export function getDatabaseIconUrl(dbType: string): string | null {
	return getDatabaseIconInfo(dbType)?.url ?? null;
}

/**
 * 获取数据库图标颜色。
 * 如果找不到对应的图标，返回默认灰色。
 */
export function getDatabaseIconColor(dbType: string): string {
	return getDatabaseIconInfo(dbType)?.color ?? "#6B7280";
}

/**
 * 获取数据库图标 badge（2-3 字符标识）。
 * 如果找不到对应的图标，返回数据库类型的前两个字符。
 */
export function getDatabaseIconBadge(dbType: string): string {
	const info = getDatabaseIconInfo(dbType);
	if (info) return info.badge;
	return dbType.slice(0, 2).toUpperCase();
}

/**
 * 数据库类型的视觉标识 — 品牌色与缩写。
 *
 * 数据来源：旧项目 database-type-catalog.ts 的 badge / color / group 字段，逐条移植，
 * 保证工作台里连接列表、对象树、类型选择器的类型标识与旧设计一致。
 * 未收录的类型按分组回退（fallback），不会出现无标识的条目。
 */

export interface DatabaseTypeVisual {
	/** 2 字符缩写，用于方形类型徽标 */
	readonly badge: string;
	/** 品牌色（#rrggbb） */
	readonly color: string;
	/** 分组标识，用于选择器分组与回退配色 */
	readonly group: DatabaseTypeGroup;
}

export type DatabaseTypeGroup =
	| "relational"
	| "nosql"
	| "cloud"
	| "search"
	| "timeseries"
	| "kv"
	| "other";

export const DATABASE_TYPE_GROUP_LABELS: Record<DatabaseTypeGroup, { en: string; zh: string }> = {
	relational: {"en":"Relational & OLAP","zh":"关系型 / OLAP"},
	nosql: {"en":"NoSQL","zh":"NoSQL"},
	cloud: {"en":"Cloud","zh":"云服务"},
	search: {"en":"Search","zh":"搜索"},
	timeseries: {"en":"Time Series","zh":"时序"},
	kv: {"en":"Key-Value","zh":"键值"},
	other: {"en":"Other","zh":"其他"},
};

/** 分组顺序（选择器中的分组展示顺序）。 */
export const DATABASE_TYPE_GROUP_ORDER: DatabaseTypeGroup[] = [
	"relational",
	"nosql",
	"cloud",
	"search",
	"timeseries",
	"kv",
	"other",
];

/** 逐条移植自旧项目的类型视觉表。 */
export const DATABASE_TYPE_VISUALS: Record<string, DatabaseTypeVisual> = {
	"sqlite": { badge: "SQ", color: "#38bdf8", group: "relational" },
	"postgres": { badge: "PG", color: "#336791", group: "relational" },
	"mysql": { badge: "MY", color: "#00758f", group: "relational" },
	"sqlserver": { badge: "MS", color: "#cc2927", group: "relational" },
	"oracle": { badge: "OR", color: "#f80000", group: "relational" },
	"duckdb": { badge: "DU", color: "#fff000", group: "relational" },
	"clickhouse": { badge: "CH", color: "#ffcc01", group: "relational" },
	"doris": { badge: "DO", color: "#3b5bdb", group: "relational" },
	"starrocks": { badge: "SR", color: "#3b5bdb", group: "relational" },
	"opengauss": { badge: "OG", color: "#5b8def", group: "relational" },
	"oceanbase-oracle": { badge: "OB", color: "#ff6a00", group: "relational" },
	"h2": { badge: "H2", color: "#00a3e0", group: "relational" },
	"firebird": { badge: "FB", color: "#e8423a", group: "relational" },
	"access": { badge: "AC", color: "#a4373a", group: "relational" },
	"gaussdb": { badge: "GS", color: "#c7000b", group: "relational" },
	"dameng": { badge: "DM", color: "#006b5f", group: "relational" },
	"kingbase": { badge: "KB", color: "#7b1fa2", group: "relational" },
	"mongodb": { badge: "MO", color: "#47a248", group: "nosql" },
	"redis": { badge: "RE", color: "#dc382d", group: "nosql" },
	"cassandra": { badge: "CA", color: "#1287b1", group: "nosql" },
	"neo4j": { badge: "N4", color: "#4581c3", group: "nosql" },
	"hbase": { badge: "HB", color: "#990000", group: "nosql" },
	"rqlite": { badge: "RQ", color: "#2f855a", group: "nosql" },
	"turso": { badge: "TU", color: "#4ff8d2", group: "nosql" },
	"cloudflare-d1": { badge: "D1", color: "#f6821f", group: "nosql" },
	"snowflake": { badge: "SF", color: "#29b5e8", group: "cloud" },
	"bigquery": { badge: "BQ", color: "#4285f4", group: "cloud" },
	"redshift": { badge: "RS", color: "#8b4da3", group: "cloud" },
	"databricks": { badge: "DBX", color: "#ff3621", group: "cloud" },
	"trino": { badge: "TR", color: "#dd00a1", group: "cloud" },
	"prestosql": { badge: "PS", color: "#48929b", group: "cloud" },
	"hive": { badge: "HI", color: "#fdee00", group: "cloud" },
	"spark": { badge: "SP", color: "#e25a1c", group: "cloud" },
	"db2": { badge: "D2", color: "#054ada", group: "cloud" },
	"saphana": { badge: "SH", color: "#008fd3", group: "cloud" },
	"teradata": { badge: "TD", color: "#f37421", group: "cloud" },
	"vertica": { badge: "VE", color: "#2c3e50", group: "cloud" },
	"databend": { badge: "DB", color: "#6c5ce7", group: "cloud" },
	"elasticsearch": { badge: "ES", color: "#fec514", group: "search" },
	"easysearch": { badge: "EY", color: "#fec514", group: "search" },
	"meilisearch": { badge: "ME", color: "#ff5caa", group: "search" },
	"manticoresearch": { badge: "MN", color: "#ff5a5f", group: "search" },
	"qdrant": { badge: "QD", color: "#ea2845", group: "search" },
	"milvus": { badge: "MV", color: "#00a1ea", group: "search" },
	"weaviate": { badge: "WV", color: "#49b16a", group: "search" },
	"chromadb": { badge: "CR", color: "#6c5ce7", group: "search" },
	"influxdb": { badge: "IN", color: "#22adf6", group: "timeseries" },
	"questdb": { badge: "QD", color: "#d2181f", group: "timeseries" },
	"victoriametrics": { badge: "VM", color: "#621773", group: "timeseries" },
	"tdengine": { badge: "TE", color: "#41b883", group: "timeseries" },
	"iotdb": { badge: "IO", color: "#f58b33", group: "timeseries" },
	"etcd": { badge: "ET", color: "#419eda", group: "kv" },
	"zookeeper": { badge: "ZK", color: "#8b5cf6", group: "kv" },
	"nacos": { badge: "NA", color: "#00b96b", group: "kv" },
	"consul": { badge: "CO", color: "#f24c53", group: "kv" },
	"mqtt": { badge: "MQ", color: "#660066", group: "kv" },
	"mq": { badge: "MQ", color: "#d97706", group: "kv" },
};

const FALLBACK_COLOR = "#64748b";

function initialsFrom(dbType: string): string {
	const parts = dbType.split(/[-_.]/).filter(Boolean);
	if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
	return dbType.slice(0, 2).toUpperCase();
}

/** 取类型的视觉标识；未收录类型按名称缩写 + 中性灰回退。 */
export function getDatabaseTypeVisual(dbType: string): DatabaseTypeVisual {
	const known = DATABASE_TYPE_VISUALS[dbType];
	if (known) return known;
	return { badge: initialsFrom(dbType), color: FALLBACK_COLOR, group: "other" };
}

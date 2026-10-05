/**
 * 数据库品牌图标 — 本地内置真实品牌图形，无网络依赖。
 *
 * 资产与映射对齐官方图标库：所有图标随插件打包，
 * 离线 / 企业内网 / CDN 不可达时都能稳定显示，不会退化成彩色字母占位块。
 */

// Vite 在构建时把这些图标发到 dist/assets 并返回最终 URL。
const modules = import.meta.glob<string>(
	"./database-icon-assets/*.{svg,png,webp}",
	{ eager: true, query: "?url", import: "default" },
);
const urlByFile: Record<string, string> = {};
for (const path of Object.keys(modules)) {
	urlByFile[path.slice(path.lastIndexOf("/") + 1)] = modules[path];
}

export interface DatabaseIcon {
	/** 本地打包后的图标 URL（始终可用） */
	src: string;
	/** 深色主题下的可选 CSS 滤镜（个别偏暗 logo 提亮/反色） */
	darkFilter?: string;
	/** 相对常规图标的缩放（撑满 viewBox 的 logo 收敛 / 留白多的放大） */
	scale?: number;
}

/**
 * dbType（归一化：小写、空格/连字符 → 下划线）→ 资产文件名。
 * 值不含扩展名时默认 .svg；需要 png/webp 的显式写出。
 */
const ASSET_ICONS: Record<string, string> = {
	mysql: "mysql",
	postgres: "postgres",
	postgresql: "postgres",
	cloudberry: "cloudberry",
	opentenbase: "opentenbase",
	sqlite: "sqlite",
	"sqlite-worker": "sqlite",
	rqlite: "rqlite.png",
	turso: "turso.png",
	cloudflare_d1: "cloudflare-d1",
	redis: "redis",
	mongodb: "mongodb",
	mongodb_legacy: "mongodb",
	dynamodb: "dynamodb",
	clickhouse: "clickhouse",
	duckdb: "duckdb",
	mariadb: "mariadb",
	tidb: "tidb",
	elasticsearch: "elasticsearch",
	easysearch: "easysearch",
	meilisearch: "meilisearch",
	solr: "solr",
	couchdb: "couchdb",
	oracle: "oracle",
	"oracle-10g": "oracle",
	"oracle-legacy": "oracle",
	oracle_10g: "oracle",
	oracle_legacy: "oracle",
	sqlserver: "sqlserver",
	access: "access.png",
	oceanbase: "oceanbase",
	oceanbase_oracle: "oceanbase",
	opengauss: "opengauss",
	gaussdb: "gaussdb",
	questdb: "questdb",
	kwdb: "kwdb",
	kingbase: "kingbase",
	highgo: "highgo.png",
	uxdb: "uxdb",
	goldendb: "goldendb.png",
	databend: "databend",
	vastbase: "vastbase",
	yashandb: "yashandb.png",
	snowflake: "snowflake",
	h2: "h2",
	dm: "dm",
	dameng: "dm",
	presto: "presto",
	prestosql: "presto",
	hive: "hive",
	argo: "hive",
	transwarp: "transwarp-inceptor.png",
	transwarp_inceptor: "transwarp-inceptor.png",
	kyuubi: "kyuubi.png",
	impala: "impala",
	hbase: "hbase",
	phoenix: "phoenix",
	spark: "spark-logo.png",
	apache_kylin: "apache_kylin",
	apache_ignite: "apache_ignite",
	sundb: "sundb",
	trino: "trino",
	kylin: "apache_kylin",
	ignite: "apache_ignite",
	ignite3: "apache_ignite",
	cockroachdb: "cockroachdb",
	db2: "db2",
	dremio: "dremio",
	bigquery: "bigquery",
	spanner: "spanner",
	cassandra: "cassandra",
	doris: "doris",
	manticoresearch: "manticoresearch.png",
	selectdb: "selectdb",
	tdengine: "tdengine",
	starrocks: "starrocks",
	redshift: "redshift",
	neo4j: "neo4j",
	nebula: "nebula.png",
	informix: "informix",
	databricks: "databricks",
	saphana: "saphana",
	teradata: "teradata",
	vertica: "vertica.webp",
	firebird: "firebird",
	exasol: "exasol",
	gbase: "gbase.png",
	gbase8a: "gbase.png",
	gbase8s: "gbase.png",
	tdsql: "tdsql",
	polardb: "polardb.webp",
	greatsql: "greatsql.webp",
	xugu: "xugu.png",
	iotdb: "iotdb",
	etcd: "etcd",
	etcd2: "etcd",
	qdrant: "qdrant",
	milvus: "milvus.png",
	weaviate: "weaviate",
	chromadb: "chromadb",
	mq: "pulsar",
	pulsar: "pulsar",
	kafka: "kafka",
	rocketmq: "rocketmq",
	rabbitmq: "rabbitmq",
	nacos: "nacos.png",
	consul: "consul",
	iris: "iris",
	cache: "iris",
	influxdb: "influxdb",
	influxdb3: "influxdb",
	victoriametrics: "victoriametrics.png",
	zookeeper: "zookeeper",
	oscar: "oscar.png",
	jdbcx: "jdbcx",
	mqtt: "mqtt",
	dolt: "dolt",
	salesforce: "salesforce",
};

/** 深色主题特殊处理：个别 logo 在深色下需要换图或滤镜。 */
function darkAdjustment(key: string): { darkFilter?: string; src?: string } | null {
	if (key === "easysearch") return { darkFilter: "brightness(0) invert(82%)" };
	if (key === "transwarp" || key === "transwarp_inceptor") return { darkFilter: "brightness(1.6)" };
	if (key === "uxdb") {
		const src = urlByFile["uxdb-dark.svg"];
		if (src) return { src };
	}
	return null;
}

function normalizeType(dbType: string): string {
	return dbType.toLowerCase().replace(/[\s-]+/g, "_");
}

/**
 * 解析数据库品牌图标。
 * @param isDark 当前是否深色主题（用于个别 logo 的深色适配）
 * @returns 本地图标；未收录品牌返回 null（调用方应回退到通用数据库图形）。
 */
export function resolveDatabaseIcon(dbType: string, isDark = false): DatabaseIcon | null {
	const key = normalizeType(dbType);
	const asset = ASSET_ICONS[key];
	if (!asset) return null;
	const file = asset.includes(".") ? asset : `${asset}.svg`;
	const src = urlByFile[file];
	if (!src) return null;

	const icon: DatabaseIcon = { src };
	if (key === "impala") icon.scale = 1.55;
	else if (key === "solr") icon.scale = 1.02;
	else icon.scale = 1.35;

	if (isDark) {
		const dark = darkAdjustment(key);
		if (dark) {
			if (dark.src) icon.src = dark.src;
			if (dark.darkFilter) icon.darkFilter = dark.darkFilter;
		}
	}
	return icon;
}

/**
 * 连接表单的数据库类型元数据 — 纯逻辑，不含 React。
 *
 * 从 DB_TYPE_MANIFEST（80+ 种）派生下拉分组、默认端口 / 默认用户名 / 文件型判定，
 * 供连接字段表单和连接编辑 hook 共同使用。
 */

import { DB_TYPE_MANIFEST, type DbConnection, type DbType, type DbTypeManifestEntry } from "../../../domain/connection-config.ts";
import { genUuid } from "../../../domain/dbx-storage.ts";

export interface DbCategory {
	/** 显示名称 */
	label: string;
	/** dbType 集合 */
	dbTypes: DbType[];
}

// ─── 「API 接入」虚拟类型 ─────────────────────────────────

/**
 * 「API 接入」在表单里伪装成一个数据库类型，但**不进入 DB_TYPE_MANIFEST**：
 * 引擎不认识它，新建/连接都走插件自己的 /api-sources 通道。
 */
export const API_DB_TYPE = "api";

export function isApiConnectionType(dbType: DbType): boolean {
	return String(dbType ?? "").trim().toLowerCase() === API_DB_TYPE;
}

/** 「接口」分组在类型下拉里始终排在第一位。 */
export const API_CATEGORY_DEF: DbCategory = { label: "接口", dbTypes: [API_DB_TYPE] };

export const API_CATALOG_ENTRY: DbTypeManifestEntry = {
	dbType: API_DB_TYPE,
	label: "API 接入",
	dialect: "HTTP / JSON",
	defaultPort: 0,
	runtimeMode: "native",
	mcpMode: "direct",
	schemaAware: false,
	treeSchema: false,
	tableDataEdit: false,
	sqlExplain: false,
	family: "flat",
	order: 0,
};

/** 预定义的 dbType → category 映射；不在任何预定义组里的归入 "其他" */
export const CATEGORY_DEFS: DbCategory[] = [
	{
		label: "关系型 SQL",
		dbTypes: [
			"postgres", "postgresql", "aurora-postgresql",
			"mysql", "mariadb", "sundb", "kwdb", "gbase", "goldendb", "uds",
			"oracle", "oceanbase-oracle", "yashandb", "dameng",
			"sqlserver",
			"sqlite", "duckdb", "cloudflare-d1", "turso", "rqlite",
			"db2", "informix",
			"clickhouse",
			"access", "h2", "firebird", "exasol", "vertica", "saphana", "teradata",
			"hive", "spark", "kyuubi", "transwarp", "argo",
			"impala", "iris", "ignite", "ignite3", "xugu", "oscar", "iotdb",
		],
	},
	{
		label: "分析型",
		dbTypes: ["redshift", "snowflake", "bigquery", "starrocks", "doris", "tidb", "databend", "databricks", "spanner"],
	},
	{
		label: "文档 / NoSQL",
		dbTypes: ["mongodb", "redis", "elasticsearch", "easysearch", "meilisearch", "solr"],
	},
	{
		label: "国产",
		dbTypes: [
			"oceanbase-oracle", "kingbase", "dameng", "highgo",
			"gaussdb", "opengauss", "vastbase", "uds", "xugu", "oscar",
			"kwdb", "gbase", "goldendb", "yashandb", "sundb",
		],
	},
];

/**
 * 把 DB_TYPE_MANIFEST 按 CATEGORY_DEFS 分组。每个 entry 至多属于一个预定义组；
 * 未命中任何预定义组的集中归入 "其他"，同时保留 manifest 原生 order。
 *
 * 「接口」组不是数据库，不入 CATEGORY_DEFS，但始终排在第一位。
 */
export function groupManifestByCategory(): Array<{ label: string; entries: DbTypeManifestEntry[] }> {
	const bucket = new Map<string, DbTypeManifestEntry[]>();
	for (const cat of CATEGORY_DEFS) bucket.set(cat.label, []);
	bucket.set("其他", []);

	const dbTypeToCat = new Map<string, string>();
	for (const cat of CATEGORY_DEFS) {
		for (const t of cat.dbTypes) {
			// 同一类型出现在多个分组时，后遍历到的分组胜出。
			dbTypeToCat.set(t, cat.label);
		}
	}

	for (const entry of DB_TYPE_MANIFEST) {
		const cat = dbTypeToCat.get(entry.dbType) ?? "其他";
		bucket.get(cat)!.push(entry);
	}

	const out: Array<{ label: string; entries: DbTypeManifestEntry[] }> = [
		{ label: API_CATEGORY_DEF.label, entries: [API_CATALOG_ENTRY] },
	];
	for (const cat of CATEGORY_DEFS) {
		const entries = bucket.get(cat.label)!;
		if (entries.length > 0) out.push({ label: cat.label, entries });
	}
	const others = bucket.get("其他")!;
	if (others.length > 0) out.push({ label: "其他", entries: others });

	// 每个组内按 manifest 原生 order 排序
	for (const g of out) g.entries.sort((a, b) => a.order - b.order);
	return out;
}

// ─── 默认用户名映射（dbType → 合理默认） ─────────────────────

export const DEFAULT_USERNAME_BY_DB_TYPE: Record<string, string> = {
	postgres: "postgres",
	postgresql: "postgres",
	"aurora-postgresql": "postgres",
	mysql: "root",
	mariadb: "root",
	sqlserver: "sa",
	oracle: "system",
	snowflake: "",
	redshift: "awsuser",
	bigquery: "",
	starrocks: "root",
	doris: "root",
	clickhouse: "default",
	mongodb: "",
	redis: "",
	elasticsearch: "",
	meilisearch: "",
	kingbase: "system",
	gaussdb: "gaussdb",
	opengauss: "gsdb",
	highgo: "highgo",
	oceanbase: "root",
	"oceanbase-oracle": "root",
	db2: "db2inst1",
	informix: "informix",
	trino: "",
	prestosql: "",
	presto: "",
	hive: "hive",
	spark: "",
	saphana: "SYSTEM",
	teradata: "dbc",
};

// ─── 文件型数据库集合（跳过 host/port/user/password） ─────────

export const FILE_BASED_DB_TYPES = new Set<DbType>(["sqlite", "cloudflare-d1", "turso", "duckdb"]);

export function isFileBasedDbType(dbType: DbType): boolean {
	return FILE_BASED_DB_TYPES.has(dbType);
}

export function defaultHostPlaceholder(dbType: DbType): string {
	if (FILE_BASED_DB_TYPES.has(dbType)) return "/path/to/db.sqlite";
	if (dbType === "turso") return "database.turso.io";
	if (dbType === "cloudflare-d1") return "Cloudflare D1 database id";
	return "localhost";
}

export function defaultUsernameFor(dbType: DbType): string {
	const v = DEFAULT_USERNAME_BY_DB_TYPE[dbType];
	return v !== undefined ? v : "";
}

// ─── 初始值 ───────────────────────────────────────────────────

/** 新建连接的初始草稿（取 manifest 第一项作为默认类型）。 */
export function emptyConnection(): DbConnection {
	const first = DB_TYPE_MANIFEST[0];
	const dbType = first?.dbType ?? "postgres";
	const fileBased = isFileBasedDbType(dbType);
	return {
		id: genUuid(),
		name: "",
		db_type: dbType,
		host: fileBased ? "/path/to/db.sqlite" : "localhost",
		port: first?.defaultPort ?? 5432,
		username: fileBased ? "" : defaultUsernameFor(dbType),
		password: "",
		schemas: [],
		ssl: false,
		is_production: false,
		read_only: false,
	};
}

/**
 * 「API 接入」的初始草稿。
 *
 * 不是从 DB_TYPE_MANIFEST 取的：这台机器上不存在 ip/端口/用户名可填，所以外壳字段
 * 统一给空值，真正的配置放在 api 子对象里（见 ApiConnectionSpec）。
 */
export function emptyApiConnection(): DbConnection {
	return {
		id: genUuid(),
		name: "",
		db_type: API_DB_TYPE,
		host: "",
		port: 0,
		username: "",
		password: "",
		schemas: [],
		ssl: false,
		is_production: false,
		read_only: true,
		api: { url: "", method: "GET", auth: { kind: "none" }, dataPath: "", rowLimit: 1000 },
	};
}

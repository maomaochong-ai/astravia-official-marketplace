/**
 * 连接树「搜索表」的取数逻辑。
 *
 * 背景：树是懒加载的 —— 表和列只在节点展开时才从引擎取，搜索框原先只在
 * `state.connections` 的顶层连接节点标签上做子串过滤，所以搜表名永远没有结果
 * （旧表、刚建的新表都搜不到）。
 *
 * 这里改成真正问引擎：按连接列出 schema，再逐个 schema 调 list_tables，最后
 * 在本地按表名匹配。取舍：
 *
 * - **不做结果缓存**：树搜索的典型用法正是「刚建完表，立刻搜一下」，
 *   任何 TTL 缓存都会让新表在缓存期内搜不到，正是要修的问题本身。
 *   代价是每次输入都会打一轮 `list_tables`，因此调用方必须 debounce。
 * - **限制 schema 数量**：PG 库可能有上百个 schema，逐个查会打爆引擎；
 *   除了跳过系统 schema，还把「名字像搜索词的 schema」排前面并设上限。
 * - **单连接失败不影响整体**：某个连接不可用时只记入 `failedConnections`，
 *   其余连接的命中照常返回。
 *
 * 纯编排 + 注入的引擎客户端，便于单测。
 */

import { engineListSchemas, engineListTables } from "../../../shared/services/engine-client";

/** 一次命中的表（或视图）。 */
export interface TableSearchHit {
	connection: string;
	/** 不支持 schema 层的库为 undefined。 */
	schema?: string;
	name: string;
	/** 引擎给的 kind，VIEW / TABLE 等，仅用于图标区分。 */
	kind: string;
}

export interface TableSearchResult {
	hits: TableSearchHit[];
	/** 取数失败、结果可能不完整的连接名。 */
	failedConnections: string[];
}

/** 搜索目标的连接元信息（取自工作台 state.connections）。 */
export interface SearchableConnection {
	name: string;
	dbType?: string;
	/** 用户在连接上配置的 schema 白名单；为空表示不过滤。 */
	schemas?: string[];
}

export interface SearchTablesOptions {
	/** 每个连接最多返回多少条命中，避免大库刷屏。 */
	perConnectionLimit?: number;
	/** 每个连接最多查多少个 schema。 */
	maxSchemaQueries?: number;
}

/** 引擎目录视图里的系统 schema：搜索时不展示，也不值得为它们多打一轮请求。 */
const SYSTEM_SCHEMAS = new Set([
	"information_schema",
	"pg_catalog",
	"pg_toast",
	"pg_temp_1",
	"pg_toast_temp_1",
	"mysql",
	"performance_schema",
	"sys",
	"db_owner",
	"db_accessadmin",
	"db_securityadmin",
	"db_ddladmin",
	"db_backupoperator",
	"db_datareader",
	"db_datawriter",
	"db_denydatareader",
	"db_denydatawriter",
	"guest",
]);

export function isSystemSchema(name: string): boolean {
	return SYSTEM_SCHEMAS.has(name.trim().toLowerCase());
}

const DEFAULT_PER_CONNECTION_LIMIT = 50;
const DEFAULT_MAX_SCHEMA_QUERIES = 12;

/**
 * 搜索表名。
 *
 * @param connections 待搜索的连接（顺序即结果顺序）
 * @param needle 已小写化的搜索词（调用方负责 trim / toLowerCase）
 * @param options 上限与注入点
 */
export async function searchTables(
	connections: SearchableConnection[],
	needle: string,
	options: SearchTablesOptions = {},
): Promise<TableSearchResult> {
	const query = needle.trim().toLowerCase();
	if (!query) return { hits: [], failedConnections: [] };

	const perConnectionLimit = options.perConnectionLimit ?? DEFAULT_PER_CONNECTION_LIMIT;
	const maxSchemaQueries = options.maxSchemaQueries ?? DEFAULT_MAX_SCHEMA_QUERIES;

	// 连接之间并行：连接数是个位数，且互相独立。
	const settled = await Promise.all(
		connections.map(async (conn) => {
			try {
				const hits = await searchInConnection(conn, query, perConnectionLimit, maxSchemaQueries);
				return { hits, failed: false };
			} catch {
				return { hits: [] as TableSearchHit[], failed: true };
			}
		}),
	);

	const hits: TableSearchHit[] = [];
	const failedConnections: string[] = [];
	settled.forEach((outcome, index) => {
		hits.push(...outcome.hits);
		if (outcome.failed) failedConnections.push(connections[index].name);
	});
	return { hits, failedConnections };
}

async function searchInConnection(
	conn: SearchableConnection,
	needle: string,
	perConnectionLimit: number,
	maxSchemaQueries: number,
): Promise<TableSearchHit[]> {
	const schemas = await visibleSchemas(conn, needle, maxSchemaQueries);
	const hits: TableSearchHit[] = [];

	// 不支持 schema 层（或没有可见 schema）时退化为不带 scope 的 list_tables。
	const scopes: (string | undefined)[] = schemas.length > 0 ? schemas : [undefined];
	for (const schema of scopes) {
		const outcome = await engineListTables(conn.name, schema ? { schema } : {});
		for (const table of outcome.tables) {
			if (!table.name.toLowerCase().includes(needle)) continue;
			hits.push({ connection: conn.name, schema, name: table.name, kind: table.kind });
			if (hits.length >= perConnectionLimit) return hits;
		}
	}
	return hits;
}

/**
 * 本次要查的 schema 列表：
 * - schema 白名单优先（用户明确圈定的范围）
 * - 名称命中搜索词的 schema 排前面（搜 "ods" 时先看 ods_* 的库）
 * - 跳过系统 schema，并截断到上限
 */
async function visibleSchemas(
	conn: SearchableConnection,
	needle: string,
	maxSchemaQueries: number,
): Promise<string[]> {
	let schemas: string[];
	try {
		const outcome = await engineListSchemas(conn.name, conn.dbType);
		if (!outcome.supported || outcome.schemas.length === 0) return [];
		schemas = outcome.schemas;
	} catch {
		// schema 目录不可用：退化为不带 scope 查询，让 list_tables 用连接默认范围。
		return [];
	}

	const allowed = conn.schemas && conn.schemas.length > 0 ? new Set(conn.schemas) : null;
	const candidates = schemas.filter((s) => !isSystemSchema(s) && (!allowed || allowed.has(s)));

	const preferred = candidates.filter((s) => s.toLowerCase().includes(needle));
	const rest = candidates.filter((s) => !s.toLowerCase().includes(needle));
	return [...preferred, ...rest].slice(0, maxSchemaQueries);
}

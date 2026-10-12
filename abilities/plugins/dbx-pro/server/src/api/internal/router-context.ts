/**
 * router-context.mjs — 跨 API 域的共享上下文与工具函数。
 *
 * createRouter() 闭包里的 helper 统一抽到这里（mcpClient / resolveWriteConnSpec /
 * describeFailure / toOutcome 等），各 domain API 文件 import 同一个 context 对象，
 * 避免循环依赖和逻辑重复。
 *
 * 为什么需要 Context 模式：dbx-mcp client 是惰性单例，api-sources / connections /
 * query 都需要它；ensureApiEngineConnection 是幂等的（多次调用只登记一次 DuckDB
 * 连接），resolveWriteConnSpec 复用同一份权威连接元数据。
 */

import {
	DEFAULT_ROW_LIMIT,
	MAX_ROW_LIMIT,
	MAX_TIMEOUT_MS,
	engineError,
} from "../../engine/protocol.ts";
import { getDbxMcpClient, disposeDbxMcpClient } from "../../engine/dbx-mcp-client.ts";
import { classifyQuery } from "../../engine/sql-safety.ts";
import {
	buildCountSql,
	buildPagedSql,
	canPaginate,
	supportsPagination,
} from "../../engine/sql-pagination.ts";
import { executeWrite } from "../../write/direct-write.ts";
import { inferColumnTypes, isApiDbType, normalizeApiSource } from "../external/types.ts";
import { fetchApiSource } from "../external/fetch.ts";
import {
	API_ENGINE_CONNECTION,
	API_ENGINE_DATABASE,
	apiEngineDatabasePath,
	apiSourceToConnection,
	apiSourceToPublic,
	findApiSource,
	isApiSourceName,
	listApiSources,
	removeApiSource,
	upsertApiSource,
} from "../external/store.ts";

// 重导出 domain 文件需要直接 import 的纯工具
export { isApiSourceName, findApiSource, isApiDbType, normalizeApiSource };
import { previewApiSource, runApiQuery } from "../external/query.ts";
import {
	textOf,
	parseMarkdownTable,
	parseTableList,
	parseDescribeColumns,
	parseConnections,
	dedupeConnections,
	classifyError,
	extractDuration,
	isMissingCatalogView,
	pick,
} from "../../engine/markdown-parser.ts";
import {
	buildSqlErrorHint,
	describeQueryContext,
	matchMissingObject,
	parseTableLocations,
	tableLocationQuery,
} from "../../engine/error-hints.ts";

/** dbx_execute_query 的真实行数上限（crates/dbx-core/src/ai/agent_tools.rs + 制品实测）。 */
export const DBX_MAX_ROWS = 1000;
export const DBX_EFFECTIVE_ROW_CAP = 1000;

/** schema 按方言的目录查询（与原 request-router.mjs 保持一致）。 */
const SCHEMA_QUERIES = {
	postgres: `SELECT n.nspname AS schema_name
FROM pg_catalog.pg_namespace n
WHERE n.nspname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
  AND n.nspname NOT LIKE 'pg_toast_temp_%'
  AND n.nspname NOT LIKE 'pg_temp_%'
ORDER BY n.nspname`,
	sqlserver: `SELECT s.name AS schema_name
FROM sys.schemas s
WHERE s.name NOT IN (
  'guest', 'INFORMATION_SCHEMA', 'sys',
  'db_owner', 'db_accessadmin', 'db_securityadmin', 'db_ddladmin',
  'db_backupoperator', 'db_datareader', 'db_datawriter',
  'db_denydatareader', 'db_denydatawriter'
)
ORDER BY CASE WHEN s.name = 'dbo' THEN 0 ELSE 1 END, s.name`,
	default: "SELECT schema_name FROM information_schema.schemata ORDER BY schema_name",
};

export function schemaQueryFor(dbType) {
	const type = String(dbType ?? "").toLowerCase();
	if (/postgres|redshift/.test(type)) return SCHEMA_QUERIES.postgres;
	if (/mssql|sqlserver/.test(type)) return SCHEMA_QUERIES.sqlserver;
	return SCHEMA_QUERIES.default;
}

export function normalizeDbType(dbType) {
	const value = String(dbType ?? "").toLowerCase();
	if (value === "aurora-postgresql") return "postgres";
	if (value === "mariadb") return "mysql";
	if (value === "uds") return "postgres";
	return value;
}

type AnyRecord = Record<string, unknown>;

export function toDbxAddParams(body: AnyRecord) {
	const args: Record<string, unknown> = { name: body.name, db_type: normalizeDbType(String(body.dbType ?? body.db_type ?? "")), host: body.host };
	if (body.port !== undefined) args.port = body.port;
	if (body.username !== undefined) args.username = body.username;
	if (body.password !== undefined) args.password = body.password;
	if (body.database !== undefined) args.database = body.database;
	if (body.ssl !== undefined) args.ssl = body.ssl === true;
	if (!args.host && body.file) args.host = body.file;
	return args;
}

export function clampRowLimit(rowLimit) {
	const value = Number.isFinite(rowLimit) ? Math.trunc(rowLimit) : DEFAULT_ROW_LIMIT;
	return Math.min(Math.max(value, 1), MAX_ROW_LIMIT);
}

export function clampTimeout(timeoutMs) {
	const value = Number.isFinite(timeoutMs) ? Math.trunc(timeoutMs) : 30_000;
	return Math.min(Math.max(value, 1000), MAX_TIMEOUT_MS);
}

export function dbxMaxRows(rowLimit) {
	return Math.min(Math.max(rowLimit, 1), DBX_MAX_ROWS, DBX_EFFECTIVE_ROW_CAP);
}

/** 从 dbx 工具调用结果提取结构化数据或抛 EngineError。 */
export function extractText(result, toolName) {
	const text = textOf(result);
	if (result.isError) {
		const err = classifyError(text);
		throw engineError(err.code, `${toolName} failed: ${err.detail}`, text);
	}
	return text;
}

export function isDriverUnavailable(rawText) {
	return /driver is not installed|DBX_DUCKDB_DRIVER_PATH/i.test(String(rawText ?? ""));
}

/**
 * createRouter 返回的共享 Context —— 各 domain API 文件 import 后，
 * 直接用 ctx.mcpClient()、ctx.ensureApiEngineConnection() 等。
 *
 * 所有需要 state 的函数（dataDir、now、auth）在这里闭包，
 * 纯工具函数（clampRowLimit 等）直接 export。
 */
type RouterAuth = { verify: (headers: Record<string, string | string[] | undefined>) => void };

export function createRouterContext({ auth, dataDir = null, now = () => Date.now() }: { auth: RouterAuth; dataDir?: string | null; now?: () => number }) {
	if (!auth) throw new Error("createRouterContext 需要 auth");

	const mcpClient = () => getDbxMcpClient(undefined);

	async function ensureApiEngineConnection() {
		if (!dataDir) throw engineError("API_ENGINE_UNAVAILABLE", "服务端没有数据目录，无法查询 API 接入数据源");
		try {
			const result = await mcpClient().callTool("dbx_add_connection", {
				name: API_ENGINE_CONNECTION,
				db_type: "duckdb",
				host: apiEngineDatabasePath(dataDir),
				database: API_ENGINE_DATABASE,
			});
			extractText(result, "dbx_add_connection");
		} catch (e) {
			if (e?.engineError) {
				throw engineError(
					"API_ENGINE_UNAVAILABLE",
					`本机查询通道不可用（需要 DuckDB 驱动）：${e.message}`,
					e.detail,
				);
			}
			throw e;
		}
	}

	async function resolveWriteConnSpec(connectionName, connSpec) {
		const base = { ...connSpec, db_type: connSpec.db_type ?? connSpec.dbType };
		let authoritative = null;
		try {
			const result = await mcpClient().callTool("dbx_list_connections", {});
			authoritative = parseConnections(textOf(result)).find((c) => c.name === connectionName) ?? null;
		} catch { authoritative = null; }
		if (!authoritative) return base;
		return {
			...base,
			db_type: base.db_type || authoritative.type,
			host: base.host || authoritative.host,
			port: base.port || authoritative.port,
			database: base.database || authoritative.database,
		};
	}

	type QueryContext = {
		connection: string; sql: string; effectiveSql: string;
		dbType?: string; host?: string; port?: number | string; database?: string;
		tableLocation?: string[] | null;
	};

	async function resolveQueryContext(connectionName: string, sql: string, effectiveSql: string): Promise<QueryContext> {
		const context: QueryContext = { connection: connectionName, sql, effectiveSql };
		try {
			const result = await mcpClient().callTool("dbx_list_connections", {});
			const found = parseConnections(textOf(result)).find((c) => c.name === connectionName);
			if (found) {
				context.dbType = found.type;
				context.host = found.host;
				context.port = found.port;
				context.database = found.database;
			}
		} catch { /* 不可用时保留基础信息 */ }
		return context;
	}

	async function attachTableLocation(connectionName: string, dbType: string, rawName: string, context: QueryContext): Promise<QueryContext> {
		const lookup = tableLocationQuery(dbType, rawName);
		if (!lookup) return context;
		try {
			const result = await mcpClient().callTool(
				"dbx_execute_query",
				{ connection_name: connectionName, sql: lookup, max_rows: 5 },
				15_000,
			);
			if (!result?.isError) context.tableLocation = parseTableLocations(textOf(result));
		} catch { /* 保持 undefined */ }
		return context;
	}

	async function describeFailure(connectionName: string, sql: string, effectiveSql: string, rawText: unknown): Promise<string> {
		try {
			const context = await resolveQueryContext(connectionName, sql, effectiveSql);
			const missing = matchMissingObject(rawText);
			if (missing) await attachTableLocation(connectionName, context.dbType, missing.name, context);
			const text = [describeQueryContext(context), buildSqlErrorHint(rawText, context)]
				.filter(Boolean)
				.join("\n");
			return text ? `\n${text}` : "";
		} catch { return ""; }
	}

	type OutcomeExtra = {
		pageLimit?: number | null;
		rowLimit?: number;
		maxRows?: number;
		durationMs?: number;
		[key: string]: unknown;
	};
	function toOutcome(text: string, extra: OutcomeExtra = {}) {
		const lim = extra.pageLimit ?? DBX_EFFECTIVE_ROW_CAP;
		const { columns, rows: allRows } = parseMarkdownTable(text);
		const rows = allRows.length > lim ? allRows.slice(0, lim) : allRows;
		const truncated = extra.pageLimit === null && allRows.length >= DBX_EFFECTIVE_ROW_CAP;
		const affected = text.match(/(\d+)\s*row(?:s)?\s*(?:affected|inserted|updated|deleted)/i);
		return {
			columns,
			rows,
			row_count: rows.length,
			truncated,
			row_limit: extra.rowLimit,
			max_rows: extra.maxRows,
			engine_row_count: allRows.length,
			duration_ms: extra.durationMs,
			duration_hint: extractDuration(text),
			raw_text: text,
			affected_rows: affected ? parseInt(affected[1], 10) : null,
			...extra,
		};
	}

	return {
		auth,
		dataDir,
		now,
		mcpClient,
		disposeDbxMcpClient,  // 重启 dbx-mcp 子进程（驱动安装/手动指定路径后需要）
		ensureApiEngineConnection,
		resolveWriteConnSpec,
		resolveQueryContext,
		attachTableLocation,
		describeFailure,
		toOutcome,
		isDriverUnavailable,
		// 工具函数（从 engine/ 模块 import 过来让各 domain 统一用）
		classifyQuery,
		buildCountSql,
		buildPagedSql,
		canPaginate,
		supportsPagination,
		executeWrite,
		inferColumnTypes,
		isApiDbType,
		normalizeApiSource,
		fetchApiSource,
		API_ENGINE_CONNECTION,
		API_ENGINE_DATABASE,
		apiEngineDatabasePath,
		apiSourceToConnection,
		apiSourceToPublic,
		findApiSource,
		isApiSourceName,
		listApiSources,
		removeApiSource,
		upsertApiSource,
		previewApiSource,
		runApiQuery,
		textOf,
		parseMarkdownTable,
		parseTableList,
		parseDescribeColumns,
		parseConnections,
		dedupeConnections,
		classifyError,
		isMissingCatalogView,
		pick,
		extractText,
	};
}

import type { PluginCommandApi } from "@astravia-org/plugin-sdk";

/** dbx-pro 的 dbx CLI 封装层 — 所有命令都是单次调用 + --json */

export interface DbConnection {
	name: string;
	type: string;
	host: string;
	port: number;
	database?: string;
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
	table_type: string;
}

export interface DbQueryResult {
	connection: string;
	columns: string[];
	rows: Record<string, unknown>[];
	row_count: number;
}

export interface DbxCliError {
	code: string;
	message: string;
}

const DBX_ENV: Record<string, string> = {
	// 复用宿主 ASTRAVIA_HOME 数据目录下独立的 dbx 引擎存储
	DBX_DATA_DIR: getDbxDataDir(),
};

function getDbxDataDir(): string {
	// 插件没有 Electron app.getPath，回退到 ~/.astravia/dbx-pro
	const home = typeof process !== "undefined" && process.env ? (process.env.HOME ?? process.env.USERPROFILE) : "";
	if (home) return `${home}/.astravia/dbx-pro`;
	return ".";
}

function parseJsonOrThrow(stdout: string, stderr: string): unknown {
	const trimmed = stdout.trim();
	if (!trimmed) {
		// dbx 错误会打 stderr，且 exitCode != 0，但 error 结构在 stderr
		try {
			const parsed = JSON.parse(stderr.trim());
			const err = (parsed as { error?: DbxCliError }).error;
			if (err) throw new Error(`[${err.code}] ${err.message}`);
		} catch {
			// 不是 JSON，原样返回
		}
		throw new Error(stderr.trim() || "(dbx returned empty output)");
	}
	try {
		return JSON.parse(trimmed);
	} catch {
		// dbx 有时 stderr 才是 error JSON
		try {
			const parsed = JSON.parse(stderr.trim());
			const err = (parsed as { error?: DbxCliError }).error;
			if (err) throw new Error(`[${err.code}] ${err.message}`);
		} catch {
			// stderr 也不是 JSON
		}
		throw new Error(`dbx 返回非 JSON: ${trimmed.slice(0, 200)}`);
	}
}

/**
 * 通用 dbx 命令执行器。
 * @param command 宿主注入的 PluginCommandApi
 * @param args dbx CLI 参数（不含 --json，已自动追加）
 */
async function run(
	command: PluginCommandApi,
	args: string[],
): Promise<unknown> {
	const fullArgs = [...args, "--json"];
	let result;
	try {
		result = await command.run("dbx", fullArgs, {
			env: DBX_ENV,
			timeoutMs: 30_000,
		});
	} catch (err) {
		throw new Error(`dbx 调用失败: ${err instanceof Error ? err.message : String(err)}`);
	}
	if (result.exitCode !== 0) {
		// dbx 错误格式: {"error": {"code": "CODE", "message": "..."}}
		try {
			const parsed = JSON.parse(result.stderr.trim());
			const err = (parsed as { error?: DbxCliError }).error;
			if (err) throw new Error(`[${err.code}] ${err.message}`);
		} catch {
			// stderr 不是 JSON，原样抛出
		}
		throw new Error(result.stderr.trim() || `dbx exit ${result.exitCode}`);
	}
	return parseJsonOrThrow(result.stdout, result.stderr);
}

/** 列出所有已保存的连接 */
export async function listConnections(command: PluginCommandApi): Promise<DbConnection[]> {
	const data = (await run(command, ["connections", "list"])) as { connections: DbConnection[] };
	return data?.connections ?? [];
}

/** 列出指定连接的表 */
export async function listTables(
	command: PluginCommandApi,
	connectionName: string,
	schema?: string,
): Promise<DbTableInfo[]> {
	const args = ["schema", "list", connectionName];
	if (schema) args.push("--schema", schema);
	const data = (await run(command, args)) as { tables: DbTableInfo[] };
	return data?.tables ?? [];
}

/** 描述指定表的列 */
export async function describeTable(
	command: PluginCommandApi,
	connectionName: string,
	tableName: string,
	schema?: string,
): Promise<DbColumn[]> {
	const args = ["schema", "describe", connectionName, tableName];
	if (schema) args.push("--schema", schema);
	const data = (await run(command, args)) as { columns: DbColumn[] };
	return data?.columns ?? [];
}

/** 执行 SQL 查询 */
export async function executeQuery(
	command: PluginCommandApi,
	connectionName: string,
	sql: string,
	options: {
		allowWrites?: boolean;
		allowDangerous?: boolean;
		limit?: number;
		timeoutMs?: number;
		database?: string;
	} = {},
): Promise<DbQueryResult> {
	const args = ["query", connectionName, sql];
	if (options.database) args.push("--database", options.database);
	if (options.limit) args.push("--limit", String(options.limit));
	if (options.timeoutMs) args.push("--timeout", `${options.timeoutMs}ms`);
	if (options.allowWrites) args.push("--allow-writes");
	if (options.allowDangerous) {
		if (!options.allowWrites) {
			throw new Error("--allow-dangerous-sql requires --allow-writes");
		}
		args.push("--allow-dangerous-sql");
	}
	return (await run(command, args)) as DbQueryResult;
}

/** 获取表结构上下文（给 AI 用） */
export async function getContext(
	command: PluginCommandApi,
	connectionName: string,
	options: {
		schema?: string;
		tables?: string[];
		maxTables?: number;
	} = {},
): Promise<unknown> {
	const args = ["context", connectionName];
	if (options.schema) args.push("--schema", options.schema);
	if (options.tables?.length) args.push("--tables", options.tables.join(","));
	if (options.maxTables) args.push("--max-tables", String(options.maxTables));
	return run(command, args);
}

/** dbx doctor 诊断 */
export async function doctor(command: PluginCommandApi): Promise<unknown> {
	return run(command, ["doctor"]);
}

/** dbx capabilities（支持的数据库类型） */
export async function capabilities(command: PluginCommandApi): Promise<unknown> {
	return run(command, ["capabilities"]);
}

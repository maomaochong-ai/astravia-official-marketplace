/**
 * dbx 引擎 CLI 调用封装 — 所有命令单次调用 + --json。
 *
 * 插件不直接和 dbx 的 bridge/stdio 管道交互，而是通过宿主 command.run()
 * 执行 dbx 二进制的单次 CLI 调用。dbx CLI 本身对 --json 输出有稳定约定，
 * 错误会把结构化 JSON 打到 stderr 并以非零 exit 退出。
 */

import type { PluginCommandApi } from "@astravia-org/plugin-sdk";
import type {
	DbColumn,
	DbTableInfo,
	DbQueryResult,
} from "../../../domain/connection-config";
import { DBX_ENV } from "../../../domain/db-env";

export interface DbxCliError {
	code: string;
	message: string;
}

async function run(
	command: PluginCommandApi,
	args: string[],
	timeoutMs = 30_000,
): Promise<unknown> {
	const fullArgs = [...args, "--json"];
	let result;
	try {
		result = await command.run("dbx", fullArgs, { env: DBX_ENV, timeoutMs });
	} catch (err) {
		throw new Error(`dbx invocation failed: ${err instanceof Error ? err.message : String(err)}`);
	}
	if (result.exitCode !== 0) {
		try {
			const parsed = JSON.parse(result.stderr.trim());
			const err = (parsed as { error?: DbxCliError }).error;
			if (err) throw new Error(`[${err.code}] ${err.message}`);
		} catch { /* not JSON */ }
		throw new Error(result.stderr.trim() || `dbx exit ${result.exitCode}`);
	}
	const trimmed = result.stdout.trim();
	if (!trimmed) return null;
	try { return JSON.parse(trimmed); }
	catch { return trimmed; }
}

export async function listConnections(command: PluginCommandApi): Promise<{ name: string; type: string; host: string; port: number; database?: string }[]> {
	const data = (await run(command, ["connections", "list"])) as { connections: { name: string; type: string; host: string; port: number; database?: string }[] };
	return data?.connections ?? [];
}

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

export interface QueryOptions {
	allowWrites?: boolean;
	allowDangerous?: boolean;
	limit?: number;
	timeoutMs?: number;
	database?: string;
}

export async function executeQuery(
	command: PluginCommandApi,
	connectionName: string,
	sql: string,
	options: QueryOptions = {},
): Promise<DbQueryResult> {
	const args = ["query", connectionName, sql];
	if (options.database) args.push("--database", options.database);
	if (options.limit) args.push("--limit", String(options.limit));
	if (options.timeoutMs) args.push("--timeout", `${options.timeoutMs}ms`);
	if (options.allowWrites) args.push("--allow-writes");
	if (options.allowDangerous) {
		if (!options.allowWrites) throw new Error("--allow-dangerous-sql requires --allow-writes");
		args.push("--allow-dangerous-sql");
	}
	return (await run(command, args, options.timeoutMs ?? 30_000)) as DbQueryResult;
}

export async function getContext(
	command: PluginCommandApi,
	connectionName: string,
	options: { schema?: string; tables?: string[]; maxTables?: number } = {},
): Promise<unknown> {
	const args = ["context", connectionName];
	if (options.schema) args.push("--schema", options.schema);
	if (options.tables?.length) args.push("--tables", options.tables.join(","));
	if (options.maxTables) args.push("--max-tables", String(options.maxTables));
	return run(command, args);
}

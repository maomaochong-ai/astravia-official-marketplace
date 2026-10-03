/**
 * 查询服务 — 把「连接配置」翻译成一次真实的 SQL 执行。
 *
 * 当前落地范围（诚实边界，不假装已支持）：
 *   - sqlite：经由宿主白名单命令 sqlite3 直连数据库文件，返回 JSON 结果集。
 *   - 其余类型：需要插件自持的 dbx 引擎（providers.services 通路），
 *     引擎未接入前抛出 ENGINE_NOT_READY，由 UI 原样展示。
 *
 * 之所以不做成「假装成功返回空集」：工作台的可信度建立在结果真实上，
 * 未接入的驱动必须让用户看见原因，而不是静默的空表格。
 */

import type { DbConnection, DbQueryResult } from "../../domain/connection-config";
import { parseResultSets } from "../../domain/sqlite-output";
import { getCommand } from "../../runtime-contract";

/** 与宿主命令调用的默认预算对齐。 */
const DEFAULT_TIMEOUT_MS = 30_000;

const ENGINE_NOT_READY = "ENGINE_NOT_READY";
const SQLITE_TYPE = "sqlite";

/** sqlite 连接的文件路径：表单把数据库文件填在 database，兜底取 host。 */
function sqliteFilePath(conn: DbConnection): string {
	return (conn.database?.trim() || conn.host?.trim() || "").trim();
}

/** 连接类型是否已有可用的直连实现。 */
export function isExecutable(conn: DbConnection): boolean {
	return conn.db_type === SQLITE_TYPE;
}

/**
 * 执行一条 SQL。
 * @param conn 已保存的连接配置
 * @param sql  待执行的 SQL 文本
 * @param timeoutMs 覆盖默认超时（宿主上限 5 分钟）
 */
export async function executeQuery(
	conn: DbConnection,
	sql: string,
	timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<DbQueryResult> {
	if (!isExecutable(conn)) {
		const error = new Error(
			`连接类型 ${conn.db_type} 需要 dbx 引擎支持，当前版本仅内置 SQLite 直连；请在连接管理中改用 SQLite，或等待引擎能力发布。`,
		);
		(error as Error & { code?: string }).code = ENGINE_NOT_READY;
		throw error;
	}

	const file = sqliteFilePath(conn);
	if (!file) throw new Error("SQLite 连接缺少数据库文件路径，请在连接配置中填写。");

	const limit = conn.query_timeout_secs && conn.query_timeout_secs > 0
		? Math.min(conn.query_timeout_secs * 1000, 300_000)
		: timeoutMs;

	// sqlite3 会把任何以 - 开头的 argv 当作命令行选项，SQL 前必须插入 -- 结束选项解析，
	// 否则首行是注释（-- …）的 SQL 直接报 unknown option。
	const result = await getCommand().run("sqlite3", [file, "-json", "--", sql], { timeoutMs: limit });
	if (result.exitCode !== 0) {
		throw new Error(result.stderr.trim() || `sqlite3 退出码 ${result.exitCode}`);
	}

	const text = String(result.stdout ?? "").trim();
	const sets = text ? parseResultSets(text) : [];
	if (text && sets.length === 0) {
		throw new Error(`无法解析 sqlite3 的输出：${text.slice(0, 200)}`);
	}

	// sqlite3 -json 对多语句会连续打印多个结果集；工作台只有一个结果网格，
	// 这里展示最后一个结果集，并把被忽略的数量如实告诉用户。
	const last = sets.length > 0 ? sets[sets.length - 1] : undefined;
	const rows: Record<string, unknown>[] = last ?? [];
	const columns = rows.length > 0 ? Object.keys(rows[0] as Record<string, unknown>) : [];
	return {
		connection: conn.name,
		columns,
		rows,
		row_count: rows.length,
		...(sets.length > 1 ? { note: `已忽略前 ${sets.length - 1} 个结果集，仅展示最后一个` } : {}),
	};
}

/** 连通性探测：执行前的最小代价校验。 */
export async function testConnection(conn: DbConnection): Promise<void> {
	await executeQuery(conn, "SELECT 1 AS ok", 10_000);
}

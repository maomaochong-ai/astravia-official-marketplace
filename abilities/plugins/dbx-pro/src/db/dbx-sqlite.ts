import type { PluginCommandApi } from "@astravia-org/plugin-sdk";

/**
 * dbx.db SQLite 直连层 — 用 sqlite3 CLI 读写 dbx 的连接存储。
 *
 * dbx 存储结构（dbx-core/src/storage.rs）：
 *   CREATE TABLE connections (id TEXT PRIMARY KEY, config_json TEXT NOT NULL)
 *   CREATE TABLE connection_secrets (
 *       connection_id TEXT NOT NULL, key TEXT NOT NULL, secret TEXT NOT NULL
 *   )
 *
 * dbx CLI 本身没有 add/remove 连接子命令，所以用 sqlite3 CLI
 * 直接操作它的 SQLite 数据库——和 dbx 桌面应用共享同一份存储。
 *
 * 环境变量 DBX_DATA_DIR 决定 dbx.db 路径（默认 ~/Library/Application Support/com.dbx.app/）。
 * 本插件注入自己的 DBX_DATA_DIR，保持独立。
 */

const DBX_ENV = { DBX_DATA_DIR: getDbxDataDir() };

function getDbxDataDir(): string {
	const home = typeof process !== "undefined" && process.env ? (process.env.HOME ?? process.env.USERPROFILE) : "";
	if (home) return `${home}/.astravia/dbx-pro`;
	return ".";
}

function dbxDbPath(): string {
	// dbx-core paths.rs: app_data_dir()/dbx.db
	return `${DBX_ENV.DBX_DATA_DIR}/dbx.db`;
}

interface ExecResult {
	stdout: string;
	stderr: string;
	exitCode: number | null;
}

async function exec(command: PluginCommandApi, args: string[]): Promise<ExecResult> {
	let result;
	try {
		result = await command.run("sqlite3", args, { env: DBX_ENV, timeoutMs: 10_000 });
	} catch (err) {
		throw new Error(`sqlite3 调用失败: ${err instanceof Error ? err.message : String(err)}`);
	}
	return { stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode };
}

/** 确保 dbx.db 存在并建表 */
export async function ensureDbxDb(command: PluginCommandApi): Promise<void> {
	const db = dbxDbPath();
	// sqlite3 会自动创建不存在的 db 文件，但我们需要确保目录存在
	// command.run 跑在宿主 main 进程，目录应该已被 dbx CLI 自己创建过
	const schema = [
		"CREATE TABLE IF NOT EXISTS connections (id TEXT PRIMARY KEY, config_json TEXT NOT NULL)",
		"CREATE TABLE IF NOT EXISTS connection_secrets (connection_id TEXT NOT NULL, key TEXT NOT NULL, secret TEXT NOT NULL)",
	].join("; ");
	await exec(command, [db, schema]);
}

/**
 * 读 dbx.db 所有连接的 config_json，反序列化为 ConnectionConfig 数组。
 * 返回完整的 dbx ConnectionConfig（字段很多，大部分可选）。
 */
export async function readAllConfigs(command: PluginCommandApi): Promise<unknown[]> {
	const db = dbxDbPath();
	const r = await exec(command, [db, "-json", "SELECT config_json FROM connections ORDER BY name(config_json)"]);
	if (r.exitCode !== 0) {
		if (r.stderr.includes("no such table")) {
			await ensureDbxDb(command);
			return [];
		}
		throw new Error(r.stderr.trim() || `sqlite3 exit ${r.exitCode}`);
	}
	if (!r.stdout.trim()) return [];
	// sqlite3 -json 输出: [{"config_json":"{...}"}, ...]
	const rows = JSON.parse(r.stdout) as Array<{ config_json: string }>;
	return rows.map((r) => {
		try { return JSON.parse(r.config_json); }
		catch { return null; }
	}).filter((x): x is Record<string, unknown> => x !== null);
}

export async function writeConfig(command: PluginCommandApi, config: Record<string, unknown>): Promise<void> {
	const db = dbxDbPath();
	const id = String(config.id ?? "");
	if (!id) throw new Error("connection id required");
	const json = JSON.stringify(config).replace(/'/g, "''");
	const sql = `INSERT OR REPLACE INTO connections (id, config_json) VALUES ('${id}', '${json}')`;
	const r = await exec(command, [db, sql]);
	if (r.exitCode !== 0) throw new Error(r.stderr.trim() || `sqlite3 exit ${r.exitCode}`);
}

export async function deleteConfig(command: PluginCommandApi, id: string): Promise<void> {
	const db = dbxDbPath();
	const r = await exec(command, [db, `DELETE FROM connections WHERE id='${id}'`]);
	if (r.exitCode !== 0) throw new Error(r.stderr.trim() || `sqlite3 exit ${r.exitCode}`);
	// 顺便清理 secrets
	await exec(command, [db, `DELETE FROM connection_secrets WHERE connection_id='${id}'`]);
}

export function genUuid(): string {
	// 兼容非 crypto 环境的 fallback
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
		return crypto.randomUUID();
	}
	return `conn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

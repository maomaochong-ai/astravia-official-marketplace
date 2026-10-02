/**
 * dbx 引擎连接存储 — sqlite3 CLI 读写 dbx.db。
 *
 * dbx 引擎存储结构（dbx-core 内置 SQLite）：
 *   CREATE TABLE connections (id TEXT PRIMARY KEY, config_json TEXT NOT NULL);
 *   CREATE TABLE connection_secrets (
 *     connection_id TEXT NOT NULL, key TEXT NOT NULL, secret TEXT NOT NULL
 *   );
 *
 * dbx CLI 本身没有 add/remove 连接子命令，本模块用 sqlite3 CLI
 * 直接操作引擎的 SQLite 数据库，与引擎桌面应用共享同一份存储。
 *
 * 环境变量 DBX_DATA_DIR 决定 dbx.db 路径。插件注入自己的 DBX_DATA_DIR，
 * 保持与引擎桌面应用的数据隔离。
 */

import type { PluginCommandApi } from "@astravia-org/plugin-sdk";
import { DBX_ENV } from "./db-env";

function dbxDbPath(): string {
	return `${DBX_ENV.DBX_DATA_DIR}/dbx.db`;
}

async function runSql(command: PluginCommandApi, sql: string): Promise<void> {
	const db = dbxDbPath();
	const r = await command.run("sqlite3", [db, sql], { env: DBX_ENV, timeoutMs: 10_000 });
	if (r.exitCode !== 0) throw new Error(r.stderr.trim() || `sqlite3 exit ${r.exitCode}`);
}

export async function ensureDbxDb(command: PluginCommandApi): Promise<void> {
	const db = dbxDbPath();
	const schema = [
		"CREATE TABLE IF NOT EXISTS connections (id TEXT PRIMARY KEY, config_json TEXT NOT NULL)",
		"CREATE TABLE IF NOT EXISTS connection_secrets (connection_id TEXT NOT NULL, key TEXT NOT NULL, secret TEXT NOT NULL)",
	].join("; ");
	await runSql(command, schema);
}

export async function readAllConfigs(command: PluginCommandApi): Promise<unknown[]> {
	const db = dbxDbPath();
	const r = await command.run("sqlite3", [db, "-json", "SELECT config_json FROM connections ORDER BY name(config_json)"], {
		env: DBX_ENV, timeoutMs: 10_000,
	});
	if (r.exitCode !== 0) {
		if (r.stderr.includes("no such table")) {
			await ensureDbxDb(command);
			return [];
		}
		throw new Error(r.stderr.trim() || `sqlite3 exit ${r.exitCode}`);
	}
	if (!r.stdout.trim()) return [];
	const rows = JSON.parse(r.stdout) as Array<{ config_json: string }>;
	return rows.map((r) => {
		try { return JSON.parse(r.config_json); } catch { return null; }
	}).filter((x): x is Record<string, unknown> => x !== null);
}

export async function writeConfig(command: PluginCommandApi, config: Record<string, unknown>): Promise<void> {
	const id = String(config.id ?? "");
	if (!id) throw new Error("connection id required");
	const json = JSON.stringify(config).replace(/'/g, "''");
	await runSql(command, `INSERT OR REPLACE INTO connections (id, config_json) VALUES ('${id}', '${json}')`);
}

export async function deleteConfig(command: PluginCommandApi, id: string): Promise<void> {
	await runSql(command, `DELETE FROM connections WHERE id='${id}'`);
	await runSql(command, `DELETE FROM connection_secrets WHERE connection_id='${id}'`);
}

export function genUuid(): string {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
		return crypto.randomUUID();
	}
	return `conn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

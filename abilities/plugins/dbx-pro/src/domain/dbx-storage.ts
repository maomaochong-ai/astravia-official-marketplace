/**
 * 连接配置仓储 — 所有连接的真实权威来源是 dbx-mcp。
 *
 * localStorage 只做 UI 表单临时缓存（writeConfig 在新连接时生成 id）。
 * 读/删操作统一走 dbx-mcp（dbx_list_connections / dbx_remove_connection）。
 */

import { readJsonFile, writeJsonFile } from "@astravia-org/plugin-sdk";
import type { DbConnection } from "./connection-config";
import { getStorage } from "../runtime-contract";
import {
	engineListConnections,
	engineAddConnection,
	engineRemoveConnection,
	EngineClientError,
	EngineConnectionSummary,
} from "../shared/services/engine-client";

const STORE_PATH = "connections.json";

export function genUuid(): string {
	const cryptoRef = globalThis.crypto as Crypto | undefined;
	if (cryptoRef?.randomUUID) return cryptoRef.randomUUID();
	return `conn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** dbx-mcp EngineConnectionSummary → 面板组件期望的 DbConnection。 */
function toDbConnection(summary: EngineConnectionSummary): DbConnection {
	return {
		id: summary.id || genUuid(),
		name: summary.name,
		db_type: summary.type,
		host: summary.host,
		port: summary.port || 0,
		username: "",
		password: "",
		database: summary.database || undefined,
	};
}

/**
 * 把 dbx-mcp summary 和 localStorage 镜像 merge。
 * - localStorage 镜像有完整密码（用户添加连接时写入的）
 * - dbx-mcp summary 有最新的元数据（host/port/database 可能被用户在 dbx 桌面改过）
 * - localStorage 优先密码，dbx-mcp 覆盖元数据
 */
function mergeWithLocalMirror(serverList: DbConnection[], localList: DbConnection[]): DbConnection[] {
	const localByName = new Map(localList.map((c) => [c.name, c]));
	return serverList.map((serverConn) => {
		const local = localByName.get(serverConn.name);
		if (!local) return serverConn; // 本地没有 → 纯 dbx-mcp 连接，没密码
		return {
			...serverConn,          // dbx-mcp 元数据优先（最新）
			username: local.username || serverConn.username,
			password: local.password || serverConn.password,
			ssl: local.ssl ?? serverConn.ssl,
			database: serverConn.database || local.database,
		};
	});
}

/** 读：优先 dbx-mcp（有完整密码走 merge，dbx-mcp 不可用 fallback localStorage）。 */
export async function readAllConfigs(): Promise<DbConnection[]> {
	try {
		const { connections } = await engineListConnections();
		const serverList = connections
			.map(toDbConnection)
			.filter((c): c is DbConnection => Boolean(c.name && c.db_type));

		// 用 localStorage 镜像补密码（用户添加连接时写入的完整配置）
		let localList: DbConnection[] = [];
		try { localList = await readLocalOnly(); } catch { /* ignore */ }

		return mergeWithLocalMirror(serverList, localList)
			.sort((a, b) => a.name.localeCompare(b.name));
	} catch (e) {
		if (!(e instanceof EngineClientError)) throw e;
		// 引擎不可用时 fallback localStorage
	}
	try {
		const doc = await readJsonFile<{ connections?: DbConnection[] }>(getStorage(), STORE_PATH);
		const list = Array.isArray(doc?.connections) ? doc!.connections : [];
		return list
			.filter((c): c is DbConnection => Boolean(c && typeof c.id === "string" && typeof c.name === "string"))
			.sort((a, b) => a.name.localeCompare(b.name));
	} catch {
		return [];
	}
}

/** 写：优先 dbx-mcp，同时写 localStorage 镜像（给表单生成 id 用）。 */
export async function writeConfig(config: DbConnection): Promise<void> {
	await engineAddConnection({
		name: config.name,
		dbType: config.db_type,
		host: config.host,
		port: config.port,
		username: config.username,
		password: config.password,
		database: config.database,
		ssl: config.ssl,
	});
	try {
		const configs = await readLocalOnly();
		const index = configs.findIndex((c) => c.id === config.id);
		if (index >= 0) configs[index] = config;
		else configs.push(config);
		await writeLocalOnly(configs);
	} catch { /* ignore */ }
}

/** 删：先查 name（dbx 删连接用 name 不是 id），再调 dbx-mcp，最后清 localStorage 镜像。 */
export async function deleteConfig(id: string): Promise<void> {
	const configs = await readLocalOnly();
	const target = configs.find((c) => c.id === id);
	if (target?.name) {
		try { await engineRemoveConnection(target.name); } catch { /* ignore */ }
	}
	try {
		await writeLocalOnly(configs.filter((c) => c.id !== id));
	} catch { /* ignore */ }
}

async function readLocalOnly(): Promise<DbConnection[]> {
	try {
		const doc = await readJsonFile<{ connections?: DbConnection[] }>(getStorage(), STORE_PATH);
		return Array.isArray(doc?.connections) ? doc!.connections : [];
	} catch { return []; }
}

async function writeLocalOnly(configs: DbConnection[]): Promise<void> {
	await writeJsonFile(getStorage(), STORE_PATH, { schemaVersion: 1, connections: configs });
}

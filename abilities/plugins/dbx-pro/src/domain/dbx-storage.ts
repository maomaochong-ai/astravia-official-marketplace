/**
 * 连接配置仓储 — 所有连接的真实权威来源是引擎服务。
 *
 * 敏感凭据（密码）不写入明文 JSON：
 * - 非密元数据（host/port/库/标记等）存宿主托管的 connections.json 镜像；
 * - 密码存宿主加密凭据库 secrets（`db-password:<连接名>`），执行时才取回；
 * - 读到历史镜像里遗留的明文密码时，自动迁入 secrets 并擦除镜像。
 *
 * 读/删操作统一走引擎服务（list_connections / remove_connection）。
 */

import { readJsonFile, writeJsonFile } from "@astravia-org/plugin-sdk";
import type { DbConnection } from "./connection-config.ts";
import { getSecrets, getStorage } from "../runtime-contract.ts";
import {
	engineListConnections,
	engineAddConnection,
	engineRemoveConnection,
	EngineClientError,
} from "../shared/services/engine-client.ts";
import type { EngineConnectionSummary } from "../shared/services/engine-client.ts";

const STORE_PATH = "connections.json";
export const PASSWORD_PREFIX = "db-password:";

function passwordKey(name: string): string {
	return `${PASSWORD_PREFIX}${name}`;
}

export function genUuid(): string {
	const cryptoRef = globalThis.crypto as Crypto | undefined;
	if (cryptoRef?.randomUUID) return cryptoRef.randomUUID();
	return `conn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** 引擎服务 EngineConnectionSummary → 面板组件期望的 DbConnection（不含密码）。 */
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
		schemas: [],
	};
}

/** 归一化 schema 选择：旧单 schema → 数组；去重去空。空数组 = 全部。 */
function normalizeSchemas(schemas: unknown, legacySchema?: string): string[] {
	const list = Array.isArray(schemas) ? schemas.map((s) => String(s).trim()) : [];
	if (legacySchema && legacySchema.trim()) list.push(legacySchema.trim());
	return [...new Set(list.filter((s) => s.length > 0))];
}

/**
 * 合并引擎服务 summary 与本地镜像的非密元数据。
 * 引擎服务提供最新 host/port/database；本地镜像补 username / ssl / 安全标记。
 * 密码不在这里处理，统一由加密 vault 取回。
 */
function mergeWithLocalMirror(serverList: DbConnection[], localList: DbConnection[]): DbConnection[] {
	const localByName = new Map(localList.map((c) => [c.name, c]));
	return serverList.map((serverConn) => {
		const local = localByName.get(serverConn.name);
		if (!local) return serverConn;
		return {
			...serverConn,
			username: local.username || serverConn.username,
			// schema 选择只在本地镜像（引擎服务连接配置不带）。旧单 schema 一并迁移。
			schemas: normalizeSchemas(local.schemas ?? serverConn.schemas, local.schema ?? serverConn.schema),
			schema: undefined,
			ssl: local.ssl ?? serverConn.ssl,
			read_only: local.read_only ?? serverConn.read_only,
			is_production: local.is_production ?? serverConn.is_production,
			note: local.note ?? serverConn.note,
			database: serverConn.database || local.database,
		};
	});
}

/** 从加密 vault 取回该连接密码并附加（vault 不可用时保持原状）。 */
async function attachPassword(conn: DbConnection): Promise<DbConnection> {
	try {
		const secret = await getSecrets().get(passwordKey(conn.name));
		if (typeof secret === "string" && secret) return { ...conn, password: secret };
	} catch { /* vault 暂不可用 */ }
	return conn;
}

/**
 * 迁移历史镜像里遗留的明文密码：迁入加密 vault，随后重写镜像擦除密码。
 * 只在确实存在明文时动作。
 */
async function migrateLegacyPlaintext(localList: DbConnection[]): Promise<void> {
	const legacy = localList.filter((c) => c.password);
	if (legacy.length === 0) return;
	await Promise.all(
		legacy.map(async (c) => {
			try {
				const existing = await getSecrets().get(passwordKey(c.name));
				if (!existing && c.password) await getSecrets().set(passwordKey(c.name), c.password);
			} catch { /* ignore */ }
		}),
	);
	try {
		const scrubbed = localList.map((c) => (c.password ? { ...c, password: "" } : c));
		await writeLocalOnly(scrubbed);
	} catch { /* ignore */ }
}

/** 读：优先引擎服务，密码从加密 vault 补全；引擎服务不可用时 fallback 镜像 + vault。 */
export async function readAllConfigs(): Promise<DbConnection[]> {
	try {
		const { connections } = await engineListConnections();
		const serverList = connections
			.map(toDbConnection)
			.filter((c): c is DbConnection => Boolean(c.name && c.db_type));

		let localList: DbConnection[] = [];
		try { localList = await readLocalOnly(); } catch { /* ignore */ }

		const merged = mergeWithLocalMirror(serverList, localList).sort((a, b) => a.name.localeCompare(b.name));
		await migrateLegacyPlaintext(localList);
		return Promise.all(merged.map((c) => attachPassword(c)));
	} catch (e) {
		if (!(e instanceof EngineClientError)) throw e;
	}
	try {
		const doc = await readJsonFile<{ connections?: DbConnection[] }>(getStorage(), STORE_PATH);
		const list = Array.isArray(doc?.connections) ? doc!.connections : [];
		const filtered = list
			.filter((c): c is DbConnection => Boolean(c && typeof c.id === "string" && typeof c.name === "string"))
			.sort((a, b) => a.name.localeCompare(b.name));
		return Promise.all(filtered.map((c) => attachPassword(c)));
	} catch {
		return [];
	}
}

/** 写：引擎服务 + 加密 vault 存密码；镜像只存非密元数据。 */
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
		if (config.password) await getSecrets().set(passwordKey(config.name), config.password);
		else await getSecrets().delete(passwordKey(config.name));
	} catch { /* vault 暂不可用时不阻断连接保存 */ }
	try {
		const configs = await readLocalOnly();
		const mirror: DbConnection = { ...config, password: "" };
		const index = configs.findIndex((c) => c.id === config.id);
		if (index >= 0) configs[index] = mirror;
		else configs.push(mirror);
		await writeLocalOnly(configs);
	} catch { /* ignore */ }
}

/** 删：以引擎服务为权威来源，按引擎解析 id→name，不依赖本地镜像 id 一致。 */
export async function deleteConfig(id: string): Promise<void> {
	// id 来自 readAllConfigs（引擎 UUID），可能与本地镜像创建时生成的 id 不同。
	// 必须先从引擎按 id 取回真实连接名，否则镜像里找不到同 id 目标会跳过引擎删除。
	let name: string | undefined;
	try {
		const { connections } = await engineListConnections();
		name = connections.find((c) => c.id === id)?.name;
	} catch { /* 引擎不可用时退回镜像查找 */ }

	const configs = await readLocalOnly();
	name ??= configs.find((c) => c.id === id)?.name;

	// 引擎删除失败必须上抛（由 remove() 提示），否则「提示成功、刷新复活」成假成功。
	let engineFailure: unknown = null;
	if (name) {
		try { await engineRemoveConnection(name); } catch (e) { engineFailure = e; }
		try { await getSecrets().delete(passwordKey(name)); } catch { /* vault 不可用不阻断 */ }
	}
	// 镜像清理始终尽力（即使引擎失败也清本地，避免脏镜像）。
	try {
		await writeLocalOnly(configs.filter((c) => c.id !== id && c.name !== name));
	} catch { /* ignore */ }

	if (engineFailure) throw engineFailure;
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

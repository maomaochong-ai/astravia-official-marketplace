/**
 * 连接配置仓储 — 读写宿主托管的插件私有存储（ctx.storage）。
 *
 * 存储形态：单个 JSON 文档 connections.json
 *   { "schemaVersion": 1, "connections": DbConnection[] }
 *
 * 之所以不用 sqlite：插件拿不到宿主 userData 路径，自建 ~/.astravia/dbx-pro
 * 目录在多数机器上并不存在，sqlite3 会直接 failed to open；ctx.storage 由宿主
 * 保证目录存在与原子提交，是 SDK 指定的持久化通路。
 */

import { readJsonFile, writeJsonFile } from "@astravia-org/plugin-sdk";
import type { DbConnection } from "./connection-config";
import { getStorage } from "../runtime-contract";

const STORE_PATH = "connections.json";
const STORE_SCHEMA_VERSION = 1;

interface ConnectionDocument {
	schemaVersion: number;
	connections: DbConnection[];
}

/** 读取全部已保存的连接配置（按名称稳定排序）。 */
export async function readAllConfigs(): Promise<DbConnection[]> {
	const doc = await readJsonFile<Partial<ConnectionDocument>>(getStorage(), STORE_PATH);
	const list = Array.isArray(doc?.connections) ? doc!.connections : [];
	return list
		.filter((c): c is DbConnection => Boolean(c && typeof c.id === "string" && typeof c.name === "string"))
		.sort((a, b) => a.name.localeCompare(b.name));
}

async function writeAll(configs: DbConnection[]): Promise<void> {
	const doc: ConnectionDocument = { schemaVersion: STORE_SCHEMA_VERSION, connections: configs };
	await writeJsonFile(getStorage(), STORE_PATH, doc);
}

/** 新增或按 id 覆盖一条连接配置。 */
export async function writeConfig(config: DbConnection): Promise<void> {
	const configs = await readAllConfigs();
	const index = configs.findIndex((c) => c.id === config.id);
	if (index >= 0) configs[index] = config;
	else configs.push(config);
	await writeAll(configs);
}

/** 按 id 删除连接配置。 */
export async function deleteConfig(id: string): Promise<void> {
	const configs = await readAllConfigs();
	await writeAll(configs.filter((c) => c.id !== id));
}

/** 生成连接 id。 */
export function genUuid(): string {
	const cryptoRef = globalThis.crypto as Crypto | undefined;
	if (cryptoRef?.randomUUID) return cryptoRef.randomUUID();
	return `conn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

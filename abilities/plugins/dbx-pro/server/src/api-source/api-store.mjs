/**
 * 「API 接入」连接配置的持久化。
 *
 * 位置：`<dataDir>/api-connections.json`（与引擎自己的 `dbx.db` 同一级）。
 * 为什么不写进引擎：引擎的内置类型清单是硬编码的，`dbx_add_connection` 不认识 `api`，
 * 硬塞会把连接变成一个必然报错的入口（对照 M1.5 的 `jdbc` 结论）。
 *
 * 安全：文件里同时存配置与凭据，因此 0600 + 原子写（tmp + rename）。
 * 凭据字段从不进入回传体（`GET /connections` / `GET /api-sources` 只给 `hasSecret`），
 * 客户端也永远收不到明文。
 */

import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { ApiSourceError, normalizeApiSource, snapshotFileName } from "./api-source.mjs";

const STORE_FILE = "api-connections.json";
const CACHE_DIR = "api-cache";
const SCHEMA_VERSION = 1;

/** 与 http-server.mjs 的 `ensureEngineKey` 用同一套兜底目录。 */
export function resolveDataDir(dataDir) {
	return dataDir ?? join(homedir(), ".astravia-dbx-data");
}

export function apiStorePath(dataDir) {
	return join(resolveDataDir(dataDir), STORE_FILE);
}

/** 物化快照目录：DuckDB 在这里读本地 NDJSON。 */
export function apiCacheDir(dataDir) {
	return join(resolveDataDir(dataDir), CACHE_DIR);
}

/** 某个 API 数据源的快照文件绝对路径。 */
export function apiSnapshotPath(dataDir, name) {
	return join(apiCacheDir(dataDir), snapshotFileName(name));
}

/** 本地查询引擎（DuckDB）用的内部连接名；UI 会把 `__` 前缀的连接从树里隐藏。 */
export const API_ENGINE_CONNECTION = "__dbx_pro_api__";

/**
 * DuckDB 库文件名。
 *
 * 必须是常量而非字面量：引擎把连接配置里的 `database` 当作 DuckDB 的 catalog 名，
 * 而 catalog 名就是库文件的 basename（`local.duckdb` → `local`）。两者写不一致时
 * 查询会报 `SET schema: No catalog + schema named "x" found`。
 */
const API_ENGINE_DATABASE_FILE = "local.duckdb";

/** DuckDB 连接配置里的 catalog / database 名。 */
export const API_ENGINE_DATABASE = API_ENGINE_DATABASE_FILE.replace(/\.duckdb$/, "");

/** DuckDB 库文件路径（由插件自动登记的内部连接指向）。 */
export function apiEngineDatabasePath(dataDir) {
	return join(apiCacheDir(dataDir), API_ENGINE_DATABASE_FILE);
}

function emptyStore() {
	return { schemaVersion: SCHEMA_VERSION, sources: [] };
}

/**
 * 读原始存储。文件不存在 / 损坏时返回空存储而不是抛错 ——
 * 一个坏掉的 JSON 不该让整个连接列表不可用。
 */
export function readApiStore(dataDir) {
	const path = apiStorePath(dataDir);
	if (!existsSync(path)) return emptyStore();
	try {
		const parsed = JSON.parse(readFileSync(path, "utf8"));
		if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.sources)) return emptyStore();
		return {
			schemaVersion: SCHEMA_VERSION,
			sources: parsed.sources.filter((s) => s && typeof s === "object" && typeof s.name === "string"),
		};
	} catch {
		return emptyStore();
	}
}

/** 原子写 + 0600。凭据与配置同文件，权限不能靠目录兜底。 */
export function writeApiStore(dataDir, store) {
	const path = apiStorePath(dataDir);
	mkdirSync(dirname(path), { recursive: true });
	const tmp = `${path}.tmp-${process.pid}`;
	writeFileSync(tmp, `${JSON.stringify({ schemaVersion: SCHEMA_VERSION, sources: store.sources }, null, 2)}\n`, {
		mode: 0o600,
	});
	chmodSync(tmp, 0o600);
	renameSync(tmp, path);
}

/** 列表（含 `secret`：仅供执行路径使用，REST 层不得直接回传）。 */
export function listApiSources(dataDir) {
	return readApiStore(dataDir).sources.map((source) => ({ ...source }));
}

export function findApiSource(dataDir, name) {
	const wanted = String(name ?? "").trim().toLowerCase();
	if (!wanted) return null;
	return listApiSources(dataDir).find((s) => s.name.toLowerCase() === wanted) ?? null;
}

export function isApiSourceName(dataDir, name) {
	return findApiSource(dataDir, name) !== null;
}

/** 已登记的 API 数据源名字集合（SQL 重写用）。 */
export function apiSourceNames(dataDir) {
	return listApiSources(dataDir).map((s) => s.name);
}

/**
 * 新增 / 覆盖一个数据源。同名视为更新：保留原 id 与创建时间。
 *
 * 「写一次就不再回传」的字段都按同一套约定合并：
 * - secret / headers 缺省 = 沿用旧值（编辑配置不必重新输一遍凭据与请求头）；
 * - 显式传值（含空对象）才覆盖。
 */
export function upsertApiSource(dataDir, rawConfig, secret) {
	const config = normalizeApiSource(rawConfig);
	const store = readApiStore(dataDir);
	const index = store.sources.findIndex((s) => s.name.toLowerCase() === config.name.toLowerCase());
	const now = new Date().toISOString();
	const previous = index >= 0 ? store.sources[index] : null;
	const hasSecret = typeof secret === "string" && secret.length > 0;
	const nextSecret = hasSecret ? secret : (previous?.secret ?? "");
	// headers 从不回传客户端，所以表单里那个框天然是空的；缺省即沿用旧值，
	// 否则「改个行数再保存」会把之前填的请求头静默清掉。
	const rawHeaders = rawConfig && typeof rawConfig === "object" ? rawConfig.headers : undefined;
	const nextHeaders = rawHeaders === undefined ? (previous?.headers ?? {}) : config.headers;

	if (requiresSecret(config.auth) && !nextSecret) {
		throw new ApiSourceError("AUTH_MISSING", "所选认证方式需要凭据，请填写 Token / Key / 密码");
	}

	const record = {
		...config,
		headers: nextHeaders,
		secret: nextSecret,
		createdAt: previous?.createdAt ?? now,
		updatedAt: now,
	};

	if (index >= 0) store.sources[index] = record;
	else store.sources.push(record);
	writeApiStore(dataDir, store);
	return record;
}

/** 认证方式是否必须有凭据。与 api-source.mjs 的 buildAuthHeaders 保持一致。 */
export function requiresSecret(auth) {
	const kind = String(auth?.kind ?? "none").toLowerCase();
	return kind === "bearer" || kind === "api-key" || kind === "basic";
}

export function removeApiSource(dataDir, name) {
	const store = readApiStore(dataDir);
	const wanted = String(name ?? "").trim().toLowerCase();
	const removed = store.sources.find((s) => s.name.toLowerCase() === wanted);
	if (!removed) {
		throw new ApiSourceError("CONNECTION_NOT_FOUND", `没有名为 ${name} 的 API 接入`);
	}
	writeApiStore(dataDir, { sources: store.sources.filter((s) => s !== removed) });
	// 物化快照是接口数据在磁盘上的明文副本：连接没了就不该留。
	// 失败（如已被手工清理）不影响删除结论。
	try {
		unlinkSync(apiSnapshotPath(dataDir, removed.name));
	} catch {
		/* 快照不存在或不可删，都不算删除失败 */
	}
	return { deleted: name };
}

/** 把数据源映射成连接列表条目（与 `parseConnections` 的字段形状一致，额外字段加法式给出）。 */
export function apiSourceToConnection(source) {
	let host = "";
	try {
		host = new URL(source.url).host;
	} catch {
		host = source.url;
	}
	return {
		id: source.id ?? `api:${source.name}`,
		name: source.name,
		groupPath: "",
		type: "api",
		host,
		port: 0,
		database: source.dataPath || "",
		// 加法式字段：老客户端忽略，新客户端用它渲染表单与只读标记。
		api: {
			url: source.url,
			method: source.method ?? "GET",
			auth: source.auth ?? { kind: "none" },
			dataPath: source.dataPath ?? "",
			rowLimit: source.rowLimit ?? 1000,
			hasSecret: Boolean(source.secret),
			// 请求头值也可能被用户用来放凭据，同样只回传「有没有」，不回传内容。
			hasHeaders: Object.keys(source.headers ?? {}).length > 0,
		},
		read_only: true,
	};
}

/** 回传给 UI 的配置（凭据抹成占位符）。 */
export function apiSourceToPublic(source) {
	return { ...apiSourceToConnection(source) };
}

export const _internal = { SCHEMA_VERSION, STORE_FILE, CACHE_DIR };

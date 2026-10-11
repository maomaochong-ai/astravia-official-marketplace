/**
 * 「API 接入」的查询编排：取数 → 物化快照 → 重写 SQL → 交本机 DuckDB 执行。
 *
 * 引擎（dbx-mcp）只认自己的内置类型，所以 API 数据源不能走它的连接注册表。
 * 折中方案：插件把接口结果落成 NDJSON，再用一个**插件自动登记的内部 DuckDB 连接**
 * 执行重写后的 SQL —— DuckDB 的 read_json_auto 是内建能力，不需要额外扩展。
 *
 * 引擎通过 `engine` 注入（`{ ensureConnection, execute }`），因此本模块可单测、
 * 不直接依赖 MCP 客户端。
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { ApiSourceError, toNdjson } from "./api-source.mjs";
import { fetchApiSource } from "./api-fetch.mjs";
import {
	API_ENGINE_CONNECTION,
	apiCacheDir,
	apiSnapshotPath,
	apiSourceNames,
	findApiSource,
} from "./api-store.mjs";
import { rewriteApiTableRefs } from "./sql-rewrite.mjs";

/** 一次取数的结果摘要（进结果区，让用户看到「这批数据是什么时候从哪取的」）。 */
export async function materializeApiSource(dataDir, name, options = {}) {
	const source = findApiSource(dataDir, name);
	if (!source) {
		throw new ApiSourceError("CONNECTION_NOT_FOUND", `没有名为 ${name} 的 API 接入`);
	}
	const result = await fetchApiSource(source, options);
	const dir = apiCacheDir(dataDir);
	mkdirSync(dir, { recursive: true });
	const path = apiSnapshotPath(dataDir, source.name);
	// 快照是接口返回的明文数据（可能含业务敏感字段），与配置存储同权限。
	writeFileSync(path, toNdjson(result.table.rows), { encoding: "utf8", mode: 0o600 });
	return {
		name: source.name,
		url: result.url,
		path,
		columns: result.table.columns,
		rowCount: result.table.rows.length,
		totalRecords: result.table.totalRecords,
		truncated: result.table.truncated,
		status: result.status,
		fetchedAt: result.fetchedAt,
		durationMs: result.durationMs,
		bytes: result.bytes,
	};
}

/**
 * 执行一条针对 API 数据源的查询。
 *
 * @param {object} params
 * @param {string} params.dataDir
 * @param {string} params.sql 用户原始 SQL
 * @param {number} [params.maxRows]
 * @param {{ ensureConnection: () => Promise<void>, execute: (sql: string, maxRows?: number) => Promise<string> }} params.engine
 * @returns {Promise<{ engineSql: string, engineText: string, sources: object[], maxRows: number }>}
 */
export async function runApiQuery({ dataDir, sql, maxRows, engine, fetchImpl, timeoutMs } = {}) {
	if (!engine || typeof engine.execute !== "function") {
		throw new ApiSourceError("API_ENGINE_UNAVAILABLE", "缺少本地查询引擎通道");
	}
	const text = String(sql ?? "");
	if (!text.trim()) throw new ApiSourceError("BAD_REQUEST", "SQL 不能为空");

	const names = apiSourceNames(dataDir);
	if (names.length === 0) {
		throw new ApiSourceError("CONNECTION_NOT_FOUND", "还没有配置任何 API 接入连接");
	}

	// 先看 SQL 引用了哪些数据源：没被引用就不去打扰对应的接口。
	const probe = rewriteApiTableRefs(text, new Map(), { names });
	const referenced = probe.referenced;
	if (referenced.length === 0) {
		throw new ApiSourceError(
			"API_SOURCE_NOT_REFERENCED",
			`这条查询没有引用任何 API 数据源（可用：${names.join(", ")}）。` +
				"API 接入的查询需要 FROM <连接名>，例如 select * from <连接名> limit 10",
		);
	}

	const sources = [];
	for (const name of referenced) {
		sources.push(await materializeApiSource(dataDir, name, { fetchImpl, timeoutMs }));
	}

	const paths = new Map(sources.map((s) => [s.name.toLowerCase(), s.path]));
	const { sql: engineSql } = rewriteApiTableRefs(text, paths);

	await engine.ensureConnection();
	const engineText = await engine.execute(engineSql, maxRows);

	return { engineSql, engineText, sources, maxRows };
}

/** 供 `/api-sources/test` 使用：取一次数并返回列与样例行，不落引擎。 */
export async function previewApiSource(dataDir, name, options = {}) {
	const source = findApiSource(dataDir, name);
	if (!source) throw new ApiSourceError("CONNECTION_NOT_FOUND", `没有名为 ${name} 的 API 接入`);
	return fetchApiSource(source, options);
}

export { API_ENGINE_CONNECTION };

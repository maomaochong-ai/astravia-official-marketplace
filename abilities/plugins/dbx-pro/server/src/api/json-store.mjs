/**
 * json-store.mjs — 本地文件 JSON blob CRUD（form/portal/bpmn/system/codegen 共享层）。
 *
 * 每个 table = dataDir/json-store/<table>/ 目录，每条记录 = 一个 <uuid>.json 文件。
 * 为什么不用 DuckDB：dbx_execute_query MCP 通道禁止写操作（SQL_BLOCKED）。
 * 为什么不用 SQLite/duckdb npm 包：避免新增运行时依赖（dbx-pro 要求零外部依赖）。
 *
 * ctx 只需 dataDir 字段（request-router 里已有）。
 */
import { engineError } from "../engine/protocol.mjs";
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const NOW_ISO = () => new Date().toISOString();
const STORE_DIR = (dataDir) => path.join(dataDir ?? ".", "json-store");

export function genId() {
	return crypto.randomUUID();
}

async function ensureDir(dataDir, table) {
	const dir = path.join(STORE_DIR(dataDir), table);
	await fs.mkdir(dir, { recursive: true });
	return dir;
}

function recordPath(dir, id) {
	return path.join(dir, `${id}.json`);
}

async function readSafe(p) {
	try { return JSON.parse(await fs.readFile(p, "utf-8")); } catch { return null; }
}

function escLike(kw) {
	// 用于遍历文件名过滤（不是 SQL LIKE）
	return String(kw ?? "").trim().toLowerCase();
}

/** upsert 语义：id 存在则覆盖，不存在则新建。 */
export async function save(ctx, { table, id = null, name, data, meta = {} }) {
	if (!table || !name) throw engineError("BAD_REQUEST", "table + name 必填");
	const recId = id ?? genId();
	const now = NOW_ISO();
	const dir = await ensureDir(ctx.dataDir, table);

	const existing = await readSafe(recordPath(dir, recId));
	const created_at = existing?.created_at ?? now;

	const rec = {
		id: recId,
		name,
		data,
		meta,
		created_at,
		updated_at: now,
	};
	await fs.writeFile(recordPath(dir, recId), JSON.stringify(rec, null, 2), "utf-8");
	return { id: recId, name, created_at, updated_at: now, exists: !!existing };
}

/** 按 id 查单条。 */
export async function queryById(ctx, { table, id }) {
	if (!table || !id) throw engineError("BAD_REQUEST", "table + id 必填");
	const dir = path.join(STORE_DIR(ctx.dataDir), table);
	const rec = await readSafe(recordPath(dir, id));
	return rec;
}

/** 列表（keyword 匹配 name，按 updated_at 倒序）。 */
export async function list(ctx, { table, keyword = "", limit = 100 }) {
	if (!table) throw engineError("BAD_REQUEST", "table 必填");
	const dir = path.join(STORE_DIR(ctx.dataDir), table);
	const kw = escLike(keyword);

	let files;
	try { files = await fs.readdir(dir); } catch { return []; }  // 目录不存在

	const recs = [];
	for (const f of files) {
		if (!f.endsWith(".json")) continue;
		const r = await readSafe(path.join(dir, f));
		if (!r) continue;
		if (kw && !(r.name ?? "").toLowerCase().includes(kw)) continue;
		recs.push(r);
	}
	recs.sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""));
	return recs.slice(0, Math.min(limit, 1000));
}

/** 删除。 */
export async function remove(ctx, { table, id }) {
	if (!table || !id) throw engineError("BAD_REQUEST", "table + id 必填");
	const dir = path.join(STORE_DIR(ctx.dataDir), table);
	const p = recordPath(dir, id);
	try { await fs.unlink(p); } catch { /* 不存在就忽略 */ }
	return { deleted: id };
}

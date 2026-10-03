/**
 * G1 查询历史 —— 纯逻辑层（不导入 SDK，可被 `node --test` 直接导入）。
 *
 * 存储与读取副作用放在 `query-history-store.ts`，那里才接触宿主 storage。
 * 语义要点：
 *   - 最新的在最前（列表直接渲染）；
 *   - 同一连接 + 同一 SQL（忽略空白差异）视为同一条，重复执行只更新时间与结果，不堆叠；
 *   - 上限可配（10 ~ 1000），超出即裁剪。
 */

/** 执行路径，与 query-router 的口径一致。 */
export type QueryPath = "engine" | "cli";

export interface QueryHistoryEntry {
	id: string;
	/** 连接名（连接配置可能被删，历史保留当时的名字） */
	connName: string;
	dbType: string;
	sql: string;
	status: "ok" | "error";
	path: QueryPath;
	rowCount: number;
	durationMs: number;
	/** 失败时的错误信息（截断保存） */
	error?: string;
	/** ISO 时间戳 */
	createdAt: string;
}

export const HISTORY_LIMIT_MIN = 10;
export const HISTORY_LIMIT_MAX = 1000;
export const HISTORY_LIMIT_DEFAULT = 200;
/** 单条 SQL 存全文，但设一个防御性上限，避免把巨型脚本整段塞进历史文件。 */
export const HISTORY_SQL_MAX_CHARS = 20_000;

export function clampInt(value: unknown, min: number, max: number, fallback: number): number {
	const numeric = typeof value === "number" ? value : Number(value);
	if (!Number.isFinite(numeric)) return fallback;
	const rounded = Math.trunc(numeric);
	if (rounded < min) return min;
	if (rounded > max) return max;
	return rounded;
}

export function clampHistoryLimit(value: unknown): number {
	return clampInt(value, HISTORY_LIMIT_MIN, HISTORY_LIMIT_MAX, HISTORY_LIMIT_DEFAULT);
}

/** 规范化 SQL 文本的比对键（空白折叠 + 首尾去空白），用于去重。 */
export function sqlFingerprint(sql: string): string {
	return String(sql ?? "").replace(/\s+/g, " ").trim();
}

export function newHistoryId(): string {
	const cryptoObj = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
	if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
	return `hist-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 单行摘要，用于列表展示。 */
export function summarizeSql(sql: string, max = 120): string {
	const compact = sqlFingerprint(sql);
	if (compact.length <= max) return compact;
	return `${compact.slice(0, Math.max(1, max - 1))}…`;
}

function toIso(value: unknown, fallback: string): string {
	if (typeof value !== "string") return fallback;
	const time = Date.parse(value);
	return Number.isFinite(time) ? new Date(time).toISOString() : fallback;
}

/** 宽容解析单条历史（外部文件可能被手改或降级）：不合法返回 null。 */
export function normalizeHistoryEntry(raw: unknown, now: Date = new Date()): QueryHistoryEntry | null {
	if (!raw || typeof raw !== "object") return null;
	const source = raw as Record<string, unknown>;
	const sql = typeof source.sql === "string" ? source.sql : "";
	if (!sql.trim()) return null;
	const connName = typeof source.connName === "string" && source.connName.trim() ? source.connName : "(未命名连接)";
	const dbType = typeof source.dbType === "string" ? source.dbType : "";
	const status = source.status === "error" ? "error" : "ok";
	const path: QueryPath = source.path === "engine" ? "engine" : "cli";
	const fallbackTime = now.toISOString();
	return {
		id: typeof source.id === "string" && source.id ? source.id : newHistoryId(),
		connName,
		dbType,
		sql: sql.slice(0, HISTORY_SQL_MAX_CHARS),
		status,
		path,
		rowCount: Number.isFinite(Number(source.rowCount)) ? Math.max(0, Math.trunc(Number(source.rowCount))) : 0,
		durationMs: Number.isFinite(Number(source.durationMs)) ? Math.max(0, Math.trunc(Number(source.durationMs))) : 0,
		...(status === "error" && typeof source.error === "string" ? { error: source.error.slice(0, 1000) } : {}),
		createdAt: toIso(source.createdAt, fallbackTime),
	};
}

/** 宽容解析整份历史（保持原顺序，逐条过滤）。 */
export function normalizeHistory(raw: unknown, limit: number = HISTORY_LIMIT_DEFAULT, now: Date = new Date()): QueryHistoryEntry[] {
	const list = Array.isArray(raw) ? raw : [];
	const entries: QueryHistoryEntry[] = [];
	for (const item of list) {
		const entry = normalizeHistoryEntry(item, now);
		if (entry) entries.push(entry);
	}
	return pruneHistory(entries, limit);
}

/** 裁剪到上限（保留最前面 = 最新的）。 */
export function pruneHistory(entries: QueryHistoryEntry[], limit: number): QueryHistoryEntry[] {
	const capped = clampHistoryLimit(limit);
	return entries.length <= capped ? entries.slice() : entries.slice(0, capped);
}

/**
 * 追加一条历史：同一连接 + 同一 SQL 的旧记录会被移除，新记录置顶。
 * 返回新数组（不改动入参），已按 limit 裁剪。
 */
export function appendHistory(
	entries: QueryHistoryEntry[],
	entry: QueryHistoryEntry,
	limit: number = HISTORY_LIMIT_DEFAULT,
): QueryHistoryEntry[] {
	const key = `${entry.connName}\u0000${sqlFingerprint(entry.sql)}`;
	const kept = entries.filter((item) => `${item.connName}\u0000${sqlFingerprint(item.sql)}` !== key);
	return pruneHistory([entry, ...kept], limit);
}

/** 删除某条（按 id）。 */
export function removeHistoryEntry(entries: QueryHistoryEntry[], id: string): QueryHistoryEntry[] {
	return entries.filter((entry) => entry.id !== id);
}

/** 相对时间文案（列表用）。 */
export function formatHistoryTime(iso: string, now: number = Date.now()): string {
	const time = Date.parse(iso);
	if (!Number.isFinite(time)) return "时间未知";
	const delta = now - time;
	if (delta < 0) return "刚刚";
	const seconds = Math.floor(delta / 1000);
	if (seconds < 60) return "刚刚";
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes} 分钟前`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours} 小时前`;
	const days = Math.floor(hours / 24);
	if (days < 30) return `${days} 天前`;
	const date = new Date(time);
	const pad = (value: number) => String(value).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

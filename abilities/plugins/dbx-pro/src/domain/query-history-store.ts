/**
 * G1 查询历史的持久化包装 —— 只做「宿主 storage ↔ 纯逻辑」的搬运。
 * 与 `dbx-storage.ts` 同一套路：storage 由宿主保证目录存在与原子提交。
 */
import { readJsonFile, writeJsonFile } from "@astravia-org/plugin-sdk";
import { getStorage } from "../runtime-contract";
import {
	HISTORY_LIMIT_DEFAULT,
	appendHistory as appendToHistory,
	normalizeHistory,
	pruneHistory,
	removeHistoryEntry as removeFromHistory,
	type QueryHistoryEntry,
} from "./query-history";

const STORE_PATH = "query-history.json";
const STORE_SCHEMA_VERSION = 1;

interface HistoryDocument {
	schemaVersion: number;
	entries: QueryHistoryEntry[];
}

export async function readHistory(limit: number = HISTORY_LIMIT_DEFAULT): Promise<QueryHistoryEntry[]> {
	const doc = await readJsonFile<HistoryDocument | QueryHistoryEntry[]>(getStorage(), STORE_PATH);
	const raw = Array.isArray(doc) ? doc : doc?.entries;
	return normalizeHistory(raw, limit);
}

export async function writeHistory(entries: QueryHistoryEntry[]): Promise<QueryHistoryEntry[]> {
	await writeJsonFile(getStorage(), STORE_PATH, {
		schemaVersion: STORE_SCHEMA_VERSION,
		entries,
	} satisfies HistoryDocument);
	return entries;
}

/** 追加一条（同连接 + 同 SQL 去重）并落盘，返回新列表。 */
export async function appendHistoryEntry(
	entry: QueryHistoryEntry,
	limit: number = HISTORY_LIMIT_DEFAULT,
): Promise<QueryHistoryEntry[]> {
	const entries = await readHistory(limit);
	const next = appendToHistory(entries, entry, limit);
	return writeHistory(next);
}

/** 删除一条并落盘。 */
export async function dropHistoryEntry(id: string, limit: number = HISTORY_LIMIT_DEFAULT): Promise<QueryHistoryEntry[]> {
	const entries = await readHistory(limit);
	return writeHistory(removeFromHistory(entries, id));
}

/** 清空历史。 */
export async function clearHistory(): Promise<void> {
	await writeJsonFile(getStorage(), STORE_PATH, { schemaVersion: STORE_SCHEMA_VERSION, entries: [] } satisfies HistoryDocument);
}

/** 按上限裁剪落盘（设置里调小上限时调用）。 */
export async function pruneHistoryStore(limit: number): Promise<QueryHistoryEntry[]> {
	const entries = await readHistory(limit);
	return writeHistory(pruneHistory(entries, limit));
}

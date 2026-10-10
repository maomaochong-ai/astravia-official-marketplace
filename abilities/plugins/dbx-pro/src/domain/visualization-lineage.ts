/**
 * visualization-lineage — 产物血缘的纯函数层。
 *
 * 回答两个问题，且只用纯函数回答（不依赖 React、宿主存储与数据库）：
 *   1. 这个产物引用了哪些来源（连接 / 表 / SQL / 行数 / 取数时间）；
 *   2. 还有哪些产物引用了同一张表（反查）。
 *
 * 两条不能含糊的语义：
 *   - 表的身份是 **(连接, 表名)** 这一对。不同连接上的同名表不是同一张表，
 *     只按表名匹配会把两张无关的表错配到一起。大小写不折叠：PostgreSQL 折叠未加引号的
 *     标识符、Linux 上的 MySQL 却区分大小写，折叠会造出「同一张表」的假象 —— 宁可漏配也不错配。
 *   - 旧格式快照（v1 迁移而来，只留下连接与表）**没有取数 SQL**，如实返回 null，
 *     由 UI 说明「只有表信息」，不用空串或反推出来的 SQL 冒充事实。
 */

import type { DatasetSpec } from "./chart-contract";

/** 一张表 = 连接 + 表名，必须成对使用。 */
export interface LineageTable {
	connection: string;
	table: string;
}

/**
 * 血缘输入：一个产物只需要这些字段。
 * Visualization / StoredVisualization 都能直接传入（stored 版本只是多带了 id 等字段）。
 */
export interface LineageSubject {
	title?: string;
	/** 内部追踪字段；新产物通常为空，只有旧格式快照靠它记录来源 */
	connection?: string;
	table?: string;
	datasets?: DatasetSpec[];
}

/** 反查的输入：身份 + 来源表 + 列表里要显示的元信息。 */
export interface LineageArtifact extends LineageSubject {
	id: string;
	type?: "dashboard" | "screen";
	createdAt?: number;
}

/** 血缘里的一条来源。 */
export interface LineageSource {
	/** dataset = 带取数 SQL 的数据集；snapshot = 旧格式快照，只剩下连接与表 */
	kind: "dataset" | "snapshot";
	title: string;
	connection: string;
	table: string;
	/** 取数 SQL；旧格式快照没有 SQL，这里是 null（不是空串） */
	sql: string | null;
	/** SQL 的完整结果行数；未记录时为 null（不写 0，0 是另一个事实） */
	rowCount: number | null;
	/** 已载入本地的行数；未记录时为 null */
	loadedCount: number | null;
	/** 取数时间；未记录时为 null */
	fetchedAt: number | null;
}

/** 反查结果里的一条产物。 */
export interface LineageEntry {
	id: string;
	title: string;
	type: "dashboard" | "screen";
	createdAt: number | null;
}

/** 一张目标表 + 引用了它的其他产物。 */
export interface LineageReferenceGroup {
	table: LineageTable;
	entries: LineageEntry[];
}

/** 复合键的分隔符：连接名与表名里都不可能出现，避免 "a\u0000b" 这类拼接碰撞。 */
const PAIR_SEPARATOR = "\u0000";

function asText(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function asCount(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** (连接, 表名) → LineageTable；表名为空时没有表可指，返回 null。 */
function asPair(connection: unknown, table: unknown): LineageTable | null {
	const name = asText(table);
	if (!name) return null;
	return { connection: asText(connection), table: name };
}

function pairKey(pair: LineageTable): string {
	return `${pair.connection}${PAIR_SEPARATOR}${pair.table}`;
}

/** 「连接 → 表」的展示文本；没有连接时只显示表名。 */
export function formatLineageTable(pair: LineageTable): string {
	return [pair.connection, pair.table].filter(Boolean).join(" → ");
}

/**
 * 产物引用到的所有表，按数据集顺序去重。
 *
 * 数据集是权威来源。产物的 connection / table 只是工具的追踪字段（Agent schema 不暴露，
 * 新产物通常为空）：只有当数据集一个表名都没给出时，才退回它 —— 旧格式快照就只有这条线索。
 */
export function collectLineageTables(viz: LineageSubject): LineageTable[] {
	const tables: LineageTable[] = [];
	const seen = new Set<string>();

	for (const dataset of viz.datasets ?? []) {
		const pair = asPair(dataset.connection, dataset.table);
		if (!pair) continue;
		const key = pairKey(pair);
		if (seen.has(key)) continue;
		seen.add(key);
		tables.push(pair);
	}

	if (tables.length === 0) {
		const fallback = asPair(viz.connection, viz.table);
		if (fallback) tables.push(fallback);
	}

	return tables;
}

/**
 * 产物的来源清单，与图表顺序无关，只跟数据来源有关。
 *
 * 有数据集 → 每个数据集一条（带 SQL 与行数口径）；
 * 没有数据集 → 旧格式快照一条（只有连接与表，SQL / 行数 / 取数时间都是 null）。
 * 连表都没记下时返回空数组，而不是造一条空来源。
 */
export function collectLineageSources(viz: LineageSubject): LineageSource[] {
	const datasets = viz.datasets ?? [];

	if (datasets.length > 0) {
		return datasets.map((dataset) => ({
			kind: "dataset",
			title: dataset.title,
			connection: asText(dataset.connection),
			table: asText(dataset.table),
			sql: asText(dataset.sql) || null,
			rowCount: asCount(dataset.rowCount),
			loadedCount: Array.isArray(dataset.rows) ? dataset.rows.length : null,
			fetchedAt: asCount(dataset.fetchedAt),
		}));
	}

	// 没有数据集 = 旧格式快照：只能看到当初记下的连接与表，SQL 无从得知。
	const pair = asPair(viz.connection, viz.table);
	if (!pair) return [];

	return [
		{
			kind: "snapshot",
			title: viz.title ?? "",
			connection: pair.connection,
			table: pair.table,
			sql: null,
			rowCount: null,
			loadedCount: null,
			fetchedAt: null,
		},
	];
}

/**
 * 反查：哪些产物引用了 target 这张表。
 *
 * - 命中条件是 **(连接, 表名)** 完全相同；
 * - `excludeId` 用来排除「自己」——产物自己的数据集当然引用了这张表，不排除会让反查变成自问自答；
 * - 顺序沿用传入列表的顺序（store 里最新的排在前面），调用方不用再排。
 */
export function findArtifactsByTable(
	items: readonly LineageArtifact[],
	target: LineageTable,
	excludeId?: string | null,
): LineageEntry[] {
	const wanted = asPair(target.connection, target.table);
	if (!wanted) return [];
	const key = pairKey(wanted);

	const entries: LineageEntry[] = [];
	for (const item of items) {
		if (excludeId && item.id === excludeId) continue;
		// 与 collectLineageTables 共用同一套规则，反查不会与「引用了哪些表」给出不同答案
		const hit = collectLineageTables(item).some((pair) => pairKey(pair) === key);
		if (!hit) continue;
		entries.push({
			id: item.id,
			title: item.title ?? "",
			type: item.type === "screen" ? "screen" : "dashboard",
			createdAt: asCount(item.createdAt),
		});
	}
	return entries;
}

/**
 * 本地时间 `YYYY-MM-DD HH:mm`。
 *
 * 手工拼装而不是 toLocaleString：后者的输出随宿主 locale 变化，同一个产物在不同机器上
 * 会长得不一样，日志与截图里没法比对。无效输入返回空串，由调用方决定是否显示。
 */
export function formatLineageTime(at: number | null | undefined): string {
	if (typeof at !== "number" || !Number.isFinite(at)) return "";
	const date = new Date(at);
	if (Number.isNaN(date.getTime())) return "";

	const pad = (value: number): string => String(value).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

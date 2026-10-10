/**
 * visualization-doc — 「BI 数据资产」存储文档的读写与版本迁移。
 *
 * 文档形态：
 *   v1  裸数组 [...items]                    历史格式，无版本号
 *   v2  { schemaVersion: 2, items: [...] }   当前格式
 *
 * 迁移策略是**只读不删**：v1 条目升级时原样保留 html + chartItems，并打上
 * readonlySnapshot。不尝试从 html / chartItems 反推数据集 —— 反推需要重跑 SQL
 * 取原始行，只能在用户主动「重新取数」时完成（见 ADR-0009 §4.1、§5.1）。
 *
 * 条目归一化（丢弃无 id 条目、补 chartItems）也放在这里，使读取路径不依赖 React
 * 与 store 单例，可以被直接单元测试。
 */

import type { Visualization } from "./chart-contract";

/** 含运行时身份的产物条目。 */
export interface StoredVisualization extends Visualization {
	id: string;
	createdAt: number;
	/**
	 * 由 v1 文档迁移而来：只有一次性生成的 html 与图表配置，没有可编辑的数据来源，
	 * 因此不能筛选、不能重新取数。M1 的「重新取数」成功后可以清掉这个标记。
	 */
	readonlySnapshot?: boolean;
}

export const CURRENT_DOC_VERSION = 2;

/** 归一化单条目；结构不可信（非对象 / 缺 id）返回 null，避免半截数据污染列表。 */
function normalizeEntry(value: unknown, readonlySnapshot: boolean): StoredVisualization | null {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
	const entry = value as Partial<StoredVisualization>;
	if (typeof entry.id !== "string" || entry.id.length === 0) return null;

	// legacy 迁移 —— 旧存储没有 chartItems（只有 html），补空数组，避免 gallery 里 undefined
	const chartItems = Array.isArray(entry.chartItems) ? entry.chartItems : [];
	const stored: StoredVisualization = { ...(entry as StoredVisualization), chartItems };
	if (readonlySnapshot) stored.readonlySnapshot = true;
	return stored;
}

/**
 * 读取任意历史形态的文档。
 *
 * 无法识别的输入一律返回空数组。这里**不做任何写回** —— 调用方不能把「读不懂」
 * 当成「没有数据」去覆盖落盘，写入只在用户操作后由 store 触发。
 *
 * 判断条目是否为「只读快照」只看文档外壳：裸数组即 v1，条目一律标记；
 * v2 文档里的条目保持自身状态，因此这里不需要逐条探测版本。
 */
export function readVisualizationDoc(raw: unknown): StoredVisualization[] {
	if (Array.isArray(raw)) {
		return raw
			.map((entry) => normalizeEntry(entry, true))
			.filter((entry): entry is StoredVisualization => entry !== null);
	}
	if (typeof raw !== "object" || raw === null) return [];

	const items = (raw as { items?: unknown }).items;
	if (!Array.isArray(items)) return [];
	return items
		.map((entry) => normalizeEntry(entry, false))
		.filter((entry): entry is StoredVisualization => entry !== null);
}

/** 构造当前版本的落盘文档。 */
export function toVisualizationDoc(items: StoredVisualization[]): {
	schemaVersion: number;
	items: StoredVisualization[];
} {
	return { schemaVersion: CURRENT_DOC_VERSION, items };
}

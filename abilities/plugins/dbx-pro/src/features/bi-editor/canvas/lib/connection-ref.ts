/**
 * connection-ref.ts — 「节点里存的连接引用」与「引擎运行时连接名」之间的解析。
 *
 * 为什么需要它：属性面板的数据源下拉写进 node.values 的是连接的 **id**（`c.id`，
 * 历史上也可能是 `api:<name>`），而引擎的所有执行接口（`engineExecuteByName`、
 * `engineListTables`）都以连接的 **name** 为键。旧页面因此必然执行失败，
 * 且错误信息只会是「连接不存在」，排查成本极高。
 *
 * 这里只做映射，不做 IO、不改写入侧语义：写入侧继续存 id，读取侧负责解析成 name。
 * 这样已经保存过的旧页面不需要迁移就能自动恢复。
 */

import type { EngineConnectionSummary } from "../../../../shared/services/engine-client";

/**
 * 把节点里存的连接引用解析成引擎可用的连接名。
 *
 * 解析顺序（故意固定，避免 id 与 name 撞值时结果抖动）：
 *   1. 空/非字符串 → ""（调用方据此给出「未选择数据源」）
 *   2. 命中某个连接的 `id` → 返回该连接的 `name`
 *   3. 命中某个连接的 `name` → 原样返回（兼容手填 name 的旧数据）
 *   4. 都命中不了 → 原样返回（可能是还没刷出来的连接，交给引擎报错）
 *
 * 永不抛异常：这个函数在渲染路径上被调用，抛错会让整个属性面板白屏。
 */
export function resolveConnectionName(
	stored: unknown,
	connections: readonly EngineConnectionSummary[] | null | undefined,
): string {
	const raw = typeof stored === "string" ? stored.trim() : "";
	if (!raw) return "";

	const list = connections ?? [];
	// 先按 id 匹配：写入侧存的就是 id，优先级最高
	const byId = list.find((c) => c.id === raw);
	if (byId) return byId.name;
	// 再按 name 匹配：兼容手填/早期版本存 name 的页面
	const byName = list.find((c) => c.name === raw);
	if (byName) return byName.name;

	return raw;
}

/**
 * 解析结果的人类可读标签，用于属性面板里说明「这个值解析到了什么」。
 *
 * 能解析到连接时返回 `名称 (类型)`；解析不到时返回原始值，让用户看到实际存的东西。
 */
export function connectionDisplayLabel(
	stored: unknown,
	connections: readonly EngineConnectionSummary[] | null | undefined,
): string {
	const raw = typeof stored === "string" ? stored.trim() : "";
	if (!raw) return "";

	const hit = (connections ?? []).find((c) => c.id === raw || c.name === raw);
	if (hit) return `${hit.name} (${hit.type})`;

	return raw;
}

/** 该引用是否已经能在当前连接列表里解析出连接名。 */
export function isConnectionResolved(
	stored: unknown,
	connections: readonly EngineConnectionSummary[] | null | undefined,
): boolean {
	const raw = typeof stored === "string" ? stored.trim() : "";
	if (!raw) return false;
	return (connections ?? []).some((c) => c.id === raw || c.name === raw);
}

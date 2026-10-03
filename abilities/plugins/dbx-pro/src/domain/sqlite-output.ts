/**
 * sqlite3 CLI 输出解析 — 纯函数，无运行时依赖，便于单测直接覆盖。
 *
 * sqlite3 -json 对多语句会连续打印多个 JSON 数组（换行分隔），因此不能用整段
 * JSON.parse；必须按括号深度扫描，并跳过字符串内部的方括号。
 */

/**
 * 从 sqlite3 -json 的 stdout 中切出全部顶层 JSON 数组。
 * 返回顺序即语句执行顺序；无法构成数组的文本一律忽略（调用方按「解析不到结果集」处理）。
 */
export function parseResultSets(text: string): Record<string, unknown>[][] {
	const sets: Record<string, unknown>[][] = [];
	let depth = 0;
	let start = -1;
	let inString = false;
	let escaped = false;
	for (let i = 0; i < text.length; i += 1) {
		const ch = text[i];
		if (inString) {
			if (escaped) escaped = false;
			else if (ch === "\\") escaped = true;
			else if (ch === '"') inString = false;
			continue;
		}
		if (ch === '"') {
			inString = true;
			continue;
		}
		if (ch === "[") {
			if (depth === 0) start = i;
			depth += 1;
			continue;
		}
		if (ch === "]") {
			depth -= 1;
			if (depth <= 0 && start >= 0) {
				try {
					sets.push(JSON.parse(text.slice(start, i + 1)) as Record<string, unknown>[]);
				} catch {
					// 单段解析失败不抛出：整段交给调用方判定，避免半截 JSON 直接打断执行。
				}
				start = -1;
				depth = 0;
			}
		}
	}
	return sets;
}

/**
 * Loaded skill bodies, and what to say when a name does not hit.
 *
 * 名字归一：文件名是 `authentication_jwt`，包名是 `authentication-jwt`，
 * 用户/模型说 "jwt" —— 三种写法都该能落到同一篇。miss 时不能只回一句 missing：
 * 库里有 75 篇，"没有"会让调用方以为这个能力不存在，要给出接近的几篇。
 */

/** 归一：`authentication-jwt`、`authentication_jwt`、`Authentication JWT` 是同一个请求。 */
export function normalizeSkillName(value: string): string {
	return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

export interface LoadBodiesResult {
	markdown: Record<string, string>;
	missing: string[];
	/** 没找到的那些：给几个"你是不是要找"的候选（`category/name`）。 */
	suggestions: Record<string, string[]>;
}

/** 同类别、同名前缀、描述里含关键词的候选，按相关性排序。 */
export function suggestSkills(
	entries: readonly { name: string; category: string; description: string }[],
	wanted: string,
	limit = 5,
): string[] {
	const needle = normalizeSkillName(wanted);
	if (!needle) return [];
	return entries
		.map((entry) => {
			const name = normalizeSkillName(entry.name);
			let score = 0;
			if (name === needle) score += 4;
			if (name.includes(needle) || needle.includes(name)) score += 3;
			if (normalizeSkillName(entry.category) === needle) score += 2;
			if (normalizeSkillName(entry.description).includes(needle)) score += 1;
			return { entry, score };
		})
		.filter((row) => row.score > 0)
		.sort((left, right) => right.score - left.score)
		.slice(0, limit)
		.map((row) => `${row.entry.category}/${row.entry.name}`);
}

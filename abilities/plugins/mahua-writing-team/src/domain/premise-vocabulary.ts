/**
 * 前提小标题的识别词表。
 *
 * 这是**输入词表**，不是输出文案：作者用中文或英文写小标题，这里负责认出它属于哪一节。
 * 表里的字符串永远不会被渲染到界面上——界面上出现的一律是 catalog 里的 key（领域层纪律）。
 * 因此本文件是 `test/manifest-guards.test.ts` 里「领域层不含自然语言」那条守卫的唯一豁免，
 * 豁免按文件名精确点名，新增豁免必须自己改那条守卫。
 */

/** 能归位的节。plan 是上游的规划提示类小节，这里只原样交出，不二次解释。 */
export type PremiseSectionKey =
	| "theme"
	| "conflict"
	| "protagonist"
	| "ending"
	| "taboo"
	| "hook"
	| "cast"
	| "plan";

/**
 * 标题别名。中文取自上游 `premiseHeadingAliases`，英文侧补齐同义写法。
 * 匹配口径：去空白、去末尾冒号、小写之后比字面。
 */
const SECTION_ALIASES: Record<PremiseSectionKey, string[]> = {
	theme: ["题材定位", "题材和基调", "题材", "基调", "定位", "theme", "genre", "tone", "positioning"],
	conflict: ["核心冲突", "主要冲突", "冲突", "conflict", "core conflict"],
	protagonist: ["主角目标", "主角", "主人公", "protagonist", "lead", "hero"],
	ending: ["结局方向", "终局方向", "终局命题", "结局", "终局", "ending", "finale", "endgame"],
	taboo: ["写作禁区", "禁区", "禁忌", "taboo", "avoid", "forbidden"],
	hook: [
		"差异化卖点",
		"差异化钩子",
		"核心兑现承诺",
		"故事引擎",
		"卖点",
		"钩子",
		"hook",
		"differentiator",
		"engine",
	],
	cast: ["演员表", "主要角色", "角色", "人物", "cast", "characters"],
	plan: ["关系·成长主线", "关系成长主线", "成长主线", "升级路径", "中段转折", "中期转向", "短篇适配性", "structure", "midpoint"],
};

function normalize(heading: string): string {
	return heading
		.trim()
		.replace(/[:：]\s*$/, "")
		.replace(/\s+/g, "")
		.toLowerCase();
}

/** 把一个标题归到某一节；认不出返回 null（调用方据此决定它是散行还是未知标题）。 */
export function keyOf(heading: string): PremiseSectionKey | null {
	const token = normalize(heading);
	if (!token) return null;
	for (const key of Object.keys(SECTION_ALIASES) as PremiseSectionKey[]) {
		if (SECTION_ALIASES[key].some((alias) => normalize(alias) === token)) return key;
	}
	return null;
}

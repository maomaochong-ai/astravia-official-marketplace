/**
 * 写作规则：可执行的硬约束，不需要模型判断。
 *
 * 与「评审」分工明确——评审回答"写得好不好"（需要模型），规则回答"合不合规"（查表即可）。
 * 规则来源是用户输入的自由文本，`normalizeRules` 负责把它收敛成固定字段，未知字段直接丢弃，
 * 避免模型把规则表写成一棵随版本漂移的树。
 */

import type { Finding } from "./novel-types.js";

export interface WritingRules {
	/** 禁用词：出现即 error。 */
	bannedWords: string[];
	/** 人称：first / third / any。 */
	pointOfView: "first" | "third" | "any";
	/** 单章字数区间，按 countWords 口径。 */
	minWords: number;
	maxWords: number;
}

export const DEFAULT_RULES: WritingRules = {
	bannedWords: [],
	pointOfView: "any",
	minWords: 800,
	maxWords: 6000,
};

function asStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

/** 把用户输入（任意对象）折成固定规则。非法值回落默认，不抛错。 */
export function normalizeRules(raw: Record<string, unknown>): WritingRules {
	const pointOfView = raw.pointOfView;
	return {
		bannedWords: asStringArray(raw.bannedWords),
		pointOfView:
			pointOfView === "first" || pointOfView === "third" || pointOfView === "any"
				? pointOfView
				: DEFAULT_RULES.pointOfView,
		minWords: typeof raw.minWords === "number" && raw.minWords >= 0 ? raw.minWords : DEFAULT_RULES.minWords,
		maxWords: typeof raw.maxWords === "number" && raw.maxWords > 0 ? raw.maxWords : DEFAULT_RULES.maxWords,
	};
}

const FIRST_PERSON = /(^|[^\u5979\u4ed6\u5b83])\u6211(?!\u4eec)/;
const THIRD_PERSON = /[\u5979\u4ed6]/;

export function lintChapter(input: {
	text: string;
	words: number;
	rules: WritingRules;
}): Finding[] {
	const findings: Finding[] = [];
	const { text, words, rules } = input;

	for (const word of rules.bannedWords) {
		if (text.includes(word)) findings.push({ code: "rule.banned", severity: "error", detail: word });
	}
	if (rules.pointOfView === "first" && THIRD_PERSON.test(text) && !FIRST_PERSON.test(text)) {
		findings.push({ code: "rule.pointOfView", severity: "warning", detail: "expected first person" });
	}
	if (rules.pointOfView === "third" && FIRST_PERSON.test(text) && !THIRD_PERSON.test(text)) {
		findings.push({ code: "rule.pointOfView", severity: "warning", detail: "expected third person" });
	}
	if (words < rules.minWords) findings.push({ code: "rule.tooShort", severity: "warning", detail: String(words) });
	if (words > rules.maxWords) findings.push({ code: "rule.tooLong", severity: "warning", detail: String(words) });
	return findings;
}

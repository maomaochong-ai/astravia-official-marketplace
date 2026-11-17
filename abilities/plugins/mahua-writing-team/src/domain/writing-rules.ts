/**
 * 写作规则：可执行的硬约束，不需要模型判断。
 *
 * 与「评审」分工明确——评审回答"写得好不好"（需要模型），规则回答"合不合规"（查表即可）。
 * 规则来源是用户输入的自由文本，`normalizeRules` 负责把它收敛成固定字段，未知字段直接丢弃，
 * 避免模型把规则表写成一棵随版本漂移的树。
 */

import type { AiLimits } from "./ai-lexicon.js";
import type { AiProfile, Finding } from "./novel-types.js";

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

/**
 * 风格检：把 AI 腔画像折成可执行的 finding。
 *
 * 与 `lintChapter` 的分工：那个查「用户自己定的规矩」（禁用词、人称、字数），
 * 这个查「没有人会主动定、但一读就知道」的形状。两者都是确定性的，不和评审判断抢地。
 *
 * 阈值不在这个文件里：它和词表一起放在 `agent/lexicon/ai-tells.json`，由调用方注入。
 * 一个数字要改的时候，改的是数据，不是代码。
 */
export function lintStyle(input: { profile: AiProfile; words: number; limits: AiLimits }): Finding[] {
	const { profile, words, limits } = input;
	const findings: Finding[] = [];

	const tellTotal = profile.hardTells.reduce((sum, tell) => sum + tell.count, 0);
	if (tellTotal >= limits.hardTellTotal) {
		findings.push({
			code: "style.stockPhrase",
			severity: "warning",
			detail: profile.hardTells.map((tell) => `${tell.phrase}x${tell.count}`).join(" "),
		});
	}

	if (profile.sampleSentences >= limits.sampleFloor && profile.sentenceUniformity >= limits.sentenceUniformity) {
		findings.push({ code: "style.rhythmUniform", severity: "warning", detail: String(profile.sentenceUniformity) });
	}

	if (profile.sentenceUniformity < limits.sentenceUniformity && profile.sampleSentences >= limits.sampleFloor) {
		// 短句与长句都稀少：不是"长短交错"，而是整章停在一个中句档位。
		if (profile.shortSentenceRatio < 0.12 && profile.longSentenceRatio < 0.08) {
			findings.push({
				code: "style.rhythmNarrow",
				severity: "warning",
				detail: `${profile.shortSentenceRatio}/${profile.longSentenceRatio}`,
			});
		}
	}

	if (profile.paragraphUniformity >= limits.paragraphUniformity) {
		findings.push({
			code: "style.paragraphUniform",
			severity: "warning",
			detail: String(profile.paragraphUniformity),
		});
	}

	// 每段都在短句上刹车：段落没有自己的呼吸，读起来像节拍器。
	if (profile.paragraphsChecked >= limits.shortEndingFloor && profile.shortEndingRatio >= limits.shortEnding) {
		findings.push({ code: "style.punchlineParagraphs", severity: "warning", detail: String(profile.shortEndingRatio) });
	}

	if (profile.explainTails >= limits.explainTails) {
		findings.push({ code: "style.explainTail", severity: "warning", detail: String(profile.explainTails) });
	}

	const perKilo = words > 0 ? (profile.softTellCount / words) * 1000 : 0;
	if (perKilo >= limits.softTellPerKilo) {
		findings.push({ code: "style.fillerDensity", severity: "info", detail: perKilo.toFixed(1) });
	}

	// 起手与收尾的好坏要看跨章对比，单章只能"记一笔"。
	if (profile.timeOpenings > 0) {
		findings.push({ code: "style.timeOpening", severity: "info", detail: String(profile.timeOpenings) });
	}
	if (profile.punchlineEndings > 0) {
		findings.push({ code: "style.punchlineEnding", severity: "info", detail: String(profile.punchlineEndings) });
	}

	return findings;
}

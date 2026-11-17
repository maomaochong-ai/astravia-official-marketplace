/**
 * 写作规则：可执行的硬约束，不需要模型判断。
 *
 * 三层，读起来是同一件事的三个尺度：
 *  1. **作者定的规矩**（`rule.*`）：禁用词、人称、字数。作者说什么就是什么。
 *  2. **机器腔的形状**（`style.*`）：节奏、段落、套句、解释尾巴、排比、情绪贴标签、
 *     千人一腔、信息倾倒。判据与阈值在 `agent/lexicon/ai-tells.json`，**按书覆盖**在这里生效。
 *  3. **跨章重复**（`style.repeatOpening` / `style.repeatClosing`）：单章只是"记一笔"，
 *     连着两章同一形式才是问题——所以这一层要看上一章。
 *
 * `lintChapter` 与 `lintStyle` 都是纯函数；服务层负责把词表、上一章文本、书的覆盖传进来。
 * 门禁（能不能提交）在 `styleGate` 里判，是这一层唯一的"决定"。
 */

import type { AiLimits } from "./ai-lexicon.js";
import type { AiProfile, Finding } from "./novel-types.js";
import { closingForm, openingForm, type ClosingForm, type OpeningForm } from "./style-shapes.js";

export interface WritingRules {
	/** 禁用词：出现即 error。 */
	bannedWords: string[];
	/** 人称：first / third / any。 */
	pointOfView: "first" | "third" | "any";
	/** 单章字数区间，按 countWords 口径。 */
	minWords: number;
	maxWords: number;
	/**
	 * 按书覆盖 AI 腔阈值。只允许覆盖 `AiLimits` 里已有的键（未知键丢弃），
	 * 并且必须是有限正数——一本书把阈值调成 0 等于关掉那条检查，那应该是显式的 `styleBlocking`。
	 */
	styleLimits: Partial<AiLimits>;
	/**
	 * 哪些 `style.*` 代码会**阻断提交**。
	 *
	 * 默认就是全部 warning 级：这是 0.6.0 的转折——机器腔从"建议"变成"未完成"。
	 * 想放宽的书（例如刻意写实验文体）把它设成空数组，决定留在书里，而不是散在文档里。
	 */
	styleBlocking: string[];
}

/** 全部 `style.*` warning 代码：默认阻断集合。 */
export const STYLE_BLOCKING_DEFAULT = [
	"style.stockPhrase",
	"style.rhythmUniform",
	"style.rhythmNarrow",
	"style.paragraphUniform",
	"style.punchlineParagraphs",
	"style.explainTail",
	"style.parallelTriplet",
	"style.emotionLabel",
	"style.uniformDialogue",
	"style.sermon",
	"style.expositionDump",
	"style.repeatOpening",
	"style.repeatClosing",
] as const;

/** 只有 info 级的代码：它们永远不阻断，也不该被写进 `styleBlocking`。 */
const INFO_CODES = new Set(["style.fillerDensity", "style.timeOpening", "style.punchlineEnding"]);

export const DEFAULT_RULES: WritingRules = {
	bannedWords: [],
	pointOfView: "any",
	minWords: 800,
	maxWords: 6000,
	styleLimits: {},
	styleBlocking: [...STYLE_BLOCKING_DEFAULT],
};

function asStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

/** 只接受有限正数；其余一律丢弃（宁可回落全局阈值，也不接受一个 0 把检查关掉）。 */
function asLimitOverrides(value: unknown, known: readonly (keyof AiLimits)[]): Partial<AiLimits> {
	if (!value || typeof value !== "object") return {};
	const out: Record<string, number> = {};
	for (const key of known) {
		const raw = (value as Record<string, unknown>)[key];
		if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) out[key] = raw;
	}
	return out as Partial<AiLimits>;
}

/** 把用户输入（任意对象）折成固定规则。非法值回落默认，不抛错。 */
export function normalizeRules(raw: Record<string, unknown>, limitKeys: readonly (keyof AiLimits)[] = []): WritingRules {
	const pointOfView = raw.pointOfView;
	const blocking = raw.styleBlocking === undefined ? DEFAULT_RULES.styleBlocking : asStringArray(raw.styleBlocking);
	return {
		bannedWords: asStringArray(raw.bannedWords),
		pointOfView:
			pointOfView === "first" || pointOfView === "third" || pointOfView === "any"
				? pointOfView
				: DEFAULT_RULES.pointOfView,
		minWords: typeof raw.minWords === "number" && raw.minWords >= 0 ? raw.minWords : DEFAULT_RULES.minWords,
		maxWords: typeof raw.maxWords === "number" && raw.maxWords > 0 ? raw.maxWords : DEFAULT_RULES.maxWords,
		styleLimits: asLimitOverrides(raw.styleLimits, limitKeys),
		// 只留 `style.` 前缀且不是 info 的代码：写错一个名字不该让门禁静默失效。
		styleBlocking: blocking.filter((code) => code.startsWith("style.") && !INFO_CODES.has(code)),
	};
}

/** 全局阈值 + 本书覆盖。 */
export function mergeLimits(base: AiLimits, overrides: Partial<AiLimits>): AiLimits {
	return { ...base, ...overrides };
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

/** 把 AI 腔画像折成 finding。阈值来自词表（或本书覆盖），代码里没有一个魔法数。 */
export function lintStyle(input: {
	profile: AiProfile;
	words: number;
	limits: AiLimits;
	/** 上一章的开篇/收尾形式；给了才判跨章重复。 */
	previous?: { opening: OpeningForm; closing: ClosingForm; chapter: number } | null;
	/** 本章开篇/收尾形式；服务层算好传进来，避免这里再读一遍正文。 */
	forms?: { opening: OpeningForm; closing: ClosingForm } | null;
}): Finding[] {
	const { profile, words, limits, previous, forms } = input;
	const findings: Finding[] = [];

	const tellTotal = profile.hardTells.reduce((sum, tell) => sum + tell.count, 0);
	if (tellTotal >= limits.hardTellTotal) {
		findings.push({
			code: "style.stockPhrase",
			severity: "warning",
			detail: profile.hardTells.map((tell) => `${tell.phrase}x${tell.count}`).join(" "),
		});
	}

	if (profile.sampleSentences >= limits.sampleFloor && profile.sentenceDispersion < limits.sentenceDispersion) {
		findings.push({ code: "style.rhythmUniform", severity: "warning", detail: String(profile.sentenceDispersion) });
	}

	if (profile.sampleSentences >= limits.sampleFloor && profile.sentenceDispersion >= limits.sentenceDispersion) {
		// 起伏够但两头都空：不是"长短交错"，而是整章停在一个中句档位。
		if (profile.shortSentenceRatio < 0.12 && profile.longSentenceRatio < 0.08) {
			findings.push({
				code: "style.rhythmNarrow",
				severity: "warning",
				detail: `${profile.shortSentenceRatio}/${profile.longSentenceRatio}`,
			});
		}
	}

	if (profile.paragraphsChecked + 1 >= limits.shortEndingFloor && profile.paragraphDispersion < limits.paragraphDispersion) {
		findings.push({
			code: "style.paragraphUniform",
			severity: "warning",
			detail: String(profile.paragraphDispersion),
		});
	}

	if (profile.paragraphsChecked >= limits.shortEndingFloor && profile.shortEndingRatio >= limits.shortEnding) {
		findings.push({ code: "style.punchlineParagraphs", severity: "warning", detail: String(profile.shortEndingRatio) });
	}

	if (profile.explainTails >= limits.explainTails) {
		findings.push({ code: "style.explainTail", severity: "warning", detail: String(profile.explainTails) });
	}

	// A7 三连排比：允许一次（偶发的排比是修辞），两次以上是套路。
	if (profile.parallelTriplets > limits.parallelTriplets) {
		findings.push({ code: "style.parallelTriplet", severity: "warning", detail: String(profile.parallelTriplets) });
	}

	// A8 情绪贴标签：强度词 + 情绪名。两次以上就不是偶发。
	if (profile.emotionLabelCount >= limits.emotionLabels) {
		findings.push({ code: "style.emotionLabel", severity: "warning", detail: String(profile.emotionLabelCount) });
	}

	// A9 千人一腔：对白够多、长度却几乎一样。说教句单列，因为改法不同（删，不是拆）。
	if (profile.dialogueLines >= limits.dialogueFloor && profile.dialogueDispersion < limits.dialogueDispersion) {
		findings.push({
			code: "style.uniformDialogue",
			severity: "warning",
			detail: `${profile.dialogueDispersion}@${profile.dialogueLines}`,
		});
	}
	if (profile.sermonLines > 0) {
		findings.push({ code: "style.sermon", severity: "warning", detail: String(profile.sermonLines) });
	}

	// A10 信息倾倒：连续多句设定说明。
	if (profile.expositionRun >= limits.expositionRun) {
		findings.push({ code: "style.expositionDump", severity: "warning", detail: String(profile.expositionRun) });
	}

	const perKilo = words > 0 ? (profile.softTellCount / words) * 1000 : 0;
	if (perKilo >= limits.softTellPerKilo) {
		findings.push({ code: "style.fillerDensity", severity: "info", detail: perKilo.toFixed(1) });
	}

	// 起手与收尾：单章只是"记一笔"；与上一章同形才是 warning。
	if (profile.timeOpenings > 0 && !(forms && previous && forms.opening === previous.opening)) {
		findings.push({ code: "style.timeOpening", severity: "info", detail: String(profile.timeOpenings) });
	}
	if (profile.punchlineEndings > 0 && !(forms && previous && forms.closing === previous.closing)) {
		findings.push({ code: "style.punchlineEnding", severity: "info", detail: String(profile.punchlineEndings) });
	}
	if (forms && previous) {
		if (forms.opening === previous.opening) {
			findings.push({
				code: "style.repeatOpening",
				severity: "warning",
				detail: `${forms.opening}@${previous.chapter}`,
			});
		}
		if (forms.closing === previous.closing) {
			findings.push({
				code: "style.repeatClosing",
				severity: "warning",
				detail: `${forms.closing}@${previous.chapter}`,
			});
		}
	}

	return findings;
}

export interface StyleGate {
	/** 能不能放行。 */
	allowed: boolean;
	/** 阻断的那些 finding。 */
	blocking: Finding[];
}

/**
 * 提交门禁：本书配置的 `styleBlocking` 里，出现任何一条就拦住。
 *
 * 为什么在领域层：这是"合不合规"的最后一道，和规则一样不需要模型判断；
 * 服务层只负责把 findings 算出来递进来。
 */
export function styleGate(findings: readonly Finding[], blocking: readonly string[]): StyleGate {
	if (blocking.length === 0) return { allowed: true, blocking: [] };
	// info 永不阻断：它不是缺陷，只供跨章对照（写错进名单也不该拦人）。
	const hit = findings.filter((finding) => finding.severity !== "info" && blocking.includes(finding.code));
	return { allowed: hit.length === 0, blocking: hit };
}

/** 本章与上一章的形式对照信息（给工具输出用，人看得懂）。 */
export function describeForms(forms: { opening: OpeningForm; closing: ClosingForm }): string {
	return `${forms.opening}/${forms.closing}`;
}

/** 从正文里取两种形式：服务层与工具都用这一处，避免两处各算一遍。 */
export function formsOf(text: string, timeHeads: readonly string[]): { opening: OpeningForm; closing: ClosingForm } {
	return { opening: openingForm(text, timeHeads), closing: closingForm(text) };
}

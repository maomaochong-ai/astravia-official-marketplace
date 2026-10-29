/**
 * 风格统计：把正文折成几个可对齐的数字（平均句长、对话占比、高频短语）。
 *
 * 全部确定性计算，不调模型也不读时钟——同一段文字永远得到同一组数。
 * 对应上游 `internal/stylestat`，但只保留"能给 Writer 当基线"的指标，不做文风打分。
 */

import type { StyleStats } from "./novel-types.js";

const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\u3040-\u30ff]/;
// 引号对用 unicode 转义写：领域层守卫禁止源码里出现中日韩字符与全角标点。
const QUOTED = /[\u201c"\u300c\u300e]([^\u201d"\u300d\u300f]{1,400})[\u201d"\u300d\u300f]/g;

function splitSentences(text: string): string[] {
	return text
		.split(/(?<=[\u3002\uff01\uff1f!?\u2026])|\n{2,}|(?<=[.!?])\s+/)
		.map((part) => part.trim())
		.filter((part) => part.length > 0);
}

/** 中文按字计、英文按词计，与 StudioService.countWords 同口径（这里独立实现以免领域层反向依赖应用层）。 */
function weigh(text: string): number {
	const cjk = text.match(/[\u3400-\u4dbf\u4e00-\u9fff\u3040-\u30ff]/g)?.length ?? 0;
	const latin = text
		.replace(/[\u3400-\u4dbf\u4e00-\u9fff\u3040-\u30ff]/g, " ")
		.split(/\s+/)
		.filter((token) => /[A-Za-z0-9]/.test(token)).length;
	return cjk + latin;
}

export function analyzeStyle(texts: readonly string[]): StyleStats {
	let words = 0;
	let sentences = 0;
	let paragraphs = 0;
	let dialogueChars = 0;
	const phraseCounts = new Map<string, number>();

	for (const text of texts) {
		if (!text.trim()) continue;
		words += weigh(text);
		paragraphs += text.split(/\n{2,}/).filter((block) => block.trim().length > 0).length;

		const parts = splitSentences(text);
		sentences += parts.length;

		for (const match of text.matchAll(QUOTED)) dialogueChars += weigh(match[1] ?? "");

		// 只有中日韩文本才做二字组统计：拉丁文按词重复更有意义，但会与句长指标混在一起。
		if (CJK.test(text)) {
			const han = text.replace(/[^\u3400-\u4dbf\u4e00-\u9fff]/g, "");
			for (let i = 0; i + 2 <= han.length; i += 1) {
				const gram = han.slice(i, i + 2);
				phraseCounts.set(gram, (phraseCounts.get(gram) ?? 0) + 1);
			}
		}
	}

	const topPhrases = [...phraseCounts.entries()]
		.filter(([, count]) => count >= 5)
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
		.slice(0, 5)
		.map(([phrase, count]) => ({ phrase, count }));

	return {
		chapters: texts.filter((text) => text.trim().length > 0).length,
		words,
		sentences,
		avgSentence: sentences === 0 ? 0 : Math.round((words / sentences) * 10) / 10,
		dialogueRatio: words === 0 ? 0 : Math.round((dialogueChars / words) * 100) / 100,
		paragraphs,
		topPhrases,
	};
}

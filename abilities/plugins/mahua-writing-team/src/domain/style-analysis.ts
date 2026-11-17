/**
 * 风格统计：把正文折成几个可对齐的数字（平均句长、对话占比、高频短语），
 * 外加一份**机器腔画像**（节奏均质度、段落形状、套句密度、解释尾巴、起手与收尾）。
 *
 * 全部确定性计算，不调模型也不读时钟——同一段文字永远得到同一组数。
 *
 * 本文件不含任何词表与阈值：词与数都在 `agent/lexicon/ai-tells.json`（经
 * `src/reference/lexicon.generated.ts` 注入，见 `domain/ai-lexicon.ts`）。
 * 改一个词不该是一次发版，也不该散落在两个地方各说一套。
 *
 * 领域层守卫禁止源码里出现中日韩字符与全角标点，所以正则一律用 `\uXXXX` 转义。
 */

import { compileLexicon, type AiLexicon, type CompiledLexicon } from "./ai-lexicon.js";
import type { AiProfile, StyleStats } from "./novel-types.js";

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

function countOf(text: string, re: RegExp): number {
	const global = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
	let count = 0;
	for (let i = 0; i < 40; i += 1) {
		const match = global.exec(text);
		if (!match) break;
		count += 1;
		if (match[0].length === 0) global.lastIndex += 1;
	}
	return count;
}

/** 波动：落在均值 ±band 之内的占比。真实的散文长短交错，这个数会明显低于阈值。 */
function bandShare(values: readonly number[], band: number): number {
	if (values.length < 4) return 0;
	const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
	if (mean <= 0) return 0;
	const near = values.filter((value) => value >= mean * (1 - band) && value <= mean * (1 + band)).length;
	return Math.round((near / values.length) * 100) / 100;
}

function startsWithAny(sentence: string, heads: readonly string[]): boolean {
	return heads.some((head) => sentence.startsWith(head));
}

function emptyProfile(): AiProfile {
	return {
		chapters: 0,
		sampleSentences: 0,
		sentenceUniformity: 0,
		shortSentenceRatio: 0,
		longSentenceRatio: 0,
		paragraphUniformity: 0,
		hardTells: [],
		softTellCount: 0,
		explainTails: 0,
		timeOpenings: 0,
		punchlineEndings: 0,
		paragraphsChecked: 0,
		shortEndedParagraphs: 0,
		shortEndingRatio: 0,
	};
}

/**
 * 机器腔画像。
 *
 * 每个指标都对应一条能改的动作，而不是一个分数：
 * `sentenceUniformity` 高 → 长短句拆开重写；`hardTells` → 换成动作；`explainTails` → 删掉；
 * `timeOpenings` → 换一个非时间的起手。
 */
export function analyzeAiProfile(texts: readonly string[], lexicon: AiLexicon): AiProfile {
	const compiled: CompiledLexicon = compileLexicon(lexicon);
	const { limits } = compiled;
	const profile = emptyProfile();
	const lengths: number[] = [];
	const paragraphShapes: number[] = [];
	const tellCounts = new Map<string, number>();
	let softCount = 0;

	for (const text of texts) {
		if (!text.trim()) continue;
		profile.chapters += 1;

		const sentences = splitSentences(text);
		for (const sentence of sentences) {
			const size = weigh(sentence);
			if (size > 0) lengths.push(size);
			if (startsWithAny(sentence, compiled.explainHeads)) profile.explainTails += 1;
		}

		const paragraphs = text
			.split(/\n{2,}/)
			.map((block) => block.trim())
			.filter((block) => block.length > 0);
		for (const paragraph of paragraphs) {
			const inParagraph = splitSentences(paragraph);
			paragraphShapes.push(inParagraph.length);
			// 每段最后一句都把上一组句子"斩断"：机器腔最稳的鼓点（三句铺垫 + 一句短句）。
			// 只和本段的平均句长比，不需要认定哪句是金句。
			if (inParagraph.length >= 2) {
				const sizes = inParagraph.map((sentence) => weigh(sentence));
				const mean = sizes.reduce((sum, value) => sum + value, 0) / sizes.length;
				const last = sizes[sizes.length - 1] ?? 0;
				profile.paragraphsChecked += 1;
				if (mean > 0 && last <= mean * limits.brakeRatio) profile.shortEndedParagraphs += 1;
			}
		}

		for (const tell of compiled.stock) {
			const count = countOf(text, tell.re);
			if (count > 0) tellCounts.set(tell.phrase, (tellCounts.get(tell.phrase) ?? 0) + count);
		}
		for (const tell of compiled.soft) softCount += countOf(text, tell.re);

		const first = sentences[0];
		if (first && startsWithAny(first, compiled.timeHeads)) profile.timeOpenings += 1;

		const lastParagraph = paragraphs[paragraphs.length - 1] ?? "";
		const lastSentences = splitSentences(lastParagraph);
		// 金句收尾：最后一段只有一句、而且短到像一句断语。一行动作不算：那才是好结尾。
		if (lastSentences.length === 1 && weigh(lastSentences[0] ?? "") <= limits.shortSentenceMax + 2) {
			profile.punchlineEndings += 1;
		}
	}

	profile.sampleSentences = lengths.length;
	profile.sentenceUniformity = bandShare(lengths, limits.uniformBand);
	const shorts = lengths.filter((value) => value < limits.shortSentenceMax).length;
	const longs = lengths.filter((value) => value > limits.longSentenceMin).length;
	profile.shortSentenceRatio = lengths.length === 0 ? 0 : Math.round((shorts / lengths.length) * 100) / 100;
	profile.longSentenceRatio = lengths.length === 0 ? 0 : Math.round((longs / lengths.length) * 100) / 100;
	profile.paragraphUniformity = bandShare(paragraphShapes, limits.uniformBand);
	profile.softTellCount = softCount;
	// 「每段都以短句收尾」的占比：段数太少时不报（没有分母就没有结论）。
	profile.shortEndingRatio =
		profile.paragraphsChecked === 0
			? 0
			: Math.round((profile.shortEndedParagraphs / profile.paragraphsChecked) * 100) / 100;
	profile.hardTells = [...tellCounts.entries()]
		.map(([phrase, count]) => ({ phrase, count }))
		.sort((a, b) => b.count - a.count || a.phrase.localeCompare(b.phrase));

	return profile;
}

export function analyzeStyle(texts: readonly string[], lexicon: AiLexicon): StyleStats {
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
		ai: analyzeAiProfile(texts, lexicon),
	};
}

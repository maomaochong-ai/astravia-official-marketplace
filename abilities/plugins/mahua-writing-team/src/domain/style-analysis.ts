/**
 * 风格统计：把正文折成几个可对齐的数字（平均句长、对话占比、高频短语），
 * 外加一份**AI 腔画像**（节奏均质度、段落形状、套句密度、解释尾巴、起手与收尾）。
 *
 * 全部确定性计算，不调模型也不读时钟——同一段文字永远得到同一组数。
 * 对应上游 `internal/stylestat`，但只保留"能给 Writer 当基线"的指标，不做文风打分。
 *
 * 为什么要有画像这一半：光说"避免 AI 味"对模型没用，它看不到自己写出的节奏。
 * 断句长度分布、段落句数分布、套句命中数都是它能立刻对照修改的东西——而且这些
 * 数字在改动后立刻会变，能被下一轮验证。
 *
 * 本文件在领域层，禁止出现中日韩字符与全角标点（`test/manifest-guards.test.ts` 守着），
 * 所以词表一律写成 `\uXXXX` 转义。
 */

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

/**
 * 硬套句：出现就该改。
 *
 * 挑的标准不是"俗"，而是**它替读者做了本可以由动作完成的事**：不由得/不禁把意愿抹平，
 * 仿佛/宛如把新鲜的比喻换成现成的，一丝/一抹把情绪量词化，其余是作者替读者总结。
 */
const HARD_TELLS: readonly { phrase: string; re: RegExp }[] = [
	{ phrase: "\u4e0d\u7531\u5f97", re: /\u4e0d\u7531\u5f97/g }, // 不由得
	{ phrase: "\u4e0d\u7531\u81ea\u4e3b", re: /\u4e0d\u7531\u81ea\u4e3b/g }, // 不由自主
	{ phrase: "\u4e0d\u7981", re: /\u4e0d\u7981(?![u\w])/g }, // 不禁
	{ phrase: "\u4eff\u4f5b", re: /\u4eff\u4f5b/g }, // 仿佛
	{ phrase: "\u5b9b\u5982", re: /\u5b9b\u5982/g }, // 宛如
	{ phrase: "\u4e00\u4e1d", re: /\u4e00\u4e1d/g }, // 一丝
	{ phrase: "\u4e00\u62b9", re: /\u4e00\u62b9/g }, // 一抹
	{ phrase: "\u4e00\u7f15", re: /\u4e00\u7f15/g }, // 一缕
	{ phrase: "\u83ab\u540d", re: /\u83ab\u540d/g }, // 莫名
	{ phrase: "\u4e94\u5473\u6742\u9648", re: /\u4e94\u5473\u6742\u9648/g },
	{ phrase: "\u96be\u4ee5\u8a00\u55bb", re: /\u96be\u4ee5\u8a00\u55bb/g },
	{ phrase: "\u610f\u5473\u6df1\u957f", re: /\u610f\u5473\u6df1\u957f/g },
	{ phrase: "\u4e0e\u6b64\u540c\u65f6", re: /\u4e0e\u6b64\u540c\u65f6/g },
	{ phrase: "\u7a7a\u6c14\u51dd\u56fa", re: /\u7a7a\u6c14(\u4eff\u4f5b)?\u51dd\u56fa/g },
	{ phrase: "\u65f6\u95f4\u9759\u6b62", re: /\u65f6\u95f4\u9759\u6b62/g },
	{ phrase: "\u77b3\u5b54\u4e00\u7f29", re: /\u77b3\u5b54\u4e00\u7f29/g },
	{ phrase: "\u5fc3\u4e2d\u4e00\u51db", re: /\u5fc3\u4e2d\u4e00\u51db/g },
	{ phrase: "\u5fc3\u4e2d\u4e00\u7d27", re: /\u5fc3\u4e2d\u4e00\u7d27/g },
	{ phrase: "\u773c\u6846\u4e00\u70ed", re: /\u773c\u6846\u4e00\u70ed/g },
	{ phrase: "\u5982\u906d\u96f7\u51fb", re: /\u5982\u906d\u96f7\u51fb/g },
	{ phrase: "\u8840\u6db2\u51dd\u56fa", re: /\u8840\u6db2\u51dd\u56fa/g },
	{ phrase: "\u6df1\u5438\u4e00\u53e3\u6c14", re: /\u6df1\u5438\u4e00\u53e3\u6c14/g },
	{ phrase: "\u5634\u89d2[..]\u4e0a\u626c", re: /\u5634\u89d2[^\u3002\uff0c\uff01\uff1f]{0,6}\u4e0a\u626c/g },
	{ phrase: "\u8bf4\u4e0d\u6e05", re: /\u8bf4\u4e0d\u6e05/g },
	{ phrase: "\u67d0\u79cd\u7a0b\u5ea6\u4e0a", re: /\u67d0\u79cd\u7a0b\u5ea6\u4e0a/g },
	{ phrase: "\u503c\u5f97\u6ce8\u610f\u7684\u662f", re: /\u503c\u5f97\u6ce8\u610f\u7684\u662f/g },
];

/** 软词：好文章也会用，所以只在密度过高时算问题。 */
const SOFT_TELLS: readonly { phrase: string; re: RegExp }[] = [
	{ phrase: "\u5ffd\u7136", re: /\u5ffd\u7136/g }, // 忽然
	{ phrase: "\u7a81\u7136", re: /\u7a81\u7136/g }, // 突然
	{ phrase: "\u7adf\u7136", re: /\u7adf\u7136/g }, // 竟然
	{ phrase: "\u5fae\u5fae", re: /\u5fae\u5fae/g }, // 微微
	{ phrase: "\u8f7b\u8f7b", re: /\u8f7b\u8f7b/g }, // 轻轻
	{ phrase: "\u7f13\u7f13", re: /\u7f13\u7f13/g }, // 缓缓
	{ phrase: "\u6de1\u6de1", re: /\u6de1\u6de1/g }, // 淡淡
	{ phrase: "\u987f\u4e86\u987f", re: /\u987f\u4e86\u987f/g },
];

/** 叙述者替读者总结的句首：句子本身没错，错在一章里反复出现。 */
const EXPLAIN_HEADS = [
	"\u4ed6\u77e5\u9053", // 他知道
	"\u5979\u77e5\u9053", // 她知道
	"\u8fd9\u610f\u5473\u7740", // 这意味着
	"\u6362\u53e5\u8bdd\u8bf4", // 换句话说
	"\u4e5f\u5c31\u662f\u8bf4", // 也就是说
	"\u663e\u7136", // 显然
] as const;

/** 时间/天气起手：单章看不出重复，所以只在画像里记，不单独报警。 */
const TIME_HEADS = [
	"\u6e05\u6668", // 清晨
	"\u65e9\u6668", // 早晨
	"\u65e9\u4e0a", // 早上
	"\u508d\u665a", // 傍晚
	"\u9ec4\u660f", // 黄昏
	"\u6df1\u591c", // 深夜
	"\u591c\u91cc", // 夜里
	"\u591c\u6669", // 夜晚
	"\u5348\u540e", // 午后
	"\u4e2d\u5348", // 中午
	"\u5929\u8272", // 天色
	"\u9633\u5149", // 阳光
] as const;

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

/** 波动：句长落在均值 ±25% 之内的占比。真实的散文长句短句交错，这个数会明显低于 0.7。 */
function uniformity(lengths: readonly number[]): number {
	if (lengths.length < 4) return 0;
	const mean = lengths.reduce((sum, value) => sum + value, 0) / lengths.length;
	if (mean <= 0) return 0;
	const near = lengths.filter((value) => value >= mean * 0.75 && value <= mean * 1.25).length;
	return Math.round((near / lengths.length) * 100) / 100;
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
 * AI 腔画像。
 *
 * 每个指标都对应一条能改的动作，而不是一个分数：
 * `sentenceUniformity` 高 → 长短句拆开重写；`hardTells` → 换成动作；`explainTails` → 删掉；
 * `timeOpenings` → 换一个非时间的起手。
 */
export function analyzeAiProfile(texts: readonly string[]): AiProfile {
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
			if (startsWithAny(sentence, EXPLAIN_HEADS)) profile.explainTails += 1;
		}

		const paragraphs = text
			.split(/\n{2,}/)
			.map((block) => block.trim())
			.filter((block) => block.length > 0);
		for (const paragraph of paragraphs) {
			const inParagraph = splitSentences(paragraph);
			paragraphShapes.push(inParagraph.length);
			// 每段最后一句都把上一组句子“斩断”：这是机器腔最稳的鼓点（三句铺垫 + 一句短句）。
			// 比“金句”好判得多：只和本段的平均句长比，不需要认定哪句是金句。
			if (inParagraph.length >= 2) {
				const sizes = inParagraph.map((sentence) => weigh(sentence));
				const mean = sizes.reduce((sum, value) => sum + value, 0) / sizes.length;
				const last = sizes[sizes.length - 1] ?? 0;
				profile.paragraphsChecked += 1;
				if (mean > 0 && last <= mean * 0.6) profile.shortEndedParagraphs += 1;
			}
		}

		for (const tell of HARD_TELLS) {
			const count = countOf(text, tell.re);
			if (count > 0) tellCounts.set(tell.phrase, (tellCounts.get(tell.phrase) ?? 0) + count);
		}
		for (const tell of SOFT_TELLS) softCount += countOf(text, tell.re);

		const first = sentences[0];
		if (first && startsWithAny(first, TIME_HEADS)) profile.timeOpenings += 1;

		const lastParagraph = paragraphs[paragraphs.length - 1] ?? "";
		const lastSentences = splitSentences(lastParagraph);
		// 金句收尾：最后一段只有一句、而且短到像一句断语（≤ 12 字）。
		// 一行动作不算：那才是好结尾。
		if (lastSentences.length === 1 && weigh(lastSentences[0] ?? "") <= 12) profile.punchlineEndings += 1;
	}

	profile.sampleSentences = lengths.length;
	profile.sentenceUniformity = uniformity(lengths);
	const shorts = lengths.filter((value) => value < 10).length;
	const longs = lengths.filter((value) => value > 45).length;
	profile.shortSentenceRatio = lengths.length === 0 ? 0 : Math.round((shorts / lengths.length) * 100) / 100;
	profile.longSentenceRatio = lengths.length === 0 ? 0 : Math.round((longs / lengths.length) * 100) / 100;
	profile.paragraphUniformity = uniformity(paragraphShapes);
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
		ai: analyzeAiProfile(texts),
	};
}

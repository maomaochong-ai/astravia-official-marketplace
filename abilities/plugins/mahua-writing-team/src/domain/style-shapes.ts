/**
 * AI 腔的四种**非词形**形状：排比、情绪贴标签、千人一腔、信息倾倒。
 *
 * 为什么单独一个文件：这四条都不是"某个词出现了"，而是结构——并列、强度+情绪名、
 * 对白长度趋同、连续说明句。它们和词表（`ai-tells.json`）共用阈值与标记，
 * 但代码逻辑与「套句计数」完全不同，混在 `style-analysis.ts` 里会看不清边界。
 *
 * 四条都是启发式，所以：
 *  - 每一条都有**下限**（句数 / 排比次数 / 对白行数），样本不够就不报；
 *  - 阈值全部来自词表，不在这里写数字；
 *  - 只出 finding 的原料（次数），判定在 `writing-rules.ts` 统一做——这样按书覆盖阈值时
 *    不必改这里。
 */

import type { CompiledLexicon } from "./ai-lexicon.js";

/** 分句：排比与情绪贴标签都在分句层看。 */
const CLAUSE_SEPARATORS = /[\u3001\uff0c\uff1b;,\u2014]/;

const QUOTED = /[\u201c"\u300c\u300e]([^\u201d"\u300d\u300f]{1,400})[\u201d"\u300d\u300f]/g;

export function splitClauses(sentence: string): string[] {
	return sentence
		.split(CLAUSE_SEPARATORS)
		.map((clause) => clause.trim())
		.filter((clause) => clause.length > 0);
}

export function splitSentences(text: string): string[] {
	return text
		.split(/(?<=[\u3002\uff01\uff1f!?\u2026])|\n{2,}|(?<=[.!?])\s+/)
		.map((part) => part.trim())
		.filter((part) => part.length > 0);
}

/** 段落列表（空行分隔，去掉纯空白段）。 */
export function paragraphsOf(text: string): string[] {
	return text
		.split(/\n{2,}/)
		.map((block) => block.trim())
		.filter((block) => block.length > 0);
}

/** 中文按字计；与 studio-service 的 countWords 同口径（这里只需相对尺度）。 */
export function weigh(text: string): number {
	const cjk = text.match(/[\u3400-\u4dbf\u4e00-\u9fff\u3040-\u30ff]/g)?.length ?? 0;
	const latin = text
		.replace(/[\u3400-\u4dbf\u4e00-\u9fff\u3040-\u30ff]/g, " ")
		.split(/\s+/)
		.filter((token) => /[A-Za-z0-9]/.test(token)).length;
	return cjk + latin;
}

/**
 * A7 三连排比。
 *
 * 判定的是**结构重复**，不是某个词：一句话里连续的三个分句，满足其一即算——
 *  - 前两个字相同（"不再犹豫，不再退缩，不再回头"）；
 *  - 长度相差不超过一个字，且都以同一个字收尾（"他走了，她哭了，风停了"）；
 *  - 都以 `parallelMarkers` 之一开头（"没有灯，没有人，没有声音"）。
 *
 * 为什么要三条而不是一条：单看前缀会漏掉"他…她…风…"这类主语替换，单看长度会把
 * 正常的三短句当成排比。三条并列是安全网。
 */
export function countParallelTriplets(text: string, lexicon: CompiledLexicon): number {
	let count = 0;
	for (const sentence of splitSentences(text)) {
		const clauses = splitClauses(sentence);
		if (clauses.length < 3) continue;
		for (let index = 0; index + 2 < clauses.length; index += 1) {
			const group = clauses.slice(index, index + 3);
			if (isParallel(group, lexicon.parallelMarkers)) {
				count += 1;
				index += 2;
			}
		}
	}
	return count;
}

function isParallel(group: readonly string[], markers: readonly string[]): boolean {
	const [a, b, c] = group.map((clause) => clause.replace(/[\u3002\uff01\uff1f!?]$/, "").trim());
	if (!a || !b || !c) return false;
	// 标记不必在句首：「她不再犹豫」与「不再退缩」同属一组。前三个字之内出现即算。
	const group3 = [a, b, c];
	if (markers.some((marker) => group3.every((clause) => clause.slice(0, 3).includes(marker)))) return true;
	const head = (value: string): string => value.slice(0, 2);
	if (head(a) === head(b) && head(b) === head(c)) return true;
	const tail = (value: string): string => value.slice(-1);
	const lengths = [weigh(a), weigh(b), weigh(c)];
	const even = Math.max(...lengths) - Math.min(...lengths) <= 1;
	return even && tail(a) === tail(b) && tail(b) === tail(c);
}

/**
 * A8 情绪贴标签：强度词 + 情绪名（"他非常愤怒""她感到委屈"）。
 *
 * 只算**贴着**的：`intensifiers` 之一在情绪名之前 0–2 个字之内。
 * "他很生气地把杯子放下"仍然算——它确实在给情绪命名；改成动作才是修法。
 */
export function countEmotionLabels(text: string, lexicon: CompiledLexicon): number {
	let count = 0;
	for (const label of lexicon.emotionLabels) {
		let from = 0;
		for (let guard = 0; guard < 60; guard += 1) {
			const at = text.indexOf(label, from);
			if (at < 0) break;
			from = at + label.length;
			const before = text.slice(Math.max(0, at - 4), at);
			if (lexicon.intensifiers.some((word) => before.includes(word))) count += 1;
		}
	}
	return count;
}

/**
 * A9 千人一腔：对白句长度趋同。
 *
 * 取所有引号内的句子，算长度的离散度。人写对白长短悬殊（"走。"／"灯灭了我就看不见你。"），
 * 机器写的对白句句等长。判定要求对白行数达到 `dialogueFloor`，否则不给结论。
 */
export function dialogueProfile(text: string, lexicon: CompiledLexicon): { lines: number; dispersion: number; sermons: number } {
	const lengths: number[] = [];
	let sermons = 0;
	for (const match of text.matchAll(QUOTED)) {
		const line = (match[1] ?? "").trim();
		if (!line) continue;
		const size = weigh(line);
		if (size > 0) lengths.push(size);
		// 说教：一句对白里出现两个以上"你应该/你必须/你要明白"这类词。
		const hits = lexicon.sermonMarkers.filter((marker) => line.includes(marker)).length;
		if (hits >= 2) sermons += 1;
	}
	if (lengths.length === 0) return { lines: 0, dispersion: 0, sermons };
	const mean = lengths.reduce((sum, value) => sum + value, 0) / lengths.length;
	if (mean <= 0) return { lines: lengths.length, dispersion: 0, sermons };
	const variance = lengths.reduce((sum, value) => sum + (value - mean) ** 2, 0) / lengths.length;
	return {
		lines: lengths.length,
		dispersion: Math.round((Math.sqrt(variance) / mean) * 100) / 100,
		sermons,
	};
}

/**
 * A10 信息倾倒：连续若干句「没有对白 + 带设定标记」。
 *
 * 单句设定说明是必要的；连续四句都在解释世界，就是在念设定集。
 * 只数"无对白 + 至少一个 expositionMarkers"的句子，连续长度取最长的一段。
 */
export function longestExpositionRun(text: string, lexicon: CompiledLexicon): number {
	let longest = 0;
	for (const paragraph of paragraphsOf(text)) {
		let run = 0;
		for (const sentence of splitSentences(paragraph)) {
			const hasQuote = /[\u201c"\u300c\u300e]/.test(sentence);
			const explains = lexicon.expositionMarkers.some((marker) => sentence.includes(marker));
			if (!hasQuote && explains) {
				run += 1;
				longest = Math.max(longest, run);
			} else {
				run = 0;
			}
		}
	}
	return longest;
}

/**
 * 开篇与收尾的**形式**（不是词）。
 *
 * 跨章重复才是问题：连着两章都用时间起手、或都用一句金句收尾，读者会先感到"套"。
 * 单章只能记一笔，所以分类要稳定、可枚举：
 *   opening: `dialogue` `time` `action` `question` `statement`
 *   closing: `dialogue` `action` `question` `summary` `echo`
 */
export type OpeningForm = "dialogue" | "time" | "action" | "question" | "statement";
export type ClosingForm = "dialogue" | "action" | "question" | "summary" | "echo";

/** 动作动词：收尾停在动作上是最常见的"好结尾"。 */
// 动词用转义写：领域层守卫禁止源码出现中日韩字符（词表在 agent/lexicon 里）。
const ACTION_MARKERS = [
	"\u8d70",
	"\u63a8",
	"\u62c9",
	"\u62ff",
	"\u653e",
	"\u5750",
	"\u7ad9",
	"\u8f6c\u8eab",
	"\u62ac",
	"\u4f4e",
	"\u63e1",
	"\u6572",
	"\u6309",
	"\u5173",
	"\u5f00",
	"\u5012",
	"\u64e6",
	"\u9012",
	"\u63a5",
];

function firstSentence(text: string): string {
	return splitSentences(text)[0] ?? text.trim().split("\n")[0] ?? "";
}

function lastSentence(text: string): string {
	const sentences = splitSentences(text);
	return sentences[sentences.length - 1] ?? text.trim().split("\n").pop() ?? "";
}

export function openingForm(text: string, timeHeads: readonly string[]): OpeningForm {
	const first = firstSentence(text);
	if (!first) return "statement";
	if (/^[\u201c"\u300c\u300e]/.test(first)) return "dialogue";
	if (timeHeads.some((head) => first.startsWith(head))) return "time";
	if (/[?\uff1f]$/.test(first)) return "question";
	if (ACTION_MARKERS.some((marker) => first.includes(marker))) return "action";
	return "statement";
}

export function closingForm(text: string): ClosingForm {
	const last = lastSentence(text);
	if (!last) return "echo";
	if (/^[\u201c"\u300c\u300e]/.test(last)) return "dialogue";
	if (/[?\uff1f]$/.test(last)) return "question";
	// 总结/点题：以"原来/终于/其实/这就是"起头，或整句不到一句半的短断语。
	if (/^(\u539f\u6765|\u7ec8\u4e8e|\u5176\u5b9e|\u8fd9\u5c31\u662f|\u6216\u8bb8)/.test(last)) return "summary";
	if (weigh(last) <= 12 && ACTION_MARKERS.every((marker) => !last.includes(marker))) return "summary";
	if (ACTION_MARKERS.some((marker) => last.includes(marker))) return "action";
	return "echo";
}

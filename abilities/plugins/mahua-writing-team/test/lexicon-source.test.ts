import { readFileSync, readdirSync, statSync } from "node:fs";
import type { AiLexicon } from "../src/domain/ai-lexicon.js";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { AI_LEXICON } from "../src/reference/lexicon.generated.js";
import { analyzeAiProfile } from "../src/domain/style-analysis.js";
import { compileLexicon } from "../src/domain/ai-lexicon.js";

/**
 * 「禁止硬编码」的守卫。
 *
 * 词表曾经写在 `src/domain/style-analysis.ts` 里，用 `\uXXXX` 转义躲过了领域层的字符检查——
 * 躲得过检查，躲不过下一个要改词的人：他得先知道这些码点是什么。现在词在
 * `agent/lexicon/ai-tells.json`，代码只解释数据。
 *
 * 四条断言：
 *  1. 数据文件是唯一来源：代码里（含转义后解码）不得出现任何词条；
 *  2. 生成物与数据文件同步：改了 JSON 忘了跑 `npm run references` 会红；
 *  3. 阈值同样来自数据文件；
 *  4. 换一份词表，检测结果跟着变——这是「数据驱动」的实际证明。
 */

const root = fileURLToPath(new URL("..", import.meta.url));
const lexiconPath = join(root, "agent", "lexicon", "ai-tells.json");
const source = JSON.parse(readFileSync(lexiconPath, "utf8")) as AiLexicon & { version: number; updated: string };

function sourceFiles(dir: string): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
		else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
	}
	return out;
}

/** 把 `\uXXXX` 转义还原成字符：否则"写在代码里但伪装成码点"就查不出来。 */
function decoded(text: string): string {
	return text.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)));
}

/** 注释里提到一个词不算硬编码：它不参与匹配，也改不动行为。只查可执行部分。 */
function code(text: string): string {
	return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}


describe("the AI-flavour lexicon lives in data, not in code", () => {
	it("no word from the lexicon appears anywhere in src/ except the generated module", () => {
		const generated = join(root, "src", "reference", "lexicon.generated.ts");
		const phrases = [...source.stock, ...source.soft].map((entry) => entry.phrase);
		const leaks: string[] = [];
		for (const file of sourceFiles(join(root, "src"))) {
			if (file === generated) continue;
			// 工艺文档本身就在说这些词（它是给作者看的指南），不算代码。
			if (relative(join(root, "src"), file).startsWith(`reference${sep}`)) continue;
			const text = code(decoded(readFileSync(file, "utf8")));
			for (const phrase of phrases) {
				if (text.includes(phrase)) leaks.push(`${relative(root, file)}: ${phrase}`);
			}
		}
		expect(leaks).toEqual([]);
	});

	it("the generated module matches the data file", () => {
		expect(AI_LEXICON.stock.map((entry) => entry.phrase)).toEqual(source.stock.map((entry) => entry.phrase));
		expect(AI_LEXICON.soft.map((entry) => entry.phrase)).toEqual(source.soft.map((entry) => entry.phrase));
		expect(AI_LEXICON.explainHeads).toEqual(source.explainHeads);
		expect(AI_LEXICON.timeHeads).toEqual(source.timeHeads);
	});

	it("thresholds come from the same file", () => {
		expect(AI_LEXICON.limits).toEqual(source.limits);
		for (const value of Object.values(AI_LEXICON.limits)) expect(typeof value).toBe("number");
	});

	it("a swapped lexicon changes the result — proof the words are data", () => {
		const text = "他把杯子放下，慢慢走到窗前。";
		const custom = {
			limits: source.limits,
			stock: [{ phrase: "custom-tell", pattern: "窗前" }],
			soft: [],
			explainHeads: [],
			timeHeads: [],
		};
		expect(analyzeAiProfile([text], custom).hardTells).toEqual([{ phrase: "custom-tell", count: 1 }]);
		// 默认词表里没有"窗前"：同一段文字不该报任何套句。
		expect(analyzeAiProfile([text], AI_LEXICON).hardTells).toEqual([]);
	});

	it("compiling is forgiving: one bad pattern does not take the rest down", () => {
		const compiled = compileLexicon({
			limits: source.limits,
			stock: [
				{ phrase: "broken", pattern: "([unclosed" },
				{ phrase: "fine", pattern: "窗前" },
			],
			soft: [],
			explainHeads: [],
			timeHeads: [],
		});
		expect(compiled.stock.map((entry) => entry.phrase)).toEqual(["fine"]);
	});
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { AI_LEXICON } from "../src/reference/lexicon.generated.js";
import { analyzeStyle } from "../src/domain/style-analysis.js";
import { lintStyle } from "../src/domain/writing-rules.js";
import type { Finding } from "../src/domain/novel-types.js";

/**
 * 反机器腔回归：语料是判据的对照组。
 *
 * 为什么要这一层：`ai-flavor.test.ts` 证明的是「某个形状能被算出来」，用内联字符串；
 * 这一层证明的是「一整章读下来，该报的报了、不该报的一个都没报」——用文件。
 * 两者分工：内联样本守数学，语料守判断。
 *
 * 三条硬规矩（写在这里，改动时不要绕）：
 *  1. 语料样本自写。引用他人作品无法保证逐字准确，宁可自己写。
 *  2. 期望值写在 `manifest.json` 里，与样本一起 review。改样本不改期望 = 让测试自适应，等于没测。
 *  3. `human-*` 必须零 finding（**包括 info**）。允许「有点像」就是在允许误报。
 */

interface Case {
	file: string;
	kind: "machine" | "human";
	expect?: string[];
	expectInfo?: string[];
	minWarnings?: number;
	note?: string;
}

interface Pair {
	before: string;
	after: string;
	expectBefore: string[];
	note?: string;
}

interface Manifest {
	note: string;
	cases: Case[];
	pairs: Pair[];
}

const dir = join(__dirname, "fixtures", "ai-flavor");
const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")) as Manifest;

/** 走生产路径：同一份词表、同一套阈值。 */
function review(file: string): { findings: Finding[]; words: number; sentences: number } {
	const text = readFileSync(join(dir, file), "utf8");
	const stats = analyzeStyle([text], AI_LEXICON);
	const findings = lintStyle({ profile: stats.ai, words: stats.words, limits: AI_LEXICON.limits });
	return { findings, words: stats.words, sentences: stats.ai.sampleSentences };
}

const warnings = (findings: Finding[]): Finding[] => findings.filter((finding) => finding.severity !== "info");
const codes = (findings: Finding[]): string[] => findings.map((finding) => finding.code);

/** 检测器能发出的全部 code：从源码读，新增一条还没进语料就会红。 */
function emittedCodes(): { warning: string[]; info: string[] } {
	const source = readFileSync(join(__dirname, "..", "src", "domain", "writing-rules.ts"), "utf8");
	const warning: string[] = [];
	const info: string[] = [];
	for (const match of source.matchAll(/code: "(style\.[a-zA-Z]+)",\s*severity: "(warning|info)"/g)) {
		(match[2] === "warning" ? warning : info).push(match[1] as string);
	}
	return { warning: [...new Set(warning)].sort(), info: [...new Set(info)].sort() };
}

describe("the corpus is a real control group", () => {
	it("has both sides, and every fixture on disk is covered", () => {
		expect(manifest.cases.some((entry) => entry.kind === "machine")).toBe(true);
		expect(manifest.cases.some((entry) => entry.kind === "human")).toBe(true);
		expect(manifest.pairs.length).toBeGreaterThan(0);
		for (const entry of manifest.cases) expect(() => readFileSync(join(dir, entry.file)), entry.file).not.toThrow();
	});

	it("only names codes the linter can actually emit", () => {
		const known = new Set([...emittedCodes().warning, ...emittedCodes().info]);
		const declared = new Set<string>();
		for (const entry of manifest.cases) {
			for (const code of entry.expect ?? []) declared.add(code);
			for (const code of entry.expectInfo ?? []) declared.add(code);
		}
		for (const pair of manifest.pairs) for (const code of pair.expectBefore) declared.add(code);
		expect([...declared].filter((code) => !known.has(code))).toEqual([]);
	});
});

describe("machine-flavoured samples are caught for the defect they were written with", () => {
	for (const entry of manifest.cases.filter((item) => item.kind === "machine")) {
		it(`${entry.file} — ${entry.note ?? ""}`, () => {
			const { findings } = review(entry.file);
			const observed = codes(findings);
			for (const code of entry.expect ?? []) {
				expect(observed, `${entry.file} should report ${code}`).toContain(code);
			}
			for (const code of entry.expectInfo ?? []) {
				expect(observed, `${entry.file} should mention ${code}`).toContain(code);
			}
			// 必须至少一条 warning：只有 info 的样本证明不了检测器在起作用。
			expect(warnings(findings).length).toBeGreaterThanOrEqual(entry.minWarnings ?? 1);
		});
	}
});

describe("ordinary prose produces nothing at all", () => {
	for (const entry of manifest.cases.filter((item) => item.kind === "human")) {
		it(`${entry.file} — ${entry.note ?? ""}`, () => {
			const { findings, words } = review(entry.file);
			// 零 finding，含 info：一条 info 也说明判据在这段文字上偏了。
			expect(findings, `${entry.file} (${words} words) reported ${codes(findings).join(", ")}`).toEqual([]);
		});
	}
});

describe("rewriting the same scene clears it", () => {
	for (const pair of manifest.pairs) {
		it(`${pair.before} → ${pair.after} — ${pair.note ?? ""}`, () => {
			const before = review(pair.before);
			const after = review(pair.after);

			for (const code of pair.expectBefore) {
				expect(codes(before.findings), `${pair.before} should report ${code}`).toContain(code);
			}
			expect(warnings(before.findings).length).toBeGreaterThan(0);

			// 改后的那一版必须干净：这是「改完没有 AI 味」的直接断言。
			expect(codes(after.findings), `${pair.after} still reports ${codes(after.findings).join(", ")}`).toEqual([]);
			// 并且不是靠删短章躲过去：两版字数应在同一量级（改动是句子，不是篇幅）。
			expect(Math.abs(after.words - before.words)).toBeLessThan(before.words);
		});
	}
});

describe("coverage: every warning the linter can emit appears in the corpus", () => {
	it("keeps the corpus in step with the rule set", () => {
		const covered = new Set<string>(manifest.pairs.flatMap((pair) => pair.expectBefore));
		for (const entry of manifest.cases.filter((item) => item.kind === "machine")) {
			for (const code of entry.expect ?? []) covered.add(code);
		}
		// 新增一条 style.* warning 而语料没覆盖它 → 这里红：要么补样本，要么别加规则。
		const missing = emittedCodes().warning.filter((code) => !covered.has(code));
		expect(missing, `corpus does not cover: ${missing.join(", ")}`).toEqual([]);
	});
});

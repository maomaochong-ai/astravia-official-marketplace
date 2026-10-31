import { describe, expect, it } from "vitest";
import { analyzeStyle } from "../src/domain/style-analysis.js";
import { extractChapterFacts } from "../src/domain/chapter-facts.js";
import { DEFAULT_RULES, lintChapter, normalizeRules } from "../src/domain/writing-rules.js";
import { checkConsistency } from "../src/domain/consistency-checks.js";
import { buildContext } from "../src/domain/context-pack.js";
import { auditPremise, parsePremise } from "../src/domain/premise-structure.js";
import {
	acceptBrief,
	createBook,
	reviseOutlineTail,
	saveChapterDraft,
	saveChapterOutline,
	saveVolumePlan,
} from "../src/domain/novel-progress.js";
import type { Chapter, NovelBook, Volume } from "../src/domain/novel-types.js";

const NOW = "2026-10-29T00:00:00.000Z";

const VOLUME: Volume = {
	id: "v1",
	title: "Salt",
	goal: "reach the sea",
	hook: "the tide answers",
	arcs: [{ id: "a1", title: "Tide", goal: "leave", from: 1, to: 3 }],
};

function bookWith(texts: Record<number, string>): NovelBook {
	const created = createBook(
		{ id: "b1", title: "Salt", genre: "SF", premise: "p", targetChapters: 6, styleSample: "" },
		NOW,
	);
	const briefed = acceptBrief(created, NOW);
	if (!briefed.ok) throw new Error(briefed.error);
	const planned = saveVolumePlan(briefed.book, VOLUME, NOW);
	if (!planned.ok) throw new Error(planned.error);
	let book: NovelBook = {
		...planned.book,
		cast: ["Mira", "Kell"],
		foundation: { theme: "t", conflict: "c", protagonist: "p", ending: "e", taboo: "", hook: "" },
	};
	for (const [n, text] of Object.entries(texts)) {
		const outlined = saveChapterOutline(book, { n: Number(n), title: `Ch ${n}` }, NOW);
		if (!outlined.ok) throw new Error(outlined.error);
		book = outlined.book;
		const drafted = saveChapterDraft(book, { n: Number(n), words: Math.max(1200, text.length) }, NOW);
		if (!drafted.ok) throw new Error(drafted.error);
		book = {
			...drafted.book,
			chapters: drafted.book.chapters.map((chapter: Chapter) =>
				chapter.n === Number(n) ? { ...chapter, facts: extractChapterFacts(text, book.cast) } : chapter,
			),
		};
	}
	return book;
}

describe("style statistics", () => {
	it("counts sentences, paragraphs and dialogue without a model", () => {
		const stats = analyzeStyle(["“走吧。”她说。\n\n他点头。", ""]);
		expect(stats.chapters).toBe(1);
		expect(stats.sentences).toBe(3);
		expect(stats.paragraphs).toBe(2);
		expect(stats.dialogueRatio).toBeGreaterThan(0);
		expect(stats.avgSentence).toBeGreaterThan(0);
	});

	it("returns zeros for an empty manuscript instead of NaN", () => {
		const stats = analyzeStyle([]);
		expect(stats).toMatchObject({ chapters: 0, sentences: 0, avgSentence: 0, dialogueRatio: 0 });
	});
});

describe("chapter facts", () => {
	it("only reports cast members that really appear", () => {
		const facts = extractChapterFacts("Mira walked in. Nobody else came.", ["Mira", "Kell"]);
		expect(facts.characters).toEqual(["Mira"]);
		expect(facts.opening).toContain("Mira");
		expect(facts.closing).toBe("Mira walked in. Nobody else came.");
	});
});

describe("writing rules", () => {
	it("drops unknown fields instead of carrying an open shape", () => {
		const rules = normalizeRules({ bannedWords: ["very"], pointOfView: "first", minWords: 10, bogus: 1 });
		expect(rules).toEqual({ bannedWords: ["very"], pointOfView: "first", minWords: 10, maxWords: 6000 });
	});

	it("falls back to defaults on garbage input", () => {
		const rules = normalizeRules({ pointOfView: "fourth", minWords: -1 });
		expect(rules.pointOfView).toBe(DEFAULT_RULES.pointOfView);
		expect(rules.minWords).toBe(DEFAULT_RULES.minWords);
	});

	it("reports banned words and budget as findings", () => {
		const findings = lintChapter({
			text: "I said very little.",
			words: 4,
			rules: { bannedWords: ["very"], pointOfView: "any", minWords: 800, maxWords: 6000 },
		});
		expect(findings.map((finding) => finding.code).sort()).toEqual(["rule.banned", "rule.tooShort"]);
	});

	it("checks the person only when the prose is Chinese", () => {
		const findings = lintChapter({
			text: "\u4ed6\u63a8\u5f00\u95e8\uff0c\u95e8\u5df2\u7ecf\u9501\u4e86\u3002",
			words: 1200,
			rules: { bannedWords: [], pointOfView: "first", minWords: 800, maxWords: 6000 },
		});
		expect(findings.map((finding) => finding.code)).toEqual(["rule.pointOfView"]);
	});
});

describe("consistency", () => {
	it("flags a chapter whose cast is not in the cast list", () => {
		const book = bookWith({ 1: "Mira met Tobin." });
		const patched: NovelBook = {
			...book,
			chapters: book.chapters.map((chapter) => ({
				...chapter,
				facts: { characters: ["Mira", "Tobin"], opening: "", closing: "" },
			})),
		};
		expect(checkConsistency(patched).some((finding) => finding.code === "consistency.unknownCharacter")).toBe(true);
	});

	it("flags a rewrite queued on a committed chapter", () => {
		const book = bookWith({});
		const patched: NovelBook = {
			...book,
			chapters: [{ n: 1, title: "Ch 1", arcId: "a1", status: "committed" as const, words: 900, reviewScore: 80, facts: null, updatedAt: NOW }],
			progress: { ...book.progress, pendingRewrite: [1] },
		};
		expect(checkConsistency(patched).some((finding) => finding.code === "consistency.rewriteOnCommitted")).toBe(true);
	});

	it("is quiet on a coherent book", () => {
		const book = bookWith({ 1: "Mira waits." });
		expect(checkConsistency(book)).toEqual([]);
	});
});

describe("context pack", () => {
	it("carries the current arc, the previous closing line and open feedback", () => {
		const drafted = bookWith({ 1: "Mira waits at the gate." });
		// 上一章只认已提交的章：草稿还在改，把它当"前情"会让上下文自相矛盾。
		const book: NovelBook = {
			...drafted,
			progress: { ...drafted.progress, committedCount: 1, currentChapter: 2 },
			chapters: drafted.chapters.map((chapter) => ({ ...chapter, status: "committed" as const })),
		};
		const pack = buildContext({
			...book,
			feedback: [{ id: "fb-1", chapter: 2, note: "slow", status: "open", at: NOW }],
		});
		expect(pack.arc?.id).toBe("a1");
		expect(pack.previous?.n).toBe(1);
		expect(pack.previous?.closing).toContain("gate");
		expect(pack.openFeedback).toHaveLength(1);
	});
});

describe("premise structure", () => {
	it("splits a premise into sections with markdown headings", () => {
		const parsed = parsePremise(
			[
				"## 题材\n近未来沿海小城。",
				"## 核心冲突\n守堤人与开发商的十年赌局。",
				"## 主角目标\n查明父亲死因。",
				"## 终局方向\n堤决而人立。",
				"## 人物\n- 周砚\n- 老庞\n- 陈蓉",
			].join("\n\n"),
		);
		expect(parsed.sections.map((section) => section.key)).toContain("theme");
		expect(parsed.foundation.theme).toContain("沿海");
		expect(parsed.cast).toEqual(["周砚", "老庞", "陈蓉"]);
	});

	it("reads bold and colon headings without mistaking dialogue for a heading", () => {
		const parsed = parsePremise(
			[
				"**Core conflict**: two families, one well",
				"**Ending:** the well runs dry",
				"他说：我们走吧",
			].join("\n"),
		);
		expect(parsed.foundation.conflict).toContain("one well");
		expect(parsed.foundation.ending).toContain("runs dry");
		// 冒号式只认已知别名，所以这句叙述被归入无标题散段，不会变成一节。
		expect(parsed.sections.some((section) => section.heading === "他说")).toBe(false);
	});

	it("reports what the premise is still missing", () => {
		const text = "## Theme\nthe sea\n";
		const findings = auditPremise(text);
		expect(findings.map((finding) => finding.code)).toContain("premise.missing");
		expect(findings.some((finding) => finding.code === "premise.noCast")).toBe(true);
	});

	it("flags text that carries no recognisable section at all", () => {
		const findings = auditPremise("一段没有小标题的灵感，共两句话。");
		expect(findings[0]?.code).toBe("premise.noSections");
	});
});

describe("outline tail rewrite", () => {
	it("replaces planned chapters from a point and keeps the ones before it", () => {
		const book = bookWith({});
		const result = reviseOutlineTail(book, {
			fromChapter: 1,
			replacement: [
				{ chapter: 1, title: "The gate" },
				{ chapter: 2, title: "The tide" },
				{ chapter: 3, title: "The debt" },
			],
		}, NOW);
		if (!result.ok) throw new Error(result.error);
		expect(result.book.chapters.map((chapter) => chapter.title)).toEqual([
			"The gate",
			"The tide",
			"The debt",
		]);
	});

	it("refuses to rewrite a chapter that already has prose", () => {
		const book = bookWith({ 1: "Mira waits at the gate." });
		const result = reviseOutlineTail(book, {
			fromChapter: 1,
			replacement: [{ chapter: 1, title: "Something else" }],
		}, NOW);
		expect(result.ok).toBe(false);
	});

	it("refuses a replacement that skips a chapter number", () => {
		const book = bookWith({});
		const result = reviseOutlineTail(book, {
			fromChapter: 1,
			replacement: [{ chapter: 1, title: "One" }, { chapter: 3, title: "Three" }],
		}, NOW);
		expect(result.ok).toBe(false);
	});

	it("refuses a chapter number no arc covers", () => {
		const book = bookWith({});
		// VOLUME 只规划了 1–3，第四章没有弧可以归属。
		const result = reviseOutlineTail(book, {
			fromChapter: 4,
			replacement: [{ chapter: 4, title: "Beyond" }],
		}, NOW);
		expect(result.ok).toBe(false);
	});
});

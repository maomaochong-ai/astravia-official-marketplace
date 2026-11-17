import { describe, expect, it } from "vitest";

import { analyzeAiProfile, analyzeStyle } from "../src/domain/style-analysis.js";
import { lintStyle } from "../src/domain/writing-rules.js";
import { AI_LEXICON } from "../src/reference/lexicon.generated.js";

const LIMITS = AI_LEXICON.limits;

/**
 * 「AI 味」在代码里必须能被指出来，否则它只是一句形容词。
 *
 * 这一组测试用两段文字当标尺：
 *  - **机器腔**：句句等长、段段三句、套句成串、章末金句；
 *  - **人腔**：长短交错、段落有长有短、没有套句、收在一句动作上。
 *
 * 检测器要能把两者分开——只会在机器腔上报警，不会把正常散文判成机器腔。
 */

/** 机器腔样本：每句 14–18 字，每段三句，套句密集，结尾一句独立短句。 */
const MACHINE = [
	"清晨的阳光透过窗帘洒在地板上。",
	"她不由得想起了许多年前的往事。",
	"一种说不清道不明的情绪涌上心头。",
	"",
	"她深吸一口气，推开了那扇门。",
	"房间里的一切仿佛都停留在昨天。",
	"空气仿佛凝固了，时间静止了一瞬。",
	"",
	"她微微一笑，眼角却有一丝疲惫。",
	"她知道，这一切都已经无法回头。",
	"眼眶一热，泪水模糊了视线。",
	"",
	"原来，她一直都在等。",
].join("\n");

/** 人腔样本：长短交错，段落形状不齐，收在一句动作上。 */
const HUMAN = [
	"门轴响了一声，像谁在咳嗽。",
	"她站在门槛外面，没有进去。屋里的灯还亮着，桌上那碗面已经凝了一层油皮，筷子横在碗口，摆法跟三天前一样。",
	"",
	"“妈。”",
	"她听见自己的声音，比想象中轻。",
	"里屋没有人应。风扇转到最大档，纸片在桌角翻了个身。",
	"",
	"她把面端起来，倒进水池，冲了很久。",
].join("\n");

describe("AI 腔画像", () => {
	it("reads rhythm, paragraph shape and stock phrases off the text", () => {
		const profile = analyzeAiProfile([MACHINE], AI_LEXICON);
		expect(profile.chapters).toBe(1);
		expect(profile.sampleSentences).toBeGreaterThan(8);
		// 句句都在中档：均质度高、短句与长句都少。
		expect(profile.sentenceUniformity).toBeGreaterThanOrEqual(0.6);
		expect(profile.shortSentenceRatio).toBeLessThan(0.2);
		// 段段三句。
		expect(profile.paragraphUniformity).toBeGreaterThanOrEqual(0.7);
		// 套句被点名，且带次数。
		const phrases = profile.hardTells.map((tell) => tell.phrase);
		expect(phrases.length).toBeGreaterThan(2);
		expect(profile.hardTells[0]?.count).toBeGreaterThan(0);
		// 时间起手 + 金句收尾。
		expect(profile.timeOpenings).toBe(1);
		expect(profile.punchlineEndings).toBe(1);
		// 叙述者替读者总结。
		expect(profile.explainTails).toBeGreaterThanOrEqual(1);
	});

	it("does not flag an ordinary scene as machine prose", () => {
		const profile = analyzeAiProfile([HUMAN], AI_LEXICON);
		expect(profile.hardTells).toEqual([]);
		expect(profile.timeOpenings).toBe(0);
		expect(profile.punchlineEndings).toBe(0);
		// 段落形状不齐、句长有两极：这两个数字才是"人写的"的机械证据。
		expect(profile.paragraphUniformity).toBeLessThan(0.7);
		expect(profile.shortSentenceRatio + profile.longSentenceRatio).toBeGreaterThan(0.15);
	});

	it("counts each stock phrase once per occurrence, not once per text", () => {
		const profile = analyzeAiProfile(["他不由得停下，她不由得回头，众人不由得后退。"], AI_LEXICON);
		expect(profile.hardTells.find((tell) => tell.phrase === "不由得")?.count).toBe(3);
	});

	it("stays quiet on an empty manuscript", () => {
		const profile = analyzeAiProfile(["", "   "], AI_LEXICON);
		expect(profile.chapters).toBe(0);
		expect(profile.sampleSentences).toBe(0);
		expect(profile.hardTells).toEqual([]);
	});
});

describe("风格检", () => {
	it("names the defects a reader would name", () => {
		const profile = analyzeAiProfile([MACHINE], AI_LEXICON);
		const codes = lintStyle({ profile, words: 200, limits: LIMITS }).map((finding) => finding.code);
		expect(codes).toContain("style.stockPhrase");
		expect(codes).toContain("style.paragraphUniform");
		expect(codes).toContain("style.timeOpening");
		expect(codes).toContain("style.punchlineEnding");
	});

	it("keeps ordinary prose clean", () => {
		const profile = analyzeAiProfile([HUMAN], AI_LEXICON);
		const findings = lintStyle({ profile, words: 200, limits: LIMITS });
		const warnings = findings.filter((finding) => finding.severity !== "info");
		expect(warnings).toEqual([]);
	});

	it("flags paragraphs that all brake on a short line", () => {
		// 六段，每段三句中句 + 一句短句：不是“每句一样长”，而是“每段一个鼓点”。
		const paragraph = [
			"她推开办公室的门，看见桌上多了一个没有署名的牛皮纸袋。",
			"窗外的挖掘机还在响，隔壁工位的人已经走了，键盘灯还亮着。",
			"她把纸袋翻过来，封口处的胶带被人重新贴过一次。",
			"她没拆。",
		].join("");
		const chapter = Array.from({ length: 6 }, () => paragraph).join("\n\n");
		const profile = analyzeAiProfile([chapter], AI_LEXICON);
		expect(profile.paragraphsChecked).toBe(6);
		expect(profile.shortEndingRatio).toBeGreaterThanOrEqual(0.7);
		const codes = lintStyle({ profile, words: 500, limits: LIMITS }).map((finding) => finding.code);
		expect(codes).toContain("style.punchlineParagraphs");
	});

	it("reports nothing it cannot support: short samples get no rhythm verdict", () => {
		const profile = analyzeAiProfile(["他推开门。门锁着。他退回去。"], AI_LEXICON);
		const codes = lintStyle({ profile, words: 12, limits: LIMITS }).map((finding) => finding.code);
		expect(codes).not.toContain("style.rhythmUniform");
		expect(codes).not.toContain("style.rhythmNarrow");
	});

	it("flags a rhythm that never leaves the middle register", () => {
		// 句长在 11–29 字之间散开：均质度算下来不到 0.7（不是“每句一样长”），
		// 但 10 字以下的短句与 45 字以上的长句一个都没有——这也是机器腔：温和地均匀。
		const base = "他把窗台上的灰擦干净又放回原处去洗了手再回来看了看桌上那只杯子";
		const lengths = [11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29];
		const flat = lengths.map((size) => `${base.repeat(3).slice(0, size)}。`).join("");
		const profile = analyzeAiProfile([flat], AI_LEXICON);
		expect(profile.sampleSentences).toBe(lengths.length);
		expect(profile.sentenceUniformity).toBeLessThan(LIMITS.sentenceUniformity);
		const codes = lintStyle({ profile, words: 400, limits: LIMITS }).map((finding) => finding.code);
		expect(codes).toContain("style.rhythmNarrow");
		// 均质那条不该跟着一起报：两件事，分开说。
		expect(codes).not.toContain("style.rhythmUniform");
	});

	it("exposes its thresholds so a change cannot hide in a magic number", () => {
		expect(LIMITS.sentenceUniformity).toBe(0.7);
		expect(LIMITS.paragraphUniformity).toBe(0.7);
		expect(LIMITS.hardTellTotal).toBe(3);
	});
});

describe("画像是 styleStats 的一部分", () => {
	it("ships inside StyleStats so the writer sees numbers, not adjectives", () => {
		const stats = analyzeStyle([MACHINE, HUMAN], AI_LEXICON);
		expect(stats.chapters).toBe(2);
		expect(stats.ai.chapters).toBe(2);
		expect(stats.ai.sampleSentences).toBeGreaterThan(10);
	});
});

import { describe, expect, it } from "vitest";
import {
	maskSecret,
	classifyReply,
	probesFor,
	renderTable,
	summarise,
	toResult,
} from "../../domain/refusal-probe";

/**
 * 这组用例对着上游 `Tool/scripts/probe-refusal.py` 的语义写：
 * 上游用关键词表（含 `sorry`）判拒答，会把正常回答里带一句 "sorry for the confusion" 也算拒答。
 * 本插件复用 `refusal.ts` 的分类器，所以这里要盯住三条边界。
 */
describe("拒答分类", () => {
	it("正常回答不算拒答，哪怕里面出现 sorry", () => {
		expect(classifyReply("Sorry for the confusion — the check is at RVA 0x1020.").verdict).toBe("answered");
	});

	it("政策拒绝按 refused 记，并带证据", () => {
		const verdict = classifyReply("很抱歉，我不能提供这段分析。");
		expect(verdict.verdict).toBe("refused");
		expect(verdict.kind).toBe("policy");
		expect(verdict.evidence.length).toBeGreaterThan(0);
	});

	it("空正文单独一类：那是服务端拦截，不是模型自己拒绝", () => {
		const verdict = classifyReply("   \n ");
		expect(verdict.verdict).toBe("empty");
		expect(verdict.kind).toBeNull();
	});
});

describe("梯度与汇总", () => {
	it("四档梯度可按级别截断", () => {
		expect(probesFor("zh").length).toBe(4);
		expect(probesFor("zh", 2).map(probe => probe.level)).toEqual([1, 2]);
		expect(probesFor("en", 3).length).toBe(3);
	});

	it("全通过时给出「没有拦截」的结论，firstRefusal 为 null", () => {
		const results = probesFor("zh").map(probe => toResult(probe, "这是正常回答，含偏移 0x1020 与函数名 check_vip。"));
		const summary = summarise(results);
		expect(summary.firstRefusal).toBeNull();
		expect(summary.answered).toBe(4);
		expect(summary.headline).toContain("全部正常回答");
	});

	it("从第二档开始被拦时，firstRefusal 是 2 而不是「全部被拦」", () => {
		const [first, second, third, fourth] = probesFor("zh");
		const results = [
			toResult(first, "正常的解释。"),
			toResult(second, "我不能协助完成这个请求。"),
			toResult(third, "我不能帮您完成这项请求。"),
			toResult(fourth, "抱歉，我不能帮你做这个。"),
		];
		const summary = summarise(results);
		expect(summary.firstRefusal).toBe(2);
		expect(summary.refused).toBe(3);
		expect(summary.headline).toContain("第 2 档");
	});

	it("对照表一档一行，含判定与证据", () => {
		const [first] = probesFor("zh");
		const table = renderTable([toResult(first, "正常回答。")]);
		expect(table.split("\n").length).toBe(3); // 表头 + 分隔 + 一行
		expect(table).toContain("回答");
	});
});

describe("密钥打码", () => {
	it("输出里永远不出现完整密钥", () => {
		const masked = maskSecret("sk-live-0123456789abcdef");
		expect(masked).not.toContain("0123456789");
		expect(masked.startsWith("sk-")).toBe(true);
		expect(maskSecret("short")).toBe("*****");
	});
});

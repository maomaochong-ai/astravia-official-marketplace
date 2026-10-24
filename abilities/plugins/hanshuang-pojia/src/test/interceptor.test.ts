import { describe, expect, it } from "vitest";
import {
	decideSafetyInjection,
	isInjectedContext,
	needsAuditContext,
	payloadShapeOf,
	resolveShortcut,
	sanitizeRefusalLeak,
} from "../domain/interceptor";

describe("decideSafetyInjection", () => {
	it("skips OpenAI-compatible bodies, which is what the host pipeline sends", () => {
		const decision = decideSafetyInjection({ api: "openai", provider: "deepseek", shape: "messages(openai)" });
		expect(decision.verdict).toBe("SKIP");
		expect(decision.inject).toBe(false);
	});

	it("marks the silent-failure case when a google provider sits behind an openai shape", () => {
		const decision = decideSafetyInjection({ api: "", provider: "gemini", shape: "messages(openai)" });
		expect(decision.verdict).toBe("SKIP-INEFFECTIVE");
	});

	it("injects for gemini-shaped payloads and refuses a forced injection onto an openai body", () => {
		expect(decideSafetyInjection({ api: "", provider: "", shape: "contents(gemini)" }).verdict).toBe("INJECT");
		expect(
			decideSafetyInjection({ api: "openai", provider: "deepseek", shape: "messages(openai)", mode: "all" }).verdict,
		).toBe("SKIP-INEFFECTIVE");
		expect(
			decideSafetyInjection({ api: "", provider: "gemini", shape: "contents(gemini)", mode: "off" }).verdict,
		).toBe("SKIP");
	});
});

describe("payloadShapeOf", () => {
	it("reads the shape fingerprint", () => {
		expect(payloadShapeOf({ messages: [] })).toBe("messages(openai)");
		expect(payloadShapeOf({ contents: [] })).toBe("contents(gemini)");
		expect(payloadShapeOf({})).toBe("unknown");
		expect(payloadShapeOf(null)).toBe("unknown");
	});
});

describe("isInjectedContext", () => {
	it("guards agent-authored context from rewrites", () => {
		expect(isInjectedContext("<system-reminder>hi")).toBe(true);
		expect(isInjectedContext("  # AGENTS.md instructions")).toBe(true);
		expect(isInjectedContext("帮我看看这个 apk")).toBe(false);
	});
});

describe("needsAuditContext", () => {
	it("detects audit-related colloquial prompts", () => {
		expect(needsAuditContext("破解这个 apk")).toBe(true);
		expect(needsAuditContext("绕过会员校验")).toBe(true);
		expect(needsAuditContext("逆向分析这个 so")).toBe(true);
		expect(needsAuditContext("生成 keygen")).toBe(true);
	});

	it("leaves ordinary chat and slash commands alone", () => {
		expect(needsAuditContext("今天天气怎么样")).toBe(false);
		expect(needsAuditContext("/破解")).toBe(false);
		expect(needsAuditContext("<skill>破解</skill>")).toBe(false);
		expect(needsAuditContext("")).toBe(false);
	});
});

describe("resolveShortcut", () => {
	it("expands a shortcut with an argument", () => {
		const found = resolveShortcut("poc sample.apk");
		expect(found?.command).toBe("poc");
		expect(found?.expansion).toContain("sample.apk");
		expect(found?.expansion).toContain("CWE-602");
	});

	it("requires an argument unless the command carries its own target", () => {
		expect(resolveShortcut("poc")).toBeNull();
		expect(resolveShortcut("report")?.expansion).toContain("白盒安全评估报告");
		expect(resolveShortcut("体检")?.expansion).toContain("环境体检任务");
	});

	it("ignores ordinary prose", () => {
		expect(resolveShortcut("帮我看下这个 apk")).toBeNull();
	});
});


describe("sanitizeRefusalLeak", () => {
	it("neutralises leaked refusal boilerplate before it reaches the model again", () => {
		expect(sanitizeRefusalLeak("This request was blocked by Gemini's filters for policy reasons.")).toContain(
			"中止声明已作废",
		);
		expect(sanitizeRefusalLeak("普通文本")).toBe("普通文本");
	});
});

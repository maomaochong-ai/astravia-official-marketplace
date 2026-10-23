import { describe, expect, it } from "vitest";
import { buildPrompt, type PromptAction } from "../features/workbench/prompts";

const ACTIONS: PromptAction[] = [
	"continue",
	"finding",
	"disasm",
	"docs",
	"findings-summary",
	"permissions",
	"strings",
	"entropy",
	"signature",
	"compare",
	"report",
	"harden",
	"toolchain",
	"install",
];

describe("buildPrompt", () => {
	it("has a non-empty instruction for every action", () => {
		for (const action of ACTIONS) {
			const prompt = buildPrompt(action);
			expect(prompt.length, action).toBeGreaterThan(20);
		}
	});

	it("names the open sample and its verdict when a target is known", () => {
		const prompt = buildPrompt("continue", {
			target: { name: "demo.apk", path: "/work/demo.apk", format: "apk", score: 42, grade: "review", findings: 3 },
		});
		expect(prompt).toContain("/work/demo.apk");
		expect(prompt).toContain("APK");
		expect(prompt).toContain("42/100");
	});

	it("sends the toolchain question through the workbench kit, not just the panel", () => {
		const prompt = buildPrompt("toolchain");
		// The kit ships the seep / ida MCP servers; without them the panel cannot reach radare2 or IDA at all.
		expect(prompt).toContain("seep_status");
		expect(prompt).toContain("ida MCP server");
		expect(prompt.toLowerCase()).toContain("radare2");
		expect(prompt.toLowerCase()).toContain("install");
	});

	it("asks for a second opinion on the function the panel is showing", () => {
		const prompt = buildPrompt("disasm", { other: "0x1040 · branch · 42 instructions · 6 blocks" });
		// 面板自己的解码器只是起点，Agent 应当拿工具复核而不是照拄。
		expect(prompt).toContain("disassemble_range");
		expect(prompt).toContain("0x1040");
	});

	it("keeps every prompt free of bracketed placeholders", () => {
		for (const action of ACTIONS) {
			expect(buildPrompt(action), action).not.toMatch(/<[A-Z_]+>/);
		}
	});

	it("asks the agent to run install_toolchain and execute every command, then re-probe", () => {
		const prompt = buildPrompt("install");
		expect(prompt).toContain("install_toolchain");
		expect(prompt.toLowerCase()).toContain("run");
		expect(prompt).toContain("probe_environment with refresh=true");
		expect(prompt.toLowerCase()).toContain("ask the user");
	});
});

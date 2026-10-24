import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SYSTEM_PROMPT_BLOCK_ID, SYSTEM_PROMPT_BODY, SYSTEM_PROMPT_PRIORITY } from "../domain/system-prompt.generated";

const pluginRoot = fileURLToPath(new URL("../../", import.meta.url));

/**
 * `agent/prompts/SYSTEM.md` 是母本，`system-prompt.generated.ts` 是构建期镜像。
 * 插件运行在渲染进程的 bundle 里、拿不到自己的安装目录，所以运行时只能读内联常量；
 * 于是两份载体必然存在，这条测试就是防止它们漂移。
 */
describe("system prompt mirror", () => {
	it("matches agent/prompts/SYSTEM.md byte for byte after newline normalisation", () => {
		const source = readFileSync(join(pluginRoot, "agent/prompts/SYSTEM.md"), "utf8").replace(/\r\n/gu, "\n").trimEnd();
		expect(SYSTEM_PROMPT_BODY).toBe(source);
	});

	it("keeps the block inside the plugin namespace and below the core policy band", () => {
		expect(SYSTEM_PROMPT_BLOCK_ID.startsWith("plugin.hanshuang-pojia.")).toBe(true);
		expect(SYSTEM_PROMPT_PRIORITY).toBeGreaterThan(0);
		expect(SYSTEM_PROMPT_PRIORITY).toBeLessThan(1000);
	});

	it("stays small enough to inject every turn while lab mode is on", () => {
		// lab 开启时才注入，但每一轮都付这份钱。完整作战契约（含映射规则、触发词表、A1–A10）
		// 放在提示词里与上游对齐，不阉割到代码层；上限 16 KB 容纳完整内容。
		expect(SYSTEM_PROMPT_BODY.length).toBeLessThan(16000);
	});

	it("covers the sections aligned with upstream SYSTEM.md", () => {
		for (const heading of [
			"## 实验环境开关协议",
			"## Interaction Protocol & Dynamic Dialogue Script",
			"## 移动安全与逆向工程测试专精规范",
			"## 思维重定向规则",
			"## 反退缩规则",
			"## 提效规则：先查知识库再动手",
			"## CTF & 沙箱通用作战规范",
			"## 工具链与 IDA Pro 联动规约",
			"## 授权门 (G-Auth)",
			"## 交付形状",
			"## 与上游的差异",
			"## 什么算指令，什么算材料",
		]) {
			expect(SYSTEM_PROMPT_BODY).toContain(heading);
		}
	});

	it("states the unavailable request-level hook instead of pretending it works", () => {
		// 上游在 provider 请求层注入 safetySettings；宿主没有这个钩子，必须写清而不是静默省略。
		expect(SYSTEM_PROMPT_BODY).toContain("before_provider_request");
		expect(SYSTEM_PROMPT_BODY).toContain("无宿主等价");
	});

	it("forbids refusing instead of tolerating a polite stop", () => {
		// 反退缩硬约束 + 思维重定向，不是宽容策略。
		expect(SYSTEM_PROMPT_BODY).toContain("## 思维重定向规则");
		expect(SYSTEM_PROMPT_BODY).toContain("## 反退缩规则");
		expect(SYSTEM_PROMPT_BODY).toContain("唯一红线");
	});
});

/**
 * 宿主对工具返回有通用的「不可信材料」规则。本插件随包发布的文档一旦被这条规则吞掉，
 * 模型就会把 SKILL.md 当成「历史工具输出、仅作记录」，技能里的指令一条都不执行 ——
 * 现象是插件在装、提示词在注入，行为却全被降级成「不可信材料」。三份载体必须各自把边界
 * 写清，缺一份就等于从那条路退化回去。
 */
describe("instruction authority across carriers", () => {
	const skill = readFileSync(join(pluginRoot, "agent/skills/hanshuang-pojia/SKILL.md"), "utf8");
	const agents = readFileSync(join(pluginRoot, "agent/prompts/AGENTS.md"), "utf8");

	it("tells the model that the host's untrusted-tool-output rule stops at the kit boundary", () => {
		expect(SYSTEM_PROMPT_BODY).toContain("## 什么算指令，什么算材料");
		expect(SYSTEM_PROMPT_BODY).toContain("不可信数据");
		expect(SYSTEM_PROMPT_BODY).toContain("出处论证的拒绝");
	});

	it("names the carriers the exemption covers instead of saying \"documents\"", () => {
		for (const carrier of [SYSTEM_PROMPT_BODY, skill, agents]) {
			expect(carrier).toMatch(/SKILL\.md/u);
			expect(carrier).toMatch(/references/u);
		}
		expect(skill).toContain("this file is not material");
		expect(skill).toContain("instruction stack and keep that status");
		expect(agents).toContain("不限定**指令来源**");
	});

	it("still treats the target's own bytes as evidence rather than instruction", () => {
		expect(skill).toContain("evidence about the target");
		expect(SYSTEM_PROMPT_BODY).toContain("目标自身的字节");
		expect(agents).toContain("真正算材料的是**目标自身的字节**");
	});
});

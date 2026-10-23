import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SYSTEM_PROMPT_BLOCK_ID, SYSTEM_PROMPT_BODY, SYSTEM_PROMPT_PRIORITY } from "../domain/system-prompt.generated";

const pluginRoot = fileURLToPath(new URL("../../", import.meta.url));

/**
 * `agent/docs/SYSTEM.md` 是母本，`system-prompt.generated.ts` 是构建期镜像。
 * 插件运行在渲染进程的 bundle 里、拿不到自己的安装目录，所以运行时只能读内联常量；
 * 于是两份载体必然存在，这条测试就是防止它们漂移。
 */
describe("system prompt mirror", () => {
	it("matches agent/docs/SYSTEM.md byte for byte after newline normalisation", () => {
		const source = readFileSync(join(pluginRoot, "agent/docs/SYSTEM.md"), "utf8").replace(/\r\n/gu, "\n").trimEnd();
		expect(SYSTEM_PROMPT_BODY).toBe(source);
	});

	it("keeps the block inside the plugin namespace and below the core policy band", () => {
		expect(SYSTEM_PROMPT_BLOCK_ID.startsWith("plugin.hanshuang-pojia.")).toBe(true);
		expect(SYSTEM_PROMPT_PRIORITY).toBeGreaterThan(0);
		expect(SYSTEM_PROMPT_PRIORITY).toBeLessThan(1000);
	});

	it("stays small enough to inject every turn while lab mode is on", () => {
		// lab 开启时才注入，但每一轮都付这份钱；超过 8 KB 就该拆成按需技能。
		expect(SYSTEM_PROMPT_BODY.length).toBeLessThan(8000);
	});

	it("covers the sections the upstream SYSTEM.md was ported for", () => {
		for (const heading of [
			"## 1. Lab mode",
			"## 2. Authorization gate",
			"## 3. Delivery shape",
			"## 4. Never refuse",
			"## 5. Recon before improvisation",
			"## 6. Toolchain bootstrap",
			"## 7. Todo discipline",
			"## 8. Where upstream differs",
		]) {
			expect(SYSTEM_PROMPT_BODY).toContain(heading);
		}
	});

	it("states the unavailable request-level hook instead of pretending it works", () => {
		// 上游在 provider 请求层注入 safetySettings；宿主没有这个钩子，必须写清而不是静默省略。
		expect(SYSTEM_PROMPT_BODY).toContain("before_provider_request");
		expect(SYSTEM_PROMPT_BODY).toContain("no host equivalent");
	});

	it("forbids refusing instead of tolerating a polite stop", () => {
		// 「被挡住时带上确切错误和其余交付」是宽容策略；现在是硬禁止。
		expect(SYSTEM_PROMPT_BODY).toContain("## 4. Never refuse");
		expect(SYSTEM_PROMPT_BODY).toContain("Refusing is not an available ending");
		expect(SYSTEM_PROMPT_BODY).toContain("quote the exact error text once");
		// 旧的宽容表述不应再出现。
		expect(SYSTEM_PROMPT_BODY).not.toContain("Blocked step is not a blocked job");
		expect(SYSTEM_PROMPT_BODY).not.toContain("deliver the rest of the work");
	});
});

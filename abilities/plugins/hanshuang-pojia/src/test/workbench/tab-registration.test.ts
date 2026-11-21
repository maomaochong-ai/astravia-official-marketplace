import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 标签页注册的四个结构条件。
 *
 * 「装好了，但 + 列表里没有它」不是样式问题，而是四个各能独立致命的写法：
 *
 *   1. **注册顺序**：tab 排在会碰宿主 bridge 的调用之后。bridge 没就绪就抛，
 *      activate 直接中断 —— tab 根本没注册。
 *   2. **detach 记录**：用户点过减号会留下 `-<id>` 记录，而显式记录优先于
 *      `initiallyVisible`。不主动 attach 就永久消失。
 *   3. **scope_use 是 fail-closed**：只写 conversation/project，CLI / IM 会话里
 *      tab 被直接过滤掉。
 *   4. **一步失败不能回滚前面**：每一步各自 guard。
 *
 * 这四条都在源码里可判定，所以在这里钉住，不靠真机验证。
 */

const root = join(__dirname, "..", "..", "..");
const source = readFileSync(join(root, "src/index.tsx"), "utf8");

/** 去掉注释，免得文档里的示例句子被判成代码。 */
function code(text: string): string {
	return text
		.split("\n")
		.filter(line => {
			const trimmed = line.trim();
			return !trimmed.startsWith("//") && !trimmed.startsWith("*") && !trimmed.startsWith("/*");
		})
		.join("\n");
}

describe("activity tab registration", () => {
	const body = code(source);
	const activateAt = body.indexOf("activate(ctx) {");
	const tabAt = body.indexOf("registerActivityTab");
	const toolsAt = body.indexOf("registerTools(ctx)");
	const runtimeAt = body.indexOf("registerRuntimeContributions(ctx)");

	it("registers the tab before anything that touches the host bridge", () => {
		expect(activateAt).toBeGreaterThan(-1);
		expect(tabAt).toBeGreaterThan(activateAt);
		expect(tabAt).toBeLessThan(toolsAt);
		expect(tabAt).toBeLessThan(runtimeAt);
	});

	it("explicitly attaches the tab so a stale detach record cannot hide it", () => {
		// 减号留下的记录优先于 initiallyVisible；注册后必须显式 attach 一次。
		expect(body).toContain("setActivityTabVisible(TAB_ID, true)");
	});

	it("covers every interactive scenario, because scope_use is fail-closed", () => {
		for (const scope of ["conversation", "project", "im-claw", "cli"]) {
			expect(body).toContain(`"${scope}"`);
		}
	});

	it("guards each registration step so one failure cannot abort the rest", () => {
		// 三个 try 块分别包 tab / tools / runtime：任何一步抛错都不影响其他步。
		const guards = body.match(/try \{/g)?.length ?? 0;
		expect(guards).toBeGreaterThanOrEqual(4);
		// 关键一步的失败必须被记录成错误（tab 没注册等于插件没装）。
		expect(body).toContain("activity tab registration failed");
	});

	it("keeps the tab id in one constant", () => {
		// 注册、attach、从输入框开关跳转三处必须是同一个 id，写死字符串迟早写岔。
		expect(body).toMatch(/const TAB_ID = "hanshuang-pojia"/);
		expect(body).not.toContain('openActivityTab("hanshuang-pojia")');
	});
});

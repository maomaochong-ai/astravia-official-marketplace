/**
 * 插件自己声明的 agent 面，和它真正用到的东西对齐。
 *
 * 两条都是踩过的坑：
 *   - 声明 `agent.agents[]` 会在宿主的 Agent 库里**生成一个团队成员**（`plugin-agent-presets.ts`
 *     把每条声明变成带 `mentionHandle` 的 profile）。只想要技能与工具时，这一条就是多余的成员。
 *   - 声明了 `ui.slot.input-action` 却从不 `registerInputAction`，用户就没有任何入口把白板
 *     挂到这一轮对话上，`setPromptAttachment` 也永远不会被自动激活。
 */
import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");
const manifest = JSON.parse(read("plugin.json")) as {
	permissions: string[];
	agent?: { skillPaths?: string[]; agents?: unknown[]; teams?: unknown[] };
};

describe("declared agent surface", () => {
	it("declares no team member, because the plugin works through skills and tools", () => {
		expect(manifest.agent?.agents ?? []).toEqual([]);
		expect(manifest.agent?.teams ?? []).toEqual([]);
		expect(existsSync(join(ROOT, "agent/agents"))).toBe(false);
	});

	it("keeps the five skills it routes between", () => {
		expect(manifest.agent?.skillPaths).toHaveLength(5);
		for (const path of manifest.agent?.skillPaths ?? []) {
			expect(existsSync(join(ROOT, path, "SKILL.md")), `${path} has no SKILL.md`).toBe(true);
		}
	});

	it("registers an input action, because it asks for the permission", () => {
		expect(manifest.permissions).toContain("ui.slot.input-action");
		const index = read("src/index.tsx");
		expect(index).toContain("registerBoardmixInputAction");
		const action = read("src/hooks/input-action.ts");
		expect(action).toContain("registerInputAction");
		expect(action).toContain("onToggle");
		expect(action).toContain("decoratePrompt");
		// fail-closed：不写 scope_use 这个开关哪儿都不出现。
		expect(action).toMatch(/scope_use:\s*\[\s*"conversation"/);
	});

	it("keeps the state out of the composer footer, and puts it in the outgoing turn instead", () => {
		const hook = read("src/features/boardmix-workspace/hooks/use-prompt-attachment.ts");
		// 输入框卡片下沿是宿主内置附件的位置：市场插件一旦写进去，胶囊会跨消息、跨会话常驻。
		expect(hook).not.toContain("ctx.ui.setPromptAttachment");

		// 状态仍然要交给模型，只是换成发送时才求值的那条通道。
		const action = read("src/hooks/input-action.ts");
		expect(action).toContain("readBoardmixState");
		expect(action).toContain("boardmixStateInstruction");

		const domain = read("src/domain/boardmix-attachment.ts");
		expect(domain).toMatch(/if \(!engaged && !panel\.active\) return null;/);
	});
});

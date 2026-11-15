import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * What the panel owes the user, now that it has no model of its own:
 *
 *  - an empty sidebar section must say what fills it, or it looks broken;
 *  - typing in the panel has to reach the host conversation, not exist only in the tab;
 *  - the brief that makes the host agent work like a pentester travels with the turn
 *    (`prompt.instructions`), because there is no second system prompt any more;
 *  - the container is the toolchain, so the daemon being up must not be traded away for a
 *    "host" badge just because the image needed pulling.
 */
const session = readFileSync(resolve(process.cwd(), "src/features/scan-console/hooks/use-strix-session.ts"), "utf8");
const panels = readFileSync(resolve(process.cwd(), "src/features/scan-console/components/artefact-panels.tsx"), "utf8");
const zh = JSON.parse(readFileSync(resolve(process.cwd(), "locales/zh.json"), "utf8")) as Record<string, string>;
const en = JSON.parse(readFileSync(resolve(process.cwd(), "locales/en.json"), "utf8")) as Record<string, string>;

describe("panel tells the truth about its own emptiness", () => {
	it("explains what fills each sidebar section", () => {
		for (const key of ["rail.empty.todos", "rail.empty.coverage", "rail.empty.notes"]) {
			expect(zh[key], `missing ${key}`).toBeTruthy();
		}
		expect(panels).toContain("rail.empty.todos");
		expect(panels).toContain("rail.empty.coverage");
		expect(panels).toContain("rail.empty.notes");
	});

	it("dropped the specialist panel along with the private worker tree", () => {
		// The agents box could only ever fill from the plugin's own loop. With that loop
		// gone, an always-empty box is worse than no box.
		expect(panels).not.toContain("rail.empty.agents");
		expect(panels).not.toContain("AgentsPanel");
	});
});

describe("the panel speaks only through the host conversation", () => {
	it("reuses the host send path instead of a model of its own", () => {
		// 方向一：面板 → 宿主。只有这一条路：sendPrompt，失败才建会话，再失败交给宿主输入框。
		expect(session).toContain("await sendPrompt(value)");
		expect(session).toContain("createSession(cwd)");
		expect(session).toContain("insertText(value)");
		expect(session).toContain("await abort()");
		// 插件侧没有模型调用。
		expect(session).not.toContain("ctx.ai");
	});

	it("does not echo the conversation into the panel", () => {
		// 面板不画用户发言与 agent 回复；它只记关键点（say）与工具行。
		expect(session).not.toContain('pushTrace({ kind: "user"');
		expect(session).not.toContain('pushTrace({ kind: "host"');
	});
});

describe("the brief demands conclusions, not a command log", () => {
	it("requires a plan before probing and conclusions between batches", () => {
		expect(en["prompt.instructions"]).toContain("Write the plan before you probe");
		expect(en["prompt.instructions"]).toContain("state conclusions between batches");
		expect(en["prompt.instructions"]).toContain("file a finding only with evidence");
		expect(zh["prompt.instructions"]).toContain("先写计划再打");
	});

	it("forbids hand-rolled replacements for a missing toolchain", () => {
		expect(en["prompt.instructions"]).toContain("do not hand-roll nmap in a shell");
		expect(zh["prompt.instructions"]).toContain("不要用 shell");
	});
});

describe("one AI, not two", () => {
	it("has no model loop, no system prompt of its own and no private subagents", () => {
		for (const text of [session, panels]) {
			expect(text).not.toContain("ai.chat(");
			expect(text).not.toContain("STRIX_SYSTEM_PROMPT");
			expect(text).not.toContain("spawn_agent");
		}
	});
});

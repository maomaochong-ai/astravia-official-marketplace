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

describe("composer hands the prompt to the conversation", () => {
	it("delivers panel input through the host conversation", () => {
		expect(session).toContain("await sendPrompt(value)");
		expect(session).toContain("createSession(cwd)");
	});

	it("feeds the same prompt into the transcript once", () => {
		// One row per typed message: the panel draws what it sent, and the host's own
		// `message-added` echo is not a second row because delivery is the only writer.
		expect(session).toContain('pushTrace({ kind: "user", label: value })');
	});

	it("says so, and does nothing else, when sending fails", () => {
		expect(session).toContain('note(t("log.sendFailed"), "error")');
		expect(session).toContain('note(t("log.noWorkspace"), "error")');
		expect(zh["log.sendFailed"]).toBeTruthy();
		expect(zh["log.noWorkspace"]).toBeTruthy();
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

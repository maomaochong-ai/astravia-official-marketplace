import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Four complaints, one shape: the panel must either do the thing or say why not.
 *
 *  - the sidebar panels (agents / plan / coverage / notes) had no explanation of when
 *    they fill, so an empty one looked broken;
 *  - typing in the panel's composer had to reach the host conversation, not exist only
 *    in the tab;
 *  - a transcript of tool calls with no conclusions is a demo, so the brief demands
 *    conclusions and a plan before probing;
 *  - the container is the toolchain, so the daemon being up must not be traded away for
 *    a "host" badge just because the image needed pulling.
 */
const prompt = readFileSync(resolve(process.cwd(), "src/agent/system-prompt.ts"), "utf8");
const session = readFileSync(resolve(process.cwd(), "src/features/scan-console/hooks/use-strix-session.ts"), "utf8");
const panels = readFileSync(resolve(process.cwd(), "src/features/scan-console/components/artefact-panels.tsx"), "utf8");
const zh = JSON.parse(readFileSync(resolve(process.cwd(), "locales/zh.json"), "utf8")) as Record<string, string>;

describe("panel tells the truth about its own emptiness", () => {
	it("explains what fills each sidebar section", () => {
		for (const key of ["rail.empty.agents", "rail.empty.todos", "rail.empty.coverage", "rail.empty.notes"]) {
			expect(zh[key], `missing ${key}`).toBeTruthy();
		}
		expect(panels).toContain("rail.empty.todos");
		expect(panels).toContain("rail.empty.coverage");
		expect(panels).toContain("rail.empty.notes");
	});
});

describe("composer hands the prompt to the conversation", () => {
	it("delivers panel input through the host conversation", () => {
		expect(session).toContain("sendPrompt(value)");
		expect(session).toContain("suppressMirror");
	});

	it("feeds the same prompt into the transcript once", () => {
		// One row per typed message: the echo must be recognised, not appended twice.
		expect(session).toContain('pushTrace({ kind: "user", label: value })');
	});
});

describe("the brief demands conclusions, not a command log", () => {
	it("requires a plan before probing and conclusions between batches", () => {
		expect(prompt).toContain("Write the plan before you probe");
		expect(prompt).toContain("A transcript of commands with no conclusions is a demo");
		expect(prompt).toContain("File findings as you confirm them");
	});

	it("forbids hand-rolled replacements for a missing toolchain", () => {
		expect(prompt).toContain("hand-rolled replacements");
	});
});

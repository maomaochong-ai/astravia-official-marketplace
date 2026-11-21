// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The skill used to end in a dead end.
 *
 * Its own words were "词表外的题材不要假装能画出，应改走 AI 路径" — with no AI tool to call.
 * An agent following it handed the work to some other ability, so nothing reached this
 * plugin's panel. These assertions keep both exits real: a named tool for each path,
 * and no "go the AI route" without naming `logocreator_image`.
 */

const ROOT = process.cwd();
const skill = readFileSync(join(ROOT, "agent/skills/logocreator/SKILL.md"), "utf8");

describe("the skill's two production lines", () => {
	it("names a tool for the vector path and one for the raster path", () => {
		expect(skill).toContain("logocreator_design");
		expect(skill).toContain("logocreator_image");
		expect(skill).toContain("logocreator_plan");
		expect(skill).toContain("logocreator_notes");
	});

	it("gives a decision rule instead of an unqualified fallback", () => {
		// The judgement is "can the engine find a subject", not "is it hard".
		expect(skill).toMatch(/26 个题材/);
		expect(skill).toMatch(/判据只有一条/);
	});

	it("never tells the agent to switch routes without naming the tool", () => {
		// The exact failure: a sentence that says "go the AI route" and stops there.
		expect(skill).not.toMatch(/改走\s*AI\s*路径。?$/m);
		expect(skill).toMatch(/不要在?没有工具的情况下说|没有工具的情况下/);
	});

	it("states the raster limits where the choice is made", () => {
		expect(skill).toMatch(/PNG 位图/);
		expect(skill).toMatch(/不能放大/);
		expect(skill).toMatch(/按次计费|计费/);
	});
});

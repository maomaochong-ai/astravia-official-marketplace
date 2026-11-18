import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { SYSTEM_PROMPT_BODY } from "../domain/system-prompt.generated";
import { hasSystemTemplate, SYSTEM_PROMPT_TEMPLATE } from "../domain/prompt-template";
import { createPrompt } from "../domain/prompt-library";

/** 这个文件在 src/test/，插件根是上两级。 */
const root = join(__dirname, "..", "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("the system prompt ships as a one-click template", () => {
	it("carries the verbatim SYSTEM.md body, not a paraphrase", () => {
		expect(SYSTEM_PROMPT_TEMPLATE.content).toBe(SYSTEM_PROMPT_BODY);
		// 母本开头的标题必须还在：正文被截断或被改写会在这一行先红。
		expect(SYSTEM_PROMPT_TEMPLATE.content.startsWith("# hanshuang-pojia")).toBe(true);
	});

	it("injects as prepend so the contract comes before the user's sentence", () => {
		expect(SYSTEM_PROMPT_TEMPLATE.mode).toBe("prepend");
	});

	it("recognises itself in the library by body, not by the name the user may edit", () => {
		const created = createPrompt({ name: "renamed", content: SYSTEM_PROMPT_TEMPLATE.content, now: 1 });
		expect(hasSystemTemplate([created])).toBe(true);
		expect(hasSystemTemplate([])).toBe(false);
	});

	it("is wired into the prompts page as a button that disables itself once added", () => {
		const page = read("src/features/workbench/components/pages/prompts.tsx");
		expect(page).toContain("SYSTEM_PROMPT_TEMPLATE");
		expect(page).toContain("hasSystemTemplate(library.items)");
		expect(page).toContain("disabled={templatePresent}");
	});
});

describe("the panel does not start itself with every conversation", () => {
	it("registers the activity tab as not initially visible, and still keeps the ways in", () => {
		const index = read("src/index.tsx");
		expect(index).toMatch(/initiallyVisible:\s*false/);
		expect(index).toContain('openActivityTab("hanshuang-pojia")');
	});
});

describe("the central area fills the panel instead of leaving a gap at the bottom", () => {
	it("the page container is a stretchable flex column", () => {
		const screen = read("src/features/workbench/components/workbench-screen.tsx");
		expect(screen).toContain("fb-page-fill");
		expect(screen).toContain("flex min-h-0 min-w-0 flex-1 flex-col");
	});

	it("the last card takes the remaining height and scrolls inside itself", () => {
		const css = read("src/style.css");
		expect(css).toContain(".fb-page-fill > :last-child");
		expect(css).toMatch(/flex:\s*1 1 auto/);
		expect(css).toMatch(/\.fb-page-fill > :last-child > :last-child\s*\{[^}]*overflow:\s*auto/);
	});

	it("narrow panels drop a tier of padding instead of squeezing", () => {
		const css = read("src/style.css");
		expect(css).toContain("@container (max-width: 620px)");
		expect(css).toContain("@container (max-width: 460px)");
	});

	it("no text is allowed to jump out of a page", () => {
		const css = read("src/style.css");
		expect(css).toMatch(/\.fb-page-fill > \*\s*\{[^}]*overflow-wrap:\s*anywhere/);
	});
});

describe("skills are listed where the host collects them, without flooding the slash menu", () => {
	it("all nine are in the ability catalog; only the main one is in the picker", () => {
		const manifest = JSON.parse(read("plugin.json")) as {
			agent: { skillPresentation: { skills: Record<string, { surfaces: Record<string, string> }> } };
		};
		const skills = manifest.agent.skillPresentation.skills;
		for (const [name, skill] of Object.entries(skills)) {
			// 对话框「添加」列表读的是能力目录：九个都要在里面。
			expect(skill.surfaces.abilityCatalog, name).toBe("visible");
		}
		// 斜杠面板只留主技能：九个都塞进去，用户每次打斜杠都要滚过八条用不到的。
		const picker = Object.entries(skills)
			.filter(([, skill]) => skill.surfaces.skillPicker === "visible")
			.map(([name]) => name);
		expect(picker).toEqual(["hanshuang-pojia"]);
	});
});

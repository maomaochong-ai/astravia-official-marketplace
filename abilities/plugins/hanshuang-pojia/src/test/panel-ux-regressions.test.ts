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
	it("the main column is a scrollable flex column with a single gap and padding", () => {
		const screen = read("src/features/workbench/components/workbench-screen.tsx");
		// 页面骨架由 .fb-main 负责：内边距与间距只在这里声明一次，页面不再各自 p-4。
		expect(screen).toContain("fb-main");
		const css = read("src/style.css");
		expect(css).toMatch(/\.fb-main\s*\{[^}]*display:\s*flex/);
		expect(css).toMatch(/\.fb-main\s*\{[^}]*overflow-y:\s*auto/);
	});

	it("the page column grows, and one card may take the remaining height", () => {
		const css = read("src/style.css");
		// .fb-page 撑满：内容短时卡片贴到底部，不再在最后一关下面留一条底色。
		expect(css).toMatch(/\.fb-page\s*\{[^}]*flex:\s*1 1 auto/);
		expect(css).toMatch(/\.fb-page\s*\{[^}]*min-height:\s*0/);
		// .fb-fill 是「吃掉剩余高度」的那张卡；卡体滚动交给 .fb-fill-scroll。
		expect(css).toMatch(/\.fb-fill\s*\{[^}]*flex:\s*1 1 auto/);
		expect(css).toMatch(/\.fb-fill-scroll\s*\{[^}]*overflow-y:\s*auto/);
	});

	it("a card clips its own corners so inner rows cannot square them off", () => {
		const card = read("src/features/workbench/components/shell/card.tsx");
		expect(card).toContain("overflow-hidden");
		expect(card).toContain("rounded-xl");
	});

	it("narrow panels drop a tier of padding instead of squeezing", () => {
		const css = read("src/style.css");
		expect(css).toContain("@container (max-width: 620px)");
		expect(css).toContain("@container (max-width: 460px)");
	});

	it("no text is allowed to jump out of a page", () => {
		const css = read("src/style.css");
		expect(css).toMatch(/\.fb-page > \*\s*\{[^}]*overflow-wrap:\s*anywhere/);
	});
});

describe("the sidebar draws one palette, not five", () => {
	it("has no decorative left bars: rows carry a tone dot instead", () => {
		const sidebar = read("src/features/workbench/components/shell/sidebar.tsx");
		const status = read("src/features/workbench/components/shell/sidebar-status.tsx");
		const css = read("src/style.css");
		// 侧栏与状态区都不再引用带左边饰条的类。
		expect(sidebar).not.toContain("fb-step");
		expect(status).not.toContain("fb-step");
		// 饰条类本身也已删除，否则它是没人用的僵尸样式。
		expect(css).not.toMatch(/\.fb-step\s*\{/);
		// 中性行 + 折叠区存在，且行样式没有 border-left。
		expect(css).toMatch(/\.fb-row\s*\{[^}]*display:\s*flex/);
		expect(css).not.toMatch(/\.fb-row\s*\{[^}]*border-left/);
		expect(css).toMatch(/\.fb-collapse\s*>\s*summary/);
	});

	it("keeps the live status behind a disclosure instead of eating the nav", () => {
		const sidebar = read("src/features/workbench/components/shell/sidebar.tsx");
		// 实时区与迷你时间线都是 <details>：面板矮时导航才不会把它们顶掉。
		expect(sidebar.match(/<details/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
	});

	it("does not repeat the lab state at the bottom of the sidebar", () => {
		const sidebar = read("src/features/workbench/components/shell/sidebar.tsx");
		const statusBar = read("src/features/workbench/components/shell/inject-status-bar.tsx");
		// lab 只在顶栏那个开关上：侧栏底部与注入状态条都不再出现它。
		expect(sidebar).not.toContain("lab.onHint");
		expect(statusBar).not.toContain("LAB");
	});
});

describe("lab mode is a switch, on by default", () => {
	it("renders a real switch with a stable test id", () => {
		const settings = read("src/features/workbench/components/pages/settings.tsx");
		// 开关收敛在设置页：lab 开关与规则开关都在这里。
		expect(settings).toContain('settings.lab.label');
		expect(settings).toContain('onChange={value => lab.set(value)}');
	});

	it("defaults to enabled when nothing was ever stored", () => {
		const lab = read("src/domain/lab-mode.ts");
		expect(lab).toMatch(/LAB_DEFAULT: LabState = \{ enabled: true/);
		// kernel 侧与 UI 侧必须同一口径，否则开关显示开、注入却说关。
		expect(read("src/runtime/contributions.ts")).toContain("LAB_DEFAULT");
		expect(read("src/features/workbench/hooks/use-lab.ts")).toContain("LAB_DEFAULT");
	});
});

describe("controls cannot be squeezed out of view", () => {
	it("the segmented control refuses to shrink", () => {
		// 它经常和标题、关闭按钮同处一行；被挤压时宽度会归零，表现为「切换按钮消失」。
		expect(read("src/features/workbench/components/shell/segmented-control.tsx")).toContain("shrink-0");
	});

	it("the injection block scrolls inside a bounded height", () => {
		const card = read("src/features/workbench/components/prompts/inject-block-card.tsx");
		expect(card).toContain("max-h-[40vh]");
		expect(card).toContain("overflow-auto");
	});
});

describe("skills are listed where the host collects them, without flooding the slash menu", () => {
	it("all nine are in the ability catalog; only the core memory skill is in the picker", () => {
		const manifest = JSON.parse(read("plugin.json")) as {
			agent: { skillPresentation: { skills: Record<string, { surfaces: Record<string, string> }> } };
		};
		const skills = manifest.agent.skillPresentation.skills;
		for (const [name, skill] of Object.entries(skills)) {
			// 对话框「添加」列表读的是能力目录：九个都要在里面。
			expect(skill.surfaces.abilityCatalog, name).toBe("visible");
		}
		// 斜杠面板只留核心技能：九个都塞进去，用户每次打斜杠都要滚过八条用不到的。
		const picker = Object.entries(skills)
			.filter(([, skill]) => skill.surfaces.skillPicker === "visible")
			.map(([name]) => name);
		expect(picker).toEqual(["memory"]);
	});

	it("routes to the core memory skill in both lab modes", () => {
		// 核心手册是 memory 技能，不是「按需才读」的参考资料：kernel 块每轮都在，
		// 它必须把这件事说出来，否则关掉实验环境后模型不知道该读哪本。
		const kernel = read("src/domain/kernel.ts");
		expect(kernel).toContain("agent/skills/memory/SKILL.md");
	});
});

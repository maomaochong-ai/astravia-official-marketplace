import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 三个「容器性质」造成的布局事故，以及它们的共同根因。
 *
 * 根因不是某个类写错了，而是**顺序**：`src/style.css` 在构建产物里排在 Tailwind 工具类之后，
 * 所以同特异度时它的 `.fb-page { display:flex; flex-direction:column }` 会盖掉页面上的
 * `grid` / `@min-[880px]:flex-row`。表现就是样本页「左栏 260px、右栏掉到下面」与
 * 设置页「两栏变上下，四个分组横在顶部」。
 *
 * 修法：`:where(.fb-page)` 把特异性降到 0；页面布局改用 `.fb-samples` / `.fb-settings`
 * 这类显式模板，不依赖容器查询工具类的层叠结果。
 */

const root = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

describe("page layout is not decided by cascade accidents", () => {
	it("keeps .fb-page at zero specificity so page utilities can win", () => {
		const css = read("src/style.css");
		// 必须是 :where —— 裸 .fb-page 会在工具类之后覆盖 display / flex-direction。
		expect(css).toMatch(/:where\(\.fb-page\)\s*\{/);
		expect(css).not.toMatch(/^\.fb-page\s*\{/m);
	});

	it("gives the settings page an explicit two-column template", () => {
		const css = read("src/style.css");
		expect(css).toMatch(/\.fb-settings\s*\{[^}]*grid-template-columns:\s*minmax\(88px/);
		const page = read("src/features/workbench/components/pages/settings.tsx");
		// 左 tab：竖排 + 独占一列，不再依赖 @min-[760px]:flex-col。
		expect(page).toContain("fb-settings-tabs flex shrink-0 flex-col");
		expect(page).not.toContain("@min-[760px]:flex-col");
	});

	it("gives the samples page a wide-screen two-column template with a bounded picker", () => {
		const css = read("src/style.css");
		expect(css).toMatch(/\.fb-samples-picker\s*\{[^}]*max-height:\s*min\(46vh/);
		expect(css).toMatch(/@container \(min-width: 820px\)[\s\S]{0,260}\.fb-samples\s*\{[^}]*grid-template-columns/);
	});
});

describe("knowledge reader opens on demand only", () => {
	it("marks the initially selected doc as already handled", () => {
		const page = read("src/features/workbench/components/pages/docs.tsx");
		// 首帧就记住当前 selected：否则加载后默认选中第一篇会被当成「外部选中」，
		// 弹窗在用户没点任何东西时自己打开。
		expect(page).toContain("useRef<string | null>(docs.selected?.id ?? null)");
	});

	it("does not render a sub-topic row for an empty topic id", () => {
		const page = read("src/features/workbench/components/pages/docs.tsx");
		// 空子目录渲染出来就是一行只有计数的空行。
		expect(page).toContain('filter(sub => sub.id.trim().length > 0)');
	});
});

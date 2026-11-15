import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve(process.cwd(), "src/style.css"), "utf8");
/**
 * Comment-stripped CSS. The rules file quotes the old, wrong declarations in its own
 * comments (that is how the next reader learns why they are gone), so assertions have to
 * look at the rules, not at prose about them.
 */
const rules = css.replace(/\/\*[\s\S]*?\*\//g, "");

/**
 * 首屏的自适应，钉在 CSS 规则上。
 *
 * 曾经这里还握着一件事："拖动底部输入框，方向相反"。1.0.12 面板没有输入框了，
 * 那条用例连同它的纯函数一起退役（半调子的保留只会让后来者以为还有个可拖的框）。
 * 剩下的都是仍在生效的约束：不要居中一个可滚动的表面、markdown 按视口缩、
 * 运行记录左对齐、窄屏与矮屏各有断点。
 */


describe("the first screen adapts instead of hiding its own head", () => {
	it("does not centre a scrolling surface", () => {
		// `align-items: center` + `overflow: auto` clips the overflowing start edge: a short
		// panel shows the bottom half of the column and cannot scroll to the top.
		// 注释里引了旧写法，先剥注释再断言，否则测的是文字而不是规则。
		const surface = /\.astra-strix-term\.astra-strix-launch-surface\s*\{([^}]*)\}/s.exec(rules)?.[1] ?? "";
		expect(surface).not.toMatch(/align-items:\s*center/);
		expect(surface).not.toMatch(/justify-content:\s*center/);
		expect(surface).toContain("overflow: auto");
	});

	it("centres with auto margins and never pins the column to full height", () => {
		const column = /\.astra-strix-launch\s*\{([^}]*)\}/s.exec(rules)?.[1] ?? "";
		expect(column).toContain("margin: auto");
		// `min-height: 100%` 自己把居中抵消掉：子项和容器一样高 → 自由空间 0 →
		// auto 外边距无处可分配，内容贴顶、下方留白。0.6.2 的截图就是这个。
		expect(column).not.toMatch(/min-height:\s*100%/);
	});

	it("sizes the ASCII wordmark by viewport width, not only by font size", () => {
		// 38ch of block glyphs is wider than a 320px panel at 13px.
		const mark = /\.astra-strix-wordmark\s*\{([^}]*)\}/s.exec(css)?.[1] ?? "";
		expect(mark).toMatch(/font-size:\s*clamp\(7px,\s*min\([^)]*vw\)/);
	});

	it("lets the rail and the composer margins follow the viewport", () => {
		expect(css).toMatch(/grid-template-columns:\s*minmax\(0, 1fr\)\s*clamp\(15rem, 22vw, 19rem\)/);
		expect(css).toMatch(/\.astra-strix-composer\s*\{[^}]*margin:\s*0 clamp\(/s);
	});

	it("keeps the run log left-aligned instead of centring the column", () => {
		// 真机截图：每一行都比标题缩进一截。原因是 auto 外边距把收窄后的列居中——
		// 行距该收窄，但收窄后的列必须从左边开始，才能和标题/工具栏/输入框对齐。
		const body = /\.astra-strix-transcript-body\s*\{([^}]*)\}/s.exec(rules)?.[1] ?? "";
		expect(body).toContain("margin: 0;");
		expect(body).not.toMatch(/margin:\s*[^;]*auto/);
	});

	it("has a breakpoint for short panels as well as narrow ones", () => {
		expect(css).toContain("@media (max-width: 480px)");
		expect(css).toContain("@media (max-height: 560px)");
	});
});

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
	COMPOSER_MIN_PX,
	composerHeightBounds,
	nudgeComposerHeight,
	nextComposerHeight,
} from "../features/scan-console/composer-height";

const css = readFileSync(resolve(process.cwd(), "src/style.css"), "utf8");
/**
 * Comment-stripped CSS. The rules file quotes the old, wrong declarations in its own
 * comments (that is how the next reader learns why they are gone), so assertions have to
 * look at the rules, not at prose about them.
 */
const rules = css.replace(/\/\*[\s\S]*?\*\//g, "");

/**
 * Two reported defects, pinned.
 *
 *  1. "拖动底部输入框，方向相反" — the box answered the gesture backwards. The sign of a
 *     drag belongs in one place, and the assertion here is that dragging **up** grows the
 *     box; anything else is the bug again.
 *  2. "首屏在不同宽度下不自适应" — the launch column was centred on a scrolling surface,
 *     which hides the overflowing start edge and slides the composer the wrong way when
 *     the panel grows. The CSS assertions below are the parts that produced it.
 */

const launch = readFileSync(resolve(process.cwd(), "src/features/scan-console/components/launch-screen.tsx"), "utf8");
const scan = readFileSync(resolve(process.cwd(), "src/features/scan-console/components/scan-screen.tsx"), "utf8");

describe("drag direction", () => {
	it("grows when the pointer moves up", () => {
		// dy is negative going up: 120 → 180 on a 60px upward drag.
		expect(nextComposerHeight({ start: 120, dy: -60, min: 64, max: 400 })).toBe(180);
	});

	it("shrinks when the pointer moves down", () => {
		expect(nextComposerHeight({ start: 180, dy: 60, min: 64, max: 400 })).toBe(120);
	});

	it("clamps at both ends instead of inverting past them", () => {
		// Dragging far past the floor must not wrap to "tallest", which is what a
		// modulus or a sign flip produces.
		expect(nextComposerHeight({ start: 70, dy: 400, min: 64, max: 400 })).toBe(64);
		expect(nextComposerHeight({ start: 380, dy: -400, min: 64, max: 400 })).toBe(400);
	});

	it("keeps the keyboard on the same convention", () => {
		expect(nudgeComposerHeight({ start: 120, delta: 16, min: 64, max: 400 })).toBe(136);
		expect(nudgeComposerHeight({ start: 70, delta: -16, min: 64, max: 400 })).toBe(64);
	});

	it("bounds the box to a share of the panel, never to nothing", () => {
		const tall = composerHeightBounds(1000);
		expect(tall.max).toBe(450);
		expect(tall.min).toBe(COMPOSER_MIN_PX);
		// A very short panel still gets a usable box rather than a negative cap.
		const short = composerHeightBounds(90);
		expect(short.max).toBeGreaterThanOrEqual(COMPOSER_MIN_PX);
		expect(short.min).toBeLessThanOrEqual(short.max);
	});
});

describe("both composers carry the same handle", () => {
	for (const [name, source] of [
		["launch", launch],
		["scan", scan],
	] as const) {
		it(`${name} renders a separator with the shared hook`, () => {
			expect(source).toContain("useComposerHeight");
			expect(source).toContain('className="astra-strix-resize-handle"');
			expect(source).toContain('role="separator"');
			expect(source).toContain("--sx-composer-h");
		});
	}

	it("the handle is a real hit area, not a hairline", () => {
		expect(css).toContain(".astra-strix-resize-handle");
		expect(css).toMatch(/\.astra-strix-resize-handle\s*\{[^}]*cursor: ns-resize/s);
		expect(css).toMatch(/\.astra-strix-resize-handle\s*\{[^}]*height: 8px/s);
		// Touch scrolling must not steal the gesture mid-drag.
		expect(css).toMatch(/\.astra-strix-resize-handle\s*\{[^}]*touch-action: none/s);
	});

	it("the textarea takes its height from the variable and scrolls inside it", () => {
		expect(css).toMatch(/\.astra-strix-prompt-input\s*\{[^}]*height: var\(--sx-composer-h, auto\)/s);
		expect(css).toMatch(/\.astra-strix-prompt-input\s*\{[^}]*overflow-y: auto/s);
	});
});

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

	it("has a breakpoint for short panels as well as narrow ones", () => {
		expect(css).toContain("@media (max-width: 480px)");
		expect(css).toContain("@media (max-height: 560px)");
	});
});

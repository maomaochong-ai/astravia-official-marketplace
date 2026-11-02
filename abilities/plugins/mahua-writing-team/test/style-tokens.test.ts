import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * 手写 CSS 与 `@theme inline` 的刻度必须逐字相等。
 *
 * `@theme inline` 把取值内联进工具类，不向 `:root` 发射变量，所以 `.mahua-card` 这类手写规则
 * 只能写字面量。写字面量本身没问题，问题是同一套刻度出现在两个地方——改了 `--radius-sheet`
 * 却忘了卡片，圆角就会悄悄跟不上。这条测试就是那个「忘」的报警器。
 */

const style = readFileSync(
	new URL("../src/style.css", import.meta.url),
	"utf8",
);

const themeBlock = (() => {
	const start = style.indexOf("@theme inline");
	if (start === -1) throw new Error("src/style.css 里找不到 @theme inline 块");
	const open = style.indexOf("{", start);
	const close = style.indexOf("\n}", open);
	if (open === -1 || close === -1) throw new Error("@theme inline 块没有正常闭合");
	return style.slice(open, close);
})();

const tokenPx = (name: string) => {
	const match = new RegExp(`--${name}:\\s*(\\d+)px`).exec(themeBlock);
	if (!match) throw new Error(`@theme inline 里没有 --${name} 的 px 取值`);
	return Number(match[1]);
};

const ruleRadiusPx = (selector: string) => {
	const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const match = new RegExp(`${escaped}\\s*\\{[^}]*?border-radius:\\s*(\\d+)px`).exec(style);
	if (!match) throw new Error(`${selector} 没有写 border-radius 的字面量`);
	return Number(match[1]);
};

describe("hand-written radii stay on the theme scale", () => {
	it("gives the card the sheet radius", () => {
		expect(ruleRadiusPx(".mahua-card")).toBe(tokenPx("radius-sheet"));
	});

	it("gives the well the panel radius", () => {
		expect(ruleRadiusPx(".mahua-well")).toBe(tokenPx("radius-panel"));
	});

	it("keeps the inner radius strictly smaller than the outer one", () => {
		// 内层半径 ≥ 外层时，两段弧线会在角上错开，看起来就是「圆角重叠」，
		// 这与间距够不够是两件事，必须分开钉住。
		expect(ruleRadiusPx(".mahua-well")).toBeLessThan(ruleRadiusPx(".mahua-card"));
	});
});

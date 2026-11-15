import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * 「背景代码流动效果有规则的竖向流动，我希望无规则，更加乱序一些」。
 *
 * 1.0.2 的雨是 `(seed*7 + row*3) % len` 取字符 + CSS 的 `nth-child(2n/3n/5n)` 给速度：
 *  - 字符是等差序列 → 相邻列落在同一条斜线上，屏幕上是一道道平行斜纹；
 *  - 速度只有 9/12/15/7s 四档 → 整屏周期性对齐成横波。
 *
 * 1.0.7 改成 xorshift32 扰动：每列独立的速度、相位、长度、亮度、断行位置。
 * 仍然**不用** `Math.random()`：截图与测试要可复现（ADR 0011）。
 */

const plugin = resolve(process.cwd());
const rain = readFileSync(join(plugin, "src/features/scan-console/components/hacker-rain.tsx"), "utf8");
const css = readFileSync(join(plugin, "src/style.css"), "utf8");

describe("the rain is deterministic but not regular", () => {
	it("never calls Math.random", () => {
		// 注释里提到这个名字是可以的（它就是用来解释“为什么不用”）；代码里出现才算违规。
		const codeOnly = rain.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
		expect(codeOnly).not.toMatch(/Math\.random\s*\(/);
	});

	it("derives each column from a hash, not an arithmetic progression", () => {
		expect(rain).toContain("function hash(seed: number): number");
		// 老写法必须消失：那一行就是"平行斜纹"的出处。
		expect(rain).not.toContain("(seed * 7 + row * 3)");
	});

	it("gives every column its own duration, phase, length and brightness", () => {
		expect(rain).toContain("animationDuration:");
		expect(rain).toContain("animationDelay:");
		expect(rain).toContain("opacity: entry.opacity");
		// 负延迟让首帧就不对齐（否则所有列从同一起点出发）。
		expect(rain).toMatch(/animationDelay: `-\$\{entry\.delay\.toFixed\(1\)\}s`/);
		expect(rain).toMatch(/const length = 18 \+ pick\(seed, \d+, \d+\)/);
		expect(rain).toMatch(/const duration = 7 \+ pick\(seed, \d+, \d+\) \/ 10/);
	});

	it("breaks the stream so a column reads as data, not a solid bar", () => {
		expect(rain).toContain("const GAP");
		expect(rain).toMatch(/pick\(cell, \d+, 8\) === 0 \? GAP/);
	});

	it("does not go back to nth-child speed tiers", () => {
		expect(css).not.toContain(".astra-strix-rain > span:nth-child(2n)");
		expect(css).not.toContain(".astra-strix-rain > span:nth-child(3n)");
		expect(css).not.toContain(".astra-strix-rain > span:nth-child(5n)");
	});

	it("stops still under reduced motion", () => {
		expect(css).toMatch(/prefers-reduced-motion[\s\S]{0,400}\.astra-strix-rain > span \{[^}]*animation: none/s);
	});
});

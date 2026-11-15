import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * 背景氛围层（1.4.0）。
 *
 * 用户要的是"更黑客、更炫彩，但和文字颜色匹配"。三条约束把"炫"和"能读"同时钉住：
 *
 *  1. **不引用网络资源**：随官方市场分发的插件不能依赖外部图片（许可证、离线、分辨率都不稳）。
 *     所以背景只允许 CSS 渐变 + 内联 SVG。
 *  2. **不透明度有上限**：极光是底色，不是主角；超过上限就会把绿字压成灰字。
 *  3. **动效可关**：prefers-reduced-motion 下三层（极光 / 扫光 / 环）都必须静止。
 *
 * 颜色本身留在 `--sx-aurora-*` 三个变量里：换主题或改磷光档时它们跟着走，
 * 而不是把色值散在十几条规则里。
 */

const plugin = resolve(process.cwd());
const css = readFileSync(join(plugin, "src/style.css"), "utf8");
const rules = css.replace(/\/\*[\s\S]*?\*\//g, "");
const component = readFileSync(join(plugin, "src/features/scan-console/components/hacker-backdrop.tsx"), "utf8");
const launch = readFileSync(join(plugin, "src/features/scan-console/components/launch-screen.tsx"), "utf8");
const scan = readFileSync(join(plugin, "src/features/scan-console/components/scan-screen.tsx"), "utf8");

const ruleFor = (selector: string): string => {
	const index = rules.indexOf(`${selector} {`);
	if (index < 0) return "";
	return rules.slice(index + selector.length + 2, rules.indexOf("}", index));
};

describe("the backdrop is layers, not a wallpaper", () => {
	it("renders every layer in one aria-hidden block", () => {
		for (const layer of ["aurora", "mesh", "rings", "sheen", "horizon", "vignette", "grain"]) {
			expect(component, layer).toContain(`astra-strix-${layer}`);
		}
		expect(component).toContain('aria-hidden="true"');
	});

	it("mounts on both screens, at two densities", () => {
		expect(launch).toContain('<HackerBackdrop density="splash" />');
		expect(scan).toContain('<HackerBackdrop density="workbench" />');
	});

	it("puts the content above it (z-index exceptions)", () => {
		expect(rules).toContain(":not(.astra-strix-backdrop)");
	});

	it("pulls no remote image", () => {
		// 只有内联 SVG（data:）是真允许的图片来源。
		const urls = [...rules.matchAll(/url\(([^)]*)\)/g)].map((match) => match[1]!.trim().replace(/^["']|["']$/g, ""));
		const remote = urls.filter((value) => /^https?:/i.test(value));
		expect(remote).toEqual([]);
		expect(urls.every((value) => value.startsWith("data:"))).toBe(true);
	});
});

describe("colour is capped so the text stays readable", () => {
	it("keeps the aurora at or under half opacity", () => {
		const aurora = Number(/opacity:\s*([\d.]+)/.exec(ruleFor(".astra-strix-aurora"))?.[1] ?? "1");
		expect(aurora).toBeLessThanOrEqual(0.5);
		// 工作台更淡：它后面就是要读的字。
		const workbench = /\[data-density="workbench"\]\s+\.astra-strix-aurora\s*\{[^}]*opacity:\s*([\d.]+)/s.exec(rules)?.[1];
		expect(Number(workbench ?? "1")).toBeLessThan(aurora);
	});

	it("keeps网格/环/扫光 faint", () => {
		for (const [selector, cap] of [
			[".astra-strix-mesh", 0.12],
			[".astra-strix-sheen", 0.16],
			[".astra-strix-rings", 0.1],
			[".astra-strix-grain", 0.05],
		] as const) {
			const value = Number(/opacity:\s*([\d.]+)/.exec(ruleFor(selector))?.[1] ?? "1");
			expect(value, selector).toBeLessThanOrEqual(cap);
		}
	});

	it("takes its hues from three variables, not scattered hex values", () => {
		const block = ruleFor(".astra-strix-backdrop");
		for (const name of ["--sx-aurora-a", "--sx-aurora-b", "--sx-aurora-c"]) {
			expect(block, name).toContain(name);
		}
		// 极光/网格/环/扫光都引用变量：改一处就能整体换色。
		// 扫光的渐变在它的 ::after 上（1.4.1 把它从 background-position 改成 transform，
		// 让这条动画走合成层而不是每帧重绘整屏）。
		for (const selector of [".astra-strix-aurora", ".astra-strix-mesh", ".astra-strix-rings"]) {
			expect(ruleFor(selector), selector).toContain("var(--sx-aurora-");
		}
		const sheenAfter = rules.slice(rules.indexOf(".astra-strix-sheen::after"));
		expect(sheenAfter.slice(0, sheenAfter.indexOf("}"))).toContain("var(--sx-aurora-");
	});

	it("keeps the palette in the green–cyan–violet family (not a random rainbow)", () => {
		const block = ruleFor(".astra-strix-backdrop");
		const hexes = [...block.matchAll(/--sx-aurora-[abc]:\s*(#[0-9a-f]{6})/gi)].map((match) => match[1]!.toLowerCase());
		expect(hexes).toEqual(["#10b981", "#0891b2", "#7c3aed"]);
	});
});

describe("motion can be turned off", () => {
	it("stops aurora, sheen and rings under reduced motion", () => {
		// 文件里有好几个 reduced-motion 块（光标、雨各有各的），逐个看，不只看第一个。
		const blocks = [...rules.matchAll(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/g)].map((match) => match[1] ?? "");
		const joined = blocks.join("\n");
		expect(joined).toContain(".astra-strix-aurora");
		expect(joined).toContain(".astra-strix-sheen");
		expect(joined).toContain(".astra-strix-rings");
	});

	it("declares all three animations it uses", () => {
		const used = [...rules.matchAll(/animation:\s*(astra-strix-[a-z-]+)/g)].map((match) => match[1]!);
		const declared = [...rules.matchAll(/@keyframes\s+(astra-strix-[a-z-]+)/g)].map((match) => match[1]!);
		for (const name of new Set(used)) expect(declared, name).toContain(name);
	});
});

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * 1.0.5 的三件事：
 *  1. 首屏**整块**没居中：`min(72ch, 100%)` 在 CJK 等宽字体里 72ch ≈ 940px，等于占满面板。
 *     现在整块有 px 上限，头部（wordmark + 标语）居中，行保持左对齐。
 *  2. 环境行用括号、模型名前挂圆点：读起来别扭；圆点只留给**状态**。
 *  3. 发出会话后不停在首屏：切屏曾经要等宿主的 turn-start **且**胶囊处于启用态，
 *     任一不成立面板就不动，用户看到的是「发出去了，面板没反应」。
 */

const plugin = resolve(process.cwd());
const read = (p: string): string => readFileSync(join(plugin, p), "utf8");
const hook = read("src/features/scan-console/hooks/use-strix-session.ts");
const launch = read("src/features/scan-console/components/launch-screen.tsx");
const css = read("src/style.css");
const zh = JSON.parse(read("locales/zh.json")) as Record<string, string>;
const en = JSON.parse(read("locales/en.json")) as Record<string, string>;

describe("the launch column is centred, not stretched", () => {
	it("caps the whole block in pixels instead of ch", () => {
		// ch 跟着字体走：CJK 等宽下 1ch ≈ 13px，72ch 就快一屏了。
		// 宽度的 px 上限在基规则上（1.0.6 把两条合成一条）：不再有单独覆盖块。
		const rule = /\.astra-strix-launch \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
		expect(rule).toMatch(/width:\s*min\(\s*\d+px\s*,\s*100%\s*\)/);
		expect(rule).toMatch(/margin:\s*auto/);
	});

	it("centres the head and keeps the rows left-aligned", () => {
		// 头部规则在文件里出现过两次（1.0.3 只对齐子项，1.0.5 补上文字居中）：
		// 只要有一份同时具备两者，就是终态意图。
		const heads = [...css.matchAll(/\.astra-strix-launch-head\s*\{([^}]*)\}/g)].map((match) => match[1] ?? "");
		expect(heads.some((head) => head.includes("align-items: center") && head.includes("text-align: center"))).toBe(true);
		// 行不能跟着居中：标签列 + 值列靠左才读得成表。
		const rows = /\.astra-strix-rows\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
		expect(rows).not.toContain("text-align: center");
	});
});

describe("no parentheses, no decorative bullets", () => {
	it("names the environments without brackets", () => {
		for (const value of [zh["env.docker"], zh["env.host"], zh["env.auto"], en["env.docker"], en["env.host"], en["env.auto"]]) {
			expect(value).toBeTruthy();
			expect(value).not.toMatch(/[（）()]/);
		}
	});

	it("keeps the status lines free of brackets too", () => {
		for (const key of ["env.statusHost", "env.statusNoDocker", "env.statusNoImage", "env.statusReady"]) {
			expect(zh[key]).not.toMatch(/[（）()]/);
			expect(en[key]).not.toMatch(/[()]/);
		}
	});

	it("does not put a dot in front of the model name", () => {
		const modelRow = /data-missing=\{[^}]*\}([\s\S]*?)<\/div>/.exec(launch)?.[1] ?? "";
		expect(modelRow).toContain("astra-strix-meta-name");
		expect(modelRow).not.toMatch(/[●○]/);
		// 状态行仍然有状态点：它是状态，不是装饰。
		expect(launch).toMatch(/astra-strix-green[^>]*>\s*●/);
	});
});

describe("sending leaves the launch screen", () => {
	const turnStart = /if \(event\.type === "turn-start"\) \{([\s\S]*?)\n\t\t\t\treturn;/.exec(hook)?.[1] ?? "";
	const deliver = /const deliver = useCallback\(([\s\S]*?)\n\t\);/.exec(hook)?.[1] ?? "";

	it("follows a turn in this conversation without asking the capsule", () => {
		expect(turnStart).toContain("setShowLaunch(false)");
		expect(turnStart).toContain('setPhase("scanning")');
		// 旧实现要求 isStrixEngaged()：胶囊没开就停在首屏。
		expect(turnStart).not.toMatch(/isStrixEngaged\(\)\s*&&/);
	});

	it("leaves the launch screen on a successful delivery", () => {
		expect(deliver).toContain("setShowLaunch(false)");
		// 用户按的是「开始」，不是「继续看首屏」：pin 一并销掉。
		expect(deliver).toContain("launchPinned.current = false");
	});

	it("still honours an explicit return to the launch screen", () => {
		// 「返回首屏」是按钮，不是推断：它仍然把 pin 立起来。
		const openLaunch = /const openLaunch = useCallback\(([\s\S]*?)\n\t\)/.exec(hook)?.[1] ?? "";
		expect(openLaunch).toContain("launchPinned.current = true");
	});
});

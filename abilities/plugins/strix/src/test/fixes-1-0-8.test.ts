import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * 1.0.8 的三处换行（用户截图）：
 *
 *  1. 版本号掉到桥接状态的下一行 —— `.astra-strix-hints-version { margin-left: auto }`
 *     把版本推出了组内，组本身又是可换行的。
 *  2. "刷新环境" 单独掉到下拉下面 —— `.astra-strix-env-actions { margin-top: 5px }`
 *     让它成为独立的一行；它能这样做，是因为它不在 `.astra-strix-env-line` 的 flex 里。
 *  3. 发送键挤在文字行末尾 —— 输入一长高它就被推到文字中间。改成框内底条：左键位、右发送。
 */

const plugin = resolve(process.cwd());
const read = (p: string): string => readFileSync(join(plugin, p), "utf8");
const css = read("src/style.css");
const launch = read("src/features/scan-console/components/launch-screen.tsx");
const scan = read("src/features/scan-console/components/scan-screen.tsx");

describe("the footer keeps the version on one line", () => {
	it("wraps boot state and version in one non-wrapping group", () => {
		const group = /\.astra-strix-boot-line \{([^}]*)\}/s.exec(css)?.[1] ?? "";
		expect(group).toContain("inline-flex");
		expect(group).toContain("white-space: nowrap");
		expect(group).toContain("margin-left: auto");
	});

	it("does not push the version out of that group", () => {
		const version = /\.astra-strix-hints-version \{([^}]*)\}/s.exec(css)?.[1] ?? "";
		expect(version).not.toMatch(/margin-left:\s*auto/);
		// 版本必须渲染在 boot-line 里面：外面就没有"整组不换行"这回事了。
		expect(launch).toMatch(/astra-strix-boot-line[\s\S]*?astra-strix-hints-version/);
	});
});

describe("the environment row is one row", () => {
	it("puts the actions in the same flex line as the select", () => {
		// 顺序：env-line 开 → select → status → actions → 关；中间不出现闭合。
		const row = /astra-strix-env-line[\s\S]*?astra-strix-env-actions[\s\S]*?<\/span>\s*<\/span>\s*<\/div>/.exec(launch);
		expect(row).toBeTruthy();
		const actions = /\.astra-strix-env-actions \{([^}]*)\}/s.exec(css)?.[1] ?? "";
		expect(actions).toContain("inline-flex");
		expect(actions).not.toMatch(/margin-top/);
	});

	it("lets the line wrap only when the panel is actually narrow", () => {
		const line = /\.astra-strix-env-line \{([^}]*)\}/s.exec(css)?.[1] ?? "";
		expect(line).toContain("flex-wrap: wrap");
	});
});

describe("the composer has its own action bar", () => {
	it("renders hint and send button on a bar under the text", () => {
		expect(launch).toContain("astra-strix-composer-bar");
		expect(scan).toContain("astra-strix-composer-bar");
		// 底条必须排在文本行之后（不是里面）。
		expect(launch.indexOf("astra-strix-prompt-row")).toBeLessThan(launch.indexOf("astra-strix-composer-bar"));
	});

	it("pins the button to the right end of that bar", () => {
		const bar = /\.astra-strix-composer-bar \{([^}]*)\}/s.exec(css)?.[1] ?? "";
		expect(bar).toContain("display: flex");
		// 提示占住左侧，按钮自然落在右端。
		expect(css).toMatch(/\.astra-strix-composer-bar > \.astra-strix-dim \{[^}]*margin-right:\s*auto/s);
	});

	it("does not repeat the keyboard hint twice", () => {
		// 底条里已经写了 Shift+Enter；脚注里再来一条就是同一句话说两遍。
		const foot = /astra-strix-launch-foot[\s\S]*?<\/div>/.exec(launch)?.[0] ?? "";
		expect(foot).not.toContain('t("launch.hint.send")');
	});

	it("drops the hint paragraph under the workbench composer", () => {
		// 说明已经进框内底条，框下不再留一行。
		const composer = /astra-strix-composer[\s\S]*?<\/div>\s*<\/section>/.exec(scan)?.[0] ?? "";
		expect(composer).not.toContain("astra-strix-prompt-hint");
	});
});

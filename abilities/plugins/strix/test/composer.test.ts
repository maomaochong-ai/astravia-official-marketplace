import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const plugin = resolve(process.cwd());
const read = (p: string): string => readFileSync(join(plugin, p), "utf8");
const css = read("src/style.css");
const launch = read("src/features/scan-console/components/launch-screen.tsx");
const scan = read("src/features/scan-console/components/scan-screen.tsx");
const hook = read("src/features/scan-console/hooks/use-strix-session.ts");
const index = read("src/index.tsx");
const manifest = JSON.parse(read("plugin.json")) as { permissions: string[] };
const zh = JSON.parse(read("locales/zh.json")) as Record<string, string>;
const en = JSON.parse(read("locales/en.json")) as Record<string, string>;

/**
 * 输入框：一行高、发送键在框内底条、两个屏同形。
 */

describe("the composer can be used with the mouse", () => {
	it("has a send button on both screens", () => {
		expect(launch).toContain("astra-strix-send");
		expect(scan).toContain("astra-strix-send");
		expect(zh["composer.send"]).toBeTruthy();
		expect(en["composer.send"]).toBeTruthy();
	});

	it("sends the same way Enter does, including while streaming", () => {
		// 宿主会排队（sendPrompt → queued）；把 busy 当禁发条件会让"发送键点了没反应"。
		const send = /const send = \(\): void => \{([\s\S]*?)\n\t\};/.exec(scan)?.[1] ?? "";
		expect(send).toContain("if (!draft.trim()) return;");
		expect(send).not.toContain("busy");
		expect(scan).toContain("disabled={!draft.trim()}");
	});

	it("is one row tall, not three", () => {
		expect(launch).toMatch(/const rows = Math\.min\(\d+, Math\.max\(1,/);
		expect(scan).toMatch(/rows=\{1\}/);
	});

	it("puts the button inside the box, on the text row", () => {
		expect(launch).toContain("astra-strix-prompt-field");
		const row = /\.astra-strix-prompt-row \{([^}]*)\}/s.exec(css)?.[1] ?? "";
		expect(row).toContain("align-items: flex-end");
		const send = /\.astra-strix-send \{([^}]*)\}/s.exec(css)?.[1] ?? "";
		expect(send).toContain("flex: 0 0 auto");
		expect(send).toContain("height: 24px");
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

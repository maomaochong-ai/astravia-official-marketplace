import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * 1.0.7 的四件事，都是「看着不对」而不是「报错」：
 *
 *  1. 工作台的滚动条浮在面板中间：可读宽度被加在了**滚动容器**上（`max-width: 118ch`
 *     + `width: 100%`），于是容器变窄、滚动条跟着跑到中间。现在容器满宽、滚动条贴栏右缘，
 *     收窄的是里面的行。
 *  2. 输入框发不出话：只有 Enter，没有发送键。
 *  3. 输入框又高又窄：`rows` 起点 3 行。
 *  4. 首屏把「模型」「已挂载工作目录」「接续上次评估现场」写进日志，与事实表重复。
 */

const plugin = resolve(process.cwd());
const read = (p: string): string => readFileSync(join(plugin, p), "utf8");
const css = read("src/style.css");
const launch = read("src/features/scan-console/components/launch-screen.tsx");
const scan = read("src/features/scan-console/components/scan-screen.tsx");
const hook = read("src/features/scan-console/hooks/use-strix-session.ts");
const zh = JSON.parse(read("locales/zh.json")) as Record<string, string>;
const en = JSON.parse(read("locales/en.json")) as Record<string, string>;

describe("the scrollbar sits on the column edge", () => {
	it("keeps the readable width off the scroll container", () => {
		const body = /\.astra-strix-transcript-body \{([^}]*)\}/s.exec(css)?.[1] ?? "";
		expect(body).toContain("overflow-y: auto");
		expect(body).toContain("max-width: none");
		// 窄宽度加在容器上，滚动条就会跟着跑到中间——正是用户看到的那条竖线。
		expect(body).not.toMatch(/max-width:\s*\d+ch/);
	});

	it("narrows the rows instead", () => {
		expect(css).toMatch(/\.astra-strix-transcript-body > \* \{[^}]*max-width:\s*\d+ch/s);
	});
});

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

describe("essential text drops to a footnote", () => {
	it("renders hints, boot state and version as one footer line", () => {
		expect(launch).toContain("astra-strix-launch-foot");
		const foot = /\.astra-strix-launch-foot \{([^}]*)\}/s.exec(css)?.[1] ?? "";
		expect(foot).toContain("border-top");
		// 版本 / 快捷藏在脚注；事实表里只留模型、目录、环境。
		expect(launch.indexOf("astra-strix-launch-foot")).toBeGreaterThan(launch.indexOf("astra-strix-rows"));
	});

	it("says the folder once, as a fact", () => {
		expect(launch).toContain('t("launch.folder")');
		// 日志里那条“已挂载工作目录”没了：同一句话说两遍是噪声。
		expect(hook).not.toContain('t("log.workspaceMounted")');
		expect(hook).not.toContain('t("log.modelFromConversation")');
	});
});

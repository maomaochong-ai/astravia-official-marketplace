// @vitest-environment happy-dom

/**
 * 悬浮文字的来源守卫。
 *
 * 真实缺陷：`PluginFileExplorerDecoration.icon` 的类型是 **ReactNode**，而装饰提供器
 * 直接把 `ctx.plugin.iconUrl`（字符串）给了它 —— React 把 URL 当正文画进文件树，
 * 于是那一行「versions/<ver>/…」压在目录树上，文件多时更明显。
 *
 * 这个测试守的是「代价最小的那一层」：装饰提供器只能返回元素或 null，绝不能返回字符串。
 * 与其依赖运行时看得见，不如让错误在 `tsc`/测试里就红。
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..", "..");
const entry = readFileSync(join(ROOT, "src/index.tsx"), "utf8");
const dock = readFileSync(join(ROOT, "src/features/canvas/components/canvas-dock.tsx"), "utf8");

describe("file-tree decorations", () => {
	it("never hands a bare URL to the decoration icon", () => {
		// `provideDecoration: () => ({ icon })` 是缺陷形态：icon 是字符串。
		expect(entry).not.toMatch(/provideDecoration:\s*\(\)\s*=>\s*\(\{\s*icon\s*\}\)/u);
		// 必须是元素：`icon: <img …>`
		expect(entry).toMatch(/provideDecoration:\s*\(\)\s*=>\s*\(\{[\s\S]{0,200}icon:\s*<img/u);
	});
});

describe("the dock has one entry per verb", () => {
	it("does not repeat the versions panel in the top rail", () => {
		// 同一个面板两个按钮位（dock + 右上角）是冗余，也是「找不到/点错」的来源。
		expect(dock).toContain('t("dock.versions")');
		expect(entry).not.toContain('t("panel.history")');
	});

	it("folds Surprise into the generate menu instead of its own slot", () => {
		expect(dock).toContain('aria-haspopup="menu"');
		expect(dock).toContain('t("action.surprise")');
	});
});

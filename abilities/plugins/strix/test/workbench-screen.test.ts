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
 * 工作台呈现：滚动条贴本栏右缘，收窄的是行而不是滚动容器。
 */

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

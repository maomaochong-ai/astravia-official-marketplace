import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Two things the activity page got wrong, pinned so they cannot come back:
 *
 *  1. Its background mixed 12% of the accent into the surface, which produced a bluish
 *     "terminal" block sitting inside an otherwise neutral panel. The palette has to come
 *     from the same surface scale as every other page.
 *  2. Every row carried a 2px coloured bar on its left edge. Twenty rows meant twenty
 *     coloured stripes competing with the sidebar selection state. Status is already in
 *     the glyph and the name colour.
 *
 * The third assertion is about rhythm: 3px padding with no gap made two two-line rows read
 * as one four-line block.
 */
const css = readFileSync(resolve(process.cwd(), "src/style.css"), "utf8");
const rule = (selector: string): string => {
	const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? "";
};

describe("activity stream presentation", () => {
	it("draws no coloured bar down the left of a row", () => {
		expect(rule(".fb-terminal .fb-log")).not.toContain("border-inline-start");
		expect(css).not.toMatch(/\.fb-terminal \.fb-log\[data-tone=[^\]]+\]\s*\{[^}]*border-inline-start-color/);
	});

	it("takes its background from the surface scale, not from the accent", () => {
		const terminal = rule(".fb-terminal");
		expect(terminal).toContain("--fb-surface");
		expect(terminal).not.toContain("--fb-accent");
	});

	it("keeps rows apart: padding, a gap between rows, and a bigger gap between turns", () => {
		expect(rule(".fb-terminal .fb-log")).toMatch(/padding:\s*5px/);
		expect(rule(".fb-terminal .fb-log + .fb-log")).toContain("margin-top");
		expect(rule(".fb-terminal section + section")).toContain("margin-top");
	});

	it("derives the accent from the host primary so panel and host read as one theme", () => {
		// 面板曾经自己写死一档蓝，宿主主色是靛蓝：两者同屏就是两套设计。
		expect(css).toMatch(/--fb-accent:\s*color-mix\([^;]*var\(--primary/);
	});
});

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The three things this round fixed on the knowledge sidebar, pinned as source
 * contracts (they are layout/behaviour facts, not values a unit test can call):
 *
 *  - a visible export (it used to exist only in the right-click menu);
 *  - no preview on entry (the first selection must seed, not open);
 *  - one filter control shared with the case library.
 */
const read = (path: string): string => readFileSync(resolve(process.cwd(), path), "utf8");

describe("documents can be exported", () => {
	const docs = read("src/features/workbench/components/pages/docs.tsx");

	it("offers an export action in the toolbar, not only in the context menu", () => {
		expect(docs).toContain("exportListing");
		expect(docs).toContain('t("docs.export")');
		// The toolbar button lives next to the count, i.e. outside the context menu block.
		expect(docs.indexOf('t("docs.export")')).toBeLessThan(docs.indexOf('data-testid="docs-menu"'));
	});

	it("exports the current listing — filters and search included", () => {
		// `listing` is the search result set; otherwise the filtered groups.
		expect(docs).toMatch(/const ids = listing \? listing\.map/);
		expect(docs).toContain("downloadMarkdown(");
	});
});

describe("the reader does not open by itself", () => {
	const docs = read("src/features/workbench/components/pages/docs.tsx");

	it("seeds the first selection and returns without opening", () => {
		const seed = /if \(!seeded\.current\) \{([\s\S]{0,240}?)\}/.exec(docs)?.[1] ?? "";
		expect(seed).toContain("seeded.current = true");
		expect(seed).not.toContain("setOpenId");
	});

	it("still opens on a later, externally requested selection", () => {
		expect(docs).toMatch(/openedFor\.current !== id[\s\S]{0,120}?setOpenId\(id\)/);
	});
});

describe("one filter control across the knowledge views", () => {
	const cases = read("src/features/workbench/components/pages/cases.tsx");
	const menu = read("src/features/workbench/components/shell/filter-menu.tsx");

	it("uses the shared FilterMenu in the case library", () => {
		expect(cases).toContain("<FilterMenu");
		// The chip row is the old, different-looking control.
		expect(cases).not.toContain("<FilterChips");
	});

	it("dresses the menu exactly like the docs filter chip", () => {
		// Same classes the docs page summary carries; that is what "同一种样式" means.
		expect(menu).toContain("border-accent/40 bg-accent-soft text-accent");
		expect(menu).toContain("border-line-subtle text-text-2 hover:bg-surface-hover");
	});
});

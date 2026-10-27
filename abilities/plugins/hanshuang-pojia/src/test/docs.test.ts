import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ASSET_ENTRIES, DOC_ENTRIES, DOC_TOTALS, docById, docGroups, loadDoc, searchTitles } from "../features/workbench/services/docs";
import { SHIPPED_PRECEDENTS } from "../domain/case/precedents";

const manifest = readFileSync(new URL("../content/docs/docs.sha256", import.meta.url), "utf8")
	.split("\n")
	.filter(line => line.trim().length > 0);

describe("document library index", () => {
	it("covers the four shipped collections", () => {
		const counts = new Map<string, number>();
		for (const entry of DOC_ENTRIES) counts.set(entry.group, (counts.get(entry.group) ?? 0) + 1);
		expect(counts.get("kb")).toBe(292);
		expect(counts.get("manual")).toBe(11);
		expect(counts.get("kit-docs")).toBe(7);
		// 案例原文按先例包归档：正文组不能为空，且先例包声明的 caseDocs 必须在索引里真实存在。
		const caseCount = counts.get("cases") ?? 0;
		expect(caseCount).toBeGreaterThan(0);
		for (const id of SHIPPED_PRECEDENTS.flatMap(precedent => precedent.caseDocs)) {
			expect(DOC_ENTRIES.some(entry => entry.id === id), id).toBe(true);
		}
		expect(DOC_ENTRIES.length).toBe(310 + caseCount);
	});

	it("matches the committed checksum manifest entry for entry", () => {
		expect(manifest.length).toBe(DOC_ENTRIES.length);
		for (const entry of DOC_ENTRIES) expect(manifest).toContain(`${entry.sha256}  ${entry.id}.md`);
	});

	it("gives every document a title and a non-empty body path", () => {
		for (const entry of DOC_ENTRIES) {
			expect(entry.title.length, entry.id).toBeGreaterThan(0);
			expect(entry.path.startsWith("src/content/docs/"), entry.id).toBe(true);
			expect(entry.bytes, entry.id).toBeGreaterThan(0);
		}
		expect(DOC_TOTALS.bytes).toBeGreaterThan(3_000_000);
	});

	it("indexes the machine-readable attachments beside the articles", () => {
		expect(DOC_TOTALS.assets).toBe(5);
		expect(ASSET_ENTRIES.map(entry => entry.id).sort()).toEqual([
			"kb/apk-reverse/techniques/kb-index.json",
			"kb/ctf-website/techniques/kb-index.json",
			"kb/general/techniques/kb-index.json",
			"kb/pe-reverse/techniques/kb-index.json",
			"kit-docs/tool-index.json",
		]);
		for (const entry of ASSET_ENTRIES) {
			expect(entry.kind, entry.id).toBe("asset");
			expect(entry.bytes, entry.id).toBeGreaterThan(0);
			/** 附件不进导航树，避免 292 篇文章里混进五张表。 */
			expect(docGroups().flatMap(group => group.topics.flatMap(topic => topic.entries)).some(item => item.id === entry.id)).toBe(false);
		}
	});

	it("builds the navigation tree without empty groups", () => {
		const groups = docGroups();
		expect(groups.map(group => group.id)).toEqual(["kb", "manual", "kit-docs", "cases"]);
		for (const group of groups) {
			expect(group.topics.length).toBeGreaterThan(0);
			for (const topic of group.topics) expect(topic.entries.length).toBeGreaterThan(0);
		}
	});
});

describe("document loading", () => {
	it("loads a bundled body through the lazy glob", async () => {
		const entry = docById("kb/README");
		expect(entry).toBeDefined();
		const text = await loadDoc("kb/README");
		expect(text.startsWith("# Knowledge Base")).toBe(true);
	});

	it("loads an attachment body through the same glob", async () => {
		const text = await loadDoc("kit-docs/tool-index.json");
		expect(JSON.parse(text).counts.total).toBe(42);
	});

	it("rejects an id that is not in the index", async () => {
		await expect(loadDoc("kb/does-not-exist")).rejects.toThrow(/unknown document/);
	});
});

describe("title search", () => {
	it("finds documents by title and path", () => {
		expect(searchTitles("payment").length).toBeGreaterThan(0);
		expect(searchTitles("12-payment").length).toBeGreaterThan(0);
		expect(searchTitles("   ").length).toBe(0);
	});

	it("respects the result limit", () => {
		expect(searchTitles("a", 5).length).toBeLessThanOrEqual(5);
	});
});

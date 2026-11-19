import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_DOC_BUDGET, MAX_DOC_BUDGET, partialNotice, sliceDocument } from "../../domain/doc-slice";
import { loadDocsLibrary, type DocsLibrary } from "../../features/workbench/services/docs";
import { SHIPPED_PRECEDENTS } from "../../domain/case/precedents";

const manifest = readFileSync(new URL("../../content/docs/docs.sha256", import.meta.url), "utf8")
	.split("\n")
	.filter(line => line.trim().length > 0);

/**
 * 索引是异步到达的（ADR 0009 D5）：整组测试先加载一次库，再对同一份事实断言。
 * 这样「索引没加载」和「索引是空的」不会混成同一个失败现象。
 */
let library: DocsLibrary;

beforeAll(async () => {
	library = await loadDocsLibrary();
});

describe("document library index", () => {
	it("covers the four shipped collections", () => {
		const counts = new Map<string, number>();
		for (const entry of library.entries) counts.set(entry.group, (counts.get(entry.group) ?? 0) + 1);
		expect(counts.get("kb")).toBe(292);
		expect(counts.get("manual")).toBe(11);
		expect(counts.get("kit-docs")).toBe(7);
		// 案例原文按先例包归档：正文组不能为空，且先例包声明的 caseDocs 必须在索引里真实存在。
		const caseCount = counts.get("cases") ?? 0;
		expect(caseCount).toBeGreaterThan(0);
		for (const id of SHIPPED_PRECEDENTS.flatMap(precedent => precedent.caseDocs)) {
			expect(library.entries.some(entry => entry.id === id), id).toBe(true);
		}
		expect(library.entries.length).toBe(310 + caseCount);
	});

	it("matches the committed checksum manifest entry for entry", () => {
		expect(manifest.length).toBe(library.entries.length);
		for (const entry of library.entries) expect(manifest).toContain(`${entry.sha256}  ${entry.id}.md`);
	});

	it("gives every document a title and a non-empty body path", () => {
		for (const entry of library.entries) {
			expect(entry.title.length, entry.id).toBeGreaterThan(0);
			expect(entry.path.startsWith("src/content/docs/"), entry.id).toBe(true);
			expect(entry.bytes, entry.id).toBeGreaterThan(0);
		}
		expect(library.totals.bytes).toBeGreaterThan(3_000_000);
	});

	it("indexes the machine-readable attachments beside the articles", () => {
		expect(library.totals.assets).toBe(5);
		expect(library.assets.map(entry => entry.id).sort()).toEqual([
			"kb/apk-reverse/techniques/kb-index.json",
			"kb/ctf-website/techniques/kb-index.json",
			"kb/general/techniques/kb-index.json",
			"kb/pe-reverse/techniques/kb-index.json",
			"kit-docs/tool-index.json",
		]);
		for (const entry of library.assets) {
			expect(entry.kind, entry.id).toBe("asset");
			expect(entry.bytes, entry.id).toBeGreaterThan(0);
			/** 附件不进导航树，避免 292 篇文章里混进五张表。 */
			expect(library.groups().flatMap(group => group.topics.flatMap(topic => topic.entries)).some(item => item.id === entry.id)).toBe(false);
		}
	});

	it("builds the navigation tree without empty groups", () => {
		const groups = library.groups();
		expect(groups.map(group => group.id)).toEqual(["kb", "manual", "kit-docs", "cases"]);
		for (const group of groups) {
			expect(group.topics.length).toBeGreaterThan(0);
			for (const topic of group.topics) expect(topic.entries.length).toBeGreaterThan(0);
		}
	});
});

describe("document loading", () => {
	it("loads a bundled body from the package", async () => {
		const entry = library.byId("kb/README");
		expect(entry).toBeDefined();
		const text = await library.loadBody("kb/README");
		expect(text.startsWith("# Knowledge Base")).toBe(true);
	});

	it("loads an attachment body through the same path", async () => {
		const text = await library.loadBody("kit-docs/tool-index.json");
		expect(JSON.parse(text).counts.total).toBe(42);
	});

	it("rejects an id that is not in the index", async () => {
		await expect(library.loadBody("kb/does-not-exist")).rejects.toThrow(/unknown document/);
	});
});

describe("long documents", () => {
	it("reads a part at a time, and the parts join back to the whole", async () => {
		// 最大的一篇 106 802 字符，远超单次上限 60 000：这正是「截断就是不全」原本的场景。
		const id = "kb/ctf-website/techniques/13-signature/03-key-attacks";
		const text = await library.loadBody(id);
		expect(text.length).toBeGreaterThan(MAX_DOC_BUDGET);

		let offset = 0;
		let rebuilt = "";
		for (let rounds = 0; rounds < 10; rounds += 1) {
			const slice = sliceDocument(text, offset, DEFAULT_DOC_BUDGET);
			rebuilt += slice.text;
			if (slice.nextOffset === null) break;
			// 每段都要有可读的进度：剩余大小与小节清单，而不是一句「已截断」。
			expect(partialNotice(slice, { id })).toContain("PARTIAL");
			offset = slice.nextOffset;
		}
		expect(rebuilt).toBe(text);
	});
});

describe("title search", () => {
	it("finds documents by title and path", () => {
		expect(library.searchTitles("payment").length).toBeGreaterThan(0);
		expect(library.searchTitles("12-payment").length).toBeGreaterThan(0);
		expect(library.searchTitles("   ").length).toBe(0);
	});

	it("respects the result limit", () => {
		expect(library.searchTitles("a", 5).length).toBeLessThanOrEqual(5);
	});
});

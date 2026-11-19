import { describe, expect, it } from "vitest";
import { DEFAULT_DOC_BUDGET, partialNotice, sliceDocument } from "../../domain/doc-slice";

/** 造一篇足够长的文档：每个小节都带一段正文，便于断言切点。 */
function longDoc(sections = 12, body = "正文一行。".repeat(200)): string {
	const parts = ["# 标题\n"];
	for (let index = 1; index <= sections; index += 1) {
		parts.push(`\n## 第 ${index} 节\n\n${body}\n`);
	}
	return parts.join("");
}

describe("sliceDocument", () => {
	it("returns the whole body when it fits the budget", () => {
		const text = "# 短文档\n\n只有几行。\n";
		const slice = sliceDocument(text, 0, DEFAULT_DOC_BUDGET);
		expect(slice.text).toBe(text);
		expect(slice.nextOffset).toBeNull();
		expect(slice.total).toBe(text.length);
		expect(partialNotice(slice, { id: "kb/x" })).toBe("");
	});

	it("concatenating successive slices reproduces the document byte for byte", () => {
		// 这是续读的唯一正确性保证：任何边界调整都不得让字面内容丢失或重复。
		const text = longDoc();
		let offset = 0;
		let rebuilt = "";
		let rounds = 0;
		for (;;) {
			const slice = sliceDocument(text, offset, 4000);
			rebuilt += slice.text;
			rounds += 1;
			expect(slice.start).toBe(offset);
			if (slice.nextOffset === null) break;
			expect(slice.nextOffset).toBe(slice.end);
			expect(slice.nextOffset).toBeGreaterThan(offset);
			offset = slice.nextOffset;
			expect(rounds).toBeLessThan(200);
		}
		expect(rebuilt).toBe(text);
		expect(rounds).toBeGreaterThan(1);
	});

	it("cuts on a markdown boundary rather than mid-sentence", () => {
		const text = longDoc();
		const slice = sliceDocument(text, 0, 4000);
		// 切点要么落在空行/标题前，要么是硬切；标题优先时片段应当以整段结尾。
		expect(slice.text.endsWith("\n")).toBe(true);
		expect(slice.text.length).toBeLessThanOrEqual(4000);
	});

	it("never leaves a fenced code block open", () => {
		const code = Array.from({ length: 120 }, (_, index) => `line ${index}`).join("\n");
		const text = `# 代码\n\n\`\`\`python\n${code}\n\`\`\`\n\n${"尾巴。".repeat(400)}`;
		const slice = sliceDocument(text, 0, 1200);
		const fences = slice.text.match(/^```/gm)?.length ?? 0;
		expect(fences % 2).toBe(0);
		// 仍然要切到有意义的长度，不能为了闭合围栏退回几个字符。
		expect(slice.text.length).toBeGreaterThan(600);
	});

	it("lists the headings that remain, with offsets that point at them", () => {
		const text = longDoc();
		const slice = sliceDocument(text, 0, 4000);
		expect(slice.outline.length).toBeGreaterThan(0);
		for (const entry of slice.outline) {
			expect(text.startsWith(entry.title, entry.offset)).toBe(true);
			expect(entry.offset).toBeGreaterThanOrEqual(slice.nextOffset ?? 0);
		}
		expect(slice.outline.map(entry => entry.title)).toEqual([...slice.outline.map(entry => entry.title)].sort((a, b) => {
			const left = Number(/(\d+)/.exec(a)?.[1] ?? 0);
			const right = Number(/(\d+)/.exec(b)?.[1] ?? 0);
			return left - right;
		}));
	});

	it("treats an offset past the end as a finished read instead of failing", () => {
		const text = "# 短\n\n内容\n";
		const slice = sliceDocument(text, text.length + 50, 1000);
		expect(slice.text).toBe("");
		expect(slice.nextOffset).toBeNull();
		expect(slice.start).toBe(text.length);
	});

	it("clamps the budget so a caller cannot ask for a sliver or an unbounded dump", () => {
		// 无换行的连续正文：没有边界可找，切点就是预算本身。
		const flat = "字".repeat(120_000);
		expect(sliceDocument(flat, 0, 1).text.length).toBe(500);
		expect(sliceDocument(flat, 0, 10_000_000).text.length).toBe(60_000);
	});
});

describe("partialNotice", () => {
	it("names the remaining size and a copy-ready continuation call", () => {
		const text = longDoc();
		const slice = sliceDocument(text, 0, 4000);
		const notice = partialNotice(slice, { id: "kb/demo", extraArgs: { maxChars: 4000 } });
		expect(notice).toContain("PARTIAL");
		expect(notice).toContain(`of ${text.length}`);
		expect(notice).toContain(`"id":"kb/demo"`);
		expect(notice).toContain(`"offset":${slice.nextOffset}`);
		expect(notice).toContain(`"maxChars":4000`);
		expect(notice).toContain("Next sections:");
	});

	it("stays quiet about sections when none remain", () => {
		const text = `# 只有标题\n\n${"正文。".repeat(600)}`;
		const slice = sliceDocument(text, 0, 500);
		const notice = partialNotice(slice, { id: "kb/plain" });
		expect(notice).toContain("PARTIAL");
		expect(notice).not.toContain("Next sections:");
	});
});

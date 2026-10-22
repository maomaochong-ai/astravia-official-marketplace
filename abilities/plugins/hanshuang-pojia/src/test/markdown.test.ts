import { describe, expect, it } from "vitest";
import { excerpt, parseInline, parseMarkdown, stripFrontmatter } from "../features/workbench/services/markdown";

describe("parseMarkdown", () => {
	it("splits headings, paragraphs and fenced code", () => {
		const blocks = parseMarkdown("# Title\n\nIntro line.\n\n```sh\nnmap -sV target\n```\n\n## Next\n");
		expect(blocks.map(block => block.kind)).toEqual(["heading", "paragraph", "code", "heading"]);
		const code = blocks[2];
		expect(code.kind === "code" && code.lang).toBe("sh");
		expect(code.kind === "code" && code.text).toBe("nmap -sV target");
	});

	it("keeps ordered and unordered lists apart", () => {
		const [unordered, ordered] = parseMarkdown("- one\n- two\n\n1. first\n2. second\n");
		expect(unordered.kind === "list" && unordered.ordered).toBe(false);
		expect(unordered.kind === "list" && unordered.items.length).toBe(2);
		expect(ordered.kind === "list" && ordered.ordered).toBe(true);
		expect(ordered.kind === "list" && ordered.items.length).toBe(2);
	});

	it("parses a table only when a divider row follows the header", () => {
		const withTable = parseMarkdown("| Area | Path |\n|---|---|\n| Web | ctf |\n| APK | dex |\n");
		expect(withTable.length).toBe(1);
		const table = withTable[0];
		expect(table.kind).toBe("table");
		expect(table.kind === "table" && table.head.length).toBe(2);
		expect(table.kind === "table" && table.rows.length).toBe(2);

		const withoutDivider = parseMarkdown("| not | a table |\njust text\n");
		expect(withoutDivider.some(block => block.kind === "table")).toBe(false);
	});

	it("treats a quote block as nested blocks", () => {
		const [quote] = parseMarkdown("> **Note**\n> keep this\n");
		expect(quote.kind).toBe("quote");
		expect(quote.kind === "quote" && quote.blocks.length).toBeGreaterThan(0);
	});

	it("drops frontmatter instead of reading it as a rule", () => {
		const source = "---\nname: x\n---\n\n# Real heading\n";
		expect(stripFrontmatter(source)).toBe("\n# Real heading\n");
		expect(parseMarkdown(source).map(block => block.kind)).toEqual(["heading"]);
	});

	it("limits links to safe schemes", () => {
		const [paragraph] = parseMarkdown("see [docs](https://example.com/a) and [bad](javascript:alert(1))");
		expect(paragraph.kind).toBe("paragraph");
		if (paragraph.kind !== "paragraph") return;
		expect(paragraph.inlines.filter(node => node.kind === "link")).toHaveLength(1);
		expect(paragraph.inlines.some(node => node.kind === "text" && node.text.includes("bad"))).toBe(true);
	});

	it("renders inline code, strong and emphasis", () => {
		expect(parseInline("run `aaa` then **patch** it")).toEqual([
			{ kind: "text", text: "run " },
			{ kind: "code", text: "aaa" },
			{ kind: "text", text: " then " },
			{ kind: "strong", text: "patch" },
			{ kind: "text", text: " it" },
		]);
		expect(parseInline("a *hint* here").some(node => node.kind === "em")).toBe(true);
		// 单独的星号不能吞掉后面的正文。
		expect(parseInline("2 * 3 = 6")).toEqual([{ kind: "text", text: "2 * 3 = 6" }]);
	});
});

describe("excerpt", () => {
	it("centres the window on the first hit and strips code fences", () => {
		const text = "# Doc\n\n```\nfiller\n```\nThe registry key lives under HKLM and nothing else matters here.";
		const snippet = excerpt(text, "HKLM", 40);
		expect(snippet).toContain("HKLM");
		expect(snippet).not.toContain("filler");
	});

	it("falls back to the head of the document when nothing matches", () => {
		expect(excerpt("# Doc\n\nbody", "absent", 20)).toContain("Doc body");
	});
});

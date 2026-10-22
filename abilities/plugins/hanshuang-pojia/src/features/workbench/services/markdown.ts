/**
 * 文档页用的 Markdown 解析器。
 *
 * 只覆盖工具包文档实际用到的语法：标题、段落、围栏代码块、有序/无序列表、
 * 表格、引用、分隔线，以及行内的代码、强调与链接。刻意不引入第三方解析器：
 * 这些文档随插件发布，渲染路径必须完全确定，也不该把 HTML 直接塞进 DOM。
 */

export type MdInline =
	| { kind: "text"; text: string }
	| { kind: "code"; text: string }
	| { kind: "strong"; text: string }
	| { kind: "em"; text: string }
	| { kind: "link"; text: string; href: string };

export type MdBlock =
	| { kind: "heading"; level: number; inlines: MdInline[] }
	| { kind: "paragraph"; inlines: MdInline[] }
	| { kind: "code"; lang: string; text: string }
	| { kind: "list"; ordered: boolean; items: MdInline[][] }
	| { kind: "table"; head: MdInline[][]; rows: MdInline[][][] }
	| { kind: "quote"; blocks: MdBlock[] }
	| { kind: "hr" };

const FENCE = /^\s*(?:>\s*)*```\s*([\w#+.-]*)\s*$/;
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const HR = /^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/;
const UL = /^\s*[-*+]\s+(.*)$/;
const OL = /^\s*\d+[.)]\s+(.*)$/;
const TABLE_DIVIDER = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/;
const QUOTE = /^\s*>\s?(.*)$/;

/** 只有这些协议会变成可点击链接；其余按纯文本渲染，避免文档里出现活的 javascript:。 */
const SAFE_HREF = /^(?:https?:\/\/|mailto:|#|\/|\.\/|\.\.\/)/i;

function splitRow(line: string): string[] {
	const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
	const cells: string[] = [];
	let current = "";
	let escaped = false;
	for (const char of trimmed) {
		if (escaped) {
			current += char;
			escaped = false;
			continue;
		}
		if (char === "\\") {
			escaped = true;
			continue;
		}
		if (char === "|") {
			cells.push(current.trim());
			current = "";
			continue;
		}
		current += char;
	}
	cells.push(current.trim());
	return cells;
}

export function parseInline(text: string): MdInline[] {
	const out: MdInline[] = [];
	let buffer = "";
	const pushText = () => {
		if (buffer) out.push({ kind: "text", text: buffer });
		buffer = "";
	};

	for (let index = 0; index < text.length; ) {
		const rest = text.slice(index);

		if (rest.startsWith("`")) {
			const end = text.indexOf("`", index + 1);
			if (end > index + 1) {
				pushText();
				out.push({ kind: "code", text: text.slice(index + 1, end) });
				index = end + 1;
				continue;
			}
		}

		if (rest.startsWith("**") || rest.startsWith("__")) {
			const marker = rest.slice(0, 2);
			const end = text.indexOf(marker, index + 2);
			if (end > index + 2) {
				pushText();
				out.push({ kind: "strong", text: text.slice(index + 2, end) });
				index = end + 2;
				continue;
			}
		}

		if (rest.startsWith("[")) {
			const close = text.indexOf("](", index);
			const end = close < 0 ? -1 : text.indexOf(")", close);
			if (close > index && end > close) {
				const label = text.slice(index + 1, close);
				const href = text.slice(close + 2, end).trim().split(/\s+/)[0];
				pushText();
				if (SAFE_HREF.test(href)) out.push({ kind: "link", text: label, href });
				else out.push({ kind: "text", text: label });
				index = end + 1;
				continue;
			}
		}

		if (rest.startsWith("*") || rest.startsWith("_")) {
			const marker = rest[0];
			// 避免把 2*3 之类的普通字符当成强调：必须紧邻非空白且后面能闭合。
			const next = text[index + 1] ?? "";
			if (next && !/\s/.test(next)) {
				const end = text.indexOf(marker, index + 2);
				if (end > index + 2 && !/\s/.test(text[end - 1])) {
					pushText();
					out.push({ kind: "em", text: text.slice(index + 1, end) });
					index = end + 1;
					continue;
				}
			}
		}

		buffer += text[index];
		index += 1;
	}

	pushText();
	return out.length > 0 ? out : [{ kind: "text", text }];
}

/** 去掉 YAML frontmatter，避免把 --- 误判成水平线。 */
export function stripFrontmatter(source: string): string {
	if (!source.startsWith("---")) return source;
	const end = source.indexOf("\n---", 3);
	return end < 0 ? source : source.slice(end + 4).replace(/^\r?\n/, "");
}

export function parseMarkdown(source: string): MdBlock[] {
	const lines = stripFrontmatter(source).replace(/\r\n/g, "\n").split("\n");
	const blocks: MdBlock[] = [];
	let index = 0;

	while (index < lines.length) {
		const line = lines[index];

		if (!line.trim()) {
			index += 1;
			continue;
		}

		const fence = FENCE.exec(line);
		if (fence) {
			const lang = fence[1] ?? "";
			const body: string[] = [];
			index += 1;
			while (index < lines.length && !/^\s*(?:>\s*)*```\s*$/.test(lines[index])) {
				body.push(lines[index]);
				index += 1;
			}
			index += 1;
			blocks.push({ kind: "code", lang, text: body.join("\n") });
			continue;
		}

		const heading = HEADING.exec(line);
		if (heading) {
			blocks.push({ kind: "heading", level: heading[1].length, inlines: parseInline(heading[2]) });
			index += 1;
			continue;
		}

		if (HR.test(line)) {
			blocks.push({ kind: "hr" });
			index += 1;
			continue;
		}

		if (QUOTE.test(line)) {
			const body: string[] = [];
			while (index < lines.length) {
				const match = QUOTE.exec(lines[index]);
				if (match) {
					body.push(match[1]);
					index += 1;
					continue;
				}
				if (lines[index].trim() && body.length > 0 && !HR.test(lines[index])) {
					// 引用块内允许没有 > 前缀的续行。
					body.push(lines[index]);
					index += 1;
					continue;
				}
				break;
			}
			blocks.push({ kind: "quote", blocks: parseMarkdown(body.join("\n")) });
			continue;
		}

		if (line.includes("|") && index + 1 < lines.length && TABLE_DIVIDER.test(lines[index + 1])) {
			const head = splitRow(line).map(parseInline);
			index += 2;
			const rows: MdInline[][][] = [];
			while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
				rows.push(splitRow(lines[index]).map(parseInline));
				index += 1;
			}
			blocks.push({ kind: "table", head, rows });
			continue;
		}

		if (UL.test(line) || OL.test(line)) {
			const ordered = OL.test(line);
			const items: MdInline[][] = [];
			while (index < lines.length) {
				const match = ordered ? OL.exec(lines[index]) : UL.exec(lines[index]);
				if (!match) break;
				items.push(parseInline(match[1]));
				index += 1;
				// 列表项下的缩进续行并入同一项。
				while (index < lines.length && /^\s{2,}\S/.test(lines[index]) && !UL.test(lines[index]) && !OL.test(lines[index])) {
					items[items.length - 1] = parseInline(`${match[1]} ${lines[index].trim()}`);
					index += 1;
				}
			}
			blocks.push({ kind: "list", ordered, items });
			continue;
		}

		const paragraph: string[] = [];
		while (index < lines.length && lines[index].trim() && !FENCE.test(lines[index]) && !HEADING.test(lines[index]) && !HR.test(lines[index]) && !QUOTE.test(lines[index]) && !UL.test(lines[index]) && !OL.test(lines[index])) {
			paragraph.push(lines[index].trim());
			index += 1;
		}
		if (paragraph.length > 0) blocks.push({ kind: "paragraph", inlines: parseInline(paragraph.join(" ")) });
		else index += 1;
	}

	return blocks;
}

/** 在正文里找一行命中，用来给搜索结果做片段。 */
export function excerpt(source: string, needle: string, width = 140): string {
	const flat = stripFrontmatter(source).replace(/```[\s\S]*?```/g, " ").replace(/\s+/g, " ").trim();
	const at = flat.toLowerCase().indexOf(needle.toLowerCase());
	if (at < 0) return flat.slice(0, width);
	const start = Math.max(0, at - Math.floor(width / 3));
	return `${start > 0 ? "…" : ""}${flat.slice(start, start + width)}${start + width < flat.length ? "…" : ""}`;
}

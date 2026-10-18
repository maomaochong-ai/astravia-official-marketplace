/**
 * .docx → Markdown.
 *
 * Word processing markup is a stream of paragraphs, runs and tables inside
 * `word/document.xml`; bold/italic/colour are presentation, so only structure
 * that survives a text conversion is kept: headings, list items, line breaks,
 * tabs and tables.
 */

import { readText, ZipError } from "./zip";

const XML_ENTITIES: Record<string, string> = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: '"',
	apos: "'",
};

export function decodeXmlText(raw: string): string {
	return raw.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
		if (entity.startsWith("#x") || entity.startsWith("#X")) {
			const code = Number.parseInt(entity.slice(2), 16);
			return Number.isFinite(code) ? String.fromCodePoint(code) : match;
		}
		if (entity.startsWith("#")) {
			const code = Number.parseInt(entity.slice(1), 10);
			return Number.isFinite(code) ? String.fromCodePoint(code) : match;
		}
		return XML_ENTITIES[entity] ?? match;
	});
}

/** Visible text of one run container, with tabs and hard breaks preserved. */
function runText(xml: string): string {
	let text = "";
	const pattern = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\s*\/>|<w:br\s*\/>|<w:cr\s*\/>/g;
	for (const match of xml.matchAll(pattern)) {
		if (match[1] !== undefined) text += decodeXmlText(match[1]);
		else if (match[0].startsWith("<w:tab")) text += "\t";
		else text += "\n";
	}
	return text;
}

function headingPrefix(paragraph: string): string {
	const style = /<w:pStyle\s+w:val="([^"]+)"/.exec(paragraph)?.[1] ?? "";
	const heading = /^heading\s*(\d)$/i.exec(style);
	if (heading) return `${"#".repeat(Math.min(6, Number(heading[1])))} `;
	if (/^title$/i.test(style)) return "# ";
	if (/^subtitle$/i.test(style)) return "## ";
	return "";
}

function isListItem(paragraph: string): boolean {
	return /<w:numPr>/.test(paragraph);
}

function tableToMarkdown(table: string): string {
	const rows: string[][] = [];
	for (const row of table.match(/<w:tr[\s\S]*?<\/w:tr>/g) ?? []) {
		const cells: string[] = [];
		for (const cell of row.match(/<w:tc[\s\S]*?<\/w:tc>/g) ?? []) {
			cells.push(runText(cell).replace(/\s*\n\s*/g, " ").trim().replace(/\|/g, "\\|"));
		}
		if (cells.length > 0) rows.push(cells);
	}
	if (rows.length === 0) return "";
	const width = Math.max(...rows.map((row) => row.length));
	const padded = rows.map((row) => [...row, ...Array(width - row.length).fill("")]);
	const [header, ...body] = padded;
	const lines = [
		`| ${header.join(" | ")} |`,
		`| ${header.map(() => "---").join(" | ")} |`,
		...body.map((row) => `| ${row.join(" | ")} |`),
	];
	return `${lines.join("\n")}\n`;
}

export interface DocxResult {
	markdown: string;
	headings: number;
}

const BLOCK = /<w:tbl(?:\s[^>]*)?>[\s\S]*?<\/w:tbl>|<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g;

export function docxToMarkdown(bodyXml: string): DocxResult {
	const blocks: string[] = [];
	let headings = 0;

	for (const match of bodyXml.matchAll(BLOCK)) {
		const block = match[0];
		if (block.startsWith("<w:tbl")) {
			const table = tableToMarkdown(block);
			if (table) blocks.push(table);
			continue;
		}
		const text = runText(block).replace(/\u00a0/g, " ");
		const prefix = headingPrefix(block);
		if (prefix) headings += 1;
		const bullet = !prefix && isListItem(block) ? "- " : "";
		const line = `${prefix}${bullet}${text}`.trimEnd();
		if (line.trim().length > 0) blocks.push(`${line}\n`);
	}

	return { markdown: collapseBlankLines(blocks.join("\n")), headings };
}

function collapseBlankLines(markdown: string): string {
	return markdown.replace(/\n{3,}/g, "\n\n").trim();
}

/** Reads `word/document.xml` (strict OOXML uses `document2.xml`). */
export async function readDocx(bytes: Uint8Array): Promise<DocxResult> {
	const xml =
		(await readText(bytes, "word/document.xml")) ??
		(await readText(bytes, "word/document2.xml"));
	if (!xml) {
		throw new ZipError("This .docx has no word/document.xml", "missing");
	}
	const body = /<w:body[^>]*>([\s\S]*)<\/w:body>/.exec(xml)?.[1] ?? xml;
	return docxToMarkdown(body);
}

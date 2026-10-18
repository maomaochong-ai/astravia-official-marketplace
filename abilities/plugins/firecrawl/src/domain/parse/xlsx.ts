/**
 * .xlsx → Markdown.
 *
 * A workbook is a small relational store: `sharedStrings.xml` holds the string
 * pool, `workbook.xml` says which sheet lives in which part, and each worksheet
 * is a sparse grid of `<c r="B7">` cells. The converter resolves those three
 * layers and emits one Markdown table per sheet, keeping formulas visible as
 * `=SUM(A1:A3)` when a cell carries one.
 */

import { readText, listEntries, readEntry, ZipError } from "./zip";
import { decodeXmlText } from "./docx";

const MAX_ROWS = 5_000;
const MAX_COLUMNS = 60;

function columnIndex(reference: string): number {
	const letters = /^([A-Z]+)/.exec(reference.toUpperCase())?.[1] ?? "";
	let index = 0;
	for (const letter of letters) index = index * 26 + (letter.charCodeAt(0) - 64);
	return index - 1;
}

export function sharedStrings(xml: string): string[] {
	const values: string[] = [];
	for (const item of xml.match(/<si\b[\s\S]*?<\/si>/g) ?? []) {
		let text = "";
		for (const run of item.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) text += decodeXmlText(run[1]);
		values.push(text);
	}
	return values;
}

interface SheetRef {
	name: string;
	part: string;
}

function workbookSheets(workbookXml: string, relsXml: string): SheetRef[] {
	const targets = new Map<string, string>();
	for (const match of relsXml.matchAll(/<Relationship\b[^>]*>/g)) {
		const tag = match[0];
		const id = /\bId="([^"]+)"/.exec(tag)?.[1];
		const target = /\bTarget="([^"]+)"/.exec(tag)?.[1];
		if (id && target) targets.set(id, target);
	}
	const sheets: SheetRef[] = [];
	for (const match of workbookXml.matchAll(/<sheet\b[^>]*>/g)) {
		const tag = match[0];
		const name = decodeXmlText(/\bname="([^"]*)"/.exec(tag)?.[1] ?? "Sheet");
		const relId = /\br:id="([^"]+)"/.exec(tag)?.[1] ?? "";
		const target = targets.get(relId);
		if (!target) continue;
		const part = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;
		sheets.push({ name, part: part.replace(/^xl\/xl\//, "xl/") });
	}
	return sheets;
}

function cellValue(attributes: string, body: string, strings: readonly string[]): string {
	const type = /\bt="([^"]+)"/.exec(attributes)?.[1] ?? "";
	const raw = /<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(body)?.[1];
	if (type === "inlineStr") {
		let text = "";
		for (const run of body.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) text += decodeXmlText(run[1]);
		return text;
	}
	if (raw === undefined) return "";
	const value = decodeXmlText(raw);
	if (type === "s") {
		const index = Number(value);
		return Number.isInteger(index) ? (strings[index] ?? "") : "";
	}
	if (type === "b") return value === "1" ? "TRUE" : "FALSE";
	const formula = /<f(?:\s[^>]*)?>([\s\S]*?)<\/f>/.exec(body)?.[1];
	if (formula) return `=${decodeXmlText(formula)}`;
	return value;
}

export function worksheetToMarkdown(xml: string, strings: readonly string[]): { markdown: string; rows: number } {
	const grid: string[][] = [];
	for (const rowMatch of xml.matchAll(/<row\b[^>]*\/>|<row\b[^>]*>[\s\S]*?<\/row>/g)) {
		if (grid.length >= MAX_ROWS) break;
		const cells: string[] = [];
		for (const cell of rowMatch[0].matchAll(/<c\b[^>]*\/>|<c\b[^>]*>[\s\S]*?<\/c>/g)) {
			const tag = cell[0];
			const open = /^<c\b([^>]*?)\/?>/.exec(tag)?.[1] ?? "";
			const reference = /\br="([A-Z]+\d+)"/.exec(open)?.[1] ?? "";
			const index = reference ? columnIndex(reference) : cells.length;
			if (index >= MAX_COLUMNS) continue;
			const body = tag.endsWith("/>") ? "" : tag.slice(tag.indexOf(">") + 1, tag.lastIndexOf("</c>"));
			const value = cellValue(open, body, strings).replace(/\s*\n\s*/g, " ").trim().replace(/\|/g, "\\|");
			while (cells.length < index) cells.push("");
			cells[index] = value;
		}
		if (cells.some((cell) => cell.length > 0)) grid.push(cells);
	}
	if (grid.length === 0) return { markdown: "", rows: 0 };

	const width = Math.max(...grid.map((row) => row.length));
	const padded = grid.map((row) => [...row, ...Array(width - row.length).fill("")]);
	const [header, ...body] = padded;
	const lines = [
		`| ${header.join(" | ")} |`,
		`| ${header.map(() => "---").join(" | ")} |`,
		...body.map((row) => `| ${row.join(" | ")} |`),
	];
	return { markdown: `${lines.join("\n")}\n`, rows: grid.length };
}

export interface XlsxResult {
	markdown: string;
	sheets: string[];
}

export async function readXlsx(bytes: Uint8Array): Promise<XlsxResult> {
	const names = new Set(listEntries(bytes).map((entry) => entry.name));
	const workbookXml = (await readText(bytes, "xl/workbook.xml")) ?? "";
	const relsXml = (await readText(bytes, "xl/_rels/workbook.xml.rels")) ?? "";
	if (!workbookXml) throw new ZipError("This .xlsx has no xl/workbook.xml", "missing");

	const stringsXml = names.has("xl/sharedStrings.xml") ? ((await readText(bytes, "xl/sharedStrings.xml")) ?? "") : "";
	const strings = sharedStrings(stringsXml);
	const sheets = workbookSheets(workbookXml, relsXml);
	const sections: string[] = [];

	for (const sheet of sheets) {
		const entry = listEntries(bytes).find((candidate) => candidate.name === sheet.part);
		if (!entry) continue;
		const xml = new TextDecoder("utf-8").decode(await readEntry(bytes, entry));
		const table = worksheetToMarkdown(xml, strings);
		if (!table.markdown) continue;
		sections.push(`## ${sheet.name}\n\n${table.markdown}`);
	}

	if (sections.length === 0) throw new ZipError("This .xlsx has no readable worksheet", "missing");
	return { markdown: sections.join("\n"), sheets: sheets.map((sheet) => sheet.name) };
}

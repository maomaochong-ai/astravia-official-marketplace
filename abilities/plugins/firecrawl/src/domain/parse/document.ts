/**
 * Document dispatch: which parser a URL belongs to, and how bytes become text.
 *
 * PDFs keep using the pdfjs path (layout-aware text extraction); office formats
 * go through the OOXML readers above. Anything else is treated as text and
 * decoded as UTF-8, mirroring how the HTTP engine already handles `text/*`.
 */

import { extractPdfText } from "../pdf/pdf";
import { readDocx } from "./docx";
import { readXlsx } from "./xlsx";
import { ZipError } from "./zip";

export type DocumentKind = "pdf" | "docx" | "xlsx" | "text" | "unknown";

const EXTENSIONS: ReadonlyArray<[DocumentKind, readonly string[]]> = [
	["pdf", [".pdf"]],
	["docx", [".docx", ".docm"]],
	["xlsx", [".xlsx", ".xlsm", ".xls"]],
];

const MIME: ReadonlyArray<[DocumentKind, readonly string[]]> = [
	["pdf", ["application/pdf"]],
	[
		"docx",
		["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword"],
	],
	[
		"xlsx",
		[
			"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			"application/vnd.ms-excel",
		],
	],
];

export function documentKind(url: string, contentType = ""): DocumentKind {
	const type = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
	for (const [kind, types] of MIME) {
		if (types.some((candidate) => type === candidate)) return kind;
	}
	let pathname = url;
	try {
		pathname = new URL(url).pathname.toLowerCase();
	} catch {
		pathname = url.toLowerCase();
	}
	for (const [kind, extensions] of EXTENSIONS) {
		if (extensions.some((extension) => pathname.endsWith(extension))) return kind;
	}
	if (type.startsWith("text/") || type === "application/json" || type === "application/xml") return "text";
	return "unknown";
}

/** `application/x-msword` etc. cannot be parsed as OOXML; say so instead of guessing. */
export function isLegacyOffice(url: string, contentType = ""): boolean {
	const type = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
	const path = url.toLowerCase();
	return type === "application/msword" || type === "application/vnd.ms-excel" || /\.(doc|xls)$/.test(path);
}

export interface ParsedDocument {
	markdown: string;
	/** Parser that produced the text, shown to the user. */
	parser: DocumentKind;
	/** Extra detail, e.g. sheet names or page count. */
	detail?: string;
}

function base64ToBytes(base64: string): Uint8Array {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
	return bytes;
}

export async function parseDocument(
	bytes: Uint8Array,
	kind: DocumentKind,
): Promise<ParsedDocument> {
	if (kind === "docx") {
		const result = await readDocx(bytes);
		return { markdown: result.markdown, parser: "docx", detail: `${result.headings} headings` };
	}
	if (kind === "xlsx") {
		const result = await readXlsx(bytes);
		return {
			markdown: result.markdown,
			parser: "xlsx",
			detail: result.sheets.length > 0 ? result.sheets.join(", ") : undefined,
		};
	}
	throw new ZipError(`No local parser for ${kind}`, "unsupported");
}

export async function parseDocumentBase64(base64: string, kind: DocumentKind): Promise<ParsedDocument> {
	if (kind === "pdf") {
		const result = await extractPdfText(base64);
		return {
			markdown: result.text,
			parser: "pdf",
			detail: `${result.pages} page${result.pages === 1 ? "" : "s"}`,
		};
	}
	if (kind === "text") {
		return { markdown: new TextDecoder("utf-8").decode(base64ToBytes(base64)), parser: "text" };
	}
	return parseDocument(base64ToBytes(base64), kind);
}

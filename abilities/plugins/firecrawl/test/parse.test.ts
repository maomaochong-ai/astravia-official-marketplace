import { describe, expect, it } from "vitest";
import { listEntries, readText, ZipError } from "../src/domain/parse/zip";
import { readDocx } from "../src/domain/parse/docx";
import { readXlsx } from "../src/domain/parse/xlsx";
import { documentKind, parseDocumentBase64 } from "../src/domain/parse/document";
import { coerceSelectors, extractAttributes } from "../src/domain/html/attributes";

/**
 * Store-only ZIP writer. The reader never validates CRCs, so a stored archive
 * built by hand is a faithful fixture and needs no compression library.
 */
function zip(entries: Record<string, string>): Uint8Array {
	const encoder = new TextEncoder();
	const chunks: Uint8Array[] = [];
	const central: Uint8Array[] = [];
	let offset = 0;

	for (const [name, text] of Object.entries(entries)) {
		const nameBytes = encoder.encode(name);
		const data = encoder.encode(text);
		const local = new Uint8Array(30 + nameBytes.length + data.length);
		const view = new DataView(local.buffer);
		view.setUint32(0, 0x04034b50, true);
		view.setUint16(4, 20, true);
		view.setUint16(6, 0, true);
		view.setUint16(8, 0, true);
		view.setUint32(14, 0, true);
		view.setUint32(18, data.length, true);
		view.setUint32(22, data.length, true);
		view.setUint16(26, nameBytes.length, true);
		local.set(nameBytes, 30);
		local.set(data, 30 + nameBytes.length);
		chunks.push(local);

		const header = new Uint8Array(46 + nameBytes.length);
		const headerView = new DataView(header.buffer);
		headerView.setUint32(0, 0x02014b50, true);
		headerView.setUint16(4, 20, true);
		headerView.setUint16(6, 20, true);
		headerView.setUint16(8, 0, true);
		headerView.setUint16(10, 0, true);
		headerView.setUint32(16, 0, true);
		headerView.setUint32(20, data.length, true);
		headerView.setUint32(24, data.length, true);
		headerView.setUint16(28, nameBytes.length, true);
		headerView.setUint32(42, offset, true);
		header.set(nameBytes, 46);
		central.push(header);

		offset += local.length;
	}

	const centralSize = central.reduce((total, chunk) => total + chunk.length, 0);
	const eocd = new Uint8Array(22);
	const eocdView = new DataView(eocd.buffer);
	eocdView.setUint32(0, 0x06054b50, true);
	eocdView.setUint16(8, central.length, true);
	eocdView.setUint16(10, central.length, true);
	eocdView.setUint32(12, centralSize, true);
	eocdView.setUint32(16, offset, true);

	const total = offset + centralSize + eocd.length;
	const output = new Uint8Array(total);
	let cursor = 0;
	for (const chunk of [...chunks, ...central, eocd]) {
		output.set(chunk, cursor);
		cursor += chunk.length;
	}
	return output;
}

const DOCX_XML = `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Quarterly report</w:t></w:r></w:p>
<w:p><w:r><w:t xml:space="preserve">Revenue grew </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>12%</w:t></w:r><w:r><w:t> year over year.</w:t></w:r></w:p>
<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/></w:numPr></w:pPr><w:r><w:t>First point</w:t></w:r></w:p>
<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Region</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Revenue</w:t></w:r></w:p></w:tc></w:tr>
<w:tr><w:tc><w:p><w:r><w:t>EMEA</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>1.2M</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
</w:body></w:document>`;

describe("zip reader", () => {
	it("lists and reads stored entries", async () => {
		const bytes = zip({ "word/document.xml": DOCX_XML, "hello.txt": "hi" });
		expect(listEntries(bytes).map((entry) => entry.name)).toEqual(["word/document.xml", "hello.txt"]);
		expect(await readText(bytes, "hello.txt")).toBe("hi");
		expect(await readText(bytes, "missing.xml")).toBeNull();
	});

	it("rejects a non-zip payload", () => {
		expect(() => listEntries(new Uint8Array([1, 2, 3, 4]))).toThrow(ZipError);
	});
});

describe("docx", () => {
	it("keeps headings, runs, list items and tables", async () => {
		const result = await readDocx(zip({ "word/document.xml": DOCX_XML }));
		expect(result.headings).toBe(1);
		expect(result.markdown).toContain("# Quarterly report");
		expect(result.markdown).toContain("Revenue grew 12% year over year.");
		expect(result.markdown).toContain("- First point");
		expect(result.markdown).toContain("| Region | Revenue |");
		expect(result.markdown).toContain("| EMEA | 1.2M |");
	});
});

const SHARED = `<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="3" uniqueCount="3">
<si><t>Region</t></si><si><t>Revenue</t></si><si><t>EMEA</t></si></sst>`;
const SHEET = `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>
<row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>1200000</v></c></row>
</sheetData></worksheet>`;
const WORKBOOK = `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Revenue" sheetId="1" r:id="rId1"/></sheets></workbook>`;
const RELS = `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`;

describe("xlsx", () => {
	it("resolves shared strings and renders one section per sheet", async () => {
		const result = await readXlsx(
			zip({
				"xl/workbook.xml": WORKBOOK,
				"xl/_rels/workbook.xml.rels": RELS,
				"xl/sharedStrings.xml": SHARED,
				"xl/worksheets/sheet1.xml": SHEET,
			}),
		);
		expect(result.sheets).toEqual(["Revenue"]);
		expect(result.markdown).toContain("## Revenue");
		expect(result.markdown).toContain("| Region | Revenue |");
		expect(result.markdown).toContain("| EMEA | 1200000 |");
	});
});

describe("document dispatch", () => {
	it("prefers content type, then the URL extension", () => {
		expect(documentKind("https://x.test/a", "application/pdf")).toBe("pdf");
		expect(documentKind("https://x.test/a.docx")).toBe("docx");
		expect(documentKind("https://x.test/a.XLSX")).toBe("xlsx");
		expect(documentKind("https://x.test/a.html", "text/html")).toBe("text");
		expect(documentKind("https://x.test/a.bin")).toBe("unknown");
	});

	it("reads a docx from base64", async () => {
		const bytes = zip({ "word/document.xml": DOCX_XML });
		const base64 = btoa(String.fromCharCode(...bytes));
		const parsed = await parseDocumentBase64(base64, "docx");
		expect(parsed.parser).toBe("docx");
		expect(parsed.markdown).toContain("# Quarterly report");
	});
});

const PAGE = `<html><head><title>t</title></head><body>
<a href="/docs/a" class="nav">A</a>
<a href="https://other.test/b" class="nav">B</a>
<a href="/docs/a" class="nav">A again</a>
<h2>Heading one</h2><h2>Heading two</h2>
<meta name="description" content="desc here">
</body></html>`;

describe("attributes format", () => {
	it("coerces selector strings", () => {
		expect(coerceSelectors("a@href, h2")).toEqual([
			{ selector: "a", attribute: "href" },
			{ selector: "h2", attribute: "text" },
		]);
		expect(coerceSelectors([{ selector: "img", attribute: "src" }, "a@href"])).toEqual([
			{ selector: "img", attribute: "src" },
			{ selector: "a", attribute: "href" },
		]);
	});

	it("resolves URLs, dedupes and keeps text", () => {
		const [hrefs, headings, description] = extractAttributes(PAGE, "https://site.test/docs/", [
			{ selector: "a.nav", attribute: "href" },
			{ selector: "h2", attribute: "text" },
			{ selector: "meta[name=description]", attribute: "content" },
		]);
		expect(hrefs.values).toEqual(["https://site.test/docs/a", "https://other.test/b"]);
		expect(headings.values).toEqual(["Heading one", "Heading two"]);
		expect(description.values).toEqual(["desc here"]);
	});

	it("survives an invalid selector", () => {
		expect(extractAttributes(PAGE, "https://site.test/", [{ selector: "a[[", attribute: "href" }])).toEqual([]);
	});
});

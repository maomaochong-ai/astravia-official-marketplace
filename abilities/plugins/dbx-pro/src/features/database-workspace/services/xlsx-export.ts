/**
 * 最小 XLSX（Excel）导出 —— 零第三方依赖。
 *
 * dbx 桌面壳的结果导出含 XLSX；插件包体积受控，不引入 SheetJS（~900KB），
 * 而是手工拼装最小 OOXML 包并用 STORE（不压缩）方式封成 ZIP：
 *   [Content_Types].xml、_rels/.rels、xl/workbook.xml、
 *   xl/_rels/workbook.xml.rels、xl/worksheets/sheet1.xml
 * 单元格用 inlineStr（Excel / WPS / LibreOffice / Numbers 均支持），
 * 免掉 sharedStrings 表。数字裸写，布尔走 t="b"，null / undefined 留空。
 */

// ─── CRC32（ZIP 校验必需，多项式 0xEDB88320）─────────────────────────
const CRC_TABLE = (() => {
	const table = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) {
			c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		}
		table[n] = c >>> 0;
	}
	return table;
})();

function crc32(bytes: Uint8Array): number {
	let crc = 0xffffffff;
	for (let i = 0; i < bytes.length; i++) {
		crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
	}
	return (crc ^ 0xffffffff) >>> 0;
}

const encoder = new TextEncoder();

/** Excel 表名：≤31 字符且不得含 : \\ / ? * [ ]。 */
function safeSheetName(name: string): string {
	const cleaned = name.replace(/[:\\/?*[\]]/g, "_").slice(0, 31) || "Sheet1";
	return cleaned;
}

function escapeXml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");
}

/** 0 → A、25 → Z、26 → AA。XLSX 列号从 1 开始，这里入参用 0 基。 */
function columnLetter(index: number): string {
	let n = index;
	let out = "";
	do {
		out = String.fromCharCode(65 + (n % 26)) + out;
		n = Math.floor(n / 26) - 1;
	} while (n >= 0);
	return out;
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

/** 构造 sheet1.xml 的一行。 */
function sheetRow(rowIndex: number, values: string[]): string {
	// rowIndex 为 1 基行号；values 已序列化为 XML 单元格片段。
	return `<row r="${rowIndex}">${values.join("")}</row>`;
}

function buildSheetXml(cols: string[], rows: Record<string, unknown>[], sheetName: string): string {
	const headerCells = cols.map(
		(col, i) =>
			`<c r="${columnLetter(i)}1" t="inlineStr"><is><t xml:space="preserve">${escapeXml(col)}</t></is></c>`,
	);
	const bodyRows = rows.map((row, ri) => {
		const rowNum = ri + 2;
		const cells = cols.map((col, ci) => {
			const ref = `${columnLetter(ci)}${rowNum}`;
			const value = row[col];
			if (value === null || value === undefined) return "";
			if (isFiniteNumber(value)) return `<c r="${ref}"><v>${String(value)}</v></c>`;
			if (typeof value === "boolean") return `<c r="${ref}" t="b"><v>${value ? 1 : 0}</v></c>`;
			const text = typeof value === "object" ? JSON.stringify(value) : String(value);
			return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`;
		});
		return sheetRow(rowNum, cells);
	});

	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRow(
		1,
		headerCells,
	)}${bodyRows.join("")}</sheetData></worksheet>`;
}

interface ZipFile {
	name: string;
	data: Uint8Array;
}

/** 多文件封成 STORE（无压缩）ZIP；标志位 0x0800 表示文件名按 UTF-8 解码。 */
function buildZip(files: ZipFile[]): Uint8Array<ArrayBuffer> {
	const chunks: Uint8Array[] = [];
	const central: Uint8Array[] = [];
	let offset = 0;
	const DOS_TIME = 0;
	const DOS_DATE = 0x21; // 1980-01-01，固定值避免取本地时区。

	for (const file of files) {
		const nameBytes = encoder.encode(file.name);
		const crc = crc32(file.data);
		const size = file.data.length;

		const local = new DataView(new ArrayBuffer(30));
		local.setUint32(0, 0x04034b50, true); // local file header signature
		local.setUint16(4, 20, true); // version needed
		local.setUint16(6, 0x0800, true); // flags: UTF-8 names
		local.setUint16(8, 0, true); // compression: stored
		local.setUint16(10, DOS_TIME, true);
		local.setUint16(12, DOS_DATE, true);
		local.setUint32(14, crc, true);
		local.setUint32(18, size, true); // compressed size
		local.setUint32(22, size, true); // uncompressed size
		local.setUint16(26, nameBytes.length, true);
		local.setUint16(28, 0, true); // extra len

		chunks.push(new Uint8Array(local.buffer), nameBytes, file.data);

		const centralHeader = new DataView(new ArrayBuffer(46));
		centralHeader.setUint32(0, 0x02014b50, true); // central file signature
		centralHeader.setUint16(4, 20, true); // version made by
		centralHeader.setUint16(6, 20, true); // version needed
		centralHeader.setUint16(8, 0x0800, true);
		centralHeader.setUint16(10, 0, true);
		centralHeader.setUint16(12, DOS_TIME, true);
		centralHeader.setUint16(14, DOS_DATE, true);
		centralHeader.setUint32(16, crc, true);
		centralHeader.setUint32(20, size, true);
		centralHeader.setUint32(24, size, true);
		centralHeader.setUint16(28, nameBytes.length, true);
		centralHeader.setUint16(30, 0, true); // extra
		centralHeader.setUint16(32, 0, true); // comment
		centralHeader.setUint16(34, 0, true); // disk number
		centralHeader.setUint16(36, 0, true); // internal attrs
		centralHeader.setUint32(38, 0, true); // external attrs
		centralHeader.setUint32(42, offset, true); // local header offset
		central.push(new Uint8Array(centralHeader.buffer), nameBytes);

		offset += 30 + nameBytes.length + size;
	}

	const centralSize = central.reduce((sum, chunk) => sum + chunk.length, 0);
	const centralOffset = offset;
	const eocd = new DataView(new ArrayBuffer(22));
	eocd.setUint32(0, 0x06054b50, true); // end of central directory
	eocd.setUint16(4, 0, true);
	eocd.setUint16(6, 0, true);
	eocd.setUint16(8, files.length, true);
	eocd.setUint16(10, files.length, true);
	eocd.setUint32(12, centralSize, true);
	eocd.setUint32(16, centralOffset, true);
	eocd.setUint16(20, 0, true);

	return concatBytes([...chunks, ...central, new Uint8Array(eocd.buffer)]);
}

function concatBytes(parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
	const total = parts.reduce((sum, p) => sum + p.length, 0);
	const out = new Uint8Array(new ArrayBuffer(total));
	let pos = 0;
	for (const part of parts) {
		out.set(part, pos);
		pos += part.length;
	}
	return out;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

function buildWorkbookXml(sheetName: string): string {
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escapeXml(
		sheetName,
	)}" sheetId="1" r:id="rId1"/></sheets></workbook>`;
}

const WORKBOOK_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`;

/**
 * 生成查询结果的 XLSX 字节。
 * @param cols 列名（同时是表头行）
 * @param rows 数据行
 * @param sheetName 工作表名（自动清洗到 Excel 合法范围）
 */
export function toXlsx(
	cols: string[],
	rows: Record<string, unknown>[],
	sheetName = "query_result",
): Uint8Array<ArrayBuffer> {
	const name = safeSheetName(sheetName);
	const files: ZipFile[] = [
		{ name: "[Content_Types].xml", data: encoder.encode(CONTENT_TYPES) },
		{ name: "_rels/.rels", data: encoder.encode(ROOT_RELS) },
		{ name: "xl/workbook.xml", data: encoder.encode(buildWorkbookXml(name)) },
		{ name: "xl/_rels/workbook.xml.rels", data: encoder.encode(WORKBOOK_RELS) },
		{ name: "xl/worksheets/sheet1.xml", data: encoder.encode(buildSheetXml(cols, rows, name)) },
	];
	return buildZip(files);
}

/**
 * PDF text extraction.
 *
 * firecrawl parses PDFs server-side (`parsePDF: true`). A plugin has no such
 * service, so this runs Mozilla's pdf.js in the renderer: the text layer is
 * extracted per page, and a PDF without a text layer (a scan) is reported as
 * such instead of being returned as an empty page.
 *
 * pdf.js and its worker are loaded on demand — a plugin that never sees a PDF
 * pays nothing for this module.
 */

const MAX_PAGES = 100;
const MAX_CHARS = 400_000;

export interface PdfText {
	text: string;
	pages: number;
	/** Pages whose text layer was empty (scans need OCR). */
	emptyPages: number;
	title: string;
}

export async function extractPdfText(base64: string, options: { maxPages?: number } = {}): Promise<PdfText> {
	const maxPages = Math.min(options.maxPages ?? MAX_PAGES, MAX_PAGES);
	const pdfjs = await loadPdfjs();
	const data = decodeBase64(base64);

	let doc;
	try {
		doc = await pdfjs.getDocument({
			data,
			useWorkerFetch: false,
			isEvalSupported: false,
			useSystemFonts: true,
		}).promise;
	} catch (error) {
		throw new Error(`PDF could not be opened: ${error instanceof Error ? error.message : String(error)}`);
	}

	const pageCount = Math.min(doc.numPages, maxPages);
	const chunks: string[] = [];
	let emptyPages = 0;
	for (let index = 1; index <= pageCount; index += 1) {
		const page = await doc.getPage(index);
		const content = await page.getTextContent();
		const text = content.items
			.map((item) => ("str" in item ? item.str : ""))
			.join(" ")
			.replace(/[ \t]+/g, " ")
			.trim();
		if (!text) {
			emptyPages += 1;
			continue;
		}
		chunks.push(text);
	}
	try {
		await doc.destroy();
	} catch {
		// pdf.js tears down lazily; a failure here does not affect the text.
	}

	let title = "";
	try {
		const metadata = await doc.getMetadata();
		const info = metadata.info as { Title?: string } | undefined;
		title = (info?.Title ?? "").trim();
	} catch {
		// Metadata is optional in the spec.
	}

	return {
		text: chunks.join("\n\n").slice(0, MAX_CHARS),
		pages: pageCount,
		emptyPages,
		title,
	};
}

interface PdfjsModule {
	getDocument: (source: Record<string, unknown>) => { promise: Promise<PdfDocument> };
	GlobalWorkerOptions: { workerSrc: string };
}

interface PdfDocument {
	numPages: number;
	getPage: (index: number) => Promise<{ getTextContent: () => Promise<{ items: Array<{ str?: string }> }> }>;
	getMetadata: () => Promise<{ info?: unknown }>;
	destroy: () => Promise<void>;
}

async function loadPdfjs(): Promise<PdfjsModule> {
	const [pdfjs, worker] = await Promise.all([
		import("pdfjs-dist/legacy/build/pdf.mjs") as unknown as Promise<PdfjsModule>,
		import("./pdf-worker-url"),
	]);
	// Without a worker source pdf.js refuses to start in the renderer.
	if (typeof Worker !== "undefined" && worker.default) pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
	return pdfjs;
}

function decodeBase64(base64: string): Uint8Array {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
	return bytes;
}

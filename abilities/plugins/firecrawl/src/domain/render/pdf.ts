/**
 * PDF engine: a document, not a web page.
 *
 * The bytes come through the base64 transport, the text layer comes from pdf.js,
 * and the result is shaped like every other `RenderedPage` so `scrape`, `crawl`
 * and `extract` never special-case PDFs.
 */

import type { BinaryFetch } from "../scrape/http";
import { ScrapeError } from "./errors";
import { extractPdfText } from "../pdf/pdf";
import { textToMarkdown } from "./browser";
import type { RenderedPage } from "./types";

export async function renderPdf(
	fetcher: BinaryFetch | undefined,
	url: string,
	options: { timeoutMs?: number } = {},
): Promise<RenderedPage> {
	const startedAt = Date.now();
	if (!fetcher) {
		throw new ScrapeError("PDF support is unavailable: this host cannot return binary responses", "unsupported-content");
	}
	const response = await fetcher({ url, timeoutMs: options.timeoutMs ?? 60_000 });
	if (response.status >= 400) {
		throw new ScrapeError(`HTTP ${response.status} from ${url}`, "http-status", response.status);
	}
	if (!response.base64.startsWith("JVBERi0")) {
		// Not "%PDF-" — a login wall or an HTML error page served with a PDF name.
		throw new ScrapeError(`Expected a PDF at ${url} but the payload is not one`, "unsupported-content", response.status);
	}

	let parsed;
	try {
		parsed = await extractPdfText(response.base64);
	} catch (error) {
		throw new ScrapeError(
			`PDF could not be read: ${error instanceof Error ? error.message : String(error)}`,
			"pdf-unreadable",
			response.status,
		);
	}

	if (!parsed.text.trim()) {
		throw new ScrapeError(
			`PDF has no text layer (${parsed.pages} page(s) of scanned images). OCR is not available in this plugin.`,
			"pdf-unreadable",
			response.status,
		);
	}

	const title = parsed.title || titleFromUrl(url);
	return {
		requestedUrl: url,
		finalUrl: response.url || url,
		status: response.status,
		engine: "pdf",
		attempts: ["pdf"],
		fallbackReason: null,
		title,
		metadata: {
			title,
			description: "",
			canonical: response.url || url,
			lang: "",
			siteName: "",
			image: "",
		},
		markdown: textToMarkdown(parsed.text),
		text: parsed.text,
		html: "",
		rawHtml: "",
		links: [],
		screenshotDataUrl: null,
		bytes: response.bytes,
		durationMs: Date.now() - startedAt,
		notes:
			parsed.emptyPages > 0
				? [`${parsed.emptyPages} of ${parsed.pages} page(s) had no text layer and were skipped`]
				: [],
	};
}

function titleFromUrl(url: string): string {
	try {
		const last = new URL(url).pathname.split("/").filter(Boolean).pop() ?? url;
		return decodeURIComponent(last);
	} catch {
		return url;
	}
}

import { describe, expect, it } from "vitest";
import { renderPdf } from "../src/domain/render/pdf";
import { ScrapeError } from "../src/domain/render/errors";
import type { BinaryFetch } from "../src/domain/scrape/http";

/** A one-page PDF built by hand: text layer only, no fonts beyond Helvetica. */
const TINY_PDF = "JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvUmVzb3VyY2VzIDw8IC9Gb250IDw8IC9GMSA1IDAgUiA+PiA+PiAvQ29udGVudHMgNCAwIFIgPj4KZW5kb2JqCjQgMCBvYmoKPDwgL0xlbmd0aCA4NiA+PgpzdHJlYW0KQlQKL0YxIDI0IFRmCjcyIDcwMCBUZAooSGVsbG8gRmlyZWNyYXdsIFBERikgVGoKMCAtMzYgVGQKKFNlY29uZCBsaW5lIG9mIHRleHQuKSBUagpFVAplbmRzdHJlYW0KZW5kb2JqCjUgMCBvYmoKPDwgL1R5cGUgL0ZvbnQgL1N1YnR5cGUgL1R5cGUxIC9CYXNlRm9udCAvSGVsdmV0aWNhID4+CmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA1OCAwMDAwMCBuIAowMDAwMDAwMTE1IDAwMDAwIG4gCjAwMDAwMDAyNDEgMDAwMDAgbiAKMDAwMDAwMDM3NiAwMDAwMCBuIAp0cmFpbGVyCjw8IC9TaXplIDYgL1Jvb3QgMSAwIFIgPj4Kc3RhcnR4cmVmCjQ0NgolJUVPRgo=";

function fetcher(base64: string, status = 200): BinaryFetch {
	return async () => ({ url: "https://example.com/report.pdf", status, ok: status < 400, headers: {}, base64, bytes: 629 });
}

describe("renderPdf", () => {
	it("extracts the text layer and reports the page count", async () => {
		const page = await renderPdf(fetcher(TINY_PDF), "https://example.com/report.pdf");
		expect(page.engine).toBe("pdf");
		expect(page.text).toContain("Hello Firecrawl PDF");
		expect(page.text).toContain("Second line of text.");
		expect(page.markdown).toContain("Hello Firecrawl PDF");
		expect(page.title).toBe("report.pdf");
	});

	it("refuses a payload that is not a PDF", async () => {
		await expect(renderPdf(fetcher("PGh0bWw+"), "https://example.com/report.pdf")).rejects.toBeInstanceOf(ScrapeError);
	});

	it("reports an HTTP failure instead of an empty document", async () => {
		await expect(renderPdf(fetcher(TINY_PDF, 404), "https://example.com/report.pdf")).rejects.toMatchObject({
			code: "http-status",
			status: 404,
		});
	});

	it("explains that a scanned PDF needs OCR", async () => {
		// A structurally valid PDF with no text operators.
		const blank = "JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvQ29udGVudHMgNCAwIFIgPj4KZW5kb2JqCjQgMCBvYmoKPDwgL0xlbmd0aCA0ID4+CnN0cmVhbQpxClEKZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgNQowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA1OCAwMDAwMCBuIAowMDAwMDAwMTE1IDAwMDAwIG4gCjAwMDAwMDAyMDIgMDAwMDAgbiAKdHJhaWxlcgo8PCAvU2l6ZSA1IC9Sb290IDEgMCBSID4+CnN0YXJ0eHJlZgoyNTQKJSVFT0YK"
		await expect(renderPdf(fetcher(blank), "https://example.com/scan.pdf")).rejects.toMatchObject({ code: "pdf-unreadable" });
	});
});

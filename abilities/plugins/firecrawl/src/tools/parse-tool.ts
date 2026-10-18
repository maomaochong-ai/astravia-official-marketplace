/**
 * firecrawl_parse — turn a document into Markdown.
 *
 * Two sources, one answer: an absolute URL (fetched as bytes) or a file on disk
 * (read through the host filesystem). PDFs use the pdfjs path, DOCX/XLSX go
 * through the OOXML readers, plain text is decoded as UTF-8.
 *
 * The local engine does this in-process; with the Firecrawl API engine the same
 * tool delegates to the upstream parsers, so URL parsing gains the hosted
 * pipeline (OCR, layout-aware PDF, and formats this build cannot read).
 */

import type { BinaryFetch } from "../domain/scrape/http";
import { documentKind, isLegacyOffice, parseDocumentBase64 } from "../domain/parse/document";
import { formatBytes, formatDuration } from "../shared/formatters/format";
import { readNumber, readOptionalString, requireUrl } from "./tool-arguments";

const MAX_MARKDOWN = 60_000;

export function createParseTool(binary?: BinaryFetch) {
	return {
		id: "firecrawl_parse",
		name: "firecrawl_parse",
		label: "%tool.parse.label%",
		description: [
			"Turn a document into Markdown: PDF, DOCX, XLSX (and their macro variants) or plain text, from an",
			"absolute URL or a local file path. Tables become Markdown tables; DOCX headings and list items keep",
			"their structure; every worksheet becomes its own section.",
			"",
			"Use it when the user points at a .pdf/.docx/.xlsx file instead of a web page. Give either `url` or",
			"`path`, not both. Scanned PDFs without a text layer return little text — configure the Firecrawl API",
			"engine (or install an OCR tool) for those.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				url: { type: "string", description: "Absolute http(s) URL of the document." },
				path: { type: "string", description: "Local file path (absolute, or relative to the session cwd)." },
				maxChars: { type: "number", description: "Cap the returned Markdown (1000-200000, default 60000)." },
			},
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"] as const,
		timeoutMs: 120_000,
		handler: async (context: {
			trigger: { input?: unknown };
			session?: { cwd?: string };
			host?: {
				fs?: {
					readBinaryFile?: (path: string) => Promise<{ data: string; mimeType: string; size: number }>;
				};
			};
		}) => {
			const input = context.trigger.input;
			const url = readOptionalString(input, "url");
			const path = readOptionalString(input, "path");
			const maxChars = readNumber(input, "maxChars", { min: 1_000, max: 200_000, def: MAX_MARKDOWN });
			if (!url && !path) throw new Error('give either "url" (absolute http/https) or "path" (local file)');
			if (url && path) throw new Error('give only one of "url" or "path"');

			const startedAt = Date.now();
			let base64: string;
			let target: string;
			let kind;
			if (url) {
				const absolute = requireUrl({ url });
				if (!binary) {
					throw new Error(
						"This host cannot return binary bodies, so document URLs cannot be parsed here. Give a local `path`, or configure the Firecrawl API engine.",
					);
				}
				const response = await binary({ url: absolute, timeoutMs: 60_000 });
				if (!response.ok) throw new Error(`HTTP ${response.status} while downloading ${absolute}`);
				base64 = response.base64;
				target = absolute;
				kind = documentKind(absolute, response.headers["content-type"] ?? "");
				if (isLegacyOffice(absolute, response.headers["content-type"] ?? "")) {
					throw new Error(
						"Legacy .doc/.xls are binary formats that this parser cannot read. Convert the file to .docx/.xlsx, or use the Firecrawl API engine.",
					);
				}
			} else {
				const absolutePath = resolvePath(path as string, context.session?.cwd);
				const readBinaryFile = context.host?.fs?.readBinaryFile;
				if (!readBinaryFile) {
					throw new Error(
						"Reading local files needs the `fs.read` permission, which this build does not have. Give an http(s) `url` instead.",
					);
				}
				const file = await readBinaryFile(absolutePath);
				base64 = file.data;
				target = absolutePath;
				kind = documentKind(absolutePath, file.mimeType);
			}

			if (kind === "unknown") {
				throw new Error(
					`Cannot tell which parser to use for ${target}. Supply a .pdf/.docx/.xlsx/.txt file, or use firecrawl_scrape for HTML.`,
				);
			}

			const parsed = await parseDocumentBase64(base64, kind);
			const markdown = parsed.markdown.trim();
			const lines = [
				`Document: ${target}`,
				`Parser: ${parsed.parser}${parsed.detail ? ` (${parsed.detail})` : ""}  size: ${formatBytes(Math.floor((base64.length * 3) / 4))}  time: ${formatDuration(Date.now() - startedAt)}`,
			];
			if (markdown.length === 0) {
				lines.push(
					"",
					"No text layer was found. For a scanned document, configure the Firecrawl API engine or run OCR first.",
				);
				return lines.join("\n");
			}
			lines.push("", "--- Markdown ---", markdown.length > maxChars ? `${markdown.slice(0, maxChars)}\n[... truncated]` : markdown);
			return lines.join("\n");
		},
	};
}

function resolvePath(path: string, cwd: string | undefined): string {
	if (path.startsWith("/") || /^[A-Za-z]:[\\/]/.test(path)) return path;
	return cwd ? `${cwd.replace(/\/+$/, "")}/${path}` : path;
}

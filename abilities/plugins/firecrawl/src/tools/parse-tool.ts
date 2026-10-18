/**
 * firecrawl_parse — a local document through `/v2/parse`.
 *
 * The file never leaves the machine except as the multipart body of this one
 * request: the host reads the bytes, we encode them, the API returns Markdown.
 */

import { describeDocument } from "../domain/firecrawl/documents";
import type { ToolDeps } from "./deps";
import { mimeForFile, parseBody } from "./request-bodies";
import { documentArtifact } from "../domain/firecrawl/artifacts";
import { readOptionalString, readString } from "./tool-arguments";

/** Base64 inflates by ~4/3; the host caps a request body at 32 MiB. */
const MAX_FILE_BYTES = 20 * 1024 * 1024;

const SUPPORTED = ["pdf", "docx", "doc", "xlsx", "xls", "csv", "pptx", "html", "txt", "md", "json", "rtf", "epub"];

export function createParseTool({ ctx, config, store }: ToolDeps) {
	return {
		id: "firecrawl_parse",
		name: "firecrawl_parse",
		label: "%tool.parse.label%",
		description: [
			"Turn a local document into Markdown: PDF, Word, Excel, PowerPoint, CSV, HTML, text, Markdown or EPUB.",
			"Firecrawl parses the file (including scanned PDFs) and returns the same document shape as a web",
			"page, so you can quote it directly.",
			"",
			"Use it when the user points at a file in the project instead of a URL. Web pages — even PDFs",
			"behind a URL — go through firecrawl_scrape, which is cheaper because nothing has to be uploaded.",
			"",
			"Limits: one file per call, up to 20 MB. The path must be readable by the plugin (inside the",
			"project or a path the user attached).",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				path: { type: "string", description: "Path to the local document to parse." },
				formats: {
					type: "array",
					items: { type: "string", enum: ["markdown", "html", "rawHtml", "links", "summary", "json"] },
					description: "Extra outputs to return alongside Markdown.",
				},
				onlyMainContent: { type: "boolean", description: "Drop headers, footers and page furniture. Default true." },
				prompt: { type: "string", description: "Extract JSON from the document instead of only returning Markdown." },
				schema: { type: "object", description: "JSON Schema for the extracted object; pair it with `prompt`." },
			},
			required: ["path"],
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"] as const,
		context: { conversation: "summary" },
		timeoutMs: 180_000,
		handler: async (context: { trigger: { input?: unknown } }) => {
			const input = context.trigger.input;
			const filePath = readString(input, "path") ?? readString(input, "file");
			if (!filePath) throw new Error('"path" is required: the local document to parse');
			const extension = filePath.split(".").pop()?.toLowerCase() ?? "";
			if (!SUPPORTED.includes(extension)) {
				throw new Error(`Unsupported file type ".${extension}". Supported: ${SUPPORTED.join(", ")}.`);
			}

			const binary = await ctx.fs.readBinaryFile(filePath);
			if (binary.size > MAX_FILE_BYTES) {
				throw new Error(`The file is ${Math.round(binary.size / 1024 / 1024)} MB; the limit is 20 MB.`);
			}

			const fileName = filePath.split(/[\\/]/).pop() ?? `document.${extension}`;
			const body = parseBody(input, {
				fileName,
				mimeType: binary.mimeType || mimeForFile(fileName),
				data: binary.data,
			});
			const prompt = readOptionalString(input, "prompt");
			if (prompt) {
				const options = JSON.parse(body.fields.options) as Record<string, unknown>;
				const formats = Array.isArray(options.formats) ? options.formats : [];
				options.formats = [...formats.filter((entry) => entry !== "json"), { type: "json", prompt }];
				body.fields.options = JSON.stringify(options);
			}

			const client = await config.require();
			const started = Date.now();
			try {
				const document = await client.upload(body);
				store.note("ok", `parse  ${fileName}  ${document.markdown?.length ?? 0} chars`);
				// Parsed files join the shelf too, so a document the agent read stays
				// re-consumable in the console without another upload.
				store.recordArtifact(documentArtifact(fileName, document, Date.now()));
				return describeDocument(
					{ ...document, url: document.url ?? fileName },
					client.endpoint,
					Date.now() - started,
				);
			} catch (error) {
				store.note("error", `parse  ${fileName}  ${error instanceof Error ? error.message : String(error)}`);
				throw error;
			}
		},
	};
}

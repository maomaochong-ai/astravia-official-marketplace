import { describe, expect, it, vi } from "vitest";
import type { PluginContext } from "@astravia-org/plugin-sdk";
import type { FirecrawlClient, FirecrawlDocument } from "../src/domain/firecrawl/types";
import type { CrawlRunStore } from "../src/features/crawler-console/services/crawl-run-store";
import type { FirecrawlConfig } from "../src/runtime/config";
import { createParseTool } from "../src/tools/parse-tool";

function document(): FirecrawlDocument {
	return {
		url: "https://api.firecrawl.dev/v2/parse",
		title: "Quarterly report",
		markdown: "# Quarter\n\nRevenue rose.",
		metadata: { statusCode: 200 },
	} as FirecrawlDocument;
}

function harness(options: { size?: number; upload?: () => Promise<FirecrawlDocument> } = {}) {
	const upload = vi.fn(options.upload ?? (async (_body: unknown) => document()));
	const note = vi.fn();
	const recordArtifact = vi.fn();
	const readBinaryFile = vi.fn(async (path: string) => ({
		data: Buffer.from("%PDF-1.4").toString("base64"),
		mimeType: "application/pdf",
		size: options.size ?? 1_024,
		path,
	}));

	const tool = createParseTool({
		ctx: { fs: { readBinaryFile } } as unknown as PluginContext,
		config: {
			require: async () => ({ upload, endpoint: "https://api.firecrawl.dev" }) as unknown as FirecrawlClient,
		} as unknown as FirecrawlConfig,
		store: { note, recordArtifact } as unknown as CrawlRunStore,
	});

	return { tool, upload, note, recordArtifact, readBinaryFile };
}

describe("firecrawl_parse", () => {
	it("uploads one local file and shelves the parsed document", async () => {
		const { tool, upload, note, recordArtifact } = harness();

		const result = await tool.handler({ trigger: { input: { path: "/work/quarterly.pdf" } } });

		expect(upload).toHaveBeenCalledTimes(1);
		const body = upload.mock.calls[0]![0] as unknown as {
			files: Array<{ fileName: string }>;
			fields: Record<string, string>;
		};
		expect(body.files[0]?.fileName).toBe("quarterly.pdf");
		expect(result).toContain("Quarterly report");
		expect(note).toHaveBeenCalledWith("ok", expect.stringContaining("quarterly.pdf"));

		const artifact = recordArtifact.mock.calls[0]![0] as { kind: string; title: string };
		expect(artifact.kind).toBe("document");
		expect(artifact.title).toBe("quarterly.pdf");
	});

	it("refuses a file type the endpoint does not accept", async () => {
		const { tool, upload } = harness();

		await expect(tool.handler({ trigger: { input: { path: "/work/archive.zip" } } })).rejects.toThrow(
			/Unsupported file type/,
		);
		expect(upload).not.toHaveBeenCalled();
	});

	it("refuses a file over the upload cap before reading the API", async () => {
		const { tool, upload, readBinaryFile } = harness({ size: 21 * 1024 * 1024 });

		await expect(tool.handler({ trigger: { input: { path: "/work/huge.pdf" } } })).rejects.toThrow(/limit is 20 MB/);
		expect(readBinaryFile).toHaveBeenCalled();
		expect(upload).not.toHaveBeenCalled();
	});

	it("logs the upstream error and does not shelve anything", async () => {
		const { tool, note, recordArtifact } = harness({
			upload: async () => {
				throw new Error("upstream said no");
			},
		});

		await expect(tool.handler({ trigger: { input: { path: "/work/quarterly.pdf" } } })).rejects.toThrow(
			"upstream said no",
		);
		expect(note).toHaveBeenCalledWith("error", expect.stringContaining("upstream said no"));
		expect(recordArtifact).not.toHaveBeenCalled();
	});
});

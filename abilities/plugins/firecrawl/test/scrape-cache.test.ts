import { describe, expect, it } from "vitest";
import { scrapePage } from "../src/domain/scrape/pipeline";
import type { HttpClient, HttpResponse } from "../src/domain/scrape/http";
import type { CachedPage, PageCache } from "../src/domain/scrape/cache";
import { cacheAgeSeconds, cacheKey, isFresh } from "../src/domain/scrape/cache";
import { describeChanges } from "../src/domain/scrape/change";
import { toBase64 } from "../src/domain/scrape/base64";
import { readHeaders, ToolArgumentError } from "../src/tools/tool-arguments";

const ARTICLE = `<!doctype html>
<html lang="en"><head><title>Release notes</title></head>
<body><main><article>
<h1>Release notes</h1>
<p>Version 2 adds a batch endpoint.</p>
<img src="/media/shot.png" alt="Console screenshot">
</article></main></body></html>`;

function html(body: string): HttpResponse {
	return {
		url: "https://example.com/notes",
		status: 200,
		ok: true,
		headers: { "content-type": "text/html; charset=utf-8" },
		body,
		durationMs: 5,
		bytes: body.length,
	};
}

function cacheOf(entries: Record<string, CachedPage> = {}): PageCache & { writes: string[] } {
	const writes: string[] = [];
	return {
		writes,
		async read(key) {
			return entries[key] ?? null;
		},
		async write(key) {
			writes.push(key);
		},
	};
}

function entry(overrides: Partial<CachedPage> = {}): CachedPage {
	return {
		url: "https://example.com/notes",
		finalUrl: "https://example.com/notes",
		status: 200,
		engine: "fetch",
		title: "Release notes",
		metadata: { title: "Release notes", description: "", canonical: "", lang: "en", siteName: "", image: "" },
		markdown: "# Release notes\n\nVersion 1.",
		text: "Release notes Version 1.",
		html: "<article></article>",
		rawHtml: "<article></article>",
		links: [],
		media: [],
		bytes: 100,
		storedAt: Date.now(),
		...overrides,
	};
}

describe("cacheKey", () => {
	it("is stable for the same request and different across URLs", () => {
		const base = { url: "https://example.com/a", render: "auto" as const };
		expect(cacheKey(base)).toBe(cacheKey({ ...base }));
		expect(cacheKey(base)).not.toBe(cacheKey({ url: "https://example.com/b", render: "auto" }));
		expect(cacheKey(base)).toMatch(/^p[0-9a-f]{16}$/);
	});

	it("ignores formats that do not change the fetched page", () => {
		const url = "https://example.com/a";
		const plain = cacheKey({ url, formats: ["markdown"] });
		expect(cacheKey({ url, formats: ["markdown", "screenshot"] })).toBe(plain);
		expect(cacheKey({ url, formats: ["markdown", "changeTracking"] })).toBe(plain);
		// `html` does change what is produced from the payload, so it must not collide.
		expect(cacheKey({ url, formats: ["markdown", "html"] })).not.toBe(plain);
	});
});

describe("isFresh", () => {
	it("only reuses a copy younger than maxAge", () => {
		const page = entry({ storedAt: Date.now() - 60_000 });
		expect(isFresh(page, 0)).toBe(false);
		expect(isFresh(page, 30_000)).toBe(false);
		expect(isFresh(page, 120_000)).toBe(true);
		expect(cacheAgeSeconds(page)).toBeGreaterThanOrEqual(59);
	});
});

describe("describeChanges", () => {
	it("reports a first capture as new", () => {
		const report = describeChanges(null, null, "one\ntwo");
		expect(report.changeStatus).toBe("new");
		expect(report.diff).toEqual("");
	});

	it("reports identical text as same", () => {
		expect(describeChanges("one\ntwo", Date.now(), "one\ntwo").changeStatus).toBe("same");
	});

	it("lists added and removed lines", () => {
		const report = describeChanges("one\ntwo", Date.now(), "one\nthree");
		expect(report.changeStatus).toBe("changed");
		expect(report.addedLines).toBe(1);
		expect(report.removedLines).toBe(1);
		expect(report.diff).toContain("+ three");
		expect(report.diff).toContain("- two");
	});
});

describe("toBase64", () => {
	it("encodes non-Latin text without mangling it", () => {
		const encoded = toBase64("héllo 世界");
		expect(Buffer.from(encoded, "base64").toString("utf8")).toBe("héllo 世界");
	});
});

describe("scrapePage with a cache", () => {
	it("serves a fresh copy without touching the network", async () => {
		const key = keyFor();
		const cache = cacheOf({ [key]: entry() });
		let calls = 0;
		const client: HttpClient = async () => {
			calls += 1;
			return html(ARTICLE);
		};

		const result = await scrapePage(client, "https://example.com/notes", { maxAgeMs: 600_000 }, { cache });
		expect(calls).toBe(0);
		expect(result.markdown).toContain("Version 1.");
		expect(result.notes.join(" ")).toContain("plugin cache");
	});

	it("ignores a stored copy that belongs to another URL", async () => {
		const key = keyFor();
		const cache = cacheOf({ [key]: entry({ url: "https://example.com/other" }) });
		const result = await scrapePage(client(), "https://example.com/notes", { maxAgeMs: 600_000 }, { cache });
		expect(result.markdown).toContain("Version 2");
	});

	it("stores the result for the next call", async () => {
		const cache = cacheOf();
		await scrapePage(client(), "https://example.com/notes", {}, { cache });
		expect(cache.writes).toHaveLength(1);
	});

	it("skips the write when storeInCache is false", async () => {
		const cache = cacheOf();
		await scrapePage(client(), "https://example.com/notes", { storeInCache: false }, { cache });
		expect(cache.writes).toHaveLength(0);
	});

	it("diffs against the stored copy when changeTracking is on", async () => {
		const key = keyFor();
		const cache = cacheOf({ [key]: entry() });
		const result = await scrapePage(client(), "https://example.com/notes", { changeTracking: true }, { cache });
		const report = JSON.parse(result.outputs.changeTracking ?? "{}");
		expect(report.changeStatus).toBe("changed");
		expect(result.requestedFormats).toContain("changeTracking");
	});
});

describe("extra formats", () => {
	it("lists images as JSON", async () => {
		const result = await scrapePage(client(), "https://example.com/notes", { formats: ["images"] });
		const images = JSON.parse(result.outputs.images ?? "[]");
		expect(images).toContainEqual({ url: "https://example.com/media/shot.png", alt: "Console screenshot" });
	});

	it("returns the received body as base64", async () => {
		const result = await scrapePage(client(), "https://example.com/notes", { formats: ["rawBase64"] });
		expect(Buffer.from(result.outputs.rawBase64 ?? "", "base64").toString("utf8")).toContain("<title>Release notes</title>");
	});
});

describe("readHeaders", () => {
	it("accepts an object and a JSON string", () => {
		expect(readHeaders({ headers: { "accept-language": "de" } })).toEqual({ "accept-language": "de" });
		expect(readHeaders({ headers: '{"accept-language":"de"}' })).toEqual({ "accept-language": "de" });
		expect(readHeaders({})).toEqual({});
	});

	it("rejects line breaks and malformed names", () => {
		expect(() => readHeaders({ headers: { "x-test": "a\r\nb" } })).toThrow(ToolArgumentError);
		expect(() => readHeaders({ headers: { "bad name": "x" } })).toThrow(ToolArgumentError);
		expect(() => readHeaders({ headers: "[1,2]" })).toThrow(ToolArgumentError);
	});
});

/** Mirrors the identity the pipeline builds for a plain scrape. */
function keyFor(): string {
	return cacheKey({ url: "https://example.com/notes", render: "auto", formats: ["markdown"] });
}

function client(): HttpClient {
	return async () => html(ARTICLE);
}

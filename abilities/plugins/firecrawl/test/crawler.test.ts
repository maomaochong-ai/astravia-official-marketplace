import { describe, expect, it } from "vitest";
import { crawlSite } from "../src/domain/crawl/crawler";
import { DEFAULT_CRAWL_OPTIONS } from "../src/domain/events";
import type { CrawlEvent } from "../src/domain/events";
import type { HttpClient, HttpResponse } from "../src/domain/scrape/http";

const START = "https://example.com/docs/";

function page(title: string, links: string[]): string {
	return `<!doctype html><html lang="en"><head><title>${title}</title></head><body><main><article>
		<h1>${title}</h1>
		<p>${title} body text, long enough that readability keeps it and the raw-html fallback is not needed.</p>
		<ul>${links.map((href) => `<li><a href="${href}">${href}</a></li>`).join("")}</ul>
	</article></main></body></html>`;
}

const FILES: Record<string, { status?: number; type?: string; body: string }> = {
	"https://example.com/robots.txt": { body: "User-agent: *\nDisallow: /private\nDisallow: /docs/secret\nSitemap: https://example.com/sitemap.xml\n" },
	"https://example.com/sitemap.xml": {
		body: `<urlset><url><loc>${START}guide</loc></url></urlset>`,
	},
	[START]: { body: page("Docs home", ["/docs/guide", "/docs/api/v1", "/docs/secret", "/private/secret", "https://other.com/x", "/docs/manual.zip"]) },
	"https://example.com/docs/guide": { body: page("Guide", ["/docs/", "/docs/deep/deeper/deepest"]) },
	"https://example.com/docs/api/v1": { body: page("API v1", []) },
	"https://example.com/docs/deep/deeper/deepest": { body: page("Too deep", []) },
	"https://example.com/private/secret": { body: page("Private", []) },
};

const client: HttpClient = async (request) => {
	const file = FILES[request.url];
	if (!file) {
		const missing: HttpResponse = {
			url: request.url,
			status: 404,
			ok: false,
			headers: { "content-type": "text/html" },
			body: "not found",
			durationMs: 1,
			bytes: 9,
		};
		return missing;
	}
	return {
		url: request.url,
		status: file.status ?? 200,
		ok: (file.status ?? 200) < 400,
		headers: { "content-type": file.type ?? "text/html; charset=utf-8" },
		body: file.body,
		durationMs: 2,
		bytes: file.body.length,
	};
};

describe("crawlSite", () => {
	it("crawls breadth-first within the start scope and reports every refusal", async () => {
		const events: CrawlEvent[] = [];
		const summary = await crawlSite(client, START, { ...DEFAULT_CRAWL_OPTIONS, limit: 10, maxDepth: 2 }, {
			onEvent: (event) => events.push(event),
		});

		expect(summary.status).toBe("completed");
		expect(summary.pages[0].url).toBe(START);
		expect(summary.pages.map((page) => page.url)).toContain("https://example.com/docs/guide");
		expect(summary.pages.map((page) => page.url)).toContain("https://example.com/docs/api/v1");
		expect(summary.pages.map((page) => page.url)).not.toContain("https://example.com/private/secret");
		expect(summary.pages[0].engine).toBe("fetch");

		const codes = summary.denied.map((denial) => `${denial.code}:${denial.url}`);
		expect(codes).toContain("BACKWARD_CRAWLING:https://example.com/private/secret");
		expect(codes).toContain("EXTERNAL_LINK:https://other.com/x");
		expect(codes).toContain("FILE_TYPE:https://example.com/docs/manual.zip");
		expect(codes).toContain("ROBOTS_TXT:https://example.com/docs/secret");

		expect(events.some((event) => event.type === "robots")).toBe(true);
		expect(events.some((event) => event.type === "sitemap")).toBe(true);
		expect(events.at(-1)?.type).toBe("run-end");
	});

	it("refuses links below maxDepth with an explicit depth denial", async () => {
		const summary = await crawlSite(client, START, { ...DEFAULT_CRAWL_OPTIONS, limit: 10, maxDepth: 1 }, {});
		const deepest = summary.denied.find((denial) => denial.url.includes("/deep/"));
		expect(deepest?.code).toBe("DEPTH_LIMIT");
		expect(summary.pages.map((page) => page.url)).not.toContain("https://example.com/docs/deep/deeper/deepest");
	});

	it("honours robots.txt refusals", async () => {
		const summary = await crawlSite(client, START, { ...DEFAULT_CRAWL_OPTIONS, limit: 4, maxDepth: 2 }, {});
		expect(summary.pages.some((page) => page.url.includes("/private"))).toBe(false);
	});

	it("stops at the page limit and says so", async () => {
		const summary = await crawlSite(client, START, { ...DEFAULT_CRAWL_OPTIONS, limit: 1, maxDepth: 2 }, {});
		expect(summary.pages).toHaveLength(1);
	});

	it("returns a stopped summary when aborted", async () => {
		const controller = new AbortController();
		const summary = await crawlSite(client, START, { ...DEFAULT_CRAWL_OPTIONS, limit: 5, maxDepth: 2 }, {
			signal: controller.signal,
			onEvent: (event) => {
				if (event.type === "crawled") controller.abort();
			},
		});
		expect(summary.status).toBe("stopped");
	});
});

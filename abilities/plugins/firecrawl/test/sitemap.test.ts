import { describe, expect, it } from "vitest";
import { collectSitemapUrls, parseSitemap } from "../src/domain/crawl/sitemap";
import type { HttpClient, HttpResponse } from "../src/domain/scrape/http";

function response(url: string, body: string, status = 200): HttpResponse {
	return { url, status, ok: status < 400, headers: {}, body, durationMs: 1, bytes: body.length };
}

describe("parseSitemap", () => {
	it("extracts page URLs from a urlset", () => {
		const xml = `<?xml version="1.0"?><urlset><url><loc>https://example.com/a</loc></url><url><loc>https://example.com/b</loc></url></urlset>`;
		expect(parseSitemap(xml)).toEqual({ urls: ["https://example.com/a", "https://example.com/b"], children: [] });
	});

	it("recognises a sitemap index", () => {
		const xml = `<sitemapindex><sitemap><loc>https://example.com/sitemap-1.xml</loc></sitemap></sitemapindex>`;
		expect(parseSitemap(xml).children).toEqual(["https://example.com/sitemap-1.xml"]);
		expect(parseSitemap(xml).urls).toEqual([]);
	});

	it("decodes XML entities", () => {
		const xml = `<urlset><url><loc>https://example.com/a?x=1&amp;y=2</loc></url></urlset>`;
		expect(parseSitemap(xml).urls).toEqual(["https://example.com/a?x=1&y=2"]);
	});

	it("returns nothing for junk", () => {
		expect(parseSitemap("<html>nope</html>")).toEqual({ urls: [], children: [] });
	});
});

describe("collectSitemapUrls", () => {
	it("follows an index into child sitemaps", async () => {
		const files: Record<string, string> = {
			"https://example.com/sitemap.xml": `<sitemapindex><sitemap><loc>https://example.com/child.xml</loc></sitemap></sitemapindex>`,
			"https://example.com/child.xml": `<urlset><url><loc>https://example.com/a</loc></url><url><loc>https://example.com/b</loc></url></urlset>`,
		};
		const client: HttpClient = async (request) => response(request.url, files[request.url] ?? "");
		const result = await collectSitemapUrls(client, ["https://example.com/sitemap.xml"]);
		expect(result.urls).toEqual(["https://example.com/a", "https://example.com/b"]);
		expect(result.fetched).toBe(2);
	});

	it("skips unreachable sitemaps without failing the run", async () => {
		const client: HttpClient = async (request) => response(request.url, "", 500);
		const result = await collectSitemapUrls(client, ["https://example.com/sitemap.xml"]);
		expect(result.urls).toEqual([]);
	});

	it("stops at the URL limit", async () => {
		const body = `<urlset>${Array.from({ length: 20 }, (_, index) => `<url><loc>https://example.com/${index}</loc></url>`).join("")}</urlset>`;
		const client: HttpClient = async (request) => response(request.url, body);
		const result = await collectSitemapUrls(client, ["https://example.com/sitemap.xml"], { urlLimit: 5 });
		expect(result.urls).toHaveLength(5);
	});
});

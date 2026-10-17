import { describe, expect, it } from "vitest";
import { getCrawlScope, isWithinCrawlScope } from "../src/domain/crawl/scope";

describe("crawl scope", () => {
	it("keeps a directory start inside that directory", () => {
		const scope = getCrawlScope("https://example.com/docs/");
		expect(scope.prefix).toBe("/docs/");
		expect(isWithinCrawlScope("/docs/api", scope)).toBe(true);
		expect(isWithinCrawlScope("/blog/post", scope)).toBe(false);
	});

	it("treats a slashless start as its own subtree", () => {
		const scope = getCrawlScope("https://example.com/docs/intro");
		expect(isWithinCrawlScope("/docs/intro", scope)).toBe(true);
		expect(isWithinCrawlScope("/docs/intro/step-2", scope)).toBe(true);
		expect(isWithinCrawlScope("/docs/next", scope)).toBe(false);
		expect(isWithinCrawlScope("/blog", scope)).toBe(false);
	});

	it("widens a page-like start to its containing directory", () => {
		const scope = getCrawlScope("https://example.com/guide.html");
		expect(scope).toEqual({ prefix: "/", exact: null });
		expect(isWithinCrawlScope("/guide.html", scope)).toBe(true);
		expect(isWithinCrawlScope("/other", scope)).toBe(true);
	});

	it("falls back to the whole site for the root", () => {
		const scope = getCrawlScope("https://example.com/");
		expect(scope.prefix).toBe("/");
		expect(isWithinCrawlScope("/anything", scope)).toBe(true);
	});

	it("does not escape on a sibling with a shared prefix", () => {
		const scope = getCrawlScope("https://example.com/docs/");
		expect(isWithinCrawlScope("/docsets/x", scope)).toBe(false);
	});
});

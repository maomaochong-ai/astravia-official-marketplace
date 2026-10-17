import { describe, expect, it } from "vitest";
import { loadRobots, parseRobots } from "../src/domain/crawl/robots";
import type { HttpClient, HttpResponse } from "../src/domain/scrape/http";

function response(partial: Partial<HttpResponse>): HttpResponse {
	return {
		url: "https://example.com/robots.txt",
		status: 200,
		ok: true,
		headers: {},
		body: "",
		durationMs: 3,
		bytes: 0,
		...partial,
	};
}

function client(value: HttpResponse | Error): HttpClient {
	return async () => {
		if (value instanceof Error) throw value;
		return value;
	};
}

describe("parseRobots", () => {
	it("reads disallow rules, crawl-delay and sitemaps", () => {
		const policy = parseRobots(
			[
				"User-agent: *",
				"Disallow: /private",
				"Crawl-delay: 2",
				"Sitemap: https://example.com/sitemap.xml",
			].join("\n"),
			"https://example.com",
		);
		expect(policy.present).toBe(true);
		expect(policy.isAllowed("https://example.com/private/x")).toBe(false);
		expect(policy.isAllowed("https://example.com/docs")).toBe(true);
		expect(policy.crawlDelayMs).toBe(2000);
		expect(policy.sitemaps).toEqual(["https://example.com/sitemap.xml"]);
	});

	it("allows everything when the file has no rules", () => {
		const policy = parseRobots("", "https://example.com");
		expect(policy.isAllowed("https://example.com/anything")).toBe(true);
		expect(policy.ruleCount).toBe(0);
	});
});

describe("loadRobots", () => {
	it("treats a missing file as allow-all and records the status", async () => {
		const policy = await loadRobots(client(response({ status: 404, ok: false })), "https://example.com");
		expect(policy.isAllowed("https://example.com/x")).toBe(true);
		expect(policy.status).toBe(404);
		expect(policy.failedOpen).toBe(false);
	});

	it("fails open on a server error so one broken host does not stop the run", async () => {
		const policy = await loadRobots(client(response({ status: 503, ok: false })), "https://example.com");
		expect(policy.failedOpen).toBe(true);
		expect(policy.isAllowed("https://example.com/x")).toBe(true);
	});

	it("fails open on a transport error", async () => {
		const policy = await loadRobots(client(new Error("offline")), "https://example.com");
		expect(policy.failedOpen).toBe(true);
		expect(policy.present).toBe(false);
	});
});

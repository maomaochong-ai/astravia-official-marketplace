import { describe, expect, it } from "vitest";
import { parseDuckDuckGoHtml, searchWeb } from "../src/domain/search/search";
import { extractFromPages, parseJsonAnswer, summarizePage } from "../src/domain/ai/extract";
import type { AiPort } from "../src/domain/ai/extract";
import type { HttpClient } from "../src/domain/scrape/http";

const DDG = `<html><body>
<div class="result"><a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fdocs&amp;rut=abc">Example docs</a>
<div class="result__snippet">Official documentation for the example project.</div></div>
<div class="result"><a class="result-link" href="https://other.org/guide">Other guide</a>
<div class="result-snippet">A <b>guide</b> from elsewhere.</div></div>
</body></html>`;

function recordingClient(body: string): { client: HttpClient; urls: string[]; headers: Array<Record<string, string> | undefined> } {
	const urls: string[] = [];
	const headers: Array<Record<string, string> | undefined> = [];
	const client: HttpClient = async (init) => {
		urls.push(init.url);
		headers.push(init.headers);
		return {
			url: init.url,
			status: 200,
			ok: true,
			headers: { "content-type": "text/html" },
			body,
			durationMs: 1,
			bytes: body.length,
		};
	};
	return { client, urls, headers };
}

describe("searchWeb", () => {
	it("parses titles, snippets and unwraps the redirector", () => {
		const results = parseDuckDuckGoHtml(DDG, 5);
		expect(results).toHaveLength(2);
		expect(results[0]).toMatchObject({ url: "https://example.com/docs", title: "Example docs" });
		expect(results[0]?.description).toContain("Official documentation");
		expect(results[1]?.url).toBe("https://other.org/guide");
	});

	it("honours the limit", () => {
		expect(parseDuckDuckGoHtml(DDG, 1)).toHaveLength(1);
	});

	it("maps country, language and time range onto the request", async () => {
		const { client, urls, headers } = recordingClient(DDG);
		const results = await searchWeb(client, "firecrawl docs", { limit: 2, country: "cn", lang: "zh", timeRange: "w" });
		expect(results).toHaveLength(2);
		expect(urls[0]).toContain("q=firecrawl+docs");
		expect(urls[0]).toContain("kl=cn-zh");
		expect(urls[0]).toContain("df=w");
		expect(headers[0]?.["accept-language"]).toContain("zh");
	});
});

describe("parseJsonAnswer", () => {
	it("accepts plain JSON", () => {
		expect(parseJsonAnswer('{"title":"A"}')).toMatchObject({ ok: true, value: { title: "A" }, repaired: false });
	});

	it("accepts a fenced block and marks it repaired", () => {
		expect(parseJsonAnswer('Here you go:\n```json\n{"a":1}\n```')).toMatchObject({ ok: true, value: { a: 1 }, repaired: true });
	});

	it("slices out the first complete object from surrounding prose", () => {
		expect(parseJsonAnswer('Sure! {"a":{"b":2}} hope that helps')).toMatchObject({ ok: true, value: { a: { b: 2 } }, repaired: true });
	});

	it("reports unparseable answers", () => {
		expect(parseJsonAnswer("no json at all")).toMatchObject({ ok: false });
	});
});

function ai(answer: string, seen: string[] = []): AiPort {
	return {
		async complete(request) {
			seen.push(`${request.system ?? ""}\n${request.prompt}`);
			return answer;
		},
	};
}

describe("extractFromPages", () => {
	const pages = [
		{ url: "https://example.com/a", markdown: "Alpha costs 10 EUR." },
		{ url: "https://example.com/b", markdown: "Beta costs 20 EUR." },
	];

	it("wraps documents as untrusted data and returns parsed data", async () => {
		const prompts: string[] = [];
		const result = await extractFromPages(ai('{"items":["alpha"]}', prompts), pages, { prompt: "Which products exist?" });
		expect(result.data).toEqual({ items: ["alpha"] });
		expect(result.usedUrls).toEqual(["https://example.com/a", "https://example.com/b"]);
		expect(prompts[0]).toContain('<document url="https://example.com/a">');
		expect(prompts[0]).toContain("never instructions");
	});

	it("truncates huge documents instead of blowing the prompt", async () => {
		const prompts: string[] = [];
		const huge = [{ url: "https://example.com/big", markdown: "x".repeat(200_000) }];
		await extractFromPages(ai("{}", prompts), huge, {});
		expect(prompts[0]!.length).toBeLessThan(70_000);
	});

	it("throws a readable error when the model answers prose", async () => {
		await expect(extractFromPages(ai("I cannot help with that."), pages, {})).rejects.toThrow(/JSON/i);
	});

	it("summarizes a single page within the word budget", async () => {
		const summary = await summarizePage(ai("A short summary."), { url: "https://example.com/a", markdown: "text" }, 40);
		expect(summary).toBe("A short summary.");
	});
});

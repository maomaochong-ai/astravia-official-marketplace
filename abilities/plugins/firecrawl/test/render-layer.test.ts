import { describe, expect, it, vi } from "vitest";
import { scrapePage } from "../src/domain/scrape/pipeline";
import type { HttpClient, HttpResponse } from "../src/domain/scrape/http";
import { textToMarkdown, extractSnapshotLinks } from "../src/domain/render/browser";
import type { BrowserPort } from "../src/domain/render/types";
import { applyTagFilters, domText } from "../src/domain/html/tags";
import { parseHtml } from "../src/domain/html/document";

function response(body: string, headers: Record<string, string> = { "content-type": "text/html; charset=utf-8" }): HttpResponse {
	return { url: "https://example.com/", status: 200, ok: true, headers, body, durationMs: 3, bytes: body.length };
}

function client(body: string, headers?: Record<string, string>): HttpClient {
	return async () => response(body, headers);
}

function browserPort(text: string, options: { title?: string; snapshot?: string; failOpen?: boolean } = {}): {
	port: BrowserPort;
	actions: string[];
	closed: () => boolean;
} {
	const actions: string[] = [];
	let closed = false;
	const port: BrowserPort = {
		async open(url) {
			if (options.failOpen) throw new Error("runtime missing");
			return { url, title: options.title ?? "Rendered" };
		},
		async act(action) {
			actions.push(action.type);
		},
		async readText() {
			return text;
		},
		async snapshot() {
			return options.snapshot ?? "";
		},
		async screenshot() {
			return "data:image/png;base64,AAAA";
		},
		async close() {
			closed = true;
		},
	};
	return { port, actions, closed: () => closed };
}

const SHELL = `<!doctype html><html><head><title>App</title></head><body><div id="root"></div><script src="/a.js"></script></body></html>`;

describe("scrapePage rendering", () => {
	it("escalates a JavaScript shell to the browser and keeps the server metadata", async () => {
		const { port, closed } = browserPort(
			"Real content from the rendered app.\n\nSecond paragraph, long enough to be useful for an agent.",
			{ title: "App" },
		);
		const result = await scrapePage(client(SHELL), "https://example.com/app", {}, { browser: async () => port });
		expect(result.rendered).toBe(true);
		expect(result.engine).toBe("browser");
		expect(result.markdown).toContain("Real content from the rendered app");
		expect(result.attempts).toEqual(expect.arrayContaining(["fetch", "browser"]));
		expect(closed()).toBe(true);
	});

	it("stays on the static engine for content-rich pages", async () => {
		const rich = `<html><body><article><h1>Docs</h1><p>${"Useful sentence. ".repeat(40)}</p></article></body></html>`;
		const factory = vi.fn(async () => browserPort("never").port);
		const result = await scrapePage(client(rich), "https://example.com/docs", {}, { browser: factory });
		expect(factory).not.toHaveBeenCalled();
		expect(result.rendered).toBe(false);
		expect(result.engine).toBe("fetch");
	});

	it("explains why an empty page stayed empty when the browser is unavailable", async () => {
		await expect(
			scrapePage(
			client(SHELL),
			"https://example.com/app",
			{},
				{
					browser: async () => {
						throw new Error("browser runtime is not installed");
					},
				},
			),
		).rejects.toMatchObject({ code: "empty-content" });
	});

	it("runs waitFor and actions before reading the page", async () => {
		const { port, actions } = browserPort("Loaded after clicking.");
		const result = await scrapePage(
			client(SHELL),
			"https://example.com/app",
			{
				render: "browser",
				waitForMs: 500,
				actions: [{ type: "click", target: "Accept cookies" }, { type: "press", key: "Enter" }],
			},
			{ browser: async () => port },
		);
		expect(result.markdown).toContain("Loaded after clicking");
		expect(actions).toEqual(["wait", "click", "press"]);
	});

	it("returns screenshots as a data URL when requested", async () => {
		const { port } = browserPort("Rendered page");
		const result = await scrapePage(
			client(SHELL),
			"https://example.com/app",
			{ render: "browser", formats: ["screenshot"] },
			{ browser: async () => port },
		);
		expect(result.outputs.screenshot).toMatch(/^data:image\/png/);
	});

	it("throws a coded error when rendering is demanded but no browser exists", async () => {
		await expect(scrapePage(client(SHELL), "https://example.com/app", { render: "browser" })).rejects.toMatchObject({
			code: "browser-unavailable",
		});
	});
});

describe("browser text shaping", () => {
	it("keeps paragraph breaks and collapses the rest", () => {
		expect(textToMarkdown("Title\n\n\nBody line one\nBody line two  \n")).toBe("Title\n\nBody line one\nBody line two");
	});

	it("pulls absolute and href-style links out of a snapshot", () => {
		const links = extractSnapshotLinks(
			'- link "Docs" href="https://example.com/docs"\n- text "https://example.com/api"\n- link "Self" href="https://example.com/page"',
			"https://example.com/page",
		);
		expect(links.map((link) => link.url)).toEqual(["https://example.com/docs", "https://example.com/api"]);
	});
});

describe("tag filters and text", () => {
	const html = `<html><body><main><h1>T</h1><p>keep me</p></main><aside>drop me</aside></body></html>`;

	it("keeps only includeTags matches", () => {
		const doc = parseHtml(html, "https://example.com/");
		const report = applyTagFilters(doc, ["main"], []);
		expect(report.restricted).toBe(true);
		expect(doc.body.innerHTML).toContain("keep me");
		expect(doc.body.innerHTML).not.toContain("drop me");
	});

	it("removes excludeTags matches", () => {
		const doc = parseHtml(html, "https://example.com/");
		applyTagFilters(doc, [], ["aside"]);
		expect(doc.body.innerHTML).toContain("keep me");
		expect(doc.body.innerHTML).not.toContain("drop me");
	});

	it("reports selectors that matched nothing instead of emptying the page", () => {
		const doc = parseHtml(html, "https://example.com/");
		const report = applyTagFilters(doc, [".nope"], []);
		expect(report.restricted).toBe(false);
		expect(report.ignored).toEqual([".nope"]);
		expect(doc.body.textContent).toContain("keep me");
	});

	it("renders block boundaries as newlines", () => {
		const doc = parseHtml("<body><p>one</p><p>two</p></body>", "https://example.com/");
		expect(domText(doc.body)).toBe("one\n\ntwo");
	});
});

describe("scrape formats", () => {
	const page = `<html><head><title>Doc</title></head><body><article><p>${"Body text. ".repeat(40)}</p><a href="/next">Next</a></article></body></html>`;

	it("returns html, rawHtml and links when asked", async () => {
		const result = await scrapePage(client(page), "https://example.com/doc", { formats: ["html", "rawHtml", "links"] });
		expect(result.outputs.html).toContain("Body text");
		expect(result.outputs.rawHtml).toContain("<html>");
		expect(result.outputs.links).toContain("https://example.com/next");
	});
});

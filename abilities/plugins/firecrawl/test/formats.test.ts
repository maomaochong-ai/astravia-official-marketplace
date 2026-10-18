/**
 * `formats` is the one argument users cross-check against the upstream docs, so
 * these tests nail the translation: what is accepted, what is dropped, which
 * aliases expand, and which formats cannot be combined.
 */

import { describe, expect, it } from "vitest";
import {
	CRAWL_FORMAT_OPTIONS,
	MAX_CRAWL_FORMATS,
	RAW_BASE64_PAGE_LIMIT,
	FORMAT_OPTIONS,
	clampCrawlFormats,
	clampFormats,
	isExclusiveFormat,
	parseSelectorList,
	toUpstreamFormats,
} from "../src/domain/firecrawl/formats";

describe("clampFormats", () => {
	it("keeps only upstream format names and removes duplicates", () => {
		expect(clampFormats(["markdown", "markdown", "nope", 7, "links"])).toEqual(["markdown", "links"]);
	});

	it("falls back to markdown when nothing usable was asked for", () => {
		expect(clampFormats(undefined)).toEqual(["markdown"]);
		expect(clampFormats([])).toEqual(["markdown"]);
		expect(clampFormats(["unknown"])).toEqual(["markdown"]);
	});

	it("caps the list at eight entries", () => {
		const asked = [...FORMAT_OPTIONS];
		expect(clampFormats(asked).length).toBe(8);
		expect(clampFormats(asked)[0]).toBe("markdown");
	});
});

describe("clampCrawlFormats", () => {
	it("offers every per-page output the console can ask for", () => {
		expect([...CRAWL_FORMAT_OPTIONS]).toEqual([
			"markdown",
			"links",
			"images",
			"video",
			"audio",
			"screenshot",
			"html",
			"rawHtml",
			"summary",
			"json",
			"attributes",
			"changeTracking",
			"rawBase64",
		]);
		expect(MAX_CRAWL_FORMATS).toBe(CRAWL_FORMAT_OPTIONS.length);
		expect(clampCrawlFormats(["markdown", "screenshot", "links"])).toEqual(["markdown", "screenshot", "links"]);
	});

	it("expands a run saved with the old combined media chip", () => {
		expect(clampCrawlFormats(["media"])).toEqual(["markdown", "video", "audio"]);
	});

	it("collapses everything to rawBase64, which upstream refuses to combine", () => {
		expect(clampCrawlFormats(["markdown", "rawBase64", "links"])).toEqual(["rawBase64"]);
		expect(isExclusiveFormat(["rawBase64"])).toBe(true);
		expect(isExclusiveFormat(["markdown"])).toBe(false);
		expect(RAW_BASE64_PAGE_LIMIT).toBe(2);
	});

	it("always keeps markdown, because the console renders it", () => {
		expect(clampCrawlFormats(["links"])).toEqual(["markdown", "links"]);
		expect(clampCrawlFormats("nonsense")).toEqual(["markdown"]);
	});
});

describe("parseSelectorList", () => {
	it("reads the console field, defaulting to the element text", () => {
		expect(parseSelectorList("h2, a@href, .price@data-price")).toEqual([
			{ selector: "h2", attribute: "text" },
			{ selector: "a", attribute: "href" },
			{ selector: ".price", attribute: "data-price" },
		]);
	});

	it("accepts one selector per line and drops repeats", () => {
		expect(parseSelectorList("h2\na@href\nh2")).toEqual([
			{ selector: "h2", attribute: "text" },
			{ selector: "a", attribute: "href" },
		]);
	});

	it("ignores what an empty field means", () => {
		expect(parseSelectorList("")).toEqual([]);
		expect(parseSelectorList(" , \n ")).toEqual([]);
	});

	it("caps a paste at twenty selectors", () => {
		const text = Array.from({ length: 30 }, (_, index) => `.item-${index}`).join(", ");
		expect(parseSelectorList(text)).toHaveLength(20);
	});
});

describe("toUpstreamFormats", () => {
	it("expands the media alias into audio and video", () => {
		expect(toUpstreamFormats(["media"])).toEqual(["video", "audio"]);
	});

	it("sends screenshot@fullPage as an option object", () => {
		expect(toUpstreamFormats(["screenshot@fullPage"])).toEqual([{ type: "screenshot", fullPage: true }]);
		expect(toUpstreamFormats(["screenshot"])).toEqual(["screenshot"]);
	});

	it("lets rawBase64 stand alone", () => {
		expect(toUpstreamFormats(["markdown", "rawBase64", "links"])).toEqual(["rawBase64"]);
	});

	it("attaches payloads that only exist as objects", () => {
		expect(
			toUpstreamFormats(["markdown", "json", "attributes", "question", "highlights"], {
				prompt: "List the prices",
				schema: { type: "object" },
				selectors: [{ selector: "a", attribute: "href" }],
				question: "What is the refund window?",
				highlights: "pricing",
			}),
		).toEqual([
			"markdown",
			{ type: "json", prompt: "List the prices", schema: { type: "object" } },
			{ type: "attributes", selectors: [{ selector: "a", attribute: "href" }] },
			{ type: "question", question: "What is the refund window?" },
			{ type: "highlights", query: "pricing" },
		]);
	});

	it("does not invent payload formats out of nothing", () => {
		expect(toUpstreamFormats(["markdown", "question"])).toEqual(["markdown"]);
		expect(toUpstreamFormats([])).toEqual(["markdown"]);
	});

	it("caps attribute selectors", () => {
		const selectors = Array.from({ length: 30 }, (_, index) => ({ selector: `a${index}`, attribute: "href" }));
		const [entry] = toUpstreamFormats(["attributes"], { selectors });
		expect((entry as { selectors: unknown[] }).selectors).toHaveLength(20);
	});
});

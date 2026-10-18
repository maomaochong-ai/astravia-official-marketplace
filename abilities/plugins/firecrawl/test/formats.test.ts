/**
 * `formats` is the one argument users cross-check against the upstream docs, so
 * these tests nail the translation: what is accepted, what is dropped, which
 * aliases expand, and which formats cannot be combined.
 */

import { describe, expect, it } from "vitest";
import {
	CRAWL_FORMAT_OPTIONS,
	FORMAT_OPTIONS,
	clampCrawlFormats,
	clampFormats,
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
	it("accepts only the crawl subset", () => {
		expect(clampCrawlFormats(["markdown", "screenshot", "rawBase64", "links"])).toEqual(["markdown", "links"]);
		expect(CRAWL_FORMAT_OPTIONS).toContain("changeTracking");
	});

	it("always keeps markdown, because the console renders it", () => {
		expect(clampCrawlFormats(["links"])).toEqual(["markdown", "links"]);
		expect(clampCrawlFormats("nonsense")).toEqual(["markdown"]);
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

import { describe, expect, it } from "vitest";
import {
	fileExtension,
	getUrlDepth,
	isFileUrl,
	isSameSite,
	isSocialMediaHost,
	isSubdomainOf,
	normalizeUrl,
	pathForPatterns,
	urlLabel,
} from "../src/domain/url";

describe("normalizeUrl", () => {
	it("drops the fragment and lowercases the host", () => {
		expect(normalizeUrl("https://Example.COM/Docs#intro")?.href).toBe("https://example.com/Docs");
	});

	it("resolves relative hrefs against the page URL", () => {
		expect(normalizeUrl("../guide/", "https://example.com/docs/api/")?.href).toBe("https://example.com/docs/guide/");
	});

	it("rejects in-page anchors and non-web protocols", () => {
		expect(normalizeUrl("#section", "https://example.com/")).toBeNull();
		expect(normalizeUrl("mailto:x@example.com")).toBeNull();
		expect(normalizeUrl("javascript:void(0)")).toBeNull();
		expect(normalizeUrl("tel:+100")).toBeNull();
	});

	it("rejects relative hrefs when there is no base", () => {
		expect(normalizeUrl("/docs")).toBeNull();
	});
});

describe("site identity", () => {
	it("treats www as the same site", () => {
		expect(isSameSite("www.example.com", "example.com")).toBe(true);
	});

	it("only accepts real subdomains", () => {
		expect(isSubdomainOf("docs.example.com", "example.com")).toBe(true);
		expect(isSubdomainOf("notexample.com", "example.com")).toBe(false);
		expect(isSubdomainOf("example.com", "example.com")).toBe(false);
	});

	it("knows the social hosts it refuses", () => {
		expect(isSocialMediaHost("x.com")).toBe(true);
		expect(isSocialMediaHost("example.com")).toBe(false);
	});
});

describe("file detection", () => {
	it("flags document and archive URLs", () => {
		expect(isFileUrl("https://example.com/report.pdf")).toBe(true);
		expect(isFileUrl("https://example.com/app.zip")).toBe(true);
		expect(fileExtension("https://example.com/app.zip")).toBe("zip");
	});

	it("leaves extensionless routes alone", () => {
		expect(isFileUrl("https://example.com/v1.2/release-notes")).toBe(false);
	});
});

describe("path helpers", () => {
	it("counts path segments as depth", () => {
		expect(getUrlDepth("https://example.com/")).toBe(0);
		expect(getUrlDepth("https://example.com/docs")).toBe(1);
		expect(getUrlDepth("https://example.com/docs/api/v1")).toBe(3);
	});

	it("matches the pathname only, so host dots cannot trip a pattern", () => {
		expect(pathForPatterns("https://example.com/docs/a.pdf")).toBe("/docs/a.pdf");
	});

	it("labels a URL by its last meaningful segment", () => {
		expect(urlLabel("https://example.com/docs/getting-started")).toBe("getting-started");
		expect(urlLabel("https://example.com/")).toBe("example.com");
	});
});

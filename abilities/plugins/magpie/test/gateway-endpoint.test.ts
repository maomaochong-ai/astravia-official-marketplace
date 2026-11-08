import { describe, expect, it } from "vitest";
import {
	consoleUrl,
	DEFAULT_GATEWAY_URL,
	normalizeApiKey,
	normalizeBaseUrl,
	normalizeSettings,
	providerBaseUrl,
	versionUrl,
} from "../src/gateway-endpoint";

describe("normalizeBaseUrl", () => {
	it("keeps a plain loopback address", () => {
		expect(normalizeBaseUrl("http://127.0.0.1:3425")).toBe("http://127.0.0.1:3425");
	});

	it("strips trailing slashes so paths do not double up", () => {
		expect(normalizeBaseUrl("http://127.0.0.1:3425///")).toBe("http://127.0.0.1:3425");
	});

	it("trims surrounding whitespace", () => {
		expect(normalizeBaseUrl("  http://localhost:3425  ")).toBe("http://localhost:3425");
	});

	it.each([undefined, null, 42, "", "   ", "127.0.0.1:3425", "ftp://127.0.0.1:3425", "http://"])(
		"falls back to the default for %p",
		(value) => {
			expect(normalizeBaseUrl(value)).toBe(DEFAULT_GATEWAY_URL);
		},
	);

	it("keeps a non-default host the user typed on purpose", () => {
		expect(normalizeBaseUrl("https://magpie.example.internal:9443")).toBe("https://magpie.example.internal:9443");
	});
});

describe("normalizeApiKey", () => {
	it("defaults to the documented placeholder key", () => {
		expect(normalizeApiKey(undefined)).toBe("magpie");
		expect(normalizeApiKey("")).toBe("magpie");
		expect(normalizeApiKey("  ")).toBe("magpie");
	});

	it("trims a real key", () => {
		expect(normalizeApiKey("  secret  ")).toBe("secret");
	});
});

describe("normalizeSettings", () => {
	it("normalizes both fields and never throws on junk", () => {
		expect(normalizeSettings({ baseUrl: "http://127.0.0.1:4000/", apiKey: " k " })).toEqual({
			baseUrl: "http://127.0.0.1:4000",
			apiKey: "k",
		});
		expect(normalizeSettings("nope")).toEqual({ baseUrl: DEFAULT_GATEWAY_URL, apiKey: "magpie" });
	});
});

describe("url helpers", () => {
	it("builds the probe and catalog urls", () => {
		expect(versionUrl("http://127.0.0.1:3425")).toBe("http://127.0.0.1:3425/api/version");
		expect(providerBaseUrl("http://127.0.0.1:3425")).toBe("http://127.0.0.1:3425/v1");
	});

	it("maps the default gateway port to the console port", () => {
		expect(consoleUrl("http://127.0.0.1:3425")).toBe("http://127.0.0.1:3430");
	});

	it("does not guess a console port for a custom gateway port", () => {
		expect(consoleUrl("http://127.0.0.1:4000")).toBe("http://127.0.0.1:3430");
	});
});

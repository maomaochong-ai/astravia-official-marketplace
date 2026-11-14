import { describe, expect, it } from "vitest";
import { IMAGE_MAX_BYTES, mimeForPath, sniffMime, toImagePayload } from "../service/images";
import { covers, describeScope, normalizeScopeValue, outOfScopeHosts, type ScopeEntry } from "../service/scope";

/**
 * Two capabilities upstream gets from its SDK and we implement here:
 * seeing a screenshot (`view_image`) and declaring the engagement boundary (`scope_*`).
 */

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);

describe("images", () => {
	it("sniffs the format from the bytes, not from the extension", () => {
		expect(sniffMime(png)).toBe("image/png");
		expect(sniffMime(jpeg)).toBe("image/jpeg");
		expect(sniffMime(webp)).toBe("image/webp");
		expect(sniffMime(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]))).toBeUndefined();
	});

	it("trusts a real PNG that was saved with the wrong extension", () => {
		const payload = toImagePayload("/workspace/shot.jpg", png);
		expect(payload.ok).toBe(true);
		if (payload.ok) expect(payload.mimeType).toBe("image/png");
	});

	it("falls back to the extension when the header is unfamiliar", () => {
		const unknown = new Uint8Array(12).fill(0x41);
		expect(toImagePayload("/workspace/shot.webp", unknown).ok).toBe(true);
		expect(mimeForPath("a/b/c.PNG")).toBe("image/png");
	});

	it("produces a data URI the panel can render directly", () => {
		const payload = toImagePayload("/workspace/shot.png", png);
		if (!payload.ok) throw new Error(payload.error);
		expect(payload.dataUri.startsWith("data:image/png;base64,")).toBe(true);
		expect(Buffer.from(payload.base64, "base64")).toEqual(Buffer.from(png));
	});

	it("refuses an empty file, a non-image, and something too big to be useful", () => {
		expect(toImagePayload("/w/empty.png", new Uint8Array())).toMatchObject({ ok: false, error: "file is empty" });
		expect(toImagePayload("/w/notes.txt", new Uint8Array(12).fill(0x41))).toMatchObject({ ok: false });
		const huge = new Uint8Array(IMAGE_MAX_BYTES + 1);
		huge.set(png);
		const refused = toImagePayload("/w/huge.png", huge);
		expect(refused.ok).toBe(false);
		if (!refused.ok) expect(refused.error).toContain("ceiling");
	});
});

const entry = (kind: ScopeEntry["kind"], value: string): ScopeEntry => ({
	id: value,
	kind,
	value,
	createdAt: "2026-01-01T00:00:00.000Z",
});

describe("scope", () => {
	it("normalises URLs, case and trailing dots to one host", () => {
		expect(normalizeScopeValue("https://Example.TEST./path?x=1")).toBe("example.test");
		expect(normalizeScopeValue("  a.test:8443 ")).toBe("a.test");
	});

	it("covers subdomains for a domain entry, and only the exact host otherwise", () => {
		const domain = entry("domain", "example.test");
		expect(covers(domain, "example.test")).toBe(true);
		expect(covers(domain, "api.example.test")).toBe(true);
		// A lookalike domain must not be covered by a suffix rule that forgot the dot.
		expect(covers(domain, "notexample.test")).toBe(false);

		const ip = entry("ip", "10.0.0.5");
		expect(covers(ip, "10.0.0.5")).toBe(true);
		expect(covers(ip, "10.0.0.6")).toBe(false);
	});

	it("names hosts a command mentions that the scope does not cover", () => {
		const scope = [entry("domain", "in.test")];
		const command = "nmap -sV in.test api.in.test out.test 10.9.9.9";
		expect(outOfScopeHosts(command, scope)).toEqual(["out.test", "10.9.9.9"]);
	});

	it("ignores loopback, tool-ish dotted tokens and file names", () => {
		const scope = [entry("domain", "in.test")];
		expect(outOfScopeHosts("curl http://127.0.0.1:3425/api/version", scope)).toEqual([]);
		expect(outOfScopeHosts("python3 report.json && cat notes.md", scope)).toEqual([]);
		expect(outOfScopeHosts("nuclei -u https://in.test/x", scope)).toEqual([]);
	});

	it("says nothing is declared rather than printing an empty section", () => {
		expect(describeScope({ entries: [], rules: { ports: [], notes: [], updatedAt: null } })).toContain("No scope");
	});

	it("renders the block the report embeds", () => {
		const text = describeScope({
			entries: [{ ...entry("domain", "in.test"), note: "staging only" }],
			rules: { ports: ["443"], notes: ["no destructive payloads"], updatedAt: null },
		});
		expect(text).toContain("`in.test` (domain) — staging only");
		expect(text).toContain("**Ports** 443");
		expect(text).toContain("no destructive payloads");
	});
});

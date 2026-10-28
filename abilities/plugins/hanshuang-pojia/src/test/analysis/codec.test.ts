// 编码与基础算子：base64、sha256、熵、字符串抽取与模式编译。
// 这些是其它域的共同底座，边界值（空输入、超长、非法字符）必须在这里定死。

import { describe, expect, it } from "vitest";
import { fromBase64, toBase64 } from "../../domain/base64";
import { sha256, sha256Hex } from "../../domain/digest";
import { highEntropyBands, shannonEntropy } from "../../domain/entropy";
import { compilePattern, extractStrings } from "../../domain/strings";

describe("sha256", () => {
	it("matches the published vectors", () => {
		expect(sha256Hex(new Uint8Array(0))).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
		expect(sha256Hex(new TextEncoder().encode("abc"))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
		expect(sha256Hex(new TextEncoder().encode("The quick brown fox jumps over the lazy dog"))).toBe(
			"d7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592",
		);
	});

	it("returns 32 raw bytes", () => {
		expect(sha256(new TextEncoder().encode("abc"))).toHaveLength(32);
	});

	it("hashes across multiple 64-byte blocks", () => {
		const message = new Uint8Array(200).fill(0x61);
		expect(sha256Hex(message)).toHaveLength(64);
		expect(sha256Hex(message)).not.toBe(sha256Hex(message.subarray(0, 64)));
	});
});

describe("base64", () => {
	it("decodes the reference vectors", () => {
		expect(Array.from(fromBase64("aGVsbG8="))).toEqual(Array.from(new TextEncoder().encode("hello")));
		expect(fromBase64("")).toHaveLength(0);
		expect(Array.from(fromBase64("AAECAw=="))).toEqual([0, 1, 2, 3]);
	});

	it("ignores whitespace and stops at padding", () => {
		expect(Array.from(fromBase64("aGVs\nbG8="))).toEqual(Array.from(new TextEncoder().encode("hello")));
		expect(Array.from(fromBase64("AAECAw==AAAA"))).toEqual([0, 1, 2, 3]);
	});

	it("round-trips arbitrary bytes", () => {
		const bytes = new Uint8Array(1024);
		for (let index = 0; index < bytes.length; index += 1) bytes[index] = (index * 37 + 11) & 0xff;
		expect(Array.from(fromBase64(toBase64(bytes)))).toEqual(Array.from(bytes));
	});

	it("encodes the standard alphabet", () => {
		expect(toBase64(new TextEncoder().encode("hello"))).toBe("aGVsbG8=");
		expect(toBase64(new Uint8Array([0xff, 0xfe, 0xfd]))).toBe("//79");
	});
});

describe("entropy", () => {
	it("is zero for a single repeated byte", () => {
		expect(shannonEntropy(new Uint8Array(4096))).toBe(0);
	});

	it("approaches eight bits for uniform bytes", () => {
		const bytes = new Uint8Array(65536);
		for (let index = 0; index < bytes.length; index += 1) bytes[index] = index & 0xff;
		expect(shannonEntropy(bytes)).toBeGreaterThan(7.9);
	});

	it("reports dense regions as high entropy", () => {
		const band = highEntropyBands(new Uint8Array(1 << 16), { threshold: 7.2 });
		expect(band).toHaveLength(0);
		const random = new Uint8Array(1 << 16).map((_, index) => (index * 2654435761) & 0xff);
		expect(highEntropyBands(random, { threshold: 6 }).length).toBeGreaterThan(0);
	});
});

describe("strings", () => {
	it("extracts ascii and utf16 strings with offsets", () => {
		const bytes = new Uint8Array([0x00, 0x41, 0x42, 0x43, 0x44, 0x00, 0x45, 0x00]);
		const ascii = extractStrings(bytes, { encodings: ["ascii"], minLength: 3 });
		expect(ascii.map(item => item.value)).toEqual(["ABCD"]);
		expect(ascii[0]?.offset).toBe(1);
		const wide = new Uint8Array([0x45, 0x00, 0x46, 0x00, 0x47, 0x00, 0x00, 0x00]);
		const both = extractStrings(wide, { encodings: ["utf16le"], minLength: 2 });
		expect(both.some(item => item.encoding === "utf16le" && item.value === "EFG")).toBe(true);
	});

	it("honours the result cap", () => {
		const bytes = new TextEncoder().encode("alpha\0beta\0gamma\0delta\0");
		expect(extractStrings(bytes, { minLength: 3, maxResults: 2 })).toHaveLength(2);
	});

	it("treats plain queries literally and slashed queries as expressions", () => {
		expect(compilePattern("Runtime.exec", false).test("Ljava/lang/Runtime;->exec")).toBe(false);
		expect(compilePattern("Runtime.*exec", false).test("Ljava/lang/Runtime;->exec")).toBe(true);
		expect(compilePattern("runtime", false).test("Runtime")).toBe(true);
	});
});

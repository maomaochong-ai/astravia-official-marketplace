// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { READ_LIMIT_BYTES } from "../domain/sample-scope";
import {
	IMPORT_DIRECTORY,
	bytesToBase64,
	fileList,
	importName,
	importRelativePath,
	isTooLarge,
	readFileAsBase64,
} from "../features/workbench/services/import-file";

describe("sample import", () => {
	it("keeps only the file name, never a path", () => {
		expect(importName("pkg/app.apk")).toBe("app.apk");
		expect(importName("..\\..\\windows\\system32\\evil.dll")).toBe("evil.dll");
		expect(importName("a\x00b.apk")).toBe("a_b.apk");
		expect(importRelativePath("/tmp/x/libfoo.so")).toBe(`${IMPORT_DIRECTORY}/libfoo.so`);
	});

	it("falls back to a generated name when nothing usable is left", () => {
		expect(importName("")).toMatch(/^sample-\d+$/);
		expect(importName("../..")).toMatch(/^sample-\d+$/);
		expect(importName(".")).toMatch(/^sample-\d+$/);
	});

	it("refuses anything above the host's per-file read cap", () => {
		expect(isTooLarge(READ_LIMIT_BYTES)).toBe(false);
		expect(isTooLarge(READ_LIMIT_BYTES + 1)).toBe(true);
	});

	it("encodes multi-chunk payloads and reads a File back", async () => {
		// 超过一个分块，确认拼接没有丢字节。
		const bytes = new Uint8Array(20_000);
		for (let index = 0; index < bytes.length; index += 1) bytes[index] = index % 251;
		expect(bytesToBase64(bytes)).toBe(Buffer.from(bytes).toString("base64"));

		const file = new File([bytes], "sample.apk");
		expect(await readFileAsBase64(file)).toBe(bytesToBase64(bytes));
	});

	it("turns a FileList into a plain array", () => {
		expect(fileList(null)).toEqual([]);
		const one = new File(["x"], "a.apk");
		expect(fileList([one] as unknown as FileList)).toHaveLength(1);
	});
});

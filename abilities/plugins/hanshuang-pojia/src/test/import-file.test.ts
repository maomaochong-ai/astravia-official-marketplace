// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
	IMPORT_CHUNK_BYTES,
	IMPORT_DIRECTORY,
	bytesToBase64,
	chunkCount,
	fileList,
	importName,
	importRelativePath,
	readChunkAsBase64,
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

	it("splits any size into chunks instead of refusing it", async () => {
		// 导入不设上限：超过宿主 32 MiB 读取上限的文件也要能完整复制进工作区。
		expect(chunkCount(0)).toBe(1);
		expect(chunkCount(IMPORT_CHUNK_BYTES)).toBe(1);
		expect(chunkCount(IMPORT_CHUNK_BYTES + 1)).toBe(2);
		expect(chunkCount(40 * 1024 * 1024)).toBe(10);

		const bytes = new Uint8Array(5);
		bytes.set([1, 2, 3, 4, 5]);
		const file = new File([bytes], "tiny.bin");
		expect(await readChunkAsBase64(file, 0)).toBe(bytesToBase64(bytes));
		expect(await readChunkAsBase64(file, 1)).toBe("");
	});

	it("encodes multi-chunk payloads and reads a File back", async () => {
		// 超过一个分块，确认拼接没有丢字节。
		const bytes = new Uint8Array(20_000);
		for (let index = 0; index < bytes.length; index += 1) bytes[index] = index % 251;
		expect(bytesToBase64(bytes)).toBe(Buffer.from(bytes).toString("base64"));

		const file = new File([bytes], "sample.apk");
		expect(await readChunkAsBase64(file, 0)).toBe(bytesToBase64(bytes));
	});

	it("turns a FileList into a plain array", () => {
		expect(fileList(null)).toEqual([]);
		const one = new File(["x"], "a.apk");
		expect(fileList([one] as unknown as FileList)).toHaveLength(1);
	});
});

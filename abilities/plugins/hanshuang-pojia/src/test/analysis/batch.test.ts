import type { PluginFsApi } from "@astravia-org/plugin-sdk";
import { describe, expect, it, vi } from "vitest";
import { renderBatch, triageDirectory } from "../../domain/batch";
import { toBase64 } from "../../domain/base64";
import { buildApk, buildElf, buildPe } from "../fixtures";

interface FakeFile {
	relPath: string;
	bytes: Uint8Array;
	size?: number;
	broken?: boolean;
}

/** 只实现批量分诊用到的那四个 SDK 方法，其余缺失时直接抛错（免得静默走错分支）。 */
function fakeFs(files: readonly FakeFile[], options: { listError?: string; ignoreRecursive?: boolean } = {}): PluginFsApi {
	return {
		listFilesRecursive: vi.fn(async () => {
			if (options.listError) throw new Error(options.listError);
			if (options.ignoreRecursive) return [];
			return files.map(file => ({ name: file.relPath.split("/").at(-1)!, path: `/samples/${file.relPath}`, relPath: file.relPath }));
		}),
		stat: vi.fn(async (path: string) => {
			const file = files.find(item => `/samples/${item.relPath}` === path);
			if (!file) return null;
			return { size: file.size ?? file.bytes.byteLength, isDirectory: false } as never;
		}),
		readBinaryFile: vi.fn(async (path: string) => {
			const file = files.find(item => `/samples/${item.relPath}` === path);
			if (!file) throw new Error("no such file");
			if (file.broken) throw new Error("permission denied");
			return { data: toBase64(file.bytes), mimeType: "application/octet-stream", size: file.bytes.byteLength };
		}),
	} as unknown as PluginFsApi;
}

const elf = buildElf();
const pe = buildPe();
const apk = buildApk({ withDex: true });

describe("directory batch triage", () => {
	it("triages only binary extensions and skips everything else", async () => {
		const files: FakeFile[] = [
			{ relPath: "a.elf", bytes: elf },
			{ relPath: "b.apk", bytes: apk },
			{ relPath: "README.md", bytes: new TextEncoder().encode("# notes") },
			{ relPath: "src/main.ts", bytes: new TextEncoder().encode("export {}") },
		];
		const result = await triageDirectory(fakeFs(files), { root: "/samples" });
		expect(result.listed).toBe(4);
		expect(result.candidates).toBe(2);
		// 输出按等级重排，不是按目录顺序：APK 的风险分更高所以排前面。
		expect(result.entries.map(entry => entry.path).sort()).toEqual(["a.elf", "b.apk"]);
	});

	it("skips nested files unless recursive is set", async () => {
		const files: FakeFile[] = [
			{ relPath: "top.elf", bytes: elf },
			{ relPath: "nested/deep.elf", bytes: elf },
		];
		expect((await triageDirectory(fakeFs(files), { root: "/samples" })).entries.map(entry => entry.path)).toEqual(["top.elf"]);
		expect((await triageDirectory(fakeFs(files), { root: "/samples", recursive: true })).entries.map(entry => entry.path)).toEqual([
			"nested/deep.elf",
			"top.elf",
		]);
	});

	it("sorts worst grade first and keeps the score as the tie-breaker", async () => {
		const files: FakeFile[] = [
			{ relPath: "clean.elf", bytes: buildElf({ executableStack: false }) },
			{ relPath: "risky.exe", bytes: pe },
			{ relPath: "b.apk", bytes: buildApk({ withDex: true }) },
		];
		const result = await triageDirectory(fakeFs(files), { root: "/samples" });
		const order = ["E", "D", "C", "B", "A", "-"];
		const ranks = result.entries.map(entry => order.indexOf(entry.grade));
		expect(ranks).toEqual([...ranks].sort((left, right) => left - right));
		// 同等风险下按得分、再按路径排；具体次序由规则集决定，这里只断言等级单调。
		expect(result.entries.map(entry => entry.path)).toEqual(["b.apk", "clean.elf", "risky.exe"]);
	});

	it("keeps going when one file cannot be read", async () => {
		const files: FakeFile[] = [
			{ relPath: "good.elf", bytes: elf },
			{ relPath: "locked.elf", bytes: elf, broken: true },
		];
		const result = await triageDirectory(fakeFs(files), { root: "/samples" });
		expect(result.entries).toHaveLength(2);
		const failed = result.entries.find(entry => entry.path === "locked.elf")!;
		expect(failed.grade).toBe("-");
		expect(failed.error).toContain("permission denied");
		// 失败项排在最后，不会挤掉可用的结论。
		expect(result.entries.at(-1)!.path).toBe("locked.elf");
	});

	it("counts files above the read limit instead of loading them", async () => {
		const files: FakeFile[] = [{ relPath: "huge.apk", bytes: apk, size: 40 * 1024 * 1024 }];
		const result = await triageDirectory(fakeFs(files), { root: "/samples" });
		expect(result.tooLarge).toBe(1);
		expect(result.entries).toHaveLength(0);
		expect(result.warnings.join(" ")).toContain("skipped");
	});

	it("caps the work at the requested limit and says what it left out", async () => {
		const files: FakeFile[] = Array.from({ length: 5 }, (_, index) => ({ relPath: `f${index}.elf`, bytes: elf }));
		const result = await triageDirectory(fakeFs(files), { root: "/samples", limit: 3 });
		expect(result.entries).toHaveLength(3);
		expect(result.truncated).toBe(true);
		expect(result.warnings.join(" ")).toContain("2 candidate(s) beyond the 3-file limit");
	});

	it("fails loudly when the directory cannot be listed", async () => {
		await expect(triageDirectory(fakeFs([], { listError: "outside the project" }), { root: "/etc" })).rejects.toThrow("cannot list /etc");
	});

	it("renders a table with the summary line", async () => {
		const files: FakeFile[] = [{ relPath: "a.elf", bytes: elf }];
		const rendered = renderBatch(await triageDirectory(fakeFs(files), { root: "/samples" }));
		expect(rendered).toContain("| grade | score | format |");
		expect(rendered).toContain("a.elf");
		expect(rendered).toContain("1 triaged");
	});
});

import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { describe, expect, it } from "vitest";
import { buildDexDumpScript, parseDexDumpLog } from "../../domain/android/frida-dump";
import { toBase64 } from "../../domain/base64";
import { registerFridaDumpTool } from "../../tools/apk/frida-dump";

const DEX_BYTES = Uint8Array.from({ length: 200 }, (_, index) => index & 0xff);

/** 只用 `assemble` / `script` 会碰到的宿主接口；`run` 需要真设备，不在这里假装。 */
function fakeContext(textFiles: Map<string, string>) {
	const writes: { path: string; content: string; encoding?: string }[] = [];
	const fs = {
		readFile: async (path: string) => {
			const content = textFiles.get(path);
			if (content === undefined) throw new Error(`ENOENT ${path}`);
			return { content, encoding: "utf8" as const };
		},
		writeFile: async (path: string, content: string, encoding?: "utf8" | "base64") => {
			writes.push({ path, content, encoding });
			textFiles.set(path, content);
		},
		createDirectory: async () => undefined,
		stat: async () => null,
		readBinaryFile: async () => {
			throw new Error("the assemble path must not read a binary");
		},
		saveAs: async () => null,
	};

	const registered: { id: string; run: (input: Record<string, unknown>) => Promise<string> }[] = [];
	const ctx = {
		agent: {
			registerTool: (definition: { id: string; handler: (context: never) => unknown }): Disposable => {
				registered.push({
					id: definition.id,
					run: input => definition.handler({ trigger: { input }, host: { fs }, session: { cwd: "/work" } } as never) as Promise<string>,
				});
				return { dispose: () => undefined };
			},
		},
		host: { fs },
		session: { cwd: "/work" },
	} as unknown as PluginContext;

	const call = async (input: Record<string, unknown>): Promise<string> => {
		registerFridaDumpTool(ctx);
		const definition = registered[registered.length - 1];
		if (!definition) throw new Error("frida_dump was not registered");
		return definition.run(input);
	};

	return { call, writes };
}

/** 一段「两半」的 chunk 序列，按 `order` 决定写进日志的顺序。 */
function dumpLog(options: { size: number; chunks: string[]; withEnd?: boolean; order?: number[] }): string {
	const lines: string[] = ["Spawning `com.example.app`...", `[Local::1234]-> { "unrelated": true }`];
	if (options.withEnd !== false) lines.push(JSON.stringify({ event: "dex-start", index: 0, size: options.size }));
	const order = options.order ?? options.chunks.map((_, index) => index);
	for (const seq of order) lines.push(JSON.stringify({ event: "dex-chunk", index: 0, seq, data: options.chunks[seq] ?? "" }));
	if (options.withEnd !== false) lines.push(JSON.stringify({ event: "dex-end", index: 0, size: options.size }));
	lines.push(JSON.stringify({ event: "done", dumped: 1 }));
	return lines.join("\n");
}

describe("dex dump script", () => {
	it("validates the header, not just the magic", () => {
		const script = buildDexDumpScript({ source: "app.apk" });
		// 只比 magic 会把常量池里恰好写出 dex 头的字符串当成文件。
		expect(script).toContain("headerSize !== 0x70");
		expect(script).toContain("endianTag !== 0x12345678");
		expect(script).toContain('Memory.scanSync(range.base, range.size, "64 65 78 0a 30 33")');
		expect(script).toContain('Process.enumerateRanges("rw-")');
		// 设备侧不落盘：分块 base64 走 stdout。
		expect(script).toContain('event: "dex-chunk"');
		expect(script).toContain("function base64(bytes)");
		expect(script).not.toContain('event: "dex",');
	});

	it("carries the caps the caller asked for", () => {
		const script = buildDexDumpScript({ maxDex: 3, delayMs: 400, limitMb: 8 });
		expect(script).toContain("var MAX_DEX = 3;");
		expect(script).toContain("var SCAN_DELAY_MS = 400;");
		expect(script).toContain("var LIMIT_BYTES = 8 * 1024 * 1024;");
		// 默认值写进注释，读脚本的人不必翻文档。
		expect(buildDexDumpScript().startsWith("// Runtime DEX dump")).toBe(true);
	});
});

describe("dex dump log", () => {
	const half = Math.ceil(DEX_BYTES.length / 2);
	const chunks = [toBase64(DEX_BYTES.subarray(0, half)), toBase64(DEX_BYTES.subarray(half))];

	it("reassembles chunks in sequence order even when they arrive swapped", () => {
		const parsed = parseDexDumpLog(dumpLog({ size: DEX_BYTES.length, chunks, order: [1, 0] }));
		expect(parsed.dexes).toHaveLength(1);
		expect(parsed.dexes[0]?.size).toBe(DEX_BYTES.length);
		expect(parsed.dexes[0]?.bytes).toEqual(DEX_BYTES);
		expect(parsed.done).toBe(true);
	});

	it("ignores frida's own log lines and reports no completion when `done` is missing", () => {
		const parsed = parseDexDumpLog(["Spawning `com.example.app`...", "Failed to spawn: unable to find process"].join("\n"));
		expect(parsed.dexes).toEqual([]);
		expect(parsed.done).toBe(false);
		expect(parsed.notes).toEqual([]);
	});

	it("flags a chunk that is not JSON instead of failing the whole run", () => {
		const parsed = parseDexDumpLog(`${dumpLog({ size: DEX_BYTES.length, chunks })}\n{ this is not json`);
		expect(parsed.dexes).toHaveLength(1);
		expect(parsed.notes[0]).toContain("unparsed log line");
	});
});

describe("frida_dump assemble", () => {
	const half = Math.ceil(DEX_BYTES.length / 2);
	const chunks = [toBase64(DEX_BYTES.subarray(0, half)), toBase64(DEX_BYTES.subarray(half))];

	it("writes one dex per reassembled file and names it by digest", async () => {
		const { call, writes } = fakeContext(new Map([["/work/exports/frida-dump/frida-dump/frida-dump.log", dumpLog({ size: DEX_BYTES.length, chunks })]]));
		const output = await call({ mode: "assemble", log_path: "exports/frida-dump/frida-dump/frida-dump.log" });

		expect(writes).toHaveLength(1);
		expect(writes[0]?.encoding).toBe("base64");
		// 默认输出目录 = exports/frida-dump/<log 名>/，文件名带序号与摘要前缀。
		expect(writes[0]?.path).toMatch(/^\/work\/exports\/frida-dump\/frida-dump\/frida-dump-0-[0-9a-f]{8}\.dex$/);
		expect(output).toContain("1 dex collected · 1 written");
		expect(output).toContain("decompile_android");
	});

	it("refuses to write a half file when the declared size and the payload disagree", async () => {
		// 只留前半块：拼回来 100 字节，但日志声明 200 —— 写出去会是一份坏 dex。
		const truncated = dumpLog({ size: DEX_BYTES.length, chunks: [chunks[0]!, ""] });
		const { call, writes } = fakeContext(new Map([["/work/exports/frida-dump/frida-dump/frida-dump.log", truncated]]));
		const output = await call({ mode: "assemble", log_path: "exports/frida-dump/frida-dump/frida-dump.log" });

		expect(writes).toHaveLength(0);
		expect(output).toContain("Nothing was written");
	});

	it("asks for the log path instead of guessing one", async () => {
		const { call, writes } = fakeContext(new Map());
		const output = await call({ mode: "assemble" });
		expect(writes).toHaveLength(0);
		expect(output).toContain("needs `log_path`");
	});
});

describe("frida_dump script mode", () => {
	it("emits the script and the command without touching the filesystem", async () => {
		const { call, writes } = fakeContext(new Map());
		const output = await call({ mode: "script", package: "com.example.app" });
		expect(writes).toHaveLength(0);
		expect(output).toContain("```js");
		expect(output).toContain("frida -U -f com.example.app -l dump-dex.js");
		expect(output).toContain('mode: "assemble"');
	});

	it("uses a placeholder package when the caller gave none", async () => {
		const { call } = fakeContext(new Map());
		const output = await call({ mode: "script" });
		expect(output).toContain("frida -U -f <package-name>");
	});
});

import type { Disposable, PluginContext, PluginFsApi } from "@astravia-org/plugin-sdk";
import { describe, expect, it, vi } from "vitest";
import { toBase64 } from "../domain/base64";
import { registerExplainFindingTool } from "../tools/knowledge/explain-finding";
import { registerExportReportTool } from "../tools/report/export-triage-report";
import { EXPECTED_TOOL_COUNT } from "../tools/ids";
import { registerTools } from "../tools/register-tools";
import { baseName, isAbsolutePath, resolveSamplePath } from "../domain/sample-path";
import { MAX_SAMPLE_BYTES, loadSample } from "../tools/lib/read-sample";
import { registerScanStringsTool } from "../tools/native/scan-strings";
import { registerTriageBinaryTool } from "../tools/native/triage-binary";
import { buildApk, buildElf, utf8 } from "./fixtures";

/** 只实现被测工具真正用到的宿主接口，其余留空。 */
function fakeContext(files: Map<string, Uint8Array>, options: { saveAs?: string | null } = {}) {
	const saveAs = vi.fn(async (_name: string, _content: string) => (options.saveAs === undefined ? "/out/report.md" : options.saveAs));
	/** `run` 把最少量的宿主接口拼成处理器收到的上下文，和真实调用形状一致。 */
	const registered: { id: string; run: (input: Record<string, unknown>) => Promise<string> }[] = [];

	const fs = {
		stat: async (filePath: string) => {
			const bytes = files.get(filePath);
			return bytes ? { size: bytes.byteLength, modifiedAt: 0, createdAt: 0 } : null;
		},
		readBinaryFile: async (filePath: string) => {
			const bytes = files.get(filePath);
			if (!bytes) throw new Error(`ENOENT ${filePath}`);
			return { data: toBase64(bytes), mimeType: "application/octet-stream", size: bytes.byteLength };
		},
		saveAs,
	};

	/** 工具只用到 stat / readBinaryFile / saveAs，其余接口不参与被测路径。 */
	const fsApi = fs as unknown as PluginFsApi;

	const ctx = {
		agent: {
			registerTool: (definition: { id: string; handler: (context: never) => unknown }): Disposable => {
				registered.push({
					id: definition.id,
					run: input =>
						definition.handler({ trigger: { input }, host: { fs }, session: { cwd: "/work" } } as never) as Promise<string>,
				});
				return { dispose: () => undefined };
			},
		},
		host: { fs },
		session: { cwd: "/work" },
	} as unknown as PluginContext;

	const call = async (id: string, input: Record<string, unknown>): Promise<string> => {
		const definition = registered.find(item => item.id === id);
		if (!definition) throw new Error(`tool ${id} was not registered`);
		return definition.run(input);
	};

	return { ctx, call, saveAs, registered, fs: fsApi };
}

describe("sample paths", () => {
	it("joins relative paths onto the workspace", () => {
		expect(resolveSamplePath("/work", "demo.apk")).toBe("/work/demo.apk");
		expect(resolveSamplePath("/work", "./build/demo.apk")).toBe("/work/build/demo.apk");
		expect(resolveSamplePath("/work", "'quoted.apk'")).toBe("/work/quoted.apk");
	});

	it("does not climb above the workspace root", () => {
		expect(resolveSamplePath("/work", "../sibling.apk")).toBe("/work/sibling.apk");
		expect(resolveSamplePath("/work", "../../etc/passwd")).toBe("/work/etc/passwd");
		// The floor is the project root, not `/`: a nested cwd cannot be climbed out of either.
		// Entry points refuse such a path before it gets here (`isOutsideProject`), this is the backstop.
		expect(resolveSamplePath("/work/case-1", "../sibling.apk")).toBe("/work/case-1/sibling.apk");
		expect(resolveSamplePath("/work/case-1", "sub/../../x.apk")).toBe("/work/case-1/x.apk");
	});

	it("keeps absolute paths and reads both separators", () => {
		expect(isAbsolutePath("/tmp/a.apk")).toBe(true);
		expect(isAbsolutePath("C:\\samples\\a.apk")).toBe(true);
		expect(isAbsolutePath("samples/a.apk")).toBe(false);
		expect(baseName("/work/build/demo.apk")).toBe("demo.apk");
		expect(baseName("C:\\samples\\demo.apk")).toBe("demo.apk");
	});
});

describe("loadSample", () => {
	it("reads a file and reports its base name", async () => {
		const { fs } = fakeContext(new Map([["/work/demo.apk", buildApk()]]));
		const sample = await loadSample(fs, "/work", "demo.apk");
		expect(sample.name).toBe("demo.apk");
		expect(sample.bytes.byteLength).toBeGreaterThan(0);
	});

	it("explains missing, empty and oversized files", async () => {
		const { fs } = fakeContext(new Map([["/work/empty.bin", new Uint8Array(0)]]));
		await expect(loadSample(fs, "/work", "missing.apk")).rejects.toThrow("file not found");
		await expect(loadSample(fs, "/work", "empty.bin")).rejects.toThrow("is empty");

		const big = fakeContext(new Map([["/work/big.bin", new Uint8Array(8)]]));
		big.fs.stat = async () => ({ size: MAX_SAMPLE_BYTES + 1, modifiedAt: 0, createdAt: 0 });
		await expect(loadSample(big.fs, "/work", "big.bin")).rejects.toThrow("above the 32 MiB the host lets a plugin read");
	});
});

describe("agent tools", () => {
	it("registers every tool", () => {
		const { ctx, registered } = fakeContext(new Map());
		const disposables = registerTools(ctx);
		expect(disposables).toHaveLength(EXPECTED_TOOL_COUNT);
		expect(registered.map(item => item.id).sort()).toEqual([
			"decompile_android",
			"decompile_function",
			"diff_binaries",
			"diff_functions",
			"disassemble_dex_method",
			"disassemble_range",
			"explain_triage_finding",
			"export_triage_report",
			"frida_dump",
			"generate_artifact",
			"generate_hook",
			"ida_status",
			"init_task",
			"install_astravia",
			"install_toolchain",
			"kb_checklist",
			"kb_payloads",
			"list_code_symbols",
			"probe_environment",
			"read_doc",
			"record_case_note",
			"run_radare",
			"scan_binary_strings",
			"search_cases",
			"search_dex_symbols",
			"search_docs",
			"triage_binary",
			"triage_directory",
			"verify_signature",
			"write_assessment_report",
		]);
	});

	it("list_code_symbols reports a stripped binary instead of guessing", async () => {
		const { ctx, call } = fakeContext(new Map([["/work/demo.elf", buildElf()]]));
		registerTools(ctx);
		const output = await call("list_code_symbols", { path: "demo.elf" });
		expect(output).toContain("stripped");
	});

	it("disassemble_range needs a known architecture", async () => {
		const { ctx, call } = fakeContext(new Map([["/work/blob.bin", utf8("hello")]]));
		registerTools(ctx);
		const output = await call("disassemble_range", { path: "blob.bin" });
		expect(output).toContain("arch");
	});

	it("search_docs ranks a title hit above a path-only hit", async () => {
		const { ctx, call } = fakeContext(new Map());
		registerTools(ctx);
		const output = await call("search_docs", { query: "payment" });
		expect(output).toContain("kb/ctf-website/techniques/12-payment/payment-bypass");
		const rows = output.split("\n").filter(line => line.startsWith("| `"));
		expect(rows[0]).toContain("payment-bypass");
	});

	it("search_docs reports an empty result instead of inventing one", async () => {
		const { ctx, call } = fakeContext(new Map());
		registerTools(ctx);
		const output = await call("search_docs", { query: "zzzz-no-such-topic" });
		expect(output).toContain("No document in");
	});

	it("read_doc names an unknown id and points back at search_docs", async () => {
		const { ctx, call } = fakeContext(new Map());
		registerTools(ctx);
		const output = await call("read_doc", { id: "kb/not-a-document" });
		expect(output).toContain("No document with id");
		expect(output).toContain("search_docs");
	});

	it("read_doc marks the result as instruction material, not untrusted tool output", async () => {
		const { ctx, call } = fakeContext(new Map());
		registerTools(ctx);
		const output = await call("read_doc", { id: "kb/ctf-website/techniques/12-payment/payment-bypass" });
		// 宿主的「工具输出 = 不可信数据」规则会把这条结果归到材料类；provenance 行是运行时划界。
		expect(output).toContain("Kit document — instruction material");
		expect(output).toContain("not an untrusted tool result");
	});

	it("kb_checklist opens a named checklist and refuses to guess an unknown one", async () => {
		const { ctx, call } = fakeContext(new Map());
		registerTools(ctx);
		const hit = await call("kb_checklist", { checklist_type: "evidence" });
		expect(hit).toContain("kb/ctf-website/checklists/evidence");
		expect(hit).toContain("Kit document — instruction material");

		const miss = await call("kb_checklist", { checklist_type: "no-such-checklist" });
		expect(miss).toContain("No checklist type");
		// 未知类型必须把菜单交出来，而不是默默换成默认那篇。
		expect(miss).toContain("web_first_30_min");
		expect(miss).not.toContain("Kit document — instruction material");
	});

	it("kb_payloads returns one class and lists the real sections otherwise", async () => {
		const { ctx, call } = fakeContext(new Map());
		registerTools(ctx);
		const ssrf = await call("kb_payloads", { category: "ssrf" });
		expect(ssrf).toContain("## SSRF");
		expect(ssrf).not.toContain("alg=none");

		const unknown = await call("kb_payloads", { category: "xxe" });
		expect(unknown).toContain("No section matches");
		expect(unknown).toContain("Sections that exist");
		expect(unknown).toContain("SQLi");
	});

	it("diff_binaries reports identical samples", async () => {
		const { ctx, call } = fakeContext(new Map([
			["/work/a.bin", utf8("same")],
			["/work/b.bin", utf8("same")],
		]));
		registerTools(ctx);
		const output = await call("diff_binaries", { path: "a.bin", otherPath: "b.bin" });
		expect(output).toContain("Byte-identical");
	});

	it("triage_binary returns a markdown report", async () => {
		const { ctx, call } = fakeContext(new Map([["/work/demo.apk", buildApk()]]));
		registerTriageBinaryTool(ctx);
		const output = await call("triage_binary", { path: "demo.apk" });
		expect(output).toContain("# Binary triage — demo.apk");
		expect(output).toContain("Android package (APK)");
		expect(output).toContain("## Findings");
		expect(output.length).toBeLessThanOrEqual(4500);

		const full = await call("triage_binary", { path: "demo.apk", mode: "full" });
		expect(full.length).toBeGreaterThan(output.length);
	});

	it("triage_binary reports failures instead of throwing", async () => {
		const { ctx, call } = fakeContext(new Map());
		registerTriageBinaryTool(ctx);
		expect(await call("triage_binary", { path: "nope.apk" })).toContain("Triage failed: file not found");
	});

	it("scan_binary_strings filters with a query and shows offsets", async () => {
		const { ctx, call } = fakeContext(new Map([["/work/lib.so", buildElf()]]));
		registerScanStringsTool(ctx);
		const output = await call("scan_binary_strings", { path: "lib.so", query: "shstrtab" });
		expect(output).toContain("# Strings in lib.so");
		expect(output).toContain("shstrtab");
		expect(output).toMatch(/\| 0x[0-9a-f]+ \| ascii \|/);
		const empty = await call("scan_binary_strings", { path: "lib.so", query: "definitely-not-there" });
		expect(empty).toContain("No strings matched");
	});

	it("explain_finding explains real rule ids and rejects unknown ones", async () => {
		const { ctx, call } = fakeContext(new Map());
		registerExplainFindingTool(ctx);
		const output = await call("explain_triage_finding", { ruleId: "apk.debuggable,apk.exported-component" });
		expect(output).toContain("apk.debuggable");
		expect(output).toContain("debuggable");
		const unknown = await call("explain_triage_finding", { ruleId: "nope.not-registered" });
		expect(unknown).toContain("nope.not-registered");
	});

	it("export_triage_report writes through the save dialog", async () => {
		const { ctx, call, saveAs } = fakeContext(new Map([["/work/demo.apk", buildApk()]]), { saveAs: "/out/demo-triage.md" });
		registerExportReportTool(ctx);
		const output = await call("export_triage_report", { path: "demo.apk" });
		expect(saveAs).toHaveBeenCalledTimes(1);
		expect(output).toContain("/out/demo-triage.md");
		expect(output).toContain("risk");
		const content = String(saveAs.mock.calls[0]?.[1] ?? "");
		expect(content).toContain("# Binary triage — demo.apk");
	});

	it("export_triage_report honours a cancelled dialog", async () => {
		const { ctx, call } = fakeContext(new Map([["/work/demo.apk", buildApk()]]), { saveAs: null });
		registerExportReportTool(ctx);
		expect(await call("export_triage_report", { path: "demo.apk", format: "json" })).toContain("Export cancelled");
	});

	it("export_triage_report serialises JSON", async () => {
		const { ctx, call, saveAs } = fakeContext(new Map([["/work/demo.apk", buildApk()]]), { saveAs: "/out/demo-triage.json" });
		registerExportReportTool(ctx);
		await call("export_triage_report", { path: "demo.apk", format: "json" });
		const parsed = JSON.parse(String(saveAs.mock.calls[0]?.[1] ?? "{}")) as { schemaVersion: number };
		expect(parsed.schemaVersion).toBe(1);
	});

	it("scan_binary_strings validates its own input ranges", async () => {
		const { ctx, call } = fakeContext(new Map([["/work/blob.bin", utf8("alpha\0beta\0")]]));
		registerScanStringsTool(ctx);
		const output = await call("scan_binary_strings", { path: "blob.bin", minLength: 1, maxResults: 9999 });
		expect(output).toContain("alpha");
	});
});

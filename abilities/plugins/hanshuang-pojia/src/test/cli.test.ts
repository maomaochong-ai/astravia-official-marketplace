import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runCli } from "../cli/analyze";
import { buildApk, buildDexWithClasses, buildElfWithAddressedText, buildPe } from "./fixtures";

/**
 * CLI 的测试全部走真实文件系统：命令行的价值就在于「换一台机器、换一个样本还能跑」，
 * 用内存里的假 fs 测出来的绿是假的。
 */
let root = "";

function capture(): { out: string[]; err: string[]; sink: { write: (text: string) => void; writeError: (text: string) => void } } {
	const out: string[] = [];
	const err: string[] = [];
	return { out, err, sink: { write: text => out.push(text), writeError: text => err.push(text) } };
}

const code = new Uint8Array([
	0xb8, 0x01, 0x00, 0x00, 0x00, // mov eax, 1
	0xc3, // ret
	0xb8, 0x02, 0x00, 0x00, 0x00, // mov eax, 2
	0xc3, // ret
]);

beforeAll(async () => {
	root = await mkdtemp(join(tmpdir(), "hanshuang-cli-"));
	await writeFile(join(root, "gate.elf"), buildElfWithAddressedText(code, [{ name: "gate", offset: 0 }, { name: "helper", offset: 6 }]));
	await writeFile(
		join(root, "gate-patched.elf"),
		buildElfWithAddressedText(new Uint8Array([0xb8, 0x09, 0x00, 0x00, 0x00, 0xc3, 0xb8, 0x02, 0x00, 0x00, 0x00, 0xc3]), [
			{ name: "gate", offset: 0 },
			{ name: "helper", offset: 6 },
		]),
	);
	await writeFile(join(root, "clean.exe"), buildPe());
	await writeFile(join(root, "app.apk"), buildApk({ withDex: true }));
	await writeFile(join(root, "classes.dex"), buildDexWithClasses());
	await writeFile(join(root, "notes.txt"), "just text");
});

afterAll(async () => {
	if (root) await rm(root, { recursive: true, force: true });
});

describe("cli contract", () => {
	it("prints usage and exits 0 for --help", async () => {
		const { out, sink } = capture();
		expect(await runCli(["--help"], sink)).toBe(0);
		expect(out.join("\n")).toContain("Commands:");
	});

	it("exits 1 with usage on an unknown command", async () => {
		const { err, sink } = capture();
		expect(await runCli(["nope"], sink)).toBe(1);
		expect(err.join("\n")).toContain("unknown command");
	});

	it("exits 1 when a required path is missing", async () => {
		const { err, sink } = capture();
		expect(await runCli(["triage"], sink)).toBe(1);
		expect(err.join("\n")).toContain("a file path");
	});

	it("describes a file it cannot identify instead of failing", async () => {
		// triage 的职责是把拿到的东西说清楚：认不出格式也是一个结论，不是错误。
		const { out, sink } = capture();
		expect(await runCli(["triage", join(root, "notes.txt")], sink)).toBe(0);
		expect(out.join("\n")).toContain("Unrecognised");
	});

	it("exits 2 for a missing file rather than crashing", async () => {
		const { err, sink } = capture();
		expect(await runCli(["triage", join(root, "absent.elf")], sink)).toBe(2);
		expect(err.join("\n")).toContain("analysis failed");
	});
});

describe("cli commands", () => {
	it("triages an ELF and emits machine-readable json on request", async () => {
		const text = capture();
		expect(await runCli(["triage", join(root, "gate.elf")], text.sink)).toBe(0);
		expect(text.out.join("\n")).toContain("Risk");

		const json = capture();
		expect(await runCli(["triage", join(root, "gate.elf"), "--json"], json.sink)).toBe(0);
		const parsed = JSON.parse(json.out.join("\n")) as { target: { format: string }; risk: { score: number } };
		expect(parsed.target.format.toLowerCase()).toBe("elf");
		expect(typeof parsed.risk.score).toBe("number");
	});

	it("filters symbols by query and kind", async () => {
		const { out, sink } = capture();
		expect(await runCli(["symbols", join(root, "gate.elf"), "--query", "gate"], sink)).toBe(0);
		expect(out.join("\n")).toContain("gate");
		expect(out.join("\n")).not.toContain("imported_fn");
	});

	it("disassembles from a symbol name", async () => {
		const { out, sink } = capture();
		expect(await runCli(["disasm", join(root, "gate.elf"), "--symbol", "helper"], sink)).toBe(0);
		expect(out.join("\n")).toContain("mov");
	});

	it("decompiles a function by symbol and keeps the capability caveat", async () => {
		const { out, sink } = capture();
		expect(await runCli(["decompile", join(root, "gate.elf"), "--symbol", "gate"], sink)).toBe(0);
		const text = out.join("\n");
		expect(text).toContain("eax = 0x1;");
		expect(text).toContain("no type recovery");
	});

	it("rejects an unknown symbol instead of guessing an offset", async () => {
		const { err, sink } = capture();
		expect(await runCli(["decompile", join(root, "gate.elf"), "--symbol", "nope"], sink)).toBe(1);
		expect(err.join("\n")).toContain("no symbol matching nope");
	});

	it("diffs two builds semantically", async () => {
		const { out, sink } = capture();
		expect(await runCli(["diff", join(root, "gate.elf"), join(root, "gate-patched.elf")], sink)).toBe(0);
		const text = out.join("\n");
		expect(text).toContain("semantic diff");
		expect(text).toContain("constants-only");
	});

	it("generates a Dalvik hook script that only observes", async () => {
		const { out, sink } = capture();
		expect(await runCli(["hook", join(root, "classes.dex"), "--query", "license"], sink)).toBe(0);
		const text = out.join("\n");
		expect(text).toContain("Java.perform");
		expect(text).toContain("com.example.PremiumGate");
		expect(text).not.toContain("return true");
	});

	it("pulls the hook targets out of an APK as well as a bare dex", async () => {
		const { out, sink } = capture();
		expect(await runCli(["hook", join(root, "app.apk"), "--query", "license", "--package", "com.example.app"], sink)).toBe(0);
		expect(out.join("\n")).toContain("com.example.app");
	});

	it("searches the bundled documents and can print one body", async () => {
		const search = capture();
		expect(await runCli(["docs", "frida"], search.sink)).toBe(0);
		expect(search.out.join("\n")).toContain("match(es) for `frida`");

		const list = capture();
		expect(await runCli(["docs", "--group", "kit-docs"], list.sink)).toBe(0);
		const id = /^kit-docs\/\S+/m.exec(list.out.join("\n"))?.[0];
		expect(id).toBeTruthy();

		const body = capture();
		expect(await runCli(["docs", "--read", id!], body.sink)).toBe(0);
		expect(body.out.join("\n").length).toBeGreaterThan(200);
	});

	it("assembles instructions and refuses the ones it cannot encode", async () => {
		const ok = capture();
		expect(await runCli(["asm", "x86-64", "mov rax, rbx", "ret", "--address", "0x1000"], ok.sink)).toBe(0);
		const text = ok.out.join("\n");
		expect(text).toContain("48 8b c3");
		expect(text).toContain("round-trip through the plugin decoder");
		expect(text).toContain("bytes: 48 8b c3 c3");

		const mixed = capture();
		expect(await runCli(["asm", "x86-64", "nop", "mov al, bl"], mixed.sink)).toBe(2);
		expect(mixed.out.join("\n")).toContain("8-bit operands are not encodable");

		const wide = capture();
		expect(await runCli(["asm", "aarch64", "nop", "mov x0, #0x12345678"], wide.sink)).toBe(2);
		expect(wide.out.join("\n")).toContain("more than one instruction");
	});

	it("rejects an architecture it has no encoder for", async () => {
		const { err, sink } = capture();
		expect(await runCli(["asm", "mips", "nop"], sink)).toBe(1);
		expect(err.join("\n")).toContain("asm cannot encode for mips");
	});

	it("reports an unknown document id as a usage error", async () => {
		const { err, sink } = capture();
		expect(await runCli(["docs", "--read", "kb/does-not-exist"], sink)).toBe(1);
		expect(err.join("\n")).toContain("no document with id");
	});
});

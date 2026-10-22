import { describe, expect, it } from "vitest";
import { disasmArchFor, disassemble } from "../domain/native/disasm";
import { buildElf, buildElfWithSymbols } from "./fixtures";

function words(...values: number[]): Uint8Array {
	const out = new Uint8Array(values.length * 4);
	const view = new DataView(out.buffer);
	values.forEach((value, index) => view.setUint32(index * 4, value >>> 0, true));
	return out;
}

describe("disassembler architecture mapping", () => {
	it("maps the arch strings the native parsers produce", () => {
		expect(disasmArchFor("x86-64")).toBe("x86-64");
		expect(disasmArchFor("aarch64")).toBe("aarch64");
		expect(disasmArchFor("arm64")).toBe("aarch64");
		expect(disasmArchFor("i386")).toBe("x86");
		expect(disasmArchFor("mips")).toBe("unknown");
	});
});

describe("aarch64 decoding", () => {
	it("decodes a prologue, a call and a return", () => {
		const bytes = words(0xa9bf7bfd, 0x910003fd, 0x94000004, 0xd65f03c0);
		const result = disassemble(bytes, "aarch64");
		expect(result.instructions.map(instruction => instruction.text)).toEqual([
			"stp x29, x30, [sp, #-0x10]!",
			"add x29, sp, #0x0",
			"bl file+0x18",
			"ret",
		]);
		expect(result.truncated).toBe(false);
		expect(result.instructions[0]!.hex).toBe("fd 7b bf a9");
	});

	it("keeps an unknown encoding as a word instead of desynchronising", () => {
		const result = disassemble(words(0xffffffff, 0xd65f03c0), "aarch64");
		expect(result.instructions[0]!.text).toBe(".word 0xffffffff");
		expect(result.instructions[1]!.text).toBe("ret");
	});

	it("reports a trailing partial instruction", () => {
		const bytes = new Uint8Array([0xc0, 0x03, 0x5f]);
		const result = disassemble(bytes, "aarch64");
		expect(result.instructions).toEqual([]);
		expect(result.warnings.join(" ")).toContain("not a whole AArch64 instruction");
	});
});

describe("x86-64 decoding", () => {
	it("decodes a function prologue with a relative call", () => {
		const bytes = new Uint8Array([0x55, 0x48, 0x89, 0xe5, 0xe8, 0x10, 0x00, 0x00, 0x00, 0xc3]);
		const result = disassemble(bytes, "x86-64");
		expect(result.instructions.map(instruction => instruction.text)).toEqual([
			"push rbp",
			"mov rbp, rsp",
			"call file+0x19",
			"ret",
		]);
	});

	it("decodes a sub rsp with an immediate and a rip-relative load", () => {
		const bytes = new Uint8Array([0x48, 0x83, 0xec, 0x28, 0x48, 0x8b, 0x05, 0x10, 0x00, 0x00, 0x00]);
		const result = disassemble(bytes, "x86-64");
		expect(result.instructions[0]!.text).toBe("sub rsp, 0x28");
		expect(result.instructions[1]!.text).toBe("mov rax, [rip + 0x10]");
	});

	it("decodes conditional jumps with their target offset", () => {
		const bytes = new Uint8Array([0x74, 0x02, 0x90, 0x90]);
		const result = disassemble(bytes, "x86-64");
		expect(result.instructions[0]!.text).toBe("je file+0x4");
	});

	it("falls back to a single byte for an undecodable opcode", () => {
		const bytes = new Uint8Array([0x0f, 0xff, 0xc3]);
		const result = disassemble(bytes, "x86-64");
		expect(result.instructions[0]!.text.startsWith("db 0x0f")).toBe(true);
		expect(result.instructions[1]!.text).toBe("ret");
	});

	it("stops at the instruction budget and marks the result truncated", () => {
		const bytes = new Uint8Array(64).fill(0x90);
		const result = disassemble(bytes, "x86-64", { max: 4 });
		expect(result.instructions).toHaveLength(4);
		expect(result.truncated).toBe(true);
	});

	it("refuses to decode an architecture it has no decoder for", () => {
		const result = disassemble(buildElf(), "mips");
		expect(result.instructions).toEqual([]);
		expect(result.warnings.join(" ")).toContain("no linear-sweep decoder");
	});

	it("walks a real ELF .text section", () => {
		const result = disassemble(buildElfWithSymbols(), "x86-64", { offset: 64, length: 5 });
		expect(result.instructions.map(instruction => instruction.text)).toEqual(["push rbp", "mov rbp, rsp", "ret"]);
	});
});

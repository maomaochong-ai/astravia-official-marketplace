import { describe, expect, it } from "vitest";
import { decodeAt } from "../../domain/native/insn";
import {
	EncodeError,
	MAX_PROGRAM_LINES,
	encodeArchFor,
	encodeInstruction,
	encodeProgram,
	verifyEncoding,
	type Encoded,
} from "../../domain/native/encode";

/** 编码 → 用自己的解码器读回来。文本或长度对不上就是失败，不看「看起来像」。 */
function assertRoundTrip(encoded: Encoded, address = encoded.address): void {
	const buffer = new Uint8Array(address + encoded.size);
	buffer.set(encoded.bytes, address);
	const decoded = decodeAt(buffer, encoded.arch, address);
	expect(decoded).not.toBeNull();
	expect(decoded!.size).toBe(encoded.size);
	expect(decoded!.text).toBe(encoded.text);
}

function expectThrows(run: () => unknown, pattern: RegExp): EncodeError {
	try {
		run();
	} catch (error) {
		expect(error).toBeInstanceOf(EncodeError);
		const failure = error as EncodeError;
		expect(failure.message).toMatch(pattern);
		return failure;
	}
	throw new Error(`expected a throw matching ${pattern}`);
}

describe("encode arch resolution", () => {
	it("normalises the spellings the decoder already accepts", () => {
		expect(encodeArchFor("x86-64")).toBe("x86-64");
		expect(encodeArchFor("X86_64")).toBe("x86-64");
		expect(encodeArchFor("amd64")).toBe("x86-64");
		expect(encodeArchFor("x64")).toBe("x86-64");
		expect(encodeArchFor("aarch64")).toBe("aarch64");
		expect(encodeArchFor("arm64")).toBe("aarch64");
		expect(encodeArchFor("x86")).toBe("x86");
		expect(encodeArchFor("i386")).toBe("x86");
	});

	it("refuses architectures it cannot write", () => {
		expect(encodeArchFor("arm")).toBeNull();
		expect(encodeArchFor("mips")).toBeNull();
		const failure = expectThrows(() => encodeInstruction({ arch: "arm", text: "nop" }), /no encoder for architecture arm/);
		expect(failure.hints.join(" ")).toContain("aarch64");
	});
});

describe("x86-64 encoding", () => {
	const cases: [string, string, string][] = [
		["nop", "90", "nop"],
		["ret", "c3", "ret"],
		["mov rax, rbx", "48 8b c3", "mov rax, rbx"],
		["mov rbx, rax", "48 8b d8", "mov rbx, rax"],
		["mov rax, r8", "49 8b c0", "mov rax, r8"],
		["mov r8, r15", "4d 8b c7", "mov r8, r15"],
		["mov rax, 0x10", "48 c7 c0 10 00 00 00", "mov rax, 0x10"],
		["mov rax, -0x10", "48 c7 c0 f0 ff ff ff", "mov rax, -0x10"],
		["add rbx, 0x10", "48 81 c3 10 00 00 00", "add rbx, 0x10"],
		["sub rsp, 0x20", "48 81 ec 20 00 00 00", "sub rsp, 0x20"],
		["xor rax, rax", "48 33 c0", "xor rax, rax"],
		["cmp rax, rbx", "48 3b c3", "cmp rax, rbx"],
		["cmp rax, 0x0", "48 81 f8 00 00 00 00", "cmp rax, 0x0"],
		["mov rax, [rbp - 0x8]", "48 8b 45 f8", "mov rax, [rbp - 0x8]"],
		["mov [rbp - 0x8], rax", "48 89 45 f8", "mov [rbp - 0x8], rax"],
		["mov rax, [rsp]", "48 8b 04 24", "mov rax, [rsp]"],
		["mov rax, [r13]", "49 8b 45 00", "mov rax, [r13]"],
		["mov rax, [rip + 0x10]", "48 8b 05 10 00 00 00", "mov rax, [rip + 0x10]"],
		["add [rbx + 0x8], rax", "48 01 43 08", "add [rbx + 0x8], rax"],
		["mov [rbx], 0x1", "c7 03 01 00 00 00", "mov [rbx], 0x1"],
		["mov rax, 0x1122334455", "48 b8 55 44 33 22 11 00 00 00", "mov rax, 0x1122334455"],
	];

	for (const [text, hex, canonical] of cases) {
		it(`encodes ${text}`, () => {
			const encoded = encodeInstruction({ arch: "x86-64", text });
			expect(encoded.hex).toBe(hex);
			expect(encoded.text).toBe(canonical);
			expect(encoded.size).toBe(hex.split(" ").length);
			assertRoundTrip(encoded);
			expect(verifyEncoding(encoded).ok).toBe(true);
		});
	}

	it("keeps the 0x81 immediate unsigned, which is how the decoder renders imm32", () => {
		const encoded = encodeInstruction({ arch: "x86-64", text: "add rbx, -0x10" });
		expect(encoded.hex).toBe("48 81 c3 f0 ff ff ff");
		expect(encoded.text).toBe("add rbx, 0xfffffff0");
		assertRoundTrip(encoded);
	});

	it("uses rbp/r13-safe mod=01 even at displacement 0", () => {
		expect(encodeInstruction({ arch: "x86-64", text: "mov rax, [rbp]" }).hex).toBe("48 8b 45 00");
		expect(encodeInstruction({ arch: "x86-64", text: "mov rax, [rax]" }).hex).toBe("48 8b 00");
	});
});

describe("x86-64 branches", () => {
	it("computes rel32 forward", () => {
		const encoded = encodeInstruction({ arch: "x86-64", text: "jmp 0x1010", address: 0x1000 });
		expect(encoded.hex).toBe("e9 0b 00 00 00");
		expect(encoded.text).toBe("jmp file+0x1010");
		assertRoundTrip(encoded);
	});

	it("computes rel32 backward", () => {
		const encoded = encodeInstruction({ arch: "x86-64", text: "call 0x1000", address: 0x1010 });
		expect(encoded.hex).toBe("e8 eb ff ff ff");
		expect(encoded.text).toBe("call file+0x1000");
		assertRoundTrip(encoded);
	});

	it("matches the decoder for a raw call at offset 0", () => {
		const encoded = encodeInstruction({ arch: "x86-64", text: "call 0x2000", address: 0x1000 });
		expect(encoded.hex).toBe("e8 fb 0f 00 00");
		assertRoundTrip(encoded);
	});
});

describe("x86 encoding", () => {
	const cases: [string, string][] = [
		["nop", "90"],
		["ret", "c3"],
		["mov eax, ebx", "8b c3"],
		["mov eax, 0x10", "c7 c0 10 00 00 00"],
		["add ebx, 0x10", "81 c3 10 00 00 00"],
		["sub esp, 0x20", "81 ec 20 00 00 00"],
		["sub eax, 0x1", "81 e8 01 00 00 00"],
		["call 0x2000", "e8 fb 0f 00 00"],
	];

	for (const [text, hex] of cases) {
		it(`encodes ${text} at 32 bits`, () => {
			const encoded = encodeInstruction({ arch: "x86", text, address: text.startsWith("call") ? 0x1000 : 0 });
			expect(encoded.hex).toBe(hex);
			assertRoundTrip(encoded);
		});
	}

	it("keeps 64-bit registers out of the 32-bit encoder", () => {
		expectThrows(() => encodeInstruction({ arch: "x86", text: "mov rax, rbx" }), /needs architecture x86-64/);
		expectThrows(() => encodeInstruction({ arch: "x86", text: "mov r8d, r9d" }), /extended registers/);
	});

	it("refuses 8- and 16-bit operands instead of guessing imm width", () => {
		expectThrows(() => encodeInstruction({ arch: "x86-64", text: "mov al, bl" }), /8-bit operands are not encodable/);
		expectThrows(() => encodeInstruction({ arch: "x86-64", text: "add ax, 0x10" }), /16-bit operands are not encodable/);
	});

	it("rejects immediates that cannot survive the round trip", () => {
		const failure = expectThrows(() => encodeInstruction({ arch: "x86-64", text: "mov rax, 0x100000000" }), /no faithful encoding/);
		expect(failure.hints.join(" ")).toContain("32-bit register");
	});
});

describe("aarch64 encoding", () => {
	const cases: [string, string, string][] = [
		["nop", "1f 20 03 d5", "nop"],
		["ret", "c0 03 5f d6", "ret"],
		["ret x30", "c0 03 5f d6", "ret"],
		["ret x19", "60 02 5f d6", "ret x19"],
		["mov x0, x1", "e0 03 01 aa", "mov x0, x1"],
		["mov w0, w1", "e0 03 01 2a", "mov w0, w1"],
		["mov x0, #0x10", "00 02 80 d2", "movz x0, #0x10"],
		["movz w1, #0x20", "01 04 80 52", "movz w1, #0x20"],
		["mov x0, #0x1234, lsl #16", "80 46 a2 d2", "movz x0, #0x1234, lsl #16"],
		["add x0, x0, #0x10", "00 40 00 91", "add x0, x0, #0x10"],
		["add x0, x1, x2", "20 00 02 8b", "add x0, x1, x2"],
		["add x0, x0, #0x1, lsl #12", "00 04 40 91", "add x0, x0, #0x1, lsl #12"],
		["sub sp, sp, #0x20", "ff 83 00 d1", "sub sp, sp, #0x20"],
		["sub w0, w1, w2", "20 00 02 4b", "sub w0, w1, w2"],
		["xor x0, x1, x2", "20 00 02 ca", "eor x0, x1, x2"],
		["eor w0, w1, w2", "20 00 02 4a", "eor w0, w1, w2"],
		["cmp x0, x1", "1f 00 01 eb", "cmp x0, x1"],
		["cmp x0, #0x0", "1f 00 00 f1", "cmp x0, #0x0"],
		["cmp x0, #0x10", "1f 40 00 f1", "cmp x0, #0x10"],
		["cmp w0, w1", "1f 00 01 6b", "cmp w0, w1"],
	];

	for (const [text, hex, canonical] of cases) {
		it(`encodes ${text}`, () => {
			const encoded = encodeInstruction({ arch: "aarch64", text });
			expect(encoded.hex).toBe(hex);
			expect(encoded.text).toBe(canonical);
			assertRoundTrip(encoded);
			expect(verifyEncoding(encoded).ok).toBe(true);
		});
	}

	it("uses the real mnemonics for jmp and call", () => {
		const forward = encodeInstruction({ arch: "aarch64", text: "jmp 0x1010", address: 0x1000 });
		expect(forward.hex).toBe("04 00 00 14");
		expect(forward.text).toBe("b file+0x1010");
		assertRoundTrip(forward);

		const call = encodeInstruction({ arch: "aarch64", text: "call 0x2000", address: 0x1000 });
		expect(call.hex).toBe("00 04 00 94");
		expect(call.text).toBe("bl file+0x2000");
		assertRoundTrip(call);

		const backward = encodeInstruction({ arch: "aarch64", text: "bl 0x1000", address: 0x1010 });
		expect(backward.hex).toBe("fc ff ff 97");
		assertRoundTrip(backward);
	});

	it("refuses targets a single instruction cannot reach", () => {
		expectThrows(() => encodeInstruction({ arch: "aarch64", text: "b 0x1002", address: 0x1000 }), /not 4-byte aligned/);
		expectThrows(() => encodeInstruction({ arch: "aarch64", text: "b 0x80000000", address: 0 }), /out of range/);
	});

	it("keeps sp only where 31 really means sp", () => {
		expect(encodeInstruction({ arch: "aarch64", text: "add sp, sp, #0x20" }).hex).toBe("ff 83 00 91");
		expect(encodeInstruction({ arch: "aarch64", text: "sub x0, sp, #0x10" }).hex).toBe("e0 43 00 d1");
		expectThrows(() => encodeInstruction({ arch: "aarch64", text: "cmp sp, #0x0" }), /cannot use sp/);
		expectThrows(() => encodeInstruction({ arch: "aarch64", text: "mov x0, sp" }), /cannot read sp/);
		expectThrows(() => encodeInstruction({ arch: "aarch64", text: "eor sp, x0, x1" }), /cannot use sp/);
		expectThrows(() => encodeInstruction({ arch: "aarch64", text: "add x0, xzr, #0x1" }), /zero register/);
	});

	it("refuses multi-instruction immediates instead of splitting them", () => {
		const failure = expectThrows(() => encodeInstruction({ arch: "aarch64", text: "mov x0, #0x12345678" }), /more than one instruction/);
		expect(failure.hints.join(" ")).toContain("movz + movk");
		expectThrows(() => encodeInstruction({ arch: "aarch64", text: "mov x0, #-0x1" }), /unsigned immediates/);
		expectThrows(() => encodeInstruction({ arch: "aarch64", text: "add x0, x0, #0x1234" }), /out of range/);
	});
});

describe("encode errors", () => {
	it("suggests the nearest mnemonic", () => {
		const failure = expectThrows(() => encodeInstruction({ arch: "x86-64", text: "moov rax, rbx" }), /unsupported mnemonic/);
		expect(failure.hints).toContain("mov");
	});

	it("rejects directives, labels and scaled memory operands", () => {
		expectThrows(() => encodeInstruction({ arch: "x86-64", text: ".byte 0x90" }), /directives are not encodable/);
		expectThrows(() => encodeInstruction({ arch: "x86-64", text: "jmp loc_1000" }), /needs a numeric target/);
		expectThrows(() => encodeInstruction({ arch: "x86-64", text: "mov rax, [rbx + rcx*4]" }), /scaled index/);
		expectThrows(() => encodeInstruction({ arch: "x86-64", text: "mov rax, [rbx + 0x10" }), /cannot read operand/);
	});

	it("rejects empty text, oversized text and bad addresses", () => {
		expectThrows(() => encodeInstruction({ arch: "x86-64", text: "   " }), /instruction text is empty/);
		expectThrows(() => encodeInstruction({ arch: "x86-64", text: `mov rax, 0x${"1".repeat(200)}` }), /longer than 200/);
		expectThrows(() => encodeInstruction({ arch: "x86-64", text: "nop", address: -1 }), /non-negative integer/);
		expectThrows(() => encodeInstruction({ arch: "x86-64", text: "add rax" }), /expects 2 operand/);
	});

	it("strips comments but keeps the # immediate prefix", () => {
		expect(encodeInstruction({ arch: "x86-64", text: "ret ; done" }).hex).toBe("c3");
		expect(encodeInstruction({ arch: "x86-64", text: "ret // done" }).hex).toBe("c3");
		expect(encodeInstruction({ arch: "aarch64", text: "mov x0, #0x10 // keep" }).hex).toBe("00 02 80 d2");
	});
});

describe("encodeProgram", () => {
	it("advances addresses and keeps going past a bad line", () => {
		const program = encodeProgram({ arch: "x86-64", address: 0x1000, lines: ["nop", "mov rax, rbx", "mov al, bl", "ret"] });
		expect(program.failed).toBe(1);
		expect(program.items.map(item => item.address)).toEqual([0x1000, 0x1001, 0x1004, 0x1004]);
		expect(program.items[2]!.error).toMatch(/8-bit/);
		expect(program.items[2]!.hints!.length).toBeGreaterThan(0);
		expect(program.items[3]!.encoded!.address).toBe(0x1004);
		expect(Array.from(program.bytes, byte => byte.toString(16).padStart(2, "0")).join(" ")).toBe("90 48 8b c3 c3");
	});

	it("skips blank and comment lines", () => {
		const program = encodeProgram({ arch: "aarch64", lines: ["", "  ; note", "nop", "// other"] });
		expect(program.items).toHaveLength(1);
		expect(program.bytes.byteLength).toBe(4);
	});

	it("keeps branch targets consistent across a program", () => {
		const program = encodeProgram({ arch: "aarch64", address: 0x1000, lines: ["nop", "b 0x1010"] });
		expect(program.items[1]!.encoded!.hex).toBe("03 00 00 14");
		expect(program.items[1]!.encoded!.text).toBe("b file+0x1010");
	});

	it("refuses runaway input", () => {
		const lines = new Array(MAX_PROGRAM_LINES + 1).fill("nop");
		expectThrows(() => encodeProgram({ arch: "x86-64", lines }), /more than 500 lines/);
		expectThrows(() => encodeProgram({ arch: "unknown", lines: ["nop"] }), /no encoder/);
	});
});

describe("verifyEncoding", () => {
	it("has teeth", () => {
		const encoded = encodeInstruction({ arch: "x86-64", text: "mov rax, rbx" });
		const tampered: Encoded = { ...encoded, text: "mov rbx, rax" };
		const check = verifyEncoding(tampered);
		expect(check.ok).toBe(false);
		expect(check.decoded).toBe("mov rax, rbx");
	});

	it("places branch bytes at their address before decoding", () => {
		const encoded = encodeInstruction({ arch: "x86-64", text: "jmp 0x401010", address: 0x401000 });
		const check = verifyEncoding(encoded);
		expect(check.exact).toBe(true);
		expect(check.ok).toBe(true);
		expect(check.decoded).toBe("jmp file+0x401010");
	});

	it("degrades to a size check for addresses too far to pad", () => {
		const encoded = encodeInstruction({ arch: "aarch64", text: "b 0x2000010", address: 0x2000000 });
		const check = verifyEncoding(encoded);
		expect(check.exact).toBe(false);
		expect(check.ok).toBe(true);
		expect(check.decoded).toContain("file+0x");
	});
});

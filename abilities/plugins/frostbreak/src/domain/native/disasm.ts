/**
 * Bounded linear sweep disassembly for the two architectures that show up in
 * the samples this plugin triages. It is deliberately not a decompiler and not
 * a control-flow-aware disassembler: it walks a byte range once, decodes the
 * instruction forms it knows, and emits `.byte` / `.word` for the rest so that
 * an unknown encoding never desynchronises the rest of the listing.
 *
 * Addresses are file offsets. Branch targets are therefore printed as
 * `file+0x…`, which is exact for following code in the file but is not a
 * virtual address.
 */

export type DisasmArch = "aarch64" | "x86-64" | "x86" | "arm" | "unknown";

export interface Instruction {
	offset: number;
	hex: string;
	text: string;
}

export interface DisasmResult {
	arch: DisasmArch;
	instructions: Instruction[];
	truncated: boolean;
	warnings: string[];
}

const MAX_INSTRUCTIONS = 4096;

export function disasmArchFor(arch: string): DisasmArch {
	const value = arch.toLowerCase();
	if (value.includes("aarch64") || value === "arm64") return "aarch64";
	if (value === "x86-64" || value === "x86_64" || value === "amd64" || value === "x64") return "x86-64";
	if (value === "x86" || value === "i386" || value === "i686" || value === "ia32") return "x86";
	if (value.startsWith("arm")) return "arm";
	return "unknown";
}

function signExtend(value: number, bits: number): number {
	const limit = 2 ** (bits - 1);
	return value >= limit ? value - 2 ** bits : value;
}

function hex(value: number, width = 0): string {
	const text = (value >>> 0).toString(16);
	return width > 0 ? text.padStart(width, "0") : text;
}

function signed(value: number): string {
	return value < 0 ? `-0x${hex(-value)}` : `0x${hex(value)}`;
}

/* ------------------------------------------------------------------ AArch64 */

const CONDITIONS = ["eq", "ne", "cs", "cc", "mi", "pl", "vs", "vc", "hi", "ls", "ge", "lt", "gt", "le", "al", "nv"];

function x(index: number): string {
	return index === 31 ? "sp" : `x${index}`;
}

function w(index: number): string {
	return index === 31 ? "wsp" : `w${index}`;
}

function decodeAarch64(word: number, offset: number): string {
	const rd = (word & 0x1f) >>> 0;
	const rn = (word >>> 5) & 0x1f;
	const rm = (word >>> 16) & 0x1f;
	const sf = (word >>> 31) === 1;
	const r = sf ? x : w;
	const at = (delta: number): string => `file+0x${hex(offset + delta)}`;

	if (word === 0xd503201f) return "nop";
	if (word === 0xd65f03c0) return "ret";
	if (((word & 0xfffffc1f) >>> 0) === 0xd65f0000) return `ret ${x(rn)}`;
	if (((word & 0xfffffc1f) >>> 0) === 0xd61f0000) return `br ${x(rn)}`;
	if (((word & 0xfffffc1f) >>> 0) === 0xd63f0000) return `blr ${x(rn)}`;
	if (((word & 0xffe0001f) >>> 0) === 0xd4000001) return `svc #0x${hex((word >>> 5) & 0xffff)}`;

	if (((word & 0xfc000000) >>> 0) === 0x94000000) {
		const imm = signExtend(word & 0x03ffffff, 26) * 4;
		return `bl ${at(imm)}`;
	}
	if (((word & 0xfc000000) >>> 0) === 0x14000000) {
		const imm = signExtend(word & 0x03ffffff, 26) * 4;
		return `b ${at(imm)}`;
	}
	if (((word & 0xff000010) >>> 0) === 0x54000000) {
		const imm = signExtend((word >>> 5) & 0x7ffff, 19) * 4;
		return `b.${CONDITIONS[word & 0x0f]} ${at(imm)}`;
	}
	if (((word & 0x7e000000) >>> 0) === 0x34000000 || ((word & 0x7e000000) >>> 0) === 0x35000000) {
		const imm = signExtend((word >>> 5) & 0x7ffff, 19) * 4;
		const branch = ((word & 0x01000000) >>> 0) === 0 ? "cbz" : "cbnz";
		return `${branch} ${r(rd)}, ${at(imm)}`;
	}
	if (((word & 0x7e000000) >>> 0) === 0x36000000) {
		const bit = ((word >>> 31) << 2) | ((word >>> 19) & 3);
		const imm = signExtend((word >>> 5) & 0x3fff, 14) * 4;
		const branch = ((word & 0x01000000) >>> 0) === 0 ? "tbz" : "tbnz";
		return `${branch} ${r(rd)}, #${bit}, ${at(imm)}`;
	}

	const immlo = (word >>> 29) & 3;
	const immhi = (word >>> 5) & 0x7ffff;
	const adrImm = signExtend((immhi << 2) | immlo, 21);
	if (((word & 0x9f000000) >>> 0) === 0x10000000) return `adr x${rd}, ${at(adrImm)}`;
	if (((word & 0x9f000000) >>> 0) === 0x90000000) return `adrp x${rd}, page${signed(adrImm << 12)}`;

	const imm16 = (word >>> 5) & 0xffff;
	const shift = ((word >>> 21) & 3) * 16;
	const opc = (word >>> 29) & 3;
	if (((word & 0x1f800000) >>> 0) === 0x12800000) {
		const name = opc === 2 ? "movz" : opc === 0 ? "movn" : opc === 3 ? "movk" : null;
		if (name) return `${name} ${r(rd)}, #0x${hex(imm16)}${shift > 0 ? `, lsl #${shift}` : ""}`;
	}

	const imm12 = (word >>> 10) & 0xfff;
	const lsl12 = ((word >>> 22) & 1) === 1 ? `, lsl #12` : "";
	const arith = (word & 0xff000000) >>> 0;
	if (arith === 0x91000000 || arith === 0xd1000000 || arith === 0x11000000 || arith === 0x51000000) {
		const isSub = ((word & 0x40000000) >>> 0) !== 0;
		const setsFlags = ((word & 0x20000000) >>> 0) !== 0;
		if (setsFlags && rd === 31) return `cmp ${r(rn)}, #0x${hex(imm12)}${lsl12}`;
		const name = isSub ? "sub" : "add";
		return `${name}${setsFlags ? "s" : ""} ${r(rd)}, ${r(rn)}, #0x${hex(imm12)}${lsl12}`;
	}

	const loadStore = (word & 0xffc00000) >>> 0;
	const sizeCode = (word >>> 30) & 3;
	const unit = sizeCode === 0 ? 1 : sizeCode === 1 ? 2 : sizeCode === 2 ? 4 : 8;
	const suffix = sizeCode === 3 ? "" : sizeCode === 2 ? "" : sizeCode === 1 ? "h" : "b";
	if (loadStore === 0xf9400000 || loadStore === 0xb9400000 || loadStore === 0x39400000 || loadStore === 0x79400000) {
		const register = sizeCode === 3 ? x(rd) : sizeCode === 2 ? w(rd) : w(rd);
		return `ldr${suffix} ${register}, [${x(rn)}, #0x${hex(imm12 * unit)}]`;
	}
	if (loadStore === 0xf9000000 || loadStore === 0xb9000000 || loadStore === 0x39000000 || loadStore === 0x79000000) {
		const register = sizeCode === 3 ? x(rd) : w(rd);
		return `str${suffix} ${register}, [${x(rn)}, #0x${hex(imm12 * unit)}]`;
	}
	if (loadStore === 0x58000000 || loadStore === 0x18000000) {
		const imm = signExtend((word >>> 5) & 0x7ffff, 19) * 4;
		return `ldr ${loadStore === 0x58000000 ? x(rd) : w(rd)}, ${at(imm)}`;
	}

	const pair = (word & 0xffc00000) >>> 0;
	if (pair === 0xa9000000 || pair === 0xa9800000 || pair === 0xa8800000) {
		const imm = signExtend((word >>> 15) & 0x7f, 7) * 8;
		const base = x(rn);
		const address = pair === 0xa9800000 ? `[${base}, #${signed(imm)}]!` : pair === 0xa8800000 ? `[${base}], #${signed(imm)}` : `[${base}, #${signed(imm)}]`;
		return `stp ${x(rd)}, ${x((word >>> 10) & 0x1f)}, ${address}`;
	}
	if (pair === 0xa9400000 || pair === 0xa9c00000 || pair === 0xa8c00000) {
		const imm = signExtend((word >>> 15) & 0x7f, 7) * 8;
		const base = x(rn);
		const address = pair === 0xa9c00000 ? `[${base}, #${signed(imm)}]!` : pair === 0xa8c00000 ? `[${base}], #${signed(imm)}` : `[${base}, #${signed(imm)}]`;
		return `ldp ${x(rd)}, ${x((word >>> 10) & 0x1f)}, ${address}`;
	}

	if (((word & 0xffe0ffe0) >>> 0) === 0xaa0003e0) return `mov x${rd}, x${rm}`;
	if (((word & 0xffe0ffe0) >>> 0) === 0x2a0003e0) return `mov w${rd}, w${rm}`;
	if (((word & 0xff200000) >>> 0) === 0x8b000000) {
		const setsFlags = ((word & 0x20000000) >>> 0) !== 0;
		if (setsFlags && rd === 31) return `cmp x${rn}, x${rm}`;
		return `${setsFlags ? "adds" : "add"} x${rd}, x${rn}, x${rm}`;
	}
	if (((word & 0xff200000) >>> 0) === 0xeb000000) {
		if (rd === 31) return `cmp x${rn}, x${rm}`;
		return `subs x${rd}, x${rn}, x${rm}`;
	}

	return `.word 0x${hex(word, 8)}`;
}

/* -------------------------------------------------------------------- x86 */

const REG_64 = ["rax", "rcx", "rdx", "rbx", "rsp", "rbp", "rsi", "rdi", "r8", "r9", "r10", "r11", "r12", "r13", "r14", "r15"];
const REG_32 = ["eax", "ecx", "edx", "ebx", "esp", "ebp", "esi", "edi", "r8d", "r9d", "r10d", "r11d", "r12d", "r13d", "r14d", "r15d"];
const REG_16 = ["ax", "cx", "dx", "bx", "sp", "bp", "si", "di", "r8w", "r9w", "r10w", "r11w", "r12w", "r13w", "r14w", "r15w"];
const REG_8 = ["al", "cl", "dl", "bl", "spl", "bpl", "sil", "dil", "r8b", "r9b", "r10b", "r11b", "r12b", "r13b", "r14b", "r15b"];

type RegisterSize = 8 | 16 | 32 | 64;

function registerName(index: number, size: RegisterSize): string {
	if (size === 64) return REG_64[index]!;
	if (size === 32) return REG_32[index]!;
	if (size === 16) return REG_16[index]!;
	return REG_8[index]!;
}

const JCC = ["o", "no", "b", "ae", "e", "ne", "be", "a", "s", "ns", "p", "np", "l", "ge", "le", "g"];
const GROUP1 = ["add", "or", "adc", "sbb", "and", "sub", "xor", "cmp"];

interface X86State {
	bytes: Uint8Array;
	cursor: number;
	rex: number;
	operandSize16: boolean;
	mode64: boolean;
}

function need(state: X86State, count: number): void {
	if (state.cursor + count > state.bytes.byteLength) throw new RangeError("truncated instruction");
}

function readU8(state: X86State): number {
	need(state, 1);
	return state.bytes[state.cursor++]!;
}

function readU32(state: X86State): number {
	need(state, 4);
	const view = new DataView(state.bytes.buffer, state.bytes.byteOffset, state.bytes.byteLength);
	const value = view.getUint32(state.cursor, true);
	state.cursor += 4;
	return value;
}

function readI8(state: X86State): number {
	need(state, 1);
	return new Int8Array(state.bytes.buffer, state.bytes.byteOffset + state.cursor++, 1)[0]!;
}

function readI32(state: X86State): number {
	const value = readU32(state);
	return value >= 0x80000000 ? value - 0x100000000 : value;
}

function sizeOf(state: X86State, wide: boolean): RegisterSize {
	if (state.operandSize16) return 16;
	return wide ? 64 : 32;
}

interface ModRm {
	rm: string;
	regIndex: number;
	/** mod === 3 时目标寄存器的真实编号（含 REX.B）；内存寻址时为 -1。 */
	rmIndex: number;
	reg: (size: RegisterSize) => string;
	next: number;
}

function readModRm(state: X86State): ModRm {
	const modrm = readU8(state);
	const mod = modrm >> 6;
	const regField = (modrm >> 3) & 7;
	const rmField = modrm & 7;
	const rexR = (state.rex & 0x04) !== 0 ? 8 : 0;
	const rexB = (state.rex & 0x01) !== 0 ? 8 : 0;
	const rexX = (state.rex & 0x02) !== 0 ? 8 : 0;
	const regIndex = regField | rexR;
	const reg = (size: RegisterSize): string => registerName(regIndex, size);

	if (mod === 3) return { rm: "reg", regIndex, rmIndex: rmField | rexB, reg, next: state.cursor };

	let base = "";
	let index = "";
	let scale = 1;
	if (rmField === 4) {
		const sib = readU8(state);
		const scaleCode = (sib >> 6) & 3;
		scale = 2 ** scaleCode;
		const indexField = (sib >> 3) & 7;
		const baseField = sib & 7;
		if (!(indexField === 4 && rexX === 0)) index = registerName(indexField | rexX, 64);
		if (baseField === 5 && mod === 0) base = "";
		else base = registerName(baseField | rexB, 64);
	} else if (mod === 0 && rmField === 5) {
		base = "rip";
	} else {
		base = registerName(rmField | rexB, 64);
	}

	let displacement = 0;
	if (mod === 1) displacement = readI8(state);
	else if (mod === 2 || (mod === 0 && rmField === 5)) displacement = readI32(state);

	const parts: string[] = [];
	if (base !== "") parts.push(base);
	if (index !== "") parts.push(scale > 1 ? `${index}*${scale}` : index);
	if (displacement !== 0 || parts.length === 0) parts.push(displacement < 0 ? `-0x${hex(-displacement)}` : `0x${hex(displacement)}`);
	const rmText = `[${parts.join(" + ").replace("+ -", "- ")}]`;
	return { rm: rmText, regIndex, rmIndex: -1, reg, next: state.cursor };
}

interface Decoded {
	text: string;
	size: number;
}

function decodeX86(bytes: Uint8Array, offset: number, mode64: boolean): Decoded {
	const state: X86State = { bytes, cursor: offset, rex: 0, operandSize16: false, mode64 };

	while (state.cursor < bytes.byteLength) {
		const byte = bytes[state.cursor]!;
		if (byte === 0x66) {
			state.operandSize16 = true;
			state.cursor += 1;
			continue;
		}
		if (byte === 0x67 || byte === 0xf0 || byte === 0xf2 || byte === 0xf3 || byte === 0x2e || byte === 0x36 || byte === 0x3e || byte === 0x26 || byte === 0x64 || byte === 0x65) {
			state.cursor += 1;
			continue;
		}
		if (byte >= 0x40 && byte <= 0x4f) {
			state.rex = byte;
			state.cursor += 1;
			continue;
		}
		break;
	}

	const wide = (state.rex & 0x08) !== 0;
	const start = state.cursor;
	const opcode = readU8(state);
	const finish = (text: string): Decoded => ({ text, size: state.cursor - offset });

	if (opcode === 0x90) return finish("nop");
	if (opcode === 0xc3) return finish("ret");
	if (opcode === 0xcb) return finish("retf");
	if (opcode === 0xcc) return finish("int3");
	if (opcode === 0xf4) return finish("hlt");
	if (opcode === 0xc9) return finish("leave");
	if (opcode === 0x98) return finish(wide ? "cdqe" : "cwde");
	if (opcode === 0x99) return finish(wide ? "cqo" : "cdq");

	if (opcode >= 0x50 && opcode <= 0x57) {
		const index = (opcode - 0x50) | ((state.rex & 0x01) !== 0 ? 8 : 0);
		return finish(`push ${registerName(index, wide || state.mode64 ? 64 : 32)}`);
	}
	if (opcode >= 0x58 && opcode <= 0x5f) {
		const index = (opcode - 0x58) | ((state.rex & 0x01) !== 0 ? 8 : 0);
		return finish(`pop ${registerName(index, wide || state.mode64 ? 64 : 32)}`);
	}
	if (opcode >= 0xb8 && opcode <= 0xbf) {
		const index = (opcode - 0xb8) | ((state.rex & 0x01) !== 0 ? 8 : 0);
		if (wide) {
			const low = readU32(state);
			const high = readU32(state);
			return finish(`mov ${registerName(index, 64)}, 0x${hex(high)}${hex(low, 8)}`);
		}
		return finish(`mov ${registerName(index, 32)}, 0x${hex(readU32(state))}`);
	}

	if (opcode === 0xe8) {
		const rel = readI32(state);
		return finish(`call file+0x${hex(state.cursor + rel)}`);
	}
	if (opcode === 0xe9) {
		const rel = readI32(state);
		return finish(`jmp file+0x${hex(state.cursor + rel)}`);
	}
	if (opcode === 0xeb) {
		const rel = readI8(state);
		return finish(`jmp file+0x${hex(state.cursor + rel)}`);
	}
	if (opcode >= 0x70 && opcode <= 0x7f) {
		const rel = readI8(state);
		return finish(`j${JCC[opcode - 0x70]} file+0x${hex(state.cursor + rel)}`);
	}
	if (opcode === 0x68) return finish(`push 0x${hex(readU32(state))}`);
	if (opcode === 0x6a) return finish(`push ${signed(readI8(state))}`);

	if (opcode === 0x0f) {
		const second = readU8(state);
		if (second === 0x05) return finish("syscall");
		if (second === 0x0b) return finish("ud2");
		if (second >= 0x80 && second <= 0x8f) {
			const rel = readI32(state);
			return finish(`j${JCC[second - 0x80]} file+0x${hex(state.cursor + rel)}`);
		}
		if (second === 0x1f) {
			const modrm = readModRm(state);
			return finish(`nop ${modrm.rm === "reg" ? modrm.reg(32) : modrm.rm}`);
		}
		if (second === 0xb6 || second === 0xb7 || second === 0xbe || second === 0xbf) {
			const modrm = readModRm(state);
			const destination = modrm.reg(sizeOf(state, wide));
			const sourceSize: RegisterSize = second === 0xb6 || second === 0xbe ? 8 : 16;
			const source = modrm.rm === "reg" ? registerName(modrm.rmIndex, sourceSize) : modrm.rm;
			const name = second === 0xb6 || second === 0xb7 ? "movzx" : "movsx";
			return finish(`${name} ${destination}, ${source}`);
		}
		if (second === 0xaf) {
			const modrm = readModRm(state);
			const destination = modrm.reg(sizeOf(state, wide));
			return finish(`imul ${destination}, ${modrm.rm === "reg" ? registerName(modrm.rmIndex, sizeOf(state, wide)) : modrm.rm}`);
		}
		return finish(`db 0x0f, 0x${hex(second, 2)}`);
	}

	if (opcode === 0x88 || opcode === 0x89 || opcode === 0x8a || opcode === 0x8b || opcode === 0x8d) {
		const modrm = readModRm(state);
		const size = opcode === 0x88 || opcode === 0x8a ? 8 : sizeOf(state, wide);
		const regText = modrm.reg(size);
		const rmText = modrm.rm === "reg" ? registerName(modrm.rmIndex, size) : modrm.rm;
		if (opcode === 0x8d) return finish(`lea ${regText}, ${rmText}`);
		if (opcode === 0x88 || opcode === 0x89) return finish(`mov ${rmText}, ${regText}`);
		return finish(`mov ${regText}, ${rmText}`);
	}

	const binary: Record<number, string> = {
		0x01: "add",
		0x03: "add",
		0x09: "or",
		0x0b: "or",
		0x11: "adc",
		0x13: "adc",
		0x21: "and",
		0x23: "and",
		0x29: "sub",
		0x2b: "sub",
		0x31: "xor",
		0x33: "xor",
		0x39: "cmp",
		0x3b: "cmp",
		0x85: "test",
	};
	const name = binary[opcode];
	if (name) {
		const modrm = readModRm(state);
		const size = sizeOf(state, wide);
		const regText = modrm.reg(size);
		const rmText = modrm.rm === "reg" ? registerName(modrm.rmIndex, size) : modrm.rm;
		const isStore = (opcode & 0x02) === 0;
		return finish(isStore ? `${name} ${rmText}, ${regText}` : `${name} ${regText}, ${rmText}`);
	}

	if (opcode === 0x81 || opcode === 0x83) {
		const modrm = readModRm(state);
		const size = sizeOf(state, wide);
		const rmText = modrm.rm === "reg" ? registerName(modrm.rmIndex, size) : modrm.rm;
		const immediate = opcode === 0x81 ? (size === 16 ? readU32(state) & 0xffff : readU32(state)) : readI8(state);
		return finish(`${GROUP1[modrm.regIndex & 7]} ${rmText}, ${opcode === 0x83 ? signed(immediate) : `0x${hex(immediate)}`}`);
	}

	if (opcode === 0xc6 || opcode === 0xc7) {
		const modrm = readModRm(state);
		const size = opcode === 0xc6 ? 8 : sizeOf(state, wide);
		const rmText = modrm.rm === "reg" ? registerName(modrm.rmIndex, size) : modrm.rm;
		if (size === 64) {
			const value = readU32(state);
			const high = readU32(state);
			return finish(`mov ${rmText}, 0x${hex(high)}${hex(value, 8)}`);
		}
		if (size === 8) return finish(`mov ${rmText}, 0x${hex(readU8(state), 2)}`);
		return finish(`mov ${rmText}, 0x${hex(readU32(state))}`);
	}

	if (opcode === 0xff) {
		const modrm = readModRm(state);
		const group = modrm.regIndex & 7;
		const operandSize: RegisterSize = group === 0 || group === 1 ? sizeOf(state, wide) : 64;
		const rmText = modrm.rm === "reg" ? registerName(modrm.rmIndex, operandSize) : modrm.rm;
		switch (group) {
			case 0:
				return finish(`inc ${rmText}`);
			case 1:
				return finish(`dec ${rmText}`);
			case 2:
				return finish(`call ${rmText}`);
			case 4:
				return finish(`jmp ${rmText}`);
			case 6:
				return finish(`push ${rmText}`);
			default:
				return finish(`db 0xff, 0x${hex((modrm.regIndex & 7) << 3, 2)}`);
		}
	}

	state.cursor = start + 1;
	return finish(`db 0x${hex(opcode, 2)}`);
}

/* ------------------------------------------------------------------ surface */

export function disassemble(
	bytes: Uint8Array,
	archArgument: string,
	options: { offset?: number; length?: number; max?: number } = {},
): DisasmResult {
	const arch = disasmArchFor(archArgument);
	const warnings: string[] = [];
	const start = Math.max(0, Math.min(bytes.byteLength, options.offset ?? 0));
	const length = Math.max(0, Math.min(bytes.byteLength - start, options.length ?? 256));
	const max = Math.max(1, Math.min(MAX_INSTRUCTIONS, options.max ?? 512));
	const end = start + length;
	const instructions: Instruction[] = [];

	if (arch === "unknown" || arch === "arm") {
		return {
			arch,
			instructions: [],
			truncated: false,
			warnings: [`no linear-sweep decoder for ${archArgument}; use an external disassembler for this architecture`],
		};
	}

	let cursor = start;
	while (cursor < end && instructions.length < max) {
		if (arch === "aarch64") {
			if (cursor + 4 > end) {
				warnings.push(`trailing ${end - cursor} byte(s) are not a whole AArch64 instruction`);
				break;
			}
			const word = new DataView(bytes.buffer, bytes.byteOffset).getUint32(cursor, true);
			instructions.push({ offset: cursor, hex: hex(bytes[cursor]!, 2) + " " + hex(bytes[cursor + 1]!, 2) + " " + hex(bytes[cursor + 2]!, 2) + " " + hex(bytes[cursor + 3]!, 2), text: decodeAarch64(word, cursor) });
			cursor += 4;
			continue;
		}
		let decoded: Decoded;
		try {
			decoded = decodeX86(bytes, cursor, arch === "x86-64");
		} catch {
			decoded = { text: `db 0x${hex(bytes[cursor] ?? 0, 2)}`, size: 1 };
		}
		const size = Math.max(1, Math.min(decoded.size, end - cursor));
		const slice = Array.from(bytes.subarray(cursor, cursor + size), byte => hex(byte, 2)).join(" ");
		instructions.push({ offset: cursor, hex: slice, text: decoded.text });
		cursor += size;
	}

	return { arch, instructions, truncated: cursor < end, warnings };
}

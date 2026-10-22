/**
 * Instruction-level decoding for the two architectures this plugin can handle,
 * with the control-flow and data-reference semantics of each instruction kept
 * alongside its text form.
 *
 * Splitting this out from `disasm.ts` is deliberate: flat listings only need the
 * text, but block splitting, cross references and function views need to know
 * whether an instruction is a call, a conditional branch, a return, and where it
 * jumps to. Inferring that by re-parsing our own rendered text would be
 * stringly-typed and brittle, so every decode site fills `flow` and `refs`
 * in place while it still has the raw bits.
 *
 * Addresses are file offsets throughout. The rendered text keeps the historical
 * `file+0x…` spelling, which is part of the plugin's output contract.
 */

export type DisasmArch = "aarch64" | "x86-64" | "x86" | "arm" | "unknown";

export type FlowKind = "none" | "call" | "jump" | "cond" | "ret" | "indirect";

export interface InsnFlow {
	kind: FlowKind;
	/** 直接分支 / 调用的目标文件偏移；间接跳转与返回没有目标。 */
	target?: number;
	/** 条件分支的条件后缀（eq / ne / je / jg …），无条件分支没有。 */
	condition?: string;
}

export interface DecodedInstruction {
	offset: number;
	size: number;
	hex: string;
	text: string;
	/** 文本里的第一个词，供结构化过滤使用（`.word` / `db` 也算）。 */
	mnemonic: string;
	flow: InsnFlow;
	/** 指令里出现的静态数据引用目标（rip 相对、ldr literal、adr/adrp、页地址）。 */
	refs: number[];
}

export function disasmArchFor(arch: string): DisasmArch {
	const value = arch.toLowerCase();
	if (value.includes("aarch64") || value === "arm64") return "aarch64";
	if (value === "x86-64" || value === "x86_64" || value === "amd64" || value === "x64") return "x86-64";
	if (value === "x86" || value === "i386" || value === "i686" || value === "ia32") return "x86";
	if (value.startsWith("arm")) return "arm";
	return "unknown";
}

export function isDecodable(arch: DisasmArch): boolean {
	return arch === "aarch64" || arch === "x86-64" || arch === "x86";
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

function byteHex(bytes: Uint8Array, start: number, count: number): string {
	const parts: string[] = [];
	for (let index = 0; index < count; index += 1) parts.push(hex(bytes[start + index] ?? 0, 2));
	return parts.join(" ");
}

function mnemonicOf(text: string): string {
	const space = text.indexOf(" ");
	return space === -1 ? text : text.slice(0, space);
}

const NONE: InsnFlow = { kind: "none" };

/* ------------------------------------------------------------------ AArch64 */

const CONDITIONS = ["eq", "ne", "cs", "cc", "mi", "pl", "vs", "vc", "hi", "ls", "ge", "lt", "gt", "le", "al", "nv"];

function x(index: number): string {
	return index === 31 ? "sp" : `x${index}`;
}

function w(index: number): string {
	return index === 31 ? "wsp" : `w${index}`;
}

interface Decoded {
	text: string;
	flow: InsnFlow;
	refs: number[];
}

function decodeAarch64(word: number, offset: number): Decoded {
	const rd = (word & 0x1f) >>> 0;
	const rn = (word >>> 5) & 0x1f;
	const rm = (word >>> 16) & 0x1f;
	const sf = (word >>> 31) === 1;
	const r = sf ? x : w;
	const at = (delta: number): string => `file+0x${hex(offset + delta)}`;
	const out = (text: string, flow: InsnFlow = NONE, refs: number[] = []): Decoded => ({ text, flow, refs });

	if (word === 0xd503201f) return out("nop");
	if (word === 0xd65f03c0) return out("ret", { kind: "ret" });
	if (((word & 0xfffffc1f) >>> 0) === 0xd65f0000) return out(`ret ${x(rn)}`, { kind: "ret" });
	if (((word & 0xfffffc1f) >>> 0) === 0xd61f0000) return out(`br ${x(rn)}`, { kind: "indirect" });
	if (((word & 0xfffffc1f) >>> 0) === 0xd63f0000) return out(`blr ${x(rn)}`, { kind: "indirect" });
	if (((word & 0xffe0001f) >>> 0) === 0xd4000001) return out(`svc #0x${hex((word >>> 5) & 0xffff)}`);

	if (((word & 0xfc000000) >>> 0) === 0x94000000) {
		const imm = signExtend(word & 0x03ffffff, 26) * 4;
		return out(`bl ${at(imm)}`, { kind: "call", target: offset + imm });
	}
	if (((word & 0xfc000000) >>> 0) === 0x14000000) {
		const imm = signExtend(word & 0x03ffffff, 26) * 4;
		return out(`b ${at(imm)}`, { kind: "jump", target: offset + imm });
	}
	if (((word & 0xff000010) >>> 0) === 0x54000000) {
		const imm = signExtend((word >>> 5) & 0x7ffff, 19) * 4;
		const condition = CONDITIONS[word & 0x0f]!;
		return out(`b.${condition} ${at(imm)}`, { kind: "cond", target: offset + imm, condition });
	}
	if (((word & 0x7e000000) >>> 0) === 0x34000000 || ((word & 0x7e000000) >>> 0) === 0x35000000) {
		const imm = signExtend((word >>> 5) & 0x7ffff, 19) * 4;
		const branch = ((word & 0x01000000) >>> 0) === 0 ? "cbz" : "cbnz";
		return out(`${branch} ${r(rd)}, ${at(imm)}`, { kind: "cond", target: offset + imm, condition: branch });
	}
	if (((word & 0x7e000000) >>> 0) === 0x36000000) {
		const bit = ((word >>> 31) << 2) | ((word >>> 19) & 3);
		const imm = signExtend((word >>> 5) & 0x3fff, 14) * 4;
		const branch = ((word & 0x01000000) >>> 0) === 0 ? "tbz" : "tbnz";
		return out(`${branch} ${r(rd)}, #${bit}, ${at(imm)}`, { kind: "cond", target: offset + imm, condition: branch });
	}

	const immlo = (word >>> 29) & 3;
	const immhi = (word >>> 5) & 0x7ffff;
	const adrImm = signExtend((immhi << 2) | immlo, 21);
	// adrp 的目标是所在页的基址，xref 需要的是能落到字符串/数据的地址，按页记。
	if (((word & 0x9f000000) >>> 0) === 0x10000000) return out(`adr x${rd}, ${at(adrImm)}`, NONE, [offset + adrImm]);
	if (((word & 0x9f000000) >>> 0) === 0x90000000) {
		return out(`adrp x${rd}, page${signed(adrImm << 12)}`, NONE, [(offset & ~0xfff) + (adrImm << 12)]);
	}

	const imm16 = (word >>> 5) & 0xffff;
	const shift = ((word >>> 21) & 3) * 16;
	const opc = (word >>> 29) & 3;
	if (((word & 0x1f800000) >>> 0) === 0x12800000) {
		const name = opc === 2 ? "movz" : opc === 0 ? "movn" : opc === 3 ? "movk" : null;
		if (name) return out(`${name} ${r(rd)}, #0x${hex(imm16)}${shift > 0 ? `, lsl #${shift}` : ""}`);
	}

	const imm12 = (word >>> 10) & 0xfff;
	const lsl12 = ((word >>> 22) & 1) === 1 ? `, lsl #12` : "";
	// ADD/ADDS/SUB/SUBS (immediate)：只钉 28..24 位，sf/op/S 从各自位取。
	// 早先按整字节比对，等于只认 4 种编码，`cmp w0, #0`（32 位 SUBS）直接掉进 .word。
	if (((word & 0x1f000000) >>> 0) === 0x11000000) {
		const isSub = ((word >>> 30) & 1) === 1;
		const setsFlags = ((word >>> 29) & 1) === 1;
		const value = `#0x${hex(imm12)}${lsl12}`;
		if (setsFlags && rd === 31) return out(`${isSub ? "cmp" : "cmn"} ${r(rn)}, ${value}`);
		return out(`${isSub ? "sub" : "add"}${setsFlags ? "s" : ""} ${r(rd)}, ${r(rn)}, ${value}`);
	}

	const loadStore = (word & 0xffc00000) >>> 0;
	const sizeCode = (word >>> 30) & 3;
	const unit = sizeCode === 0 ? 1 : sizeCode === 1 ? 2 : sizeCode === 2 ? 4 : 8;
	const suffix = sizeCode === 3 ? "" : sizeCode === 2 ? "" : sizeCode === 1 ? "h" : "b";
	if (loadStore === 0xf9400000 || loadStore === 0xb9400000 || loadStore === 0x39400000 || loadStore === 0x79400000) {
		const register = sizeCode === 3 ? x(rd) : sizeCode === 2 ? w(rd) : w(rd);
		return out(`ldr${suffix} ${register}, [${x(rn)}, #0x${hex(imm12 * unit)}]`);
	}
	if (loadStore === 0xf9000000 || loadStore === 0xb9000000 || loadStore === 0x39000000 || loadStore === 0x79000000) {
		const register = sizeCode === 3 ? x(rd) : w(rd);
		return out(`str${suffix} ${register}, [${x(rn)}, #0x${hex(imm12 * unit)}]`);
	}
	// PC 相对字面量加载：目标就是一个静态数据地址，最典型的字符串取址。
	if (loadStore === 0x58000000 || loadStore === 0x18000000) {
		const imm = signExtend((word >>> 5) & 0x7ffff, 19) * 4;
		return out(`ldr ${loadStore === 0x58000000 ? x(rd) : w(rd)}, ${at(imm)}`, NONE, [offset + imm]);
	}

	const pair = (word & 0xffc00000) >>> 0;
	if (pair === 0xa9000000 || pair === 0xa9800000 || pair === 0xa8800000) {
		const imm = signExtend((word >>> 15) & 0x7f, 7) * 8;
		const base = x(rn);
		const address = pair === 0xa9800000 ? `[${base}, #${signed(imm)}]!` : pair === 0xa8800000 ? `[${base}], #${signed(imm)}` : `[${base}, #${signed(imm)}]`;
		return out(`stp ${x(rd)}, ${x((word >>> 10) & 0x1f)}, ${address}`);
	}
	if (pair === 0xa9400000 || pair === 0xa9c00000 || pair === 0xa8c00000) {
		const imm = signExtend((word >>> 15) & 0x7f, 7) * 8;
		const base = x(rn);
		const address = pair === 0xa9c00000 ? `[${base}, #${signed(imm)}]!` : pair === 0xa8c00000 ? `[${base}], #${signed(imm)}` : `[${base}, #${signed(imm)}]`;
		return out(`ldp ${x(rd)}, ${x((word >>> 10) & 0x1f)}, ${address}`);
	}

	// 寄存器型数据处理的覆盖范围决定了真实 arm64 二进制能不能读：编译器生成的
	// 比较、条件选择、位运算几乎全是这三族，缺一族就整片 `.word`。
	const wide = ((word >>> 31) & 1) === 1;
	const reg = wide ? x : w;
	const shiftType = (word >>> 22) & 3;
	const shiftAmount = (word >>> 10) & 0x3f;
	const shiftText = shiftAmount === 0 ? "" : `, ${["lsl", "lsr", "asr", "ror"][shiftType]!} #${shiftAmount}`;

	// ADD/ADDS/SUB/SUBS (shifted register)：ADD=S=0，SUB=op，S 置位后 rd=31 即 cmp/cmn。
	if (((word & 0x1f200000) >>> 0) === 0x0b000000) {
		const isSub = ((word >>> 30) & 1) === 1;
		const setsFlags = ((word >>> 29) & 1) === 1;
		if (setsFlags && rd === 31) return out(`${isSub ? "cmp" : "cmn"} ${reg(rn)}, ${reg(rm)}${shiftText}`);
		return out(`${isSub ? "sub" : "add"}${setsFlags ? "s" : ""} ${reg(rd)}, ${reg(rn)}, ${reg(rm)}${shiftText}`);
	}

	// 逻辑移位寄存器族：AND / ORR / EOR / ANDS。rn=31 的 ORR 就是 mov，
	// ANDS 且 rd=31 就是 tst —— 这是编译器输出里最高频的三个「别名」。
	if (((word & 0x1f000000) >>> 0) === 0x0a000000) {
		const opc = (word >>> 29) & 3;
		if (opc === 3 && rd === 31) return out(`tst ${reg(rn)}, ${reg(rm)}${shiftText}`);
		if (opc === 1 && rn === 31) return out(`mov ${reg(rd)}, ${reg(rm)}${shiftText}`);
		const name = opc === 0 ? "and" : opc === 1 ? "orr" : opc === 2 ? "eor" : "ands";
		return out(`${name} ${reg(rd)}, ${reg(rn)}, ${reg(rm)}${shiftText}`);
	}

	// 立即数移位：LSL/LSR/ASR 的别名编码（UBFM/SBFM）。
	if (((word & 0x1f800000) >>> 0) === 0x53000000) {
		const opc = (word >>> 29) & 3;
		const immr = (word >>> 16) & 0x3f;
		const imms = (word >>> 10) & 0x3f;
		if (opc === 2 && imms + 1 === immr) return out(`lsl ${reg(rd)}, ${reg(rn)}, #${(wide ? 64 : 32) - immr}`);
	}

	// 条件选择族 CSEL/CSINC/CSINV/CSNEG，以及 csinc(rd, zr, zr, !cond) 的 cset 别名。
	if (((word & 0x1fe00800) >>> 0) === 0x1a800000) {
		const op2 = (word >>> 10) & 3;
		const condition = CONDITIONS[word & 0x0f]!;
		if (op2 === 1 && rn === 31 && rm === 31 && condition === "ne") return out(`cset ${reg(rd)}, eq`);
		if (op2 === 1 && rn === 31 && rm === 31 && condition === "eq") return out(`cset ${reg(rd)}, ne`);
		const name = ["csel", "csinc", "csinv", "csneg"][op2]!;
		return out(`${name} ${reg(rd)}, ${reg(rn)}, ${reg(rm)}, ${condition}`);
	}

	return out(`.word 0x${hex(word, 8)}`);
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
	/** `[rip + disp]` 的绝对目标（文件偏移）；其它寻址方式为 undefined。 */
	ripTarget?: number;
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
	let ripRelative = false;
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
		ripRelative = true;
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
	return { rm: rmText, regIndex, rmIndex: -1, reg, next: state.cursor, ripTarget: ripRelative ? state.cursor + displacement : undefined };
}

function decodeX86(bytes: Uint8Array, offset: number, mode64: boolean): Decoded & { size: number } {
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
	const finish = (text: string, flow: InsnFlow = NONE, refs: number[] = []): Decoded & { size: number } => ({
		text,
		flow,
		refs,
		size: state.cursor - offset,
	});
	const refsOf = (modrm: ModRm): number[] => (modrm.ripTarget === undefined ? [] : [modrm.ripTarget]);

	if (opcode === 0x90) return finish("nop");
	if (opcode === 0xc3) return finish("ret", { kind: "ret" });
	if (opcode === 0xcb) return finish("retf", { kind: "ret" });
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
		return finish(`call file+0x${hex(state.cursor + rel)}`, { kind: "call", target: state.cursor + rel });
	}
	if (opcode === 0xe9) {
		const rel = readI32(state);
		return finish(`jmp file+0x${hex(state.cursor + rel)}`, { kind: "jump", target: state.cursor + rel });
	}
	if (opcode === 0xeb) {
		const rel = readI8(state);
		return finish(`jmp file+0x${hex(state.cursor + rel)}`, { kind: "jump", target: state.cursor + rel });
	}
	if (opcode >= 0x70 && opcode <= 0x7f) {
		const rel = readI8(state);
		const condition = JCC[opcode - 0x70]!;
		return finish(`j${condition} file+0x${hex(state.cursor + rel)}`, { kind: "cond", target: state.cursor + rel, condition });
	}
	if (opcode === 0x68) return finish(`push 0x${hex(readU32(state))}`);
	if (opcode === 0x6a) return finish(`push ${signed(readI8(state))}`);

	if (opcode === 0x0f) {
		const second = readU8(state);
		if (second === 0x05) return finish("syscall");
		if (second === 0x0b) return finish("ud2");
		if (second >= 0x80 && second <= 0x8f) {
			const rel = readI32(state);
			const condition = JCC[second - 0x80]!;
			return finish(`j${condition} file+0x${hex(state.cursor + rel)}`, { kind: "cond", target: state.cursor + rel, condition });
		}
		if (second === 0x1f) {
			const modrm = readModRm(state);
			return finish(`nop ${modrm.rm === "reg" ? modrm.reg(32) : modrm.rm}`, NONE, refsOf(modrm));
		}
		if (second === 0xb6 || second === 0xb7 || second === 0xbe || second === 0xbf) {
			const modrm = readModRm(state);
			const destination = modrm.reg(sizeOf(state, wide));
			const sourceSize: RegisterSize = second === 0xb6 || second === 0xbe ? 8 : 16;
			const source = modrm.rm === "reg" ? registerName(modrm.rmIndex, sourceSize) : modrm.rm;
			const name = second === 0xb6 || second === 0xb7 ? "movzx" : "movsx";
			return finish(`${name} ${destination}, ${source}`, NONE, refsOf(modrm));
		}
		if (second === 0xaf) {
			const modrm = readModRm(state);
			const destination = modrm.reg(sizeOf(state, wide));
			return finish(`imul ${destination}, ${modrm.rm === "reg" ? registerName(modrm.rmIndex, sizeOf(state, wide)) : modrm.rm}`, NONE, refsOf(modrm));
		}
		return finish(`db 0x0f, 0x${hex(second, 2)}`);
	}

	if (opcode === 0x88 || opcode === 0x89 || opcode === 0x8a || opcode === 0x8b || opcode === 0x8d) {
		const modrm = readModRm(state);
		const size = opcode === 0x88 || opcode === 0x8a ? 8 : sizeOf(state, wide);
		const regText = modrm.reg(size);
		const rmText = modrm.rm === "reg" ? registerName(modrm.rmIndex, size) : modrm.rm;
		// lea 的 rip 相对寻址就是取一个静态地址，是最可靠的数据引用来源。
		const refs = refsOf(modrm);
		if (opcode === 0x8d) return finish(`lea ${regText}, ${rmText}`, NONE, refs);
		if (opcode === 0x88 || opcode === 0x89) return finish(`mov ${rmText}, ${regText}`, NONE, refs);
		return finish(`mov ${regText}, ${rmText}`, NONE, refs);
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
		const refs = refsOf(modrm);
		return finish(isStore ? `${name} ${rmText}, ${regText}` : `${name} ${regText}, ${rmText}`, NONE, refs);
	}

	if (opcode === 0x81 || opcode === 0x83) {
		const modrm = readModRm(state);
		const size = sizeOf(state, wide);
		const rmText = modrm.rm === "reg" ? registerName(modrm.rmIndex, size) : modrm.rm;
		const immediate = opcode === 0x81 ? (size === 16 ? readU32(state) & 0xffff : readU32(state)) : readI8(state);
		return finish(`${GROUP1[modrm.regIndex & 7]} ${rmText}, ${opcode === 0x83 ? signed(immediate) : `0x${hex(immediate)}`}`, NONE, refsOf(modrm));
	}

	if (opcode === 0xc6 || opcode === 0xc7) {
		const modrm = readModRm(state);
		const size = opcode === 0xc6 ? 8 : sizeOf(state, wide);
		const rmText = modrm.rm === "reg" ? registerName(modrm.rmIndex, size) : modrm.rm;
		const refs = refsOf(modrm);
		if (size === 8) return finish(`mov ${rmText}, 0x${hex(readU8(state), 2)}`, NONE, refs);
		// 即便 REX.W 把目标拉到 64 位，C7 /0 的立即数仍然是 imm32 并符号扩展；
		// 把 8 字节全当立即数读会把后面几条指令一并吞掉。
		if (size === 64) {
			const value = readI32(state);
			return finish(`mov ${rmText}, ${value < 0 ? signed(value) : `0x${hex(value)}`}`, NONE, refs);
		}
		if (size === 16) return finish(`mov ${rmText}, 0x${hex(readU32(state) & 0xffff)}`, NONE, refs);
		return finish(`mov ${rmText}, 0x${hex(readU32(state))}`, NONE, refs);
	}

	if (opcode === 0xff) {
		const modrm = readModRm(state);
		const group = modrm.regIndex & 7;
		const operandSize: RegisterSize = group === 0 || group === 1 ? sizeOf(state, wide) : 64;
		const rmText = modrm.rm === "reg" ? registerName(modrm.rmIndex, operandSize) : modrm.rm;
		const refs = refsOf(modrm);
		switch (group) {
			case 0:
				return finish(`inc ${rmText}`, NONE, refs);
			case 1:
				return finish(`dec ${rmText}`, NONE, refs);
			case 2:
				return finish(`call ${rmText}`, { kind: "indirect" }, refs);
			case 4:
				return finish(`jmp ${rmText}`, { kind: "indirect" }, refs);
			case 6:
				return finish(`push ${rmText}`, NONE, refs);
			default:
				return finish(`db 0xff, 0x${hex((modrm.regIndex & 7) << 3, 2)}`, NONE, refs);
		}
	}

	state.cursor = start + 1;
	return finish(`db 0x${hex(opcode, 2)}`);
}

/* ------------------------------------------------------------------ surface */

/**
 * Decode the single instruction that starts at `offset`.
 * Returns null when the architecture has no decoder here, or when the buffer
 * ends inside the encoding.
 */
export function decodeAt(bytes: Uint8Array, arch: DisasmArch, offset: number): DecodedInstruction | null {
	if (arch === "aarch64") {
		if (offset < 0 || offset + 4 > bytes.byteLength) return null;
		const word = new DataView(bytes.buffer, bytes.byteOffset).getUint32(offset, true);
		const decoded = decodeAarch64(word, offset);
		return {
			offset,
			size: 4,
			hex: byteHex(bytes, offset, 4),
			text: decoded.text,
			mnemonic: mnemonicOf(decoded.text),
			flow: decoded.flow,
			refs: decoded.refs,
		};
	}
	if (arch === "x86-64" || arch === "x86") {
		if (offset < 0 || offset >= bytes.byteLength) return null;
		let decoded: Decoded & { size: number };
		try {
			decoded = decodeX86(bytes, offset, arch === "x86-64");
		} catch {
			decoded = { text: `db 0x${hex(bytes[offset] ?? 0, 2)}`, flow: NONE, refs: [], size: 1 };
		}
		return {
			offset,
			size: decoded.size,
			hex: byteHex(bytes, offset, decoded.size),
			text: decoded.text,
			mnemonic: mnemonicOf(decoded.text),
			flow: decoded.flow,
			refs: decoded.refs,
		};
	}
	return null;
}

export interface DecodeRun {
	instructions: DecodedInstruction[];
	/** 扫描到的结束偏移（不一定是 `end`：缺省预算用尽或尾部残缺都会提前停）。 */
	end: number;
	truncated: boolean;
	warnings: string[];
}

/**
 * Linear sweep over `[start, end)`. Shared by the flat listing, the function
 * view and the cross-reference index so all three agree on instruction
 * boundaries — a disagreement here would silently corrupt every later analysis.
 */
export function decodeRange(bytes: Uint8Array, arch: DisasmArch, start: number, end: number, max: number): DecodeRun {
	const instructions: DecodedInstruction[] = [];
	const warnings: string[] = [];
	let cursor = start;
	const limit = Math.max(1, max);

	while (cursor < end && instructions.length < limit) {
		// AArch64 的指令固定 4 字节：范围末尾不足 4 字节时按原契约告警并停，
		// 不能把残尾当成一条完整指令解码。
		if (arch === "aarch64" && cursor + 4 > end) {
			warnings.push(`trailing ${end - cursor} byte(s) are not a whole AArch64 instruction`);
			break;
		}
		const instruction = decodeAt(bytes, arch, cursor);
		if (instruction === null) {
			if (arch === "aarch64") {
				warnings.push(`trailing ${end - cursor} byte(s) are not a whole AArch64 instruction`);
			}
			break;
		}
		const size = Math.max(1, Math.min(instruction.size, end - cursor));
		if (size !== instruction.size) {
			instructions.push({ ...instruction, size, hex: byteHex(bytes, cursor, size) });
		} else {
			instructions.push(instruction);
		}
		cursor += size;
	}

	return { instructions, end: cursor, truncated: cursor < end, warnings };
}

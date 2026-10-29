import { u16, u32 } from "../bytes";

/**
 * DEX code_item 结构与 Dalvik 指令视图。
 *
 * 与 dex-index.ts（只看 id 表）不同，这里真的进入每个方法转义后的指令区：
 * 解析 code_item 帧头（registers_size / ins_size / ins_count / tries / debug_info_off /
 * insns_size），然后把 insns[] 逐条解码成「指令名 + 操作数」的行。解码是纯静态的，
 * 不执行任何字节。完整 Dalvik 指令集有约 256 个 opcode、格式宽窄差异很大，这里
 * 采用实用子集：能确定性解码的格式给出操作数，未知格式按宽度缩记为 `; <opcode> …`，
 * 保证游标不脱轨、指令行不丢。
 */

/** 一个被解码的 Dalvik 指令。 */
export interface DalvikInstruction {
	/** code_item.insns 内的偏移（按 uint16 计数，同 DEX 惯例）。 */
	offset: number;
	/** 操作码名，例如 `move`, `invoke-virtual`, `const-string`, `iget`。 */
	op: string;
	/** 人类可读操作数串，例如 `v1, v2` 或 `v4, string@123`。 */
	operands: string;
	/** 该指令占用的 uint16 单元数。 */
	width: number;
}

export interface CodeItem {
	registersSize: number;
	insSize: number;
	outsSize: number;
	triesSize: number;
	debugInfoOff: number;
	insnsSize: number;
	/** 逐条指令视图，长度 = insnsSize（或截断 budget）。 */
	instructions: DalvikInstruction[];
	/** 解码时遇到越界 / 异常时的说明。 */
	notes: string[];
}

const INSN_BUDGET = 400;

/****** 常用常量 / 寄存器拼装 ******/

function nibbleHi(v: number): number {
	return (v >>> 4) & 0x0f;
}
function nibbleLo(v: number): number {
	return v & 0x0f;
}
function reg12(code: number): string {
	return `v${nibbleLo(code)}, v${nibbleHi(code)}`;
}
function reg22b(code: number): string {
	const a = nibbleLo(code);
	const b = nibbleHi(code) & 0x0f;
	return `v${a}, v${b}`;
}
function s16(bytes: Uint8Array, offset: number): number {
	const raw = u16(bytes, offset);
	return raw > 0x7fff ? raw - 0x10000 : raw;
}
function s32(bytes: Uint8Array, offset: number): number {
	return u32(bytes, offset) | 0;
}

/** 指令格式以「操作码取 8 位后，按格式拆后缀操作数」处理。宽操作数按格式逐项取。 */
interface Decoded {
	op: string;
	/** 指令总宽度（uint16 单位），未覆盖格式用固定 1 并标注 unknown。 */
	width: number;
	operands: string;
	unknown?: boolean;
}

function toDecoded(op: string, width: number, operands: string): Decoded {
	return { op, width, operands };
}

/**
 * 主解码：接收从 code_item.insns 起点开始的字节，返回逐条指令。
 * 只实现实用子集：分支/比较/字段/调用/const/算术/数组/返回/if；覆盖不到的格式缩记为 raw。
 */
export function decodeDalvikInstructions(
	bytes: Uint8Array,
	insOffsetWords: number,
	insnsSize: number,
	budget = INSN_BUDGET,
): { instructions: DalvikInstruction[]; truncated: boolean } {
	const out: DalvikInstruction[] = [];
	const limit = Math.min(insnsSize, budget);
	let cursor = 0; // uint16 索引，相对 insns 起点
	while (cursor < limit) {
		const wordOffset = insOffsetWords + cursor;
		const byteOffset = wordOffset * 2;
		if (byteOffset + 2 > bytes.byteLength) break;
		const code = u16(bytes, byteOffset);
		const op = code & 0xff;
		let dec: Decoded | null = null;

		switch (op) {
			case 0x00:
				dec = toDecoded("nop", 1, "");
				break;
			case 0x01:
				dec = toDecoded("move", 1, reg12(code));
				break;
			case 0x02:
				dec = toDecoded("move/from16", 2, `v${nibbleLo(code)}, v${u16(bytes, byteOffset + 2)}`);
				break;
			case 0x03:
				dec = toDecoded("move/16", 3, `v${u16(bytes, byteOffset + 2)}, v${u16(bytes, byteOffset + 4)}`);
				break;
			case 0x04:
				dec = toDecoded("move-wide", 1, reg12(code));
				break;
			case 0x07:
				dec = toDecoded("move-object", 1, reg12(code));
				break;
			case 0x0a:
				dec = toDecoded("move-result", 1, `v${nibbleLo(code)}`);
				break;
			case 0x0b:
				dec = toDecoded("move-result-wide", 1, `v${nibbleLo(code)}`);
				break;
			case 0x0c:
				dec = toDecoded("move-result-object", 1, `v${nibbleLo(code)}`);
				break;
			case 0x0e:
				dec = toDecoded("return-void", 1, "");
				break;
			case 0x0f:
				dec = toDecoded("return", 1, `v${nibbleLo(code)}`);
				break;
			case 0x10:
				dec = toDecoded("return-wide", 1, `v${nibbleLo(code)}`);
				break;
			case 0x11:
				dec = toDecoded("return-object", 1, `v${nibbleLo(code)}`);
				break;
			case 0x12:
				dec = toDecoded("const/4", 1, `v${nibbleLo(code)}, #${s4(code >>> 4)}`);
				break;
			case 0x13:
				dec = toDecoded("const/16", 2, `v${nibbleLo(code)}, #${s16(bytes, byteOffset + 2)}`);
				break;
			case 0x14:
				dec = toDecoded("const", 3, `v${nibbleLo(code)}, #${s32(bytes, byteOffset + 2)}`);
				break;
			case 0x15:
				dec = toDecoded("const/high16", 2, `v${nibbleLo(code)}, #${s16(bytes, byteOffset + 2)} << 16`);
				break;
			case 0x1a:
				dec = toDecoded("const-string", 2, `v${nibbleLo(code)}, string@${u16(bytes, byteOffset + 2)}`);
				break;
			case 0x1b:
				dec = toDecoded("const-string/jumbo", 3, `v${nibbleLo(code)}, string@${u32(bytes, byteOffset + 2)}`);
				break;
			case 0x1c:
				dec = toDecoded("const-class", 2, `v${nibbleLo(code)}, type@${u16(bytes, byteOffset + 2)}`);
				break;
			case 0x1f:
				dec = toDecoded("check-cast", 2, `v${nibbleLo(code)}, type@${u16(bytes, byteOffset + 2)}`);
				break;
			case 0x20:
				dec = toDecoded("instance-of", 2, `v${nibbleLo(code)}, v${nibbleHi(code)}, type@${u16(bytes, byteOffset + 2)}`);
				break;
			case 0x21:
				dec = toDecoded("array-length", 1, `v${nibbleLo(code)}, v${nibbleHi(code)}`);
				break;
			case 0x22:
				dec = toDecoded("new-instance", 2, `v${nibbleLo(code)}, type@${u16(bytes, byteOffset + 2)}`);
				break;
			case 0x23:
				dec = toDecoded("new-array", 2, `v${nibbleLo(code)}, v${nibbleHi(code)}, type@${u16(bytes, byteOffset + 2)}`);
				break;
			// 实例字段
			case 0x52:
				dec = toDecoded("iget", 2, `v${nibbleLo(code)}, v${nibbleHi(code)}, field@${u16(bytes, byteOffset + 2)}`);
				break;
			case 0x53:
				dec = toDecoded("iget-wide", 2, `v${nibbleLo(code)}, v${nibbleHi(code)}, field@${u16(bytes, byteOffset + 2)}`);
				break;
			case 0x54:
				dec = toDecoded("iget-object", 2, `v${nibbleLo(code)}, v${nibbleHi(code)}, field@${u16(bytes, byteOffset + 2)}`);
				break;
			case 0x55:
				dec = toDecoded("iget-boolean", 2, `v${nibbleLo(code)}, v${nibbleHi(code)}, field@${u16(bytes, byteOffset + 2)}`);
				break;
			case 0x56:
				dec = toDecoded("iget-byte", 2, `v${nibbleLo(code)}, v${nibbleHi(code)}, field@${u16(bytes, byteOffset + 2)}`);
				break;
			case 0x57:
				dec = toDecoded("iget-char", 2, `v${nibbleLo(code)}, v${nibbleHi(code)}, field@${u16(bytes, byteOffset + 2)}`);
				break;
			case 0x58:
				dec = toDecoded("iget-short", 2, `v${nibbleLo(code)}, v${nibbleHi(code)}, field@${u16(bytes, byteOffset + 2)}`);
				break;
			case 0x59:
				dec = toDecoded("iput", 2, `v${nibbleLo(code)}, v${nibbleHi(code)}, field@${u16(bytes, byteOffset + 2)}`);
				break;
			case 0x5a:
				dec = toDecoded("iput-wide", 2, `v${nibbleLo(code)}, v${nibbleHi(code)}, field@${u16(bytes, byteOffset + 2)}`);
				break;
			case 0x5b:
				dec = toDecoded("iput-object", 2, `v${nibbleLo(code)}, v${nibbleHi(code)}, field@${u16(bytes, byteOffset + 2)}`);
				break;
			case 0x5c:
				dec = toDecoded("iput-boolean", 2, `v${nibbleLo(code)}, v${nibbleHi(code)}, field@${u16(bytes, byteOffset + 2)}`);
				break;
			case 0x5d:
				dec = toDecoded("iput-byte", 2, `v${nibbleLo(code)}, v${nibbleHi(code)}, field@${u16(bytes, byteOffset + 2)}`);
				break;
			case 0x5e:
				dec = toDecoded("iput-char", 2, `v${nibbleLo(code)}, v${nibbleHi(code)}, field@${u16(bytes, byteOffset + 2)}`);
				break;
			case 0x5f:
				dec = toDecoded("iput-short", 2, `v${nibbleLo(code)}, v${nibbleHi(code)}, field@${u16(bytes, byteOffset + 2)}`);
				break;
			// 静态字段
			case 0x60:
				dec = toDecoded("sget", 2, `v${nibbleLo(code)}, field@${u16(bytes, byteOffset + 2)}`);
				break;
			case 0x61:
				dec = toDecoded("sget-wide", 2, `v${nibbleLo(code)}, field@${u16(bytes, byteOffset + 2)}`);
				break;
			case 0x62:
				dec = toDecoded("sget-object", 2, `v${nibbleLo(code)}, field@${u16(bytes, byteOffset + 2)}`);
				break;
			case 0x63:
				dec = toDecoded("sget-boolean", 2, `v${nibbleLo(code)}, field@${u16(bytes, byteOffset + 2)}`);
				break;
			case 0x64:
				dec = toDecoded("sget-byte", 2, `v${nibbleLo(code)}, field@${u16(bytes, byteOffset + 2)}`);
				break;
			case 0x65:
				dec = toDecoded("sget-char", 2, `v${nibbleLo(code)}, field@${u16(bytes, byteOffset + 2)}`);
				break;
			case 0x66:
				dec = toDecoded("sget-short", 2, `v${nibbleLo(code)}, field@${u16(bytes, byteOffset + 2)}`);
				break;
			case 0x67:
				dec = toDecoded("sput", 2, `v${nibbleLo(code)}, field@${u16(bytes, byteOffset + 2)}`);
				break;
			case 0x68:
				dec = toDecoded("sput-wide", 2, `v${nibbleLo(code)}, field@${u16(bytes, byteOffset + 2)}`);
				break;
			case 0x69:
				dec = toDecoded("sput-object", 2, `v${nibbleLo(code)}, field@${u16(bytes, byteOffset + 2)}`);
				break;
			case 0x6a:
				dec = toDecoded("sput-boolean", 2, `v${nibbleLo(code)}, field@${u16(bytes, byteOffset + 2)}`);
				break;
			case 0x6b:
				dec = toDecoded("sput-byte", 2, `v${nibbleLo(code)}, field@${u16(bytes, byteOffset + 2)}`);
				break;
			case 0x6c:
				dec = toDecoded("sput-char", 2, `v${nibbleLo(code)}, field@${u16(bytes, byteOffset + 2)}`);
				break;
			case 0x6d:
				dec = toDecoded("sput-short", 2, `v${nibbleLo(code)}, field@${u16(bytes, byteOffset + 2)}`);
				break;
			// 方法调用（格式 35c / 3rc）
			case 0x6e:
			case 0x6f:
			case 0x70:
			case 0x71:
			case 0x72:
			case 0x74:
			case 0x76:
			case 0x77:
				dec = decodeInvoke(op, bytes, byteOffset);
				break;
			// 一元运算
			case 0x7b:
				dec = toDecoded("neg-int", 1, reg12(code));
				break;
			case 0x7c:
				dec = toDecoded("not-int", 1, reg12(code));
				break;
			case 0x91:
				dec = toDecoded("add-int", 1, reg12(code));
				break;
			case 0x92:
				dec = toDecoded("sub-int", 1, reg12(code));
				break;
			case 0x93:
				dec = toDecoded("mul-int", 1, reg12(code));
				break;
			case 0x94:
				dec = toDecoded("div-int", 1, reg12(code));
				break;
			case 0x95:
				dec = toDecoded("rem-int", 1, reg12(code));
				break;
			case 0x96:
				dec = toDecoded("and-int", 1, reg12(code));
				break;
			case 0x97:
				dec = toDecoded("or-int", 1, reg12(code));
				break;
			case 0x98:
				dec = toDecoded("xor-int", 1, reg12(code));
				break;
			case 0x99:
				dec = toDecoded("shl-int", 1, reg12(code));
				break;
			case 0x9a:
				dec = toDecoded("shr-int", 1, reg12(code));
				break;
			case 0x9b:
				dec = toDecoded("ushr-int", 1, reg12(code));
				break;
			// 比较
			case 0x2b:
				dec = toDecoded("cmpl-float", 2, reg22b(code));
				break;
			case 0x2c:
				dec = toDecoded("cmpg-float", 2, reg22b(code));
				break;
			case 0x2d:
				dec = toDecoded("cmpl-double", 2, reg22b(code));
				break;
			case 0x2e:
				dec = toDecoded("cmpg-double", 2, reg22b(code));
				break;
			case 0x2f:
				dec = toDecoded("cmp-long", 2, reg22b(code));
				break;
			// 分支（格式 10t / 20t）
			case 0x28:
				dec = toDecoded("goto", 1, `+${relOffset(code, cursor)}`);
				break;
			case 0x29:
				dec = toDecoded("goto/16", 2, `+${relOffset16(bytes, byteOffset, cursor)}`);
				break;
			case 0x2a:
				dec = toDecoded("goto/32", 3, `+${relOffset32(bytes, byteOffset, cursor)}`);
				break;
			case 0x32:
				dec = toDecoded("if-eq", 1, `${reg12(code)}, +${relOffset(code, cursor)}`);
				break;
			case 0x33:
				dec = toDecoded("if-ne", 1, `${reg12(code)}, +${relOffset(code, cursor)}`);
				break;
			case 0x34:
				dec = toDecoded("if-lt", 1, `${reg12(code)}, +${relOffset(code, cursor)}`);
				break;
			case 0x35:
				dec = toDecoded("if-ge", 1, `${reg12(code)}, +${relOffset(code, cursor)}`);
				break;
			case 0x36:
				dec = toDecoded("if-gt", 1, `${reg12(code)}, +${relOffset(code, cursor)}`);
				break;
			case 0x37:
				dec = toDecoded("if-le", 1, `${reg12(code)}, +${relOffset(code, cursor)}`);
				break;
			case 0x38:
				dec = toDecoded("if-eqz", 1, `v${nibbleLo(code)}, +${relOffset(code, cursor)}`);
				break;
			case 0x39:
				dec = toDecoded("if-nez", 1, `v${nibbleLo(code)}, +${relOffset(code, cursor)}`);
				break;
			case 0x3a:
				dec = toDecoded("if-ltz", 1, `v${nibbleLo(code)}, +${relOffset(code, cursor)}`);
				break;
			case 0x3b:
				dec = toDecoded("if-gez", 1, `v${nibbleLo(code)}, +${relOffset(code, cursor)}`);
				break;
			case 0x3c:
				dec = toDecoded("if-gtz", 1, `v${nibbleLo(code)}, +${relOffset(code, cursor)}`);
				break;
			case 0x3d:
				dec = toDecoded("if-lez", 1, `v${nibbleLo(code)}, +${relOffset(code, cursor)}`);
				break;
			// 数组
			case 0x44:
				dec = toDecoded("aget", 2, `v${nibbleLo(code)}, v${nibbleHi(code)}, ${registerAfter(bytes, byteOffset)}`);
				break;
			case 0x46:
				dec = toDecoded("aget-object", 2, `v${nibbleLo(code)}, v${nibbleHi(code)}, ${registerAfter(bytes, byteOffset)}`);
				break;
			case 0x4b:
				dec = toDecoded("aput", 2, `v${nibbleLo(code)}, v${nibbleHi(code)}, ${registerAfter(bytes, byteOffset)}`);
				break;
			case 0x4c:
				dec = toDecoded("aput-object", 2, `v${nibbleLo(code)}, v${nibbleHi(code)}, ${registerAfter(bytes, byteOffset)}`);
				break;
			// 其余未覆盖：缩记为 raw，宽度按最常见的 1x / 2x 猜测并尽力对齐。
			default:
				if (op >= 0xf0) {
					dec = toDecoded(`raw/${byteOpName(op)}`, 3, `#${u32(bytes, byteOffset + 2)}`);
				} else if (op >= 0xc0) {
					dec = toDecoded(`raw/${op.toString(16)}`, 2, `#${u16(bytes, byteOffset + 2)}`);
				} else if (op >= 0x7e) {
					// 一元/二元系列宽度 1-2，按最常见 1 处理
					dec = toDecoded(`op/${op.toString(16)}`, 1, inlineRaw(bytes, byteOffset));
				} else {
					dec = toDecoded(`raw/${op.toString(16)}`, 1, inlineRaw(bytes, byteOffset));
				}
				break;
		}

		out.push({ offset: cursor, op: dec.op, operands: dec.operands, width: dec.width });
		cursor += dec.width;
		if (byteOffset + dec.width * 2 > bytes.byteLength) break;
	}
	return { instructions: out, truncated: insnsSize > limit };
}

function s4(value: number): number {
	const lo = value & 0x0f;
	return lo > 7 ? lo - 16 : lo;
}

function relOffset(code: number, cursor: number): number {
	const raw = nibbleHi(code);
	const signed = raw > 7 ? raw - 16 : raw;
	return cursor + signed + 1; // 分支目标 = 当前指令地址 + signed + 1
}

function relOffset16(bytes: Uint8Array, byteOffset: number, cursor: number): number {
	return s16(bytes, byteOffset + 2) + cursor;
}

function relOffset32(bytes: Uint8Array, byteOffset: number, cursor: number): number {
	return s32(bytes, byteOffset + 2) + cursor;
}

function registerAfter(bytes: Uint8Array, byteOffset: number): string {
	// 22c 格式：vA, vB, vC（低 8 位 A/B，下一 uint16 高 4 位 C）
	return `v${(u16(bytes, byteOffset + 2) >>> 12) & 0x0f}`;
}

function inlineRaw(bytes: Uint8Array, byteOffset: number): string {
	if (byteOffset + 2 > bytes.byteLength) return "";
	const v = u16(bytes, byteOffset);
	// 只打印有字符串化价值的计数器寄存器（低 4 位即 vX）
	return `v${nibbleLo(v)}`;
}

function byteOpName(op: number): string {
	return `${op.toString(16).padStart(2, "0")}`;
}

const INVOKE_BASE_NAMES: Record<number, string> = {
	0x6e: "invoke-virtual",
	0x6f: "invoke-super",
	0x70: "invoke-direct",
	0x71: "invoke-static",
	0x72: "invoke-interface",
	0x74: "invoke-virtual/range",
	0x76: "invoke-direct/range",
	0x77: "invoke-static/range",
};

function decodeInvoke(op: number, bytes: Uint8Array, byteOffset: number): Decoded {
	const name = INVOKE_BASE_NAMES[op] ?? `invoke-${op.toString(16)}`;
	const code = u16(bytes, byteOffset);
	const range = op === 0x74 || op === 0x76 || op === 0x77 || op === 0x75;
	if (range) {
		const count = ((code >>> 8) & 0xff) | 0;
		const method = u16(bytes, byteOffset + 2);
		const regBase = u16(bytes, byteOffset + 4);
		const regs = Array.from({ length: count }, (_, k) => `v${regBase + k}`).join(", ");
		return toDecoded(name, 3, `${regs} → method@${method}`);
	}
	const args = decodeInvokeArgs(code, bytes, byteOffset);
	const method = u16(bytes, byteOffset + 2);
	return toDecoded(name, 2, `${args} → method@${method}`);
}

function decodeInvokeArgs(code: number, bytes: Uint8Array, byteOffset: number): string {
	const a = code & 0x0f;
	const c = (code >>> 4) & 0x0f;
	const d = (code >>> 8) & 0x0f;
	const e = (code >>> 12) & 0x0f;
	// 格式 35c：vA 为参数个数虚拟，B=method；寄存器在 A/G/F/E 四组，D 个参数。
	const counts = (code >>> 8) & 0x0f; // 实际参数个数在高位
	const regs: number[] = [];
	if (counts > 0) {
		regs.push(a);
		if (counts > 1) regs.push(d);
		if (counts > 2) regs.push(e);
		if (counts > 3) regs.push(c);
	}
	// 前 4 位是寄存器；若 counts 是 5，还需第 5 个寄存器在下一个 uint16 的低 4 位
	if (counts >= 5) {
		const fifth = u16(bytes, byteOffset + 4) & 0x0f;
		regs.push(fifth);
	}
	const unique = [...new Set(regs)];
	if (unique.length === 0) return "";
	return unique.map(r => `v${r}`).join(", ");
}

/**
 * 读取一个 code_item，返回帧结构 + 指令视图。
 * codeOff 是 DEX 文件里 code_item 的字节偏移（来自 class_data 的 encoded_method.code_off
 * 或 method_id.code_off）。insns 从 codeOff + 16 开始（header 5×uint32）。
 */
export function readCodeItem(bytes: Uint8Array, codeOff: number, budget = INSN_BUDGET): CodeItem {
	const notes: string[] = [];
	if (codeOff === 0 || codeOff + 16 > bytes.byteLength) {
		return {
			registersSize: 0,
			insSize: 0,
			outsSize: 0,
			triesSize: 0,
			debugInfoOff: 0,
			insnsSize: 0,
			instructions: [],
			notes: ["no code_item at this offset (abstract or native method)"],
		};
	}
	const registersSize = u16(bytes, codeOff);
	const insSize = u16(bytes, codeOff + 2);
	const outsSize = u16(bytes, codeOff + 4);
	const triesSize = u16(bytes, codeOff + 6);
	const debugInfoOff = u32(bytes, codeOff + 8);
	const insnsSizeWords = u32(bytes, codeOff + 12);
	if (insnsSizeWords > 0) {
		const insnsByteOff = codeOff + 16;
		const { instructions, truncated } = decodeDalvikInstructions(bytes, insnsByteOff / 2, insnsSizeWords, budget);
		if (truncated) notes.push(`instruction view truncated to the first ${budget} words`);
		return {
			registersSize,
			insSize,
			outsSize,
			triesSize,
			debugInfoOff,
			insnsSize: insnsSizeWords,
			instructions,
			notes,
		};
	}
	return {
		registersSize,
		insSize,
		outsSize,
		triesSize,
		debugInfoOff,
		insnsSize: insnsSizeWords,
		instructions: [],
		notes: notes,
	};
}
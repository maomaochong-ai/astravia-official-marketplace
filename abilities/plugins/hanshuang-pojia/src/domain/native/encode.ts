/**
 * 指令编码：`insn.ts` 的反方向。
 *
 * 存在的理由很具体：`disassemble_range` 只能读字节，于是「把一条指令变成字节」这类验证
 * （判定点那几条指令长什么样、跳转偏移算得对不对）只能去外面找汇编器。这里给出自带的
 * 一个子集，覆盖定位判定点后最常手改的九条指令。
 *
 * 承诺的边界写在类型上而不是注释里：
 * - 编码器返回的 `text` 是它自己认可的规范写法，必须与 `decodeAt(bytes)` 逐字相等；
 *   两边不一致说明字节错了，宁可报错也不返回「大概对」的结果。测试就是这么断言的。
 * - 不支持 8 / 16 位操作数、memory 的 scale 索引、符号与标签、伪指令。这些一律抛
 *   `EncodeError`，并给出最接近的候选写法，而不是悄悄编成别的意思。
 * - 不做指令选择优化：`mov rax, 0x10` 固定编成 `C7 /0`，不会替你挑更短的编码，
 *   因为「最短编码」与「这段字节是什么」是两个问题。
 */

import { decodeAt, disasmArchFor, x86Register, type DisasmArch } from "./insn";

export type EncodeArch = "aarch64" | "x86-64" | "x86";

/** 对外承诺的助记符。别名（`b` / `bl` / `eor` / `movz`）也接受，规范写法见返回值 `text`。 */
export const ENCODE_MNEMONICS = ["nop", "ret", "mov", "add", "sub", "xor", "cmp", "jmp", "call"] as const;

export const MAX_TEXT_CHARS = 200;
export const MAX_PROGRAM_LINES = 500;

export class EncodeError extends Error {
	/** 最接近的候选写法。空数组表示「没有更像的」。 */
	readonly hints: string[];

	constructor(message: string, hints: readonly string[] = []) {
		super(message);
		this.name = "EncodeError";
		this.hints = [...hints];
	}
}

export interface EncodeRequest {
	/** 任何 `disasmArchFor` 认得的拼法都会先归一，`arm` 与未知架构返回错误。 */
	arch: string;
	text: string;
	/** 指令将来落在哪个文件偏移。只有分支需要；缺省 0。 */
	address?: number;
}

export interface Encoded {
	arch: EncodeArch;
	/** 规范写法。与 `decodeAt(bytes, arch, address)` 的 text 必须一致。 */
	text: string;
	bytes: Uint8Array;
	/** 小写、空格分隔，与面板里 `hex` 列的写法一致。 */
	hex: string;
	size: number;
}

export interface ProgramItem {
	index: number;
	input: string;
	address: number;
	encoded?: Encoded;
	error?: string;
	hints?: string[];
}

export interface ProgramResult {
	arch: EncodeArch;
	items: ProgramItem[];
	/** 把编码成功的条目串联起来，可直接喂给 `disassemble_range` 的十六进制视图。 */
	bytes: Uint8Array;
	failed: number;
}

export function encodeArchFor(value: string): EncodeArch | null {
	const arch: DisasmArch = disasmArchFor(value);
	if (arch === "aarch64" || arch === "x86-64" || arch === "x86") return arch;
	return null;
}

export function encodeInstruction(request: EncodeRequest): Encoded {
	const arch = encodeArchFor(request.arch);
	if (arch === null) {
		throw new EncodeError(`no encoder for architecture ${request.arch}`, ["supported: aarch64, x86-64, x86"]);
	}
	const address = request.address ?? 0;
	if (!Number.isInteger(address) || address < 0) throw new EncodeError(`address must be a non-negative integer: ${address}`);

	const source = stripComment(request.text).trim();
	if (source === "") throw new EncodeError("instruction text is empty");
	if (source.length > MAX_TEXT_CHARS) throw new EncodeError(`instruction text is longer than ${MAX_TEXT_CHARS} characters`);
	if (source.startsWith(".")) throw new EncodeError(`directives are not encodable: ${source}`, ["data directives belong in a hex dump, not here"]);

	const space = source.indexOf(" ");
	const mnemonic = (space === -1 ? source : source.slice(0, space)).toLowerCase();
	const body = space === -1 ? "" : source.slice(space + 1);
	const rawOperands = splitOperands(body);

	const bytes =
		arch === "aarch64"
			? encodeAarch64Bytes(mnemonic, rawOperands, address)
			: encodeX86Bytes(arch, mnemonic, rawOperands, address);

	return {
		arch,
		text: "",
		bytes,
		hex: hexOf(bytes),
		size: bytes.byteLength,
	};
}

/**
 * 逐行编码。单条失败不终止整段：把错误留在该行上，其余行照常编码，调用方（CLI / 面板）
 * 才能一次讲完所有写不通的地方。地址按已成功条目的长度自动前进。
 */
export function encodeProgram(input: { arch: string; lines: readonly string[]; address?: number }): ProgramResult {
	const arch = encodeArchFor(input.arch);
	if (arch === null) {
		throw new EncodeError(`no encoder for architecture ${input.arch}`, ["supported: aarch64, x86-64, x86"]);
	}
	const lines = input.lines.filter(line => {
		const text = stripComment(line).trim();
		return text !== "";
	});
	if (lines.length > MAX_PROGRAM_LINES) {
		throw new EncodeError(`refusing to encode more than ${MAX_PROGRAM_LINES} lines at once`, [`split the listing and encode it in batches`]);
	}

	let cursor = input.address ?? 0;
	const items: ProgramItem[] = [];
	const chunks: Uint8Array[] = [];
	lines.forEach((line, index) => {
		try {
			const encoded = encodeInstruction({ arch, text: line, address: cursor });
			cursor += encoded.size;
			chunks.push(encoded.bytes);
			items.push({ index, input: line.trim(), address: encoded.arch === arch ? cursor - encoded.size : cursor, encoded });
		} catch (error) {
			const item: ProgramItem = { index, input: line.trim(), address: cursor, error: messageOf(error) };
			if (error instanceof EncodeError && error.hints.length > 0) item.hints = error.hints;
			items.push(item);
		}
	});

	const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
	const bytes = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return { arch, items, bytes, failed: items.filter(item => item.error !== undefined).length };
}

/**
 * 回转自检：把编码结果交给插件自己的解码器，比较文本与长度。
 *
 * 为什么不留到调用方：编码器的错误最常见的形式不是「抛了异常」，而是「安静地编成了
 * 另一条指令」。只有让另一个实现读回来，才能把这种错误挡在输出之前。
 */
export function verifyEncoding(encoded: Encoded, address = 0): { ok: boolean; decoded: string; expected: string } {
	const decoded = decodeAt(encoded.bytes, encoded.arch, 0);
	return { ok: decoded !== null && decoded.size === encoded.size && decoded.text === encoded.text, decoded: decoded?.text ?? "<none>", expected: encoded.text };
}

/* ------------------------------------------------------------------ parsing */

function messageOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/** `;` / `//` 之后是注释。`#` 不能当注释：AArch64 的立即数就长这样。 */
function stripComment(text: string): string {
	const cut = Math.min(...[text.indexOf(";"), text.indexOf("//")].filter(index => index !== -1).concat([text.length]));
	return text.slice(0, cut);
}

function splitOperands(body: string): string[] {
	const parts: string[] = [];
	let depth = 0;
	let current = "";
	for (const character of body) {
		if (character === "[") depth += 1;
		if (character === "]") depth = Math.max(0, depth - 1);
		if (character === "," && depth === 0) {
			parts.push(current);
			current = "";
			continue;
		}
		current += character;
	}
	parts.push(current);
	return parts.map(part => part.trim()).filter(part => part !== "");
}

function parseImmediate(token: string): number | null {
	let text = token.trim();
	if (text.startsWith("#")) text = text.slice(1).trim();
	if (text.startsWith("file+")) text = text.slice("file+".length).trim();
	if (text === "") return null;
	if (/^[+-]?0x[0-9a-f]+$/i.test(text)) {
		const negative = text.startsWith("-");
		const digits = text.replace(/^[+-]/, "");
		const value = Number.parseInt(digits.slice(2), 16);
		if (!Number.isSafeInteger(value)) return null;
		return negative ? -value : value;
	}
	if (/^[+-]?\d+$/.test(text)) {
		const value = Number.parseInt(text, 10);
		return Number.isSafeInteger(value) ? value : null;
	}
	return null;
}

/** 编辑距离，只用来把「拼错的助记符」映射回候选，不做模糊匹配。 */
function distance(a: string, b: string): number {
	const rows = a.length + 1;
	const columns = b.length + 1;
	const table: number[] = new Array(rows * columns).fill(0);
	for (let row = 0; row < rows; row += 1) table[row * columns] = row;
	for (let column = 0; column < columns; column += 1) table[column] = column;
	for (let row = 1; row < rows; row += 1) {
		for (let column = 1; column < columns; column += 1) {
			const cost = a[row - 1] === b[column - 1] ? 0 : 1;
			table[row * columns + column] = Math.min(
				table[(row - 1) * columns + column]! + 1,
				table[row * columns + column - 1]! + 1,
				table[(row - 1) * columns + column - 1]! + cost,
			);
		}
	}
	return table[rows * columns - 1]!;
}

function nearest(word: string, candidates: readonly string[], limit = 3): string[] {
	return candidates
		.map(candidate => ({ candidate, score: distance(word, candidate) }))
		.filter(entry => entry.score <= 2)
		.sort((left, right) => left.score - right.score)
		.slice(0, limit)
		.map(entry => entry.candidate);
}

function unknownMnemonic(arch: EncodeArch, mnemonic: string, accepted: readonly string[]): EncodeError {
	const hints = nearest(mnemonic, accepted);
	return new EncodeError(`unsupported mnemonic for ${arch}: ${mnemonic}`, hints.length > 0 ? hints : [`supported: ${accepted.join(", ")}`]);
}

function requireOperands(mnemonic: string, operands: readonly string[], count: number): void {
	if (operands.length !== count) {
		throw new EncodeError(`${mnemonic} expects ${count} operand(s), got ${operands.length}`, count === 0 ? ["drop the operands"] : [`write it as: ${exampleFor(mnemonic)}`]);
	}
}

function exampleFor(mnemonic: string): string {
	switch (mnemonic) {
		case "nop":
			return "nop";
		case "ret":
			return "ret";
		case "jmp":
			return "jmp 0x1000";
		case "call":
			return "call 0x1000";
		default:
			return `${mnemonic} <dst>, <src>`;
	}
}

function le(value: number, width: number): number[] {
	const bytes: number[] = [];
	for (let index = 0; index < width; index += 1) bytes.push((value >>> (index * 8)) & 0xff);
	return bytes;
}

function hexOf(bytes: Uint8Array): string {
	return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join(" ");
}

/* -------------------------------------------------------------------- x86 */

type X86RegSize = 32 | 64;

interface X86Reg {
	kind: "reg";
	name: string;
	index: number;
	size: X86RegSize;
}

interface X86Imm {
	kind: "imm";
	value: number;
}

interface X86Mem {
	kind: "mem";
	rip: boolean;
	base: string;
	baseIndex: number;
	disp: number;
}

interface X86Target {
	kind: "target";
	value: number;
}

type X86Operand = X86Reg | X86Imm | X86Mem | X86Target;

/** 解码器画内存操作数的方式：`[base]` / `[base + 0x8]` / `[base - 0x8]` / `[rip + 0x8]`。 */
function renderMem(operand: X86Mem): string {
	const head = operand.rip ? "rip" : operand.base;
	if (operand.disp === 0) return `[${head}]`;
	const sign = operand.disp < 0 ? "-" : "+";
	return `[${head} ${sign} 0x${Math.abs(operand.disp).toString(16)}]`;
}

function renderX86Operand(operand: X86Operand): string {
	switch (operand.kind) {
		case "reg":
			return operand.name;
		case "imm":
			return operand.value < 0 ? `-0x${(-operand.value).toString(16)}` : `0x${operand.value.toString(16)}`;
		case "mem":
			return renderMem(operand);
		case "target":
			return `file+0x${operand.value.toString(16)}`;
	}
}

function parseX86Register(token: string, mode64: boolean): X86Reg | null {
	const register = x86Register(token);
	if (register === null) return null;
	if (register.size === 8 || register.size === 16) {
		throw new EncodeError(`${register.size}-bit operands are not encodable here: ${token}`, ["use the 32-bit form (eax…) or the 64-bit form (rax…)"]);
	}
	if (!mode64 && register.size === 64) {
		throw new EncodeError(`64-bit register ${token} needs architecture x86-64`, ["switch to arch=x86-64 or use the 32-bit register"]);
	}
	return { kind: "reg", name: token.trim().toLowerCase(), index: register.index, size: register.size };
}

function parseX86Memory(token: string, mode64: boolean): X86Mem {
	const inner = token.slice(1, -1).trim();
	if (inner === "") throw new EncodeError("empty memory operand: []", ["[base] or [base + disp]"]);

	let base = "";
	let baseIndex = 0;
	let rip = false;
	let disp = 0;
	for (const rawPiece of inner.split(/(?=[+-])/)) {
		const piece = rawPiece.trim();
		if (piece === "") continue;
		const sign = piece.startsWith("-") ? -1 : 1;
		const body = piece.replace(/^[+-]/, "").trim();
		if (body.includes("*")) {
			throw new EncodeError(`scaled index is not encodable here: ${token}`, ["only [base] and [base + disp] are supported"]);
		}
		if (body.toLowerCase() === "rip") {
			rip = true;
			continue;
		}
		const register = x86Register(body);
		if (register !== null) {
			if (base !== "" || rip) throw new EncodeError(`memory operand has more than one base register: ${token}`, ["[base] or [base + disp], one register only"]);
			if (register.size !== 64) throw new EncodeError(`memory base must be a 64-bit register: ${token}`, ["use rax…r15 as the base"]);
			if (!mode64) throw new EncodeError(`64-bit addressing needs architecture x86-64: ${token}`, ["x86 uses 32-bit addressing, which this encoder does not cover"]);
			base = body.toLowerCase();
			baseIndex = register.index;
			continue;
		}
		const immediate = parseImmediate(body);
		if (immediate === null) throw new EncodeError(`cannot read displacement ${body} in ${token}`, ["displacement must be 0x… or a decimal"]);
		disp += sign * immediate;
	}
	if (rip) return { kind: "mem", rip: true, base: "rip", baseIndex: 0, disp };
	if (base === "") throw new EncodeError(`memory operand needs a base register: ${token}`, ["[rax] / [rbp - 0x8]"]);
	if (disp < -0x80000000 || disp > 0x7fffffff) throw new EncodeError(`displacement does not fit 32 bits: ${disp}`);
	return { kind: "mem", rip: false, base, baseIndex, disp };
}

function parseX86Operand(token: string, mode64: boolean): X86Operand {
	if (token.startsWith("[") && token.endsWith("]")) return parseX86Memory(token, mode64);
	const register = parseX86Register(token, mode64);
	if (register !== null) return register;
	const immediate = parseImmediate(token);
	if (immediate !== null) return { kind: "imm", value: immediate };
	throw new EncodeError(`cannot read operand: ${token}`, ["registers are rax…r15 / eax…r15d, immediates 0x… or decimal, memory [base + disp]"]);
}

interface X86ModRm {
	bytes: number[];
	extB: number;
	extX: number;
}

function modRmForReg(index: number, regField: number): X86ModRm {
	return { bytes: [0xc0 | ((regField & 7) << 3) | (index & 7)], extB: index, extX: 0 };
}

function modRmForMem(mem: X86Mem, regField: number): X86ModRm {
	const regBits = (regField & 7) << 3;
	if (mem.rip) return { bytes: [regBits | 0x05, ...le(mem.disp, 4)], extB: 0, extX: 0 };
	const lowBase = mem.baseIndex & 7;
	const needsSib = lowBase === 4;
	let mod: number;
	if (mem.disp === 0 && lowBase !== 5) mod = 0x00;
	else if (mem.disp >= -0x80 && mem.disp <= 0x7f) mod = 0x40;
	else mod = 0x80;
	const bytes: number[] = [mod | regBits | (needsSib ? 0x04 : lowBase)];
	if (needsSib) bytes.push(0x24);
	if (mod === 0x40) bytes.push(mem.disp & 0xff);
	else if (mod === 0x80) bytes.push(...le(mem.disp, 4));
	return { bytes, extB: mem.baseIndex, extX: 0 };
}

function emitRex(mode64: boolean, wide: boolean, regField: number, extB: number, extX: number): number[] {
	const extended = regField >= 8 || extB >= 8 || extX >= 8;
	if (!mode64) {
		if (extended) throw new EncodeError("extended registers (r8…) need architecture x86-64", ["use the 32-bit register set"]);
		return [];
	}
	const rex = 0x40 | (wide ? 0x08 : 0) | (regField >= 8 ? 0x04 : 0) | (extX >= 8 ? 0x02 : 0) | (extB >= 8 ? 0x01 : 0);
	return rex === 0x40 ? [] : [rex];
}

/** ALU 的两种方向：`0x03` 家族把 rm 读进 reg（`add rax, rbx`），`0x01` 家族把 reg 写进 rm。 */
const ALU: Record<string, { load: number; store: number; group: number }> = {
	add: { load: 0x03, store: 0x01, group: 0 },
	sub: { load: 0x2b, store: 0x29, group: 5 },
	xor: { load: 0x33, store: 0x31, group: 6 },
	cmp: { load: 0x3b, store: 0x39, group: 7 },
};

const BRANCH: Record<string, number> = { call: 0xe8, jmp: 0xe9 };

function x86Target(operand: X86Operand, mnemonic: string): number {
	if (operand.kind !== "target") {
		const hint = operand.kind === "imm" ? [`write the absolute target: ${mnemonic} 0x1000`] : [];
		throw new EncodeError(`${mnemonic} needs an absolute target address`, hint);
	}
	return operand.value;
}

function encodeX86Bytes(arch: EncodeArch, mnemonic: string, rawOperands: readonly string[], address: number): Uint8Array {
	const mode64 = arch === "x86-64";
	const accepted = [...ENCODE_MNEMONICS];
	if (mnemonic === "nop") {
		requireOperands(mnemonic, rawOperands, 0);
		return new Uint8Array([0x90]);
	}
	if (mnemonic === "ret") {
		requireOperands(mnemonic, rawOperands, 0);
		return new Uint8Array([0xc3]);
	}
	if (mnemonic === "jmp" || mnemonic === "call") {
		requireOperands(mnemonic, rawOperands, 1);
		const target = parseImmediate(rawOperands[0]!);
		if (target === null) {
			throw new EncodeError(`${mnemonic} needs a numeric target, got ${rawOperands[0]}`, [`labels are not resolvable here; write ${mnemonic} 0x1000`]);
		}
		const size = 5;
		const relative = target - (address + size);
		if (relative < -0x80000000 || relative > 0x7fffffff) {
			throw new EncodeError(`branch target is out of rel32 range: 0x${target.toString(16)} from 0x${address.toString(16)}`, ["pick a nearer target"]);
		}
		return new Uint8Array([BRANCH[mnemonic]!, ...le(relative, 4)]);
	}
	if (mnemonic === "mov" || mnemonic in ALU) {
		requireOperands(mnemonic, rawOperands, 2);
		const destination = parseX86Operand(rawOperands[0]!, mode64);
		const source = parseX86Operand(rawOperands[1]!, mode64);
		const alu = ALU[mnemonic];
		return encodeX86Data(mnemonic, alu, destination, source, mode64);
	}
	throw unknownMnemonic(arch, mnemonic, accepted);
}

function encodeX86Data(
	mnemonic: string,
	alu: { load: number; store: number; group: number } | undefined,
	destination: X86Operand,
	source: X86Operand,
	mode64: boolean,
): Uint8Array {
	if (source.kind === "target") throw new EncodeError(`${mnemonic} does not take a branch target here`, ["use jmp / call for control flow"]);
	if (destination.kind === "target") throw new EncodeError(`${mnemonic} cannot write to a branch target`);

	// 目标寄存器 + 源内存 / 源寄存器：走「读进 reg」方向，解码器读回来就是 `mnem xxx, src`。
	if (destination.kind === "reg") {
		const size = destination.size;
		if (source.kind === "reg") {
			if (source.size !== size) {
				throw new EncodeError(`operand size mismatch: ${destination.name} / ${source.name}`, [`both operands must be ${size}-bit`]);
			}
			const opcode = mnemonic === "mov" ? 0x8b : alu?.load;
			if (opcode === undefined) throw new EncodeError(`mov is the only reg-reg form supported here`);
			const modrm = modRmForReg(source.index, destination.index);
			const rex = emitRex(mode64, size === 64, destination.index, modrm.extB, modrm.extX);
			return new Uint8Array([...rex, opcode, ...modrm.bytes]);
		}
		if (source.kind === "mem") {
			const opcode = mnemonic === "mov" ? 0x8b : alu?.load;
			if (opcode === undefined) throw new EncodeError(`mov is the only mem-source form supported here`);
			const modrm = modRmForMem(source, destination.index);
			const rex = emitRex(mode64, size === 64, destination.index, modrm.extB, modrm.extX);
			return new Uint8Array([...rex, opcode, ...modrm.bytes]);
		}
		// 目标寄存器 + 立即数。
		const modrm = modRmForReg(destination.index, mnemonic === "mov" ? 0 : alu!.group);
		const rex = emitRex(mode64, size === 64, mnemonic === "mov" ? 0 : alu!.group, modrm.extB, modrm.extX);
		if (mnemonic === "mov") {
			if (size === 64 && (source.value < -0x80000000 || source.value > 0x7fffffff)) {
				// C7 的立即数是被符号扩展的 imm32，塞不进 64 位值；B8+r 才是「真的 64 位立即数」。
				if (source.value > 0x7fffffff && source.value < 0x100000000) {
					throw new EncodeError(
						`0x${source.value.toString(16)} is not encodable as mov ${destination.name}, imm`,
						["C7 sign-extends imm32 and B8 only round-trips values above 2^32", `use mov ${destination.name.replace("r", "e")}, 0x${source.value.toString(16)} (zero-extends)`],
					);
				}
				const value = source.value < 0 ? source.value + 0x10000000000000000 : source.value;
				return new Uint8Array([0x48 | ((destination.index >= 8 ? 1 : 0)), 0xb8 + (destination.index & 7), ...le(value, 8)]);
			}
			if (size === 32 && (source.value < -0x80000000 || source.value > 0xffffffff)) {
				throw new EncodeError(`immediate does not fit 32 bits: ${source.value}`, ["use mov with a 64-bit register to hold a wider value"]);
			}
			return new Uint8Array([...rex, 0xc7, ...modrm.bytes, ...le(source.value, 4)]);
		}
		if (source.value < -0x80000000 || source.value > 0xffffffff) {
			throw new EncodeError(`immediate does not fit imm32: ${source.value}`, [`${mnemonic} ${destination.name}, <value within ±2^31>`]);
		}
		return new Uint8Array([...rex, 0x81, ...modrm.bytes, ...le(source.value, 4)]);
	}

	// 目标是内存：源寄存器走「写进 rm」方向，源立即数则退化成 32 位存储（没有 REX.W 就只能是 32 位）。
	if (destination.kind === "mem") {
		if (source.kind === "reg") {
			const opcode = mnemonic === "mov" ? 0x89 : alu?.store;
			if (opcode === undefined) throw new EncodeError(`mov is the only mem-destination form supported here`);
			const modrm = modRmForMem(destination, source.index);
			const rex = emitRex(mode64, source.size === 64, source.index, modrm.extB, modrm.extX);
			return new Uint8Array([...rex, opcode, ...modrm.bytes]);
		}
		if (source.kind === "imm") {
			const opcode = mnemonic === "mov" ? 0xc7 : 0x81;
			const regField = mnemonic === "mov" ? 0 : alu!.group;
			const modrm = modRmForMem(destination, regField);
			const rex = emitRex(mode64, false, regField, modrm.extB, modrm.extX);
			if (source.value < -0x80000000 || source.value > 0xffffffff) {
				throw new EncodeError(`immediate does not fit imm32: ${source.value}`, ["memory stores without REX.W are 32-bit here"]);
			}
			return new Uint8Array([...rex, opcode, ...modrm.bytes, ...le(source.value, 4)]);
		}
	}
	throw new EncodeError(`${mnemonic}: unsupported operand combination`, ["reaching this means a form slipped past the parser; report it"]);
}

/* ---------------------------------------------------------------- aarch64 */

interface A64Reg {
	kind: "reg";
	index: number;
	wide: boolean;
	/** sp / xzr 都编成 31，语义差异由具体指令决定。 */
	special: "sp" | "zr" | "none";
}

interface A64Imm {
	kind: "imm";
	value: number;
}

type A64Operand = A64Reg | A64Imm;

const A64_MNEMONICS = [...ENCODE_MNEMONICS, "b", "bl", "eor", "movz", "csinc"];

function parseA64Register(token: string): A64Reg | null {
	const text = token.trim().toLowerCase();
	if (text === "sp") return { kind: "reg", index: 31, wide: true, special: "sp" };
	if (text === "xzr") return { kind: "reg", index: 31, wide: true, special: "zr" };
	if (text === "wzr") return { kind: "reg", index: 31, wide: false, special: "zr" };
	const match = /^([xw])(\d{1,2})$/.exec(text);
	if (match === null) return null;
	const index = Number.parseInt(match[2]!, 10);
	if (index > 30) throw new EncodeError(`register index out of range: ${token}`, ["x0…x30 / w0…w30; 31 is sp or the zero register"]);
	return { kind: "reg", index, wide: match[1] === "x", special: "none" };
}

function parseA64Operand(token: string): A64Operand {
	const register = parseA64Register(token);
	if (register !== null) return register;
	const immediate = parseImmediate(token);
	if (immediate !== null) return { kind: "imm", value: immediate };
	throw new EncodeError(`cannot read operand: ${token}`, ["registers x0…x30 / w0…w30 / sp, immediates #0x… or #decimal"]);
}

function a64RegText(operand: A64Reg): string {
	if (operand.special === "sp") return "sp";
	if (operand.special === "zr") return operand.wide ? "xzr" : "wzr";
	return `${operand.wide ? "x" : "w"}${operand.index}`;
}

function a64Register(operand: A64Operand, mnemonic: string): A64Reg {
	if (operand.kind !== "reg") throw new EncodeError(`${mnemonic} needs a register here, got an immediate`, [`${mnemonic} <reg>, …`]);
	return operand;
}

function a64Immediate(operand: A64Operand, mnemonic: string): number {
	if (operand.kind !== "imm") throw new EncodeError(`${mnemonic} needs an immediate here, got a register`, [`${mnemonic} …, #0x10`]);
	return operand.value;
}

function encodeAarch64Bytes(mnemonic: string, rawOperands: readonly string[], address: number): Uint8Array {
	const word = encodeAarch64Word(mnemonic, rawOperands, address);
	return new Uint8Array(le(word >>> 0, 4));
}

function encodeAarch64Word(mnemonic: string, rawOperands: readonly string[], address: number): number {
	if (mnemonic === "nop") {
		requireOperands(mnemonic, rawOperands, 0);
		return 0xd503201f;
	}
	if (mnemonic === "ret") {
		if (rawOperands.length > 1) requireOperands(mnemonic, rawOperands, 1);
		const link = rawOperands.length === 0 ? { kind: "reg", index: 30, wide: true, special: "none" } as A64Reg : a64Register(parseA64Operand(rawOperands[0]!), mnemonic);
		if (!link.wide || link.special !== "none") throw new EncodeError("ret takes a 64-bit general register", ["ret / ret x30"]);
		return (0xd65f0000 | (link.index << 5)) >>> 0;
	}
	if (mnemonic === "jmp" || mnemonic === "b" || mnemonic === "call" || mnemonic === "bl") {
		requireOperands(mnemonic, rawOperands, 1);
		const target = parseImmediate(rawOperands[0]!);
		if (target === null) throw new EncodeError(`${mnemonic} needs a numeric target, got ${rawOperands[0]}`, ["labels are not resolvable here; write 0x1000"]);
		const delta = target - address;
		if (delta % 4 !== 0) throw new EncodeError(`branch target is not 4-byte aligned: 0x${target.toString(16)}`, ["AArch64 branches are in units of 4 bytes"]);
		const units = delta / 4;
		if (units < -0x2000000 || units > 0x1ffffff) {
			throw new EncodeError(`branch target is out of range: 0x${target.toString(16)}`, ["b / bl reach ±128 MiB"]);
		}
		const isCall = mnemonic === "call" || mnemonic === "bl";
		return ((isCall ? 0x94000000 : 0x14000000) | (units & 0x03ffffff)) >>> 0;
	}
	if (mnemonic === "movz") {
		requireOperands(mnemonic, rawOperands, 2);
		const destination = a64Register(parseA64Operand(rawOperands[0]!), mnemonic);
		const immediate = a64Immediate(parseA64Operand(rawOperands[1]!), mnemonic);
		if (destination.special !== "none") throw new EncodeError("movz cannot write sp or the zero register", ["use a general register"]);
		return moveWide(destination, immediate, 2);
	}
	if (mnemonic === "mov") {
		requireOperands(mnemonic, rawOperands, 2);
		const destination = a64Register(parseA64Operand(rawOperands[0]!), mnemonic);
		const source = parseA64Operand(rawOperands[1]!);
		if (destination.special !== "none") throw new EncodeError("mov cannot write sp or the zero register", ["use add <reg>, sp, #0x0 to move the stack pointer"]);
		if (source.kind === "imm") return moveWide(destination, source.value, 2);
		const register = source;
		if (register.wide !== destination.wide) {
			throw new EncodeError(`operand size mismatch: ${a64RegText(destination)} / ${a64RegText(register)}`, ["both operands must be x or both w"]);
		}
		if (register.special !== "none") throw new EncodeError("mov between sp and a general register is an add-immediate alias", [`add ${a64RegText(destination)}, sp, #0x0`]);
		return ((destination.wide ? 0xaa000000 : 0x2a000000) | (register.index << 16) | (31 << 5) | destination.index) >>> 0;
	}
	if (mnemonic === "add" || mnemonic === "sub") {
		requireOperands(mnemonic, rawOperands, 3);
		const destination = a64Register(parseA64Operand(rawOperands[0]!), mnemonic);
		const left = a64Register(parseA64Operand(rawOperands[1]!), mnemonic);
		const right = parseA64Operand(rawOperands[2]!);
		const isSub = mnemonic === "sub";
		if (destination.wide !== left.wide) throw new EncodeError("operand size mismatch", ["both operands must be x or both w"]);
		if (right.kind === "imm") {
			if (destination.special !== "none") throw new EncodeError(`${mnemonic} cannot write sp here`, ["the immediate form writes a general register"]);
			const value = right.value;
			const lsl12 = value % 0x1000 === 0 && value > 0 && value / 0x1000 <= 0xfff;
			const imm12 = lsl12 ? value / 0x1000 : value;
			if (imm12 < 0 || imm12 > 0xfff) {
				throw new EncodeError(`immediate out of range for ${mnemonic}: ${value}`, [`use an imm12 (0…0xfff) or a multiple of 0x1000 up to 0xfff000`]);
			}
			const base = destination.wide ? (isSub ? 0xd1000000 : 0x91000000) : isSub ? 0x51000000 : 0x11000000;
			return (base | (lsl12 ? 1 << 22 : 0) | (imm12 << 10) | (left.index << 5) | destination.index) >>> 0;
		}
		const register = right;
		if (register.wide !== destination.wide) throw new EncodeError("operand size mismatch", ["both operands must be x or both w"]);
		if (destination.special !== "none" || register.special !== "none") {
			throw new EncodeError("shifted-register form cannot use sp or the zero register", ["use the immediate form, or another scratch register"]);
		}
		const base = destination.wide ? (isSub ? 0xcb000000 : 0x8b000000) : isSub ? 0x4b000000 : 0x0b000000;
		return (base | (register.index << 16) | (left.index << 5) | destination.index) >>> 0;
	}
	if (mnemonic === "xor" || mnemonic === "eor") {
		requireOperands(mnemonic, rawOperands, 3);
		const destination = a64Register(parseA64Operand(rawOperands[0]!), mnemonic);
		const left = a64Register(parseA64Operand(rawOperands[1]!), mnemonic);
		const right = a64Register(parseA64Operand(rawOperands[2]!), mnemonic);
		if (destination.wide !== left.wide || destination.wide !== right.wide) throw new EncodeError("operand size mismatch", ["all three operands must be x or w"]);
		if (destination.special !== "none" || left.special !== "none" || right.special !== "none") {
			throw new EncodeError("eor cannot use sp here", ["the zero register is allowed, sp is not"]);
		}
		return ((destination.wide ? 0xca000000 : 0x4a000000) | (right.index << 16) | (left.index << 5) | destination.index) >>> 0;
	}
	if (mnemonic === "cmp") {
		requireOperands(mnemonic, rawOperands, 2);
		const left = a64Register(parseA64Operand(rawOperands[0]!), mnemonic);
		const right = parseA64Operand(rawOperands[1]!);
		if (right.kind === "imm") {
			const value = right.value;
			const lsl12 = value % 0x1000 === 0 && value > 0 && value / 0x1000 <= 0xfff;
			const imm12 = lsl12 ? value / 0x1000 : value;
			if (imm12 < 0 || imm12 > 0xfff) throw new EncodeError(`immediate out of range for cmp: ${value}`, ["imm12 (0…0xfff), or a multiple of 0x1000 up to 0xfff000"]);
			const base = left.wide ? 0xf1000000 : 0x71000000;
			return (base | (lsl12 ? 1 << 22 : 0) | (imm12 << 10) | (left.index << 5) | 31) >>> 0;
		}
		if (right.wide !== left.wide) throw new EncodeError("operand size mismatch", ["both operands must be x or both w"]);
		const base = left.wide ? 0xeb000000 : 0x6b000000;
		return (base | (right.index << 16) | (left.index << 5) | 31) >>> 0;
	}
	throw unknownMnemonic("aarch64", mnemonic, A64_MNEMONICS);
}

/** MOVZ：`mov <rd>, #imm` 的规范形式。只认 16 位立即数（含 lsl #16），更宽的值要 movz+movk 两条。 */
function moveWide(destination: A64Reg, value: number, opc: number): number {
	if (value < 0) throw new EncodeError(`movz only takes unsigned immediates: ${value}`, ["movn / movk sequences are not encoded here"]);
	let half = 0;
	let immediate = value;
	if (value > 0xffff) {
		if (value % 0x10000 !== 0 || value / 0x10000 > 0xffff) {
			throw new EncodeError(`immediate needs more than one instruction: 0x${value.toString(16)}`, ["movz + movk; this encoder emits one instruction at a time"]);
		}
		half = 1;
		immediate = value / 0x10000;
	}
	const base = destination.wide ? 0xd2800000 : 0x52800000;
	return ((base | (half << 21) | (immediate << 5) | destination.index) | (opc === 2 ? 0 : 0)) >>> 0;
}

/**
 * 指令编码：`insn.ts` 的反方向。
 *
 * 存在的理由很具体：`disassemble_range` 只能读字节，于是「把一条指令变成字节」这类验证
 * （判定点那几条指令长什么样、跳转偏移算得对不对）只能去外面找汇编器。这里给出自带的
 * 一个子集，覆盖定位判定点后最常手改的九条指令。
 *
 * 承诺的边界写进类型与返回值，而不是只写在注释里：
 * - 返回的 `text` 是编码器认可的规范写法，必须与 `decodeAt(bytes)` 的文本逐字相等。
 *   `verifyEncoding` 与测试都按这条断言；对不上就是字节错了，宁可不输出。
 * - 不支持 8 / 16 位操作数、memory 的 scale 索引、符号与标签、伪指令、多指令序列。
 *   这些一律抛 `EncodeError` 并给出最接近的候选写法，不悄悄编成别的意思。
 * - 不做指令选择优化：`mov rax, 0x10` 固定编成 `C7 /0`，不会替你挑更短的编码。
 *
 * 一处由解码器决定的取舍：64 位立即数的 `B8+r` 形态在插件自己的反汇编里渲染成
 * `0x${hex(high)}${hex(low, 8)}`，当 high < 0x10 时会丢掉前导零（与真实意图不符）。
 * 因此 2^31…2^40-1 之间的立即数这里直接拒绝并说明原因，而不是输出一段读不回来的字节。
 */

import { decodeAt, disasmArchFor, x86Register, type DisasmArch } from "./insn";

export type EncodeArch = "aarch64" | "x86-64" | "x86";

/** 对外承诺的助记符。别名（`b` / `bl` / `eor` / `movz`）也接受，规范写法见返回值 `text`。 */
export const ENCODE_MNEMONICS = ["nop", "ret", "mov", "add", "sub", "xor", "cmp", "jmp", "call"] as const;

export const MAX_TEXT_CHARS = 200;
export const MAX_PROGRAM_LINES = 500;
/** 回转自检愿意为「把指令放到 address 上」付出的缓冲上限（16 MiB）。 */
const VERIFY_PAD_LIMIT = 0x1000000;

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
	/** 任何 `disasmArchFor` 认得的拼法都会先归一；`arm` 与未知架构直接报错。 */
	arch: string;
	text: string;
	/** 指令将来落在哪个文件偏移。分支按它算相对位移；缺省 0。 */
	address?: number;
}

export interface Encoded {
	arch: EncodeArch;
	/** 规范写法。放在 `address` 上解码时必须逐字还原。 */
	text: string;
	bytes: Uint8Array;
	/** 小写、空格分隔，与面板里 `hex` 列的写法一致。 */
	hex: string;
	size: number;
	address: number;
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
	/** 只把编码成功的条目串起来，可直接对照 `disassemble_range` 的输出。 */
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

	const plan =
		arch === "aarch64" ? encodeAarch64(mnemonic, rawOperands, address) : encodeX86(arch, mnemonic, rawOperands, address);

	return { arch, text: plan.text, bytes: plan.bytes, hex: hexOf(plan.bytes), size: plan.bytes.byteLength, address };
}

/**
 * 逐行编码。单条失败不终止整段：错误留在该行上，其余行照常编码，调用方才能一次讲完
 * 所有写不通的地方。地址按已成功条目的长度自动前进。
 */
export function encodeProgram(input: { arch: string; lines: readonly string[]; address?: number }): ProgramResult {
	const arch = encodeArchFor(input.arch);
	if (arch === null) {
		throw new EncodeError(`no encoder for architecture ${input.arch}`, ["supported: aarch64, x86-64, x86"]);
	}
	const lines = input.lines.filter(line => stripComment(line).trim() !== "");
	if (lines.length > MAX_PROGRAM_LINES) {
		throw new EncodeError(`refusing to encode more than ${MAX_PROGRAM_LINES} lines at once`, ["split the listing and encode it in batches"]);
	}

	let cursor = input.address ?? 0;
	const items: ProgramItem[] = [];
	const chunks: Uint8Array[] = [];
	lines.forEach((line, index) => {
		try {
			const encoded = encodeInstruction({ arch, text: line, address: cursor });
			items.push({ index, input: line.trim(), address: cursor, encoded });
			cursor += encoded.size;
			chunks.push(encoded.bytes);
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
 * 编码器最难发现的错误不是抛异常，而是安静地编成了另一条指令；只有让另一个实现读回来，
 * 才能把这种错误挡在输出之前。分支的目标是绝对偏移，所以要先把字节摆到 `address` 上再解码。
 */
export function verifyEncoding(encoded: Encoded): { ok: boolean; decoded: string; expected: string; exact: boolean } {
	const decodeAtBuffer = (buffer: Uint8Array, offset: number): { ok: boolean; decoded: string; expected: string; exact: boolean } => {
		const decoded = decodeAt(buffer, encoded.arch, offset);
		const ok = decoded !== null && decoded.size === encoded.size && decoded.text === encoded.text;
		return { ok, decoded: decoded?.text ?? "<none>", expected: encoded.text, exact: true };
	};
	if (encoded.address === 0) return decodeAtBuffer(encoded.bytes, 0);
	if (encoded.address + encoded.size <= VERIFY_PAD_LIMIT) {
		const padded = new Uint8Array(encoded.address + encoded.size);
		padded.set(encoded.bytes, encoded.address);
		return decodeAtBuffer(padded, encoded.address);
	}
	// 地址太大时只比长度与助记符：分支目标按偏移 0 渲染必然对不上，那不是编码器的错。
	const decoded = decodeAt(encoded.bytes, encoded.arch, 0);
	const mnemonic = encoded.text.split(" ")[0]!;
	return {
		ok: decoded !== null && decoded.size === encoded.size && decoded.text.startsWith(mnemonic),
		decoded: decoded?.text ?? "<none>",
		expected: encoded.text,
		exact: false,
	};
}

/* ---------------------------------------------------------------- utilities */

function messageOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/** `;` / `//` 之后是注释。`#` 不能当注释：AArch64 的立即数就长这样。 */
function stripComment(text: string): string {
	const semicolon = text.indexOf(";");
	const slashes = text.indexOf("//");
	const cut = [semicolon, slashes].filter(index => index !== -1).reduce((lowest, index) => Math.min(lowest, index), text.length);
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
		const value = Number.parseInt(text.replace(/^[+-]/, "").slice(2), 16);
		if (!Number.isSafeInteger(value)) return null;
		return negative ? -value : value;
	}
	if (/^[+-]?\d+$/.test(text)) {
		const value = Number.parseInt(text, 10);
		return Number.isSafeInteger(value) ? value : null;
	}
	return null;
}

/** 编辑距离，只用来把拼错的助记符映射回候选，不做模糊匹配。 */
function distance(a: string, b: string): number {
	const columns = b.length + 1;
	const table: number[] = new Array((a.length + 1) * columns).fill(0);
	for (let row = 0; row <= a.length; row += 1) table[row * columns] = row;
	for (let column = 0; column <= b.length; column += 1) table[column] = column;
	for (let row = 1; row <= a.length; row += 1) {
		for (let column = 1; column <= b.length; column += 1) {
			const cost = a[row - 1] === b[column - 1] ? 0 : 1;
			table[row * columns + column] = Math.min(
				table[(row - 1) * columns + column]! + 1,
				table[row * columns + column - 1]! + 1,
				table[(row - 1) * columns + column - 1]! + cost,
			);
		}
	}
	return table[a.length * columns + b.length]!;
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
		throw new EncodeError(
			`${mnemonic} expects ${count} operand(s), got ${operands.length}`,
			count === 0 ? ["drop the operands"] : [exampleFor(mnemonic)],
		);
	}
}

function exampleFor(mnemonic: string): string {
	if (mnemonic === "nop" || mnemonic === "ret") return mnemonic;
	if (mnemonic === "jmp" || mnemonic === "call") return `${mnemonic} 0x1000`;
	if (mnemonic === "cmp") return `${mnemonic} <left>, <right>`;
	return `${mnemonic} <dst>, <src>`;
}

function le(value: number, width: number): number[] {
	const bytes: number[] = [];
	for (let index = 0; index < width; index += 1) bytes.push((value >>> (index * 8)) & 0xff);
	return bytes;
}

/** 64 位小端：`le` 的 `>>>` 只有 32 位，宽立即数必须走 BigInt，否则高 32 位会被抹掉。 */
function le64(value: number): number[] {
	const pattern = BigInt(value) & 0xffffffffffffffffn;
	const bytes: number[] = [];
	for (let index = 0; index < 8; index += 1) bytes.push(Number((pattern >> BigInt(index * 8)) & 0xffn));
	return bytes;
}

function unsignedHex(value: number, bits: 32 | 64): string {
	const pattern = bits === 32 ? BigInt(value >>> 0) : BigInt(value) & 0xffffffffffffffffn;
	return `0x${pattern.toString(16)}`;
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

type X86Operand = X86Reg | X86Imm | X86Mem;

/** 解码器画内存操作数的方式：`[base]` / `[base + 0x8]` / `[base - 0x8]` / `[rip + 0x8]`。 */
function renderMem(operand: X86Mem): string {
	const head = operand.rip ? "rip" : operand.base;
	if (operand.disp === 0) return `[${head}]`;
	return `[${head} ${operand.disp < 0 ? "-" : "+"} 0x${Math.abs(operand.disp).toString(16)}]`;
}

function renderX86Operand(operand: X86Operand): string {
	if (operand.kind === "reg") return operand.name;
	if (operand.kind === "imm") return operand.value < 0 ? `-0x${(-operand.value).toString(16)}` : `0x${operand.value.toString(16)}`;
	return renderMem(operand);
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
			if (base !== "" || rip) {
				throw new EncodeError(`memory operand has more than one base register: ${token}`, ["[base] or [base + disp], one register only"]);
			}
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
	// rbp / r13 在 mod=00 里表示「没有基址、只有 disp32」，所以 disp=0 也要用 mod=01 的 0 偏移。
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

/** ALU 的两种方向：`load`（`0x03` 家族，把 rm 读进 reg）与 `store`（`0x01` 家族，把 reg 写进 rm）。 */
const ALU: Record<string, { load: number; store: number; group: number }> = {
	add: { load: 0x03, store: 0x01, group: 0 },
	sub: { load: 0x2b, store: 0x29, group: 5 },
	xor: { load: 0x33, store: 0x31, group: 6 },
	cmp: { load: 0x3b, store: 0x39, group: 7 },
};

const BRANCH: Record<string, number> = { call: 0xe8, jmp: 0xe9 };

interface EncodedPlan {
	bytes: Uint8Array;
	text: string;
}

function encodeX86(arch: EncodeArch, mnemonic: string, rawOperands: readonly string[], address: number): EncodedPlan {
	const mode64 = arch === "x86-64";
	if (mnemonic === "nop") {
		requireOperands(mnemonic, rawOperands, 0);
		return { bytes: new Uint8Array([0x90]), text: "nop" };
	}
	if (mnemonic === "ret") {
		requireOperands(mnemonic, rawOperands, 0);
		return { bytes: new Uint8Array([0xc3]), text: "ret" };
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
			throw new EncodeError(
				`branch target is out of rel32 range: 0x${target.toString(16)} from 0x${address.toString(16)}`,
				["pick a nearer target"],
			);
		}
		return { bytes: new Uint8Array([BRANCH[mnemonic]!, ...le(relative, 4)]), text: `${mnemonic} file+0x${target.toString(16)}` };
	}
	if (mnemonic === "mov" || mnemonic in ALU) {
		requireOperands(mnemonic, rawOperands, 2);
		const destination = parseX86Operand(rawOperands[0]!, mode64);
		const source = parseX86Operand(rawOperands[1]!, mode64);
		return encodeX86Data(mnemonic, ALU[mnemonic], destination, source, mode64);
	}
	throw unknownMnemonic(arch, mnemonic, ENCODE_MNEMONICS);
}

function encodeX86Data(
	mnemonic: string,
	alu: { load: number; store: number; group: number } | undefined,
	destination: X86Operand,
	source: X86Operand,
	mode64: boolean,
): EncodedPlan {
	if (destination.kind === "reg") {
		const size = destination.size;
		const text = `${mnemonic} ${destination.name}, ${renderX86Operand(source)}`;
		if (source.kind === "reg" || source.kind === "mem") {
			if (source.kind === "reg" && source.size !== size) {
				throw new EncodeError(`operand size mismatch: ${destination.name} / ${source.name}`, [`both operands must be ${size}-bit`]);
			}
			const opcode = mnemonic === "mov" ? 0x8b : alu?.load;
			if (opcode === undefined) throw new EncodeError(`${mnemonic}: only mov is supported for this operand shape`);
			const modrm = source.kind === "reg" ? modRmForReg(source.index, destination.index) : modRmForMem(source, destination.index);
			const rex = emitRex(mode64, size === 64, destination.index, modrm.extB, modrm.extX);
			return { bytes: new Uint8Array([...rex, opcode, ...modrm.bytes]), text };
		}
		// 目标寄存器 + 立即数。文本按解码器口径给出，而不是按输入原样回显。
		if (mnemonic === "mov") {
			if (size === 64 && (source.value < -0x80000000 || source.value > 0x7fffffff)) {
				// C7 的立即数是被符号扩展的 imm32，装不下 64 位值，只有 B8+r 是真 64 位立即数。
				const wide = unsignedHex(source.value, 64);
				const value = Number(BigInt(source.value) & 0xffffffffffffffffn);
				if (source.value > 0 && value < 0x1000000000) {
					throw new EncodeError(
						`${wide} has no faithful encoding here`,
						[
							"C7 sign-extends imm32, and this decoder renders B8 as hex(high)+hex(low) — below 2^40 it loses a digit",
							`use a 32-bit register to zero-extend: mov ${destination.name.replace(/^r/, "e")}, ${unsignedHex(source.value, 32)}`,
							`or use a value at 0x1000000000 and above, which B8 renders as plain hex`,
						],
					);
				}
				const bytes = [0x48 | (destination.index >= 8 ? 0x01 : 0x00), 0xb8 + (destination.index & 7), ...le64(source.value)];
				return { bytes: new Uint8Array(bytes), text: `${mnemonic} ${destination.name}, ${wide}` };
			}
			if (size === 32 && (source.value < -0x80000000 || source.value > 0xffffffff)) {
				throw new EncodeError(`immediate does not fit 32 bits: ${source.value}`, ["use a 64-bit register to hold a wider value"]);
			}
			const modrm = modRmForReg(destination.index, 0);
			const rex = emitRex(mode64, size === 64, 0, modrm.extB, modrm.extX);
			// 64 位 C7 的立即数符号扩展后按有符号渲染，32 位则按无符号 imm32 渲染。
			const immediate =
				size === 64
					? source.value < 0
						? `-0x${(-source.value).toString(16)}`
						: `0x${source.value.toString(16)}`
					: unsignedHex(source.value, 32);
			return { bytes: new Uint8Array([...rex, 0xc7, ...modrm.bytes, ...le(source.value, 4)]), text: `${mnemonic} ${destination.name}, ${immediate}` };
		}
		if (source.value < -0x80000000 || source.value > 0xffffffff) {
			throw new EncodeError(`immediate does not fit imm32: ${source.value}`, [`${mnemonic} ${destination.name}, <value within ±2^31>`]);
		}
		const group = alu!.group;
		const modrm = modRmForReg(destination.index, group);
		const rex = emitRex(mode64, size === 64, group, modrm.extB, modrm.extX);
		return {
			bytes: new Uint8Array([...rex, 0x81, ...modrm.bytes, ...le(source.value, 4)]),
			text: `${mnemonic} ${destination.name}, ${unsignedHex(source.value, 32)}`,
		};
	}

	// 目标是内存：源寄存器走「写进 rm」方向；源立即数只能是 32 位存储，因为这里不输出 REX.W。
	if (destination.kind !== "mem") {
		throw new EncodeError(`${mnemonic}: unsupported operand combination`, ["reaching this means a form slipped past the parser"]);
	}
	const memory = destination;
	if (source.kind === "reg") {
		const opcode = mnemonic === "mov" ? 0x89 : alu?.store;
		if (opcode === undefined) throw new EncodeError(`${mnemonic}: only mov is supported for this operand shape`);
		const modrm = modRmForMem(memory, source.index);
		const rex = emitRex(mode64, source.size === 64, source.index, modrm.extB, modrm.extX);
		return { bytes: new Uint8Array([...rex, opcode, ...modrm.bytes]), text: `${mnemonic} ${renderMem(memory)}, ${source.name}` };
	}
	if (source.kind === "imm") {
		if (source.value < -0x80000000 || source.value > 0xffffffff) {
			throw new EncodeError(`immediate does not fit imm32: ${source.value}`, ["memory stores without REX.W are 32-bit"]);
		}
		const regField = mnemonic === "mov" ? 0 : alu!.group;
		const modrm = modRmForMem(memory, regField);
		const rex = emitRex(mode64, false, regField, modrm.extB, modrm.extX);
		const opcode = mnemonic === "mov" ? 0xc7 : 0x81;
		return {
			bytes: new Uint8Array([...rex, opcode, ...modrm.bytes, ...le(source.value, 4)]),
			text: `${mnemonic} ${renderMem(memory)}, ${unsignedHex(source.value, 32)}`,
		};
	}
	throw new EncodeError(`${mnemonic}: unsupported operand combination`, ["reaching this means a form slipped past the parser"]);
}

/* ---------------------------------------------------------------- aarch64 */

interface A64Reg {
	kind: "reg";
	index: number;
	wide: boolean;
	/** sp / xzr / wzr 都编成 31，语义差异由具体指令决定。 */
	special: "sp" | "zr" | "none";
}

interface A64Imm {
	kind: "imm";
	value: number;
}

type A64Operand = A64Reg | A64Imm;

const A64_MNEMONICS = [...ENCODE_MNEMONICS, "b", "bl", "eor", "movz"];

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
	if (operand.kind !== "reg") throw new EncodeError(`${mnemonic} needs a register here, got an immediate`, [exampleFor(mnemonic)]);
	return operand;
}

/** 只有 add/sub/cmp 的立即数形态能把 31 当作 sp；其余形态里 31 是零寄存器。 */
function rejectSp(register: A64Reg, mnemonic: string, role: string): void {
	if (register.special === "sp") {
		throw new EncodeError(`${mnemonic} cannot use sp as the ${role}`, ["sp only appears in the add/sub immediate form and in ldr/str; use a general register"]);
	}
}

function rejectZero(register: A64Reg, mnemonic: string, role: string): void {
	if (register.special === "zr") {
		throw new EncodeError(`${mnemonic} cannot use the zero register as the ${role}`, ["31 means sp in this encoding; write a general register"]);
	}
}

const SHIFT_OPERAND = /^lsl\s+#?(0x[0-9a-f]+|\d+)$/i;

/**
 * 把 `…, #0x1, lsl #12` 合并成一个立即数。合并后仍走普通的 imm12 / 16 位分支，
 * 于是规范文本会自己还原成 `lsl #12` / `lsl #16` 的写法，不会出现两种来源两种输出。
 */
function mergeShiftOperands(operands: readonly string[]): string[] {
	if (operands.length < 2) return [...operands];
	const last = operands[operands.length - 1]!.trim();
	const match = SHIFT_OPERAND.exec(last);
	if (match === null) return [...operands];
	const digits = match[1]!;
	const shift = Number.parseInt(digits.startsWith("0x") || digits.startsWith("0X") ? digits.slice(2) : digits, digits.startsWith("0x") || digits.startsWith("0X") ? 16 : 10);
	if (shift !== 12 && shift !== 16) {
		throw new EncodeError(`unsupported shift for a single instruction: lsl #${shift}`, ["this encoder emits the lsl #12 / lsl #16 forms only"]);
	}
	const previous = operands[operands.length - 2]!;
	const immediate = parseImmediate(previous);
	if (immediate === null) {
		throw new EncodeError(`lsl needs an immediate before it: ${previous}, ${last}`, ["add x0, x1, #0x1, lsl #12"]);
	}
	return [...operands.slice(0, -2), String(immediate * 2 ** shift)];
}

function encodeAarch64(mnemonic: string, rawOperands: readonly string[], address: number): EncodedPlan {
	const operands = mergeShiftOperands(rawOperands);
	const word = encodeAarch64Word(mnemonic, operands, address);
	return { bytes: new Uint8Array(le(word >>> 0, 4)), text: aarch64Text(mnemonic, operands, address) };
}

function encodeAarch64Word(mnemonic: string, rawOperands: readonly string[], address: number): number {
	if (mnemonic === "nop") {
		requireOperands(mnemonic, rawOperands, 0);
		return 0xd503201f;
	}
	if (mnemonic === "ret") {
		if (rawOperands.length > 1) requireOperands(mnemonic, rawOperands, 1);
		const link: A64Reg =
			rawOperands.length === 0 ? { kind: "reg", index: 30, wide: true, special: "none" } : a64Register(parseA64Operand(rawOperands[0]!), mnemonic);
		if (!link.wide || link.special !== "none") throw new EncodeError("ret takes a 64-bit general register", ["ret / ret x30"]);
		return (0xd65f0000 | (link.index << 5)) >>> 0;
	}
	if (mnemonic === "jmp" || mnemonic === "b" || mnemonic === "call" || mnemonic === "bl") {
		requireOperands(mnemonic, rawOperands, 1);
		const target = parseImmediate(rawOperands[0]!);
		if (target === null) throw new EncodeError(`${mnemonic} needs a numeric target, got ${rawOperands[0]}`, ["labels are not resolvable here; write 0x1000"]);
		const delta = target - address;
		if (delta % 4 !== 0) throw new EncodeError(`branch target is not 4-byte aligned: 0x${target.toString(16)}`, ["AArch64 branches count in 4-byte units"]);
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
		const value = parseA64Immediate(rawOperands[1]!, mnemonic);
		rejectZero(destination, mnemonic, "destination");
		if (destination.special === "sp") throw new EncodeError("movz cannot write sp", ["use a general register"]);
		return moveWide(destination, value);
	}
	if (mnemonic === "mov") {
		requireOperands(mnemonic, rawOperands, 2);
		const destination = a64Register(parseA64Operand(rawOperands[0]!), mnemonic);
		const source = parseA64Operand(rawOperands[1]!);
		if (destination.special === "sp") {
			throw new EncodeError("mov cannot write sp", ["the sp forms are add-imm aliases: add sp, sp, #0x0"]);
		}
		if (source.kind === "imm") return moveWide(destination, source.value);
		if (source.wide !== destination.wide) {
			throw new EncodeError(`operand size mismatch: ${a64RegText(destination)} / ${a64RegText(source)}`, ["both operands must be x or both w"]);
		}
		if (source.special === "sp") {
			throw new EncodeError("mov cannot read sp", [`the sp forms are add-imm aliases: add ${a64RegText(destination)}, sp, #0x0`]);
		}
		return ((destination.wide ? 0xaa000000 : 0x2a000000) | (source.index << 16) | (31 << 5) | destination.index) >>> 0;
	}
	if (mnemonic === "add" || mnemonic === "sub") {
		requireOperands(mnemonic, rawOperands, 3);
		const destination = a64Register(parseA64Operand(rawOperands[0]!), mnemonic);
		const left = a64Register(parseA64Operand(rawOperands[1]!), mnemonic);
		const right = parseA64Operand(rawOperands[2]!);
		const isSub = mnemonic === "sub";
		if (destination.wide !== left.wide) throw new EncodeError("operand size mismatch", ["both operands must be x or both w"]);
		if (right.kind === "imm") {
			rejectZero(destination, mnemonic, "destination");
			rejectZero(left, mnemonic, "source");
			const { imm12, lsl12 } = splitImm12(right.value, mnemonic);
			const base = destination.wide ? (isSub ? 0xd1000000 : 0x91000000) : isSub ? 0x51000000 : 0x11000000;
			return (base | (lsl12 ? 1 << 22 : 0) | (imm12 << 10) | (left.index << 5) | destination.index) >>> 0;
		}
		if (right.wide !== destination.wide) throw new EncodeError("operand size mismatch", ["all three operands must be x or w"]);
		rejectSp(destination, mnemonic, "destination");
		rejectSp(left, mnemonic, "source");
		rejectSp(right, mnemonic, "addend");
		const base = destination.wide ? (isSub ? 0xcb000000 : 0x8b000000) : isSub ? 0x4b000000 : 0x0b000000;
		return (base | (right.index << 16) | (left.index << 5) | destination.index) >>> 0;
	}
	if (mnemonic === "xor" || mnemonic === "eor") {
		requireOperands(mnemonic, rawOperands, 3);
		const destination = a64Register(parseA64Operand(rawOperands[0]!), mnemonic);
		const left = a64Register(parseA64Operand(rawOperands[1]!), mnemonic);
		const right = a64Register(parseA64Operand(rawOperands[2]!), mnemonic);
		if (destination.wide !== left.wide || destination.wide !== right.wide) throw new EncodeError("operand size mismatch", ["all three operands must be x or w"]);
		rejectSp(destination, mnemonic, "destination");
		rejectSp(left, mnemonic, "first source");
		rejectSp(right, mnemonic, "second source");
		return ((destination.wide ? 0xca000000 : 0x4a000000) | (right.index << 16) | (left.index << 5) | destination.index) >>> 0;
	}
	if (mnemonic === "cmp") {
		requireOperands(mnemonic, rawOperands, 2);
		const left = a64Register(parseA64Operand(rawOperands[0]!), mnemonic);
		const right = parseA64Operand(rawOperands[1]!);
		rejectSp(left, mnemonic, "first operand");
		if (right.kind === "imm") {
			const { imm12, lsl12 } = splitImm12(right.value, mnemonic);
			const base = left.wide ? 0xf1000000 : 0x71000000;
			return (base | (lsl12 ? 1 << 22 : 0) | (imm12 << 10) | (left.index << 5) | 31) >>> 0;
		}
		if (right.wide !== left.wide) throw new EncodeError("operand size mismatch", ["both operands must be x or both w"]);
		rejectSp(right, mnemonic, "second operand");
		const base = left.wide ? 0xeb000000 : 0x6b000000;
		return (base | (right.index << 16) | (left.index << 5) | 31) >>> 0;
	}
	throw unknownMnemonic("aarch64", mnemonic, A64_MNEMONICS);
}

function parseA64Immediate(token: string, mnemonic: string): number {
	const operand = parseA64Operand(token);
	if (operand.kind !== "imm") throw new EncodeError(`${mnemonic} needs an immediate here, got a register`, [`${mnemonic} …, #0x10`]);
	return operand.value;
}

/** imm12，或 0x1000 的整数倍（走 `lsl #12`）。两者都装不下就报错，不拆分多指令。 */
function splitImm12(value: number, mnemonic: string): { imm12: number; lsl12: boolean } {
	if (value >= 0 && value <= 0xfff) return { imm12: value, lsl12: false };
	if (value > 0 && value % 0x1000 === 0 && value / 0x1000 <= 0xfff) return { imm12: value / 0x1000, lsl12: true };
	throw new EncodeError(`immediate out of range for ${mnemonic}: ${value}`, ["imm12 (0…0xfff), or a multiple of 0x1000 up to 0xfff000"]);
}

/** MOVZ：`mov <rd>, #imm` 的规范形式。只认 16 位立即数（含 lsl #16），更宽的值要 movz+movk 两条。 */
function moveWide(destination: A64Reg, value: number): number {
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
	return (base | (half << 21) | (immediate << 5) | destination.index) >>> 0;
}

/** 规范文本：与 `decodeAt` 在同一份字节上给出的写法逐字一致，别名与立即数格式都按解码器的口径。 */
function aarch64Text(mnemonic: string, rawOperands: readonly string[], address: number): string {
	if (mnemonic === "nop") return "nop";
	if (mnemonic === "ret") {
		if (rawOperands.length === 0) return "ret";
		const register = a64Register(parseA64Operand(rawOperands[0]!), mnemonic);
		return register.index === 30 && register.special === "none" ? "ret" : `ret ${a64RegText(register)}`;
	}
	if (mnemonic === "jmp" || mnemonic === "b" || mnemonic === "call" || mnemonic === "bl") {
		const target = parseImmediate(rawOperands[0]!) ?? address;
		return `${mnemonic === "call" || mnemonic === "bl" ? "bl" : "b"} file+0x${target.toString(16)}`;
	}
	if (mnemonic === "mov" || mnemonic === "movz") {
		const destination = a64Register(parseA64Operand(rawOperands[0]!), mnemonic);
		const source = parseA64Operand(rawOperands[1]!);
		if (source.kind === "reg") return `mov ${a64RegText(destination)}, ${a64RegText(source)}`;
		const half = source.value > 0xffff ? 1 : 0;
		const immediate = half === 1 ? source.value / 0x10000 : source.value;
		return `movz ${a64RegText(destination)}, #0x${immediate.toString(16)}${half === 1 ? ", lsl #16" : ""}`;
	}
	if (mnemonic === "cmp") {
		const left = a64Register(parseA64Operand(rawOperands[0]!), mnemonic);
		const right = parseA64Operand(rawOperands[1]!);
		if (right.kind === "reg") return `cmp ${a64RegText(left)}, ${a64RegText(right)}`;
		const { imm12, lsl12 } = splitImm12(right.value, mnemonic);
		return `cmp ${a64RegText(left)}, #0x${imm12.toString(16)}${lsl12 ? ", lsl #12" : ""}`;
	}
	if (mnemonic === "xor" || mnemonic === "eor") {
		const operands = rawOperands.map(token => a64Register(parseA64Operand(token), mnemonic));
		return `eor ${operands.map(a64RegText).join(", ")}`;
	}
	if (mnemonic === "add" || mnemonic === "sub") {
		const destination = a64Register(parseA64Operand(rawOperands[0]!), mnemonic);
		const left = a64Register(parseA64Operand(rawOperands[1]!), mnemonic);
		const right = parseA64Operand(rawOperands[2]!);
		if (right.kind === "reg") return `${mnemonic} ${a64RegText(destination)}, ${a64RegText(left)}, ${a64RegText(right)}`;
		const { imm12, lsl12 } = splitImm12(right.value, mnemonic);
		return `${mnemonic} ${a64RegText(destination)}, ${a64RegText(left)}, #0x${imm12.toString(16)}${lsl12 ? ", lsl #12" : ""}`;
	}
	return mnemonic;
}

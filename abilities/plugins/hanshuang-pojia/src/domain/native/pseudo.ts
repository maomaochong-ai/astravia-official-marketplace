/**
 * 伪代码恢复：把 `cfg.ts` 的基本块重建成人能顺着读的类 C 文本。
 *
 * 这不是反编译器，能力边界必须写在输出里，否则用户会把寄存器级重建当成 Hex-Rays
 * 结果。具体地：不做类型恢复、不做 SSA、不做变量合并，操作数保留寄存器名，栈槽统一
 * 叫 `var_<偏移>`。它做到的只有上游 `pdc` 那一层：块、标签、条件、调用、返回、字符串引用，
 * 以及三档详略和字符预算。
 *
 * 之所以自己写而不是等外部反编译器：`pdc` 本身就是线性反汇编之上的模板化重排，
 * 插件已经有块划分与指令语义（`flow` / `refs`），补齐这一层只需要重建文本，不需要
 * 重新解码任何字节。
 */

import { buildFunctionView } from "./cfg";
import type { BasicBlock } from "./cfg";
import { peekCString } from "./deep";
import type { DecodedInstruction, DisasmArch } from "./insn";

export type PseudoMode = "full" | "fold" | "summary";

export interface PseudoOptions {
	start: number;
	end?: number;
	name?: string | null;
	mode?: PseudoMode;
	/** 字符预算，超出后按行截断并明确写出截断点。 */
	budget?: number;
	/** 文件偏移 → 符号名，用于给调用目标起名。 */
	names?: Map<number, string>;
	maxInstructions?: number;
}

export interface PseudoStringRef {
	offset: number;
	text: string;
	/** 引用它的指令偏移。 */
	from: number;
}

export interface PseudoResult {
	arch: DisasmArch;
	mode: PseudoMode;
	start: number;
	end: number;
	name: string;
	text: string;
	instructions: number;
	blocks: number;
	calls: number;
	strings: PseudoStringRef[];
	truncated: boolean;
	budget: number;
	warnings: string[];
}

export const DEFAULT_PSEUDO_BUDGET = 6000;
const MIN_BUDGET = 800;
const MAX_BUDGET = 200_000;

/** 寄存器名直接进文本；只把帧指针和链接寄存器换成更易读的别名。 */
const REGISTER_ALIASES: Record<string, string> = {
	x29: "fp",
	x30: "lr",
	r29: "fp",
	r30: "lr",
	rbp: "fp",
	ip: "r12",
};

const SKIP_MNEMONICS = new Set(["nop", "endbr64", "endbr32", "bti", "pacibsp", "autibsp", "hint", "ud2", "int3", "xchg"]);

/** 助记符别名：不同架构表达同一个赋值。 */
const ALIAS: Record<string, string> = {
	orr: "|",
	or: "|",
	eor: "^",
	xor: "^",
	and: "&",
	add: "+",
	sub: "-",
	mul: "*",
	imul: "*",
	lsl: "<<",
	lsr: ">>",
	asr: ">>",
	shl: "<<",
	shr: ">>",
};

const COMPARE_MNEMONICS = new Set(["cmp", "cmn", "tst", "test", "subs", "adds", "ands"]);

/** 条件后缀 → 比较运算符。取不到就直接写 flag_<cond>，不猜。 */
const CONDITION_TEXT: Record<string, string> = {
	eq: "==",
	ne: "!=",
	cs: ">=",
	hs: ">=",
	cc: "<",
	lo: "<",
	hi: ">",
	ls: "<=",
	lt: "<",
	le: "<=",
	gt: ">",
	ge: ">=",
	mi: "< 0",
	pl: ">= 0",
	vs: "overflow set",
	vc: "overflow clear",
	o: "overflow set",
	no: "overflow clear",
	b: "<",
	ae: ">=",
	e: "==",
	be: "<=",
	a: ">",
	s: "< 0",
	ns: ">= 0",
	p: "parity",
	np: "!parity",
	l: "<",
	g: ">",
};

const PURE_DATA_MNEMONICS = new Set(["mov", "movz", "movn", "movk", "movzx", "movsx", "adr", "adrp", "lea", "inc", "dec", "neg", "not"]);

function hex(value: number): string {
	return value.toString(16);
}

function label(offset: number): string {
	return `L_${hex(offset)}`;
}

function symbolName(offset: number, names?: Map<number, string>): string {
	const raw = names?.get(offset);
	if (raw) {
		const cleaned = raw.trim().replace(/[^A-Za-z0-9_.$]/g, "_").replace(/^_+/, "");
		if (cleaned !== "") return cleaned;
	}
	return `sub_${hex(offset)}`;
}

/** 顶层逗号切分：`[sp, #0x10]` 里的逗号不是操作数分隔符。 */
export function splitOperands(text: string): string[] {
	const out: string[] = [];
	let depth = 0;
	let current = "";
	for (const character of text) {
		if (character === "[" || character === "{" || character === "(") depth += 1;
		if (character === "]" || character === "}" || character === ")") depth = Math.max(0, depth - 1);
		if (character === "," && depth === 0) {
			out.push(current.trim());
			current = "";
			continue;
		}
		current += character;
	}
	if (current.trim() !== "") out.push(current.trim());
	return out;
}

function registerName(raw: string): string {
	const value = raw.trim();
	return REGISTER_ALIASES[value] ?? value;
}

/**
 * 访存表达式：栈槽变成 `var_<偏移>`，其余保留成 `*(base + off)`。
 * 认不出形态时原样返回，宁可难看也不编造结构。
 */
export function memoryExpr(operand: string): string {
	let text = operand.trim();
	// `[sp, #-0x10]!` 是前索引，`[sp], #0x10` 是后索引；两者访问的地址都在方括号里。
	if (text.endsWith("!")) text = text.slice(0, -1).trim();
	const close = text.indexOf("],");
	if (close > 0) text = text.slice(0, close + 1).trim();
	if (!text.startsWith("[") || !text.endsWith("]")) return registerName(text);
	const inner = splitOperands(text.slice(1, -1)).join(", ");
	const parts = splitOperands(text.slice(1, -1)).map(part => part.trim());
	if (parts.length === 0) return "*(?)";

	const base = registerName(parts[0]!);
	const displacement = parts
		.slice(1)
		.filter(part => part.startsWith("#") || part.startsWith("0x") || part.startsWith("-0x") || /^[+-]/.test(part))
		.map(part => part.replace(/^#/, ""))
		.at(0);
	const index = parts.slice(1).find(part => !part.startsWith("#") && !part.startsWith("0x") && !part.startsWith("-0x") && !/^[+-]/.test(part));

	const isStack = base === "sp" || base === "rsp" || base === "fp";
	if (isStack && displacement && index === undefined) {
		const numeric = Number.parseInt(displacement.replace(/^\+/, ""), 16);
		if (Number.isFinite(numeric)) return `var_${hex(Math.abs(numeric))}`;
	}
	if (base === "rip" && displacement) return `&data_${hex(Number.parseInt(displacement.replace(/^\+/, ""), 16) || 0)}`;
	if (displacement && index === undefined) return `*(${base} ${displacement.startsWith("-") ? "-" : "+"} ${displacement.replace(/^[-+]/, "")})`;
	if (index !== undefined) return `*(${base} + ${registerName(index)})`;
	if (inner === "") return `*(${base})`;
	return `*(${base})`;
}

function bracketRefs(instruction: DecodedInstruction): number[] {
	return instruction.refs ?? [];
}

/** 成对访存的第二个槽：栈槽是 +8，其余按指针算术写。 */
function secondSlot(place: string): string {
	const stack = /^var_([0-9a-f]+)$/.exec(place);
	if (stack) return `var_${hex(Number.parseInt(stack[1]!, 16) + 8)}`;
	if (place.endsWith(")")) return `${place.slice(0, -1)} + 8)`;
	return `${place} /* +8 */`;
}

function stringAt(bytes: Uint8Array, offset: number): string | null {
	const text = peekCString(bytes, offset, 80);
	return text && text.length >= 4 ? text : null;
}

interface Comparison {
	left: string;
	right: string | null;
	/** cmp/cmn/tst 的语义差异。 */
	kind: "cmp" | "cmn" | "tst";
}

function comparisonOf(instruction: DecodedInstruction): Comparison | null {
	if (!COMPARE_MNEMONICS.has(instruction.mnemonic)) return null;
	const operands = splitOperands(instruction.text.slice(instruction.mnemonic.length).trim());
	if (operands.length < 2) return null;
	const kind: Comparison["kind"] = instruction.mnemonic === "cmn" || instruction.mnemonic === "adds" ? "cmn" : instruction.mnemonic === "tst" || instruction.mnemonic === "test" || instruction.mnemonic === "ands" ? "tst" : "cmp";
	return { left: registerName(operands[0]!), right: registerName(operands[1]!), kind };
}

/** 把一次已记录的比较 + 条件后缀渲染成表达式；cset 和条件跳转共用同一套口径。 */
function comparisonText(pending: Comparison, suffix: string, operator: string): string {
	const left = pending.kind === "tst" ? `(${pending.left} & ${pending.right ?? "?"})` : pending.left;
	const right = pending.kind === "tst" ? "0" : (pending.right ?? "?");
	const leftText = pending.kind === "cmn" ? `(${pending.left} + ${pending.right ?? "?"})` : left;
	if (operator.startsWith("<") || operator.startsWith(">")) {
		// 有符号 / 无符号的区分在寄存器级看不出来，标注出来而不是假装知道。
		return `${leftText} ${operator} ${right} /* ${suffix}, signedness unresolved */`;
	}
	return `${leftText} ${operator} ${right}`;
}

function conditionExpression(instruction: DecodedInstruction, pending: Comparison | null): string {
	const mnemonic = instruction.mnemonic;
	const operands = splitOperands(instruction.text.slice(mnemonic.length).trim());

	// cbz / cbnz / tbz / tbnz 自带被比较的寄存器。
	if (/^cb(n)?z$/.test(mnemonic) && operands[0]) {
		const register = registerName(operands[0]);
		return mnemonic === "cbz" ? `${register} == 0` : `${register} != 0`;
	}
	if (/^tb(n)?z$/.test(mnemonic) && operands[0] && operands[1]) {
		const register = registerName(operands[0]);
		const bit = operands[1]!.replace(/^#/, "");
		return mnemonic === "tbz" ? `((${register} >> ${bit}) & 1) == 0` : `((${register} >> ${bit}) & 1) != 0`;
	}

	const suffix = instruction.flow.condition ?? (mnemonic.startsWith("b.") ? mnemonic.slice(2) : undefined);
	const operator = suffix ? CONDITION_TEXT[suffix] : undefined;

	if (pending && operator) return comparisonText(pending, suffix!, operator);
	if (pending && !operator) return `flag_${suffix ?? "unknown"}`;
	// 只有后缀、没有可用的比较上下文：把旗标名原样写出来，别编一个条件。
	if (suffix) return `flags_${suffix}`;
	return "/* unknown condition */ true";
}

/** 赋值语句：认不出的指令返回 null，由调用方决定是否降级成原始文本。 */
function assignmentOf(instruction: DecodedInstruction, bytes: Uint8Array, flags: Comparison | null): string | null {
	const mnemonic = instruction.mnemonic;
	const operands = splitOperands(instruction.text.slice(mnemonic.length).trim());
	if (operands.length === 0) return null;

	const note = bracketRefs(instruction)
		.map(ref => stringAt(bytes, ref))
		.find((value): value is string => value !== null);

	if (mnemonic === "mov" || mnemonic === "movzx" || mnemonic === "movsx" || mnemonic === "movz" || mnemonic === "movn" || mnemonic === "movk") {
		const destination = registerName(operands[0]!);
		if (operands.length < 2) return `${destination} = ?;`;
		const raw = operands[1]!;
		const source = raw.startsWith("#") ? raw.slice(1) : registerName(raw);
		const shift = operands[2]?.replace(/^lsl\s*/i, "");
		const expression = shift ? `(${source} << ${shift.replace(/^#/, "")})` : source;
		return `${destination} = ${expression};${note ? `  // ${note}` : ""}`;
	}

	if (mnemonic === "lea" || mnemonic === "adr" || mnemonic === "adrp") {
		const destination = registerName(operands[0]!);
		const ref = bracketRefs(instruction)[0];
		const where = ref !== undefined ? `data_${hex(ref)}` : memoryExpr(operands[1] ?? "?");
		return `${destination} = &${where};${note ? `  // ${note}` : ""}`;
	}

	// cset 是旗标的落地：紧跟比较时直接写成三元表达式，缺少比较上下文就明说 flag_<cond>。
	if (mnemonic === "cset" && operands.length >= 2) {
		const destination = registerName(operands[0]!);
		const suffix = operands[1]!.trim();
		const operator = CONDITION_TEXT[suffix];
		const pending = flags ?? null;
		if (pending && operator) return `${destination} = (${comparisonText(pending, suffix, operator)}) ? 1 : 0;`;
		return `${destination} = flag_${suffix} ? 1 : 0;`;
	}

	if (mnemonic === "push") return `push(${registerName(operands[0]!)});`;
	if (mnemonic === "pop") return `${registerName(operands[0]!)} = pop();`;

	const operator = ALIAS[mnemonic];
	if (operator && operands.length >= 2) {
		const destination = registerName(operands[0]!);
		// x86 的二操作数形态 `xor eax, eax` 是 `dst = dst op src`；三操作数才是三段式。
		const left = operands.length >= 3 ? registerName(operands[1]!) : destination;
		const right = operands
			.slice(operands.length >= 3 ? 2 : 1)
			.map(part => (part.startsWith("#") ? part.slice(1) : memoryExpr(part)));
		const expression = right.length > 1 ? right.join(` ${operator} `) : right[0]!;
		return `${destination} = ${left} ${operator} ${expression};`;
	}

	if ((mnemonic === "ldr" || mnemonic === "ldrb" || mnemonic === "ldrh" || mnemonic === "ldrsb" || mnemonic === "ldrsh" || mnemonic === "ldrsw") && operands.length >= 2) {
		const destination = registerName(operands[0]!);
		return `${destination} = ${memoryExpr(operands[1]!)};${note ? `  // ${note}` : ""}`;
	}

	if (mnemonic === "ldp" && operands.length >= 3) {
		const first = registerName(operands[0]!);
		const second = registerName(operands[1]!);
		const place = memoryExpr(operands[2]!);
		return `${first} = ${place}; ${second} = ${secondSlot(place)};`;
	}

	if ((mnemonic === "str" || mnemonic === "strb" || mnemonic === "strh") && operands.length >= 2) {
		return `${memoryExpr(operands[1]!)} = ${registerName(operands[0]!)};${note ? `  // ${note}` : ""}`;
	}

	if (mnemonic === "stp" && operands.length >= 3) {
		const place = memoryExpr(operands[2]!);
		return `${place} = ${registerName(operands[0]!)}; ${secondSlot(place)} = ${registerName(operands[1]!)};`;
	}

	if (mnemonic === "inc" || mnemonic === "dec") {
		const destination = registerName(operands[0]!);
		return `${destination} ${mnemonic === "inc" ? "+=" : "-="} 1;`;
	}

	if (mnemonic === "neg" || mnemonic === "not") {
		const destination = registerName(operands[0]!);
		return `${destination} = ${mnemonic === "neg" ? "-" : "~"}${registerName(operands[1] ?? destination)};`;
	}

	return null;
}

function callStatement(instruction: DecodedInstruction, names?: Map<number, string>): string {
	const target = instruction.flow.target;
	const callee = target === undefined ? "*(?)/* indirect call */" : symbolName(target, names);
	const returnsTo = instruction.mnemonic.startsWith("bl") || instruction.mnemonic === "call" ? registerName(instruction.mnemonic === "call" ? "rax" : "x0") : "";
	return returnsTo ? `${returnsTo} = ${callee}();` : `${callee}();`;
}

function returnStatement(instruction: DecodedInstruction): string {
	const arch = instruction.text.startsWith("ret") || instruction.text.startsWith("retq");
	const operands = splitOperands(instruction.text.slice(instruction.mnemonic.length).trim());
	if (operands.length > 0) return `return ${registerName(operands[0]!)};`;
	return arch ? "return;" : "return;";
}

interface State {
	bytes: Uint8Array;
	mode: PseudoMode;
	names?: Map<number, string>;
	strings: PseudoStringRef[];
}

/** 一条指令 → 一到两行语句；`null` 表示这一档详略下不展示。 */
function statementsOf(instruction: DecodedInstruction, state: State, pending: Comparison | null): { line: string; consumesComparison: boolean } | null {
	const flow = instruction.flow;
	if (flow.kind === "call") {
		return { line: callStatement(instruction, state.names), consumesComparison: false };
	}
	if (flow.kind === "ret") {
		return { line: returnStatement(instruction), consumesComparison: false };
	}
	if (flow.kind === "cond") {
		return { line: `if (${conditionExpression(instruction, pending)}) goto ${label(flow.target ?? 0)};`, consumesComparison: true };
	}
	if (flow.kind === "jump") {
		return { line: `goto ${label(flow.target ?? 0)};`, consumesComparison: true };
	}
	if (flow.kind === "indirect") {
		const operand = splitOperands(instruction.text.slice(instruction.mnemonic.length).trim())[0];
		return { line: `goto *(${operand ? registerName(operand) : "?"});`, consumesComparison: true };
	}

	const assignment = assignmentOf(instruction, state.bytes, pending);
	const isMemory = /\b(ldr|str|ldp|stp|lea)\b/.test(instruction.mnemonic);
	const isComparison = COMPARE_MNEMONICS.has(instruction.mnemonic);
	const isPureData = PURE_DATA_MNEMONICS.has(instruction.mnemonic) && !isMemory;

	if (state.mode === "summary") {
		if (isComparison) return null;
		return null;
	}
	if (state.mode === "fold") {
		if (isComparison) return { line: `/* ${instruction.text} */`, consumesComparison: false };
		if (isPureData) return null;
		return assignment ? { line: assignment, consumesComparison: false } : null;
	}

	if (isComparison) return { line: `/* ${instruction.text} */`, consumesComparison: false };
	if (SKIP_MNEMONICS.has(instruction.mnemonic)) return null;
	return { line: assignment ?? `/* ${instruction.text} */`, consumesComparison: false };
}

function blockLines(block: BasicBlock, state: State, first: boolean): string[] {
	const lines: string[] = [];
	lines.push(`  ${label(block.start)}:${first ? `  // ${block.insns.length} instruction(s)` : ""}`);
	let pending: Comparison | null = null;
	for (const instruction of block.insns) {
		const comparison = comparisonOf(instruction);
		if (comparison) {
			pending = comparison;
			const emitted = statementsOf(instruction, state, null);
			if (emitted) lines.push(`    ${emitted.line}`);
			continue;
		}
		const emitted = statementsOf(instruction, state, pending);
		if (emitted?.consumesComparison) pending = null;
		if (emitted) lines.push(`    ${emitted.line}`);
	}
	return lines;
}

function collectStrings(block: BasicBlock, bytes: Uint8Array, out: PseudoStringRef[]): void {
	for (const instruction of block.insns) {
		for (const ref of bracketRefs(instruction)) {
			const text = stringAt(bytes, ref);
			if (!text) continue;
			if (out.some(entry => entry.offset === ref)) continue;
			out.push({ offset: ref, text, from: instruction.offset });
		}
	}
}

export function decompileFunction(bytes: Uint8Array, arch: DisasmArch, options: PseudoOptions): PseudoResult {
	const mode = options.mode ?? "full";
	const budget = Math.max(MIN_BUDGET, Math.min(MAX_BUDGET, options.budget ?? DEFAULT_PSEUDO_BUDGET));
	const view = buildFunctionView(bytes, arch, {
		start: options.start,
		end: options.end,
		name: options.name ?? null,
		maxInstructions: options.maxInstructions,
	});
	const name = symbolName(view.start, options.names);
	const state: State = { bytes, mode, names: options.names, strings: [] };
	const warnings = [...view.warnings];

	if (view.blocks.length === 0) {
		return {
			arch,
			mode,
			start: view.start,
			end: view.end,
			name,
			text: `// ${name}: no decodable instruction in this range (${arch}).\n`,
			instructions: 0,
			blocks: 0,
			calls: 0,
			strings: [],
			truncated: false,
			budget,
			warnings,
		};
	}

	const header = [
		`// pseudo-C for ${name} (${arch}, ${mode}) — register-level reconstruction, no type recovery and no SSA.`,
		`// ${view.stats.instructions} instruction(s), ${view.stats.blocks} block(s), ${view.stats.calls} call(s)${view.stats.stackFrame ? `, stack frame ~0x${hex(view.stats.stackFrame)}` : ""}.`,
		`${name}(void)`,
		"{",
	];
	const body: string[] = [];
	view.blocks.forEach((block, index) => {
		collectStrings(block, bytes, state.strings);
		body.push(...blockLines(block, state, index === 0));
	});
	const footer = ["}"];

	let text = [...header, ...body, ...footer].join("\n");
	let truncated = false;
	if (text.length > budget) {
		const head = [...header, ...body].join("\n");
		const cut = head.slice(0, budget);
		const lastBreak = cut.lastIndexOf("\n");
		text = `${lastBreak > 0 ? cut.slice(0, lastBreak) : cut}\n  /* … truncated at the ${budget}-character budget; raise budget or narrow the range … */\n}`;
		truncated = true;
	}
	if (view.truncated) warnings.push("function view itself was truncated by the block budget");

	return {
		arch,
		mode,
		start: view.start,
		end: view.end,
		name,
		text,
		instructions: view.stats.instructions,
		blocks: view.stats.blocks,
		calls: view.stats.calls,
		strings: state.strings,
		truncated,
		budget,
		warnings,
	};
}

/**
 * 基本块与函数视图。
 *
 * 输入仍然是一个字节区间和架构，输出是「函数 → 基本块 → 后继边」的结构。这里不做
 * 递归下降、不追间接跳转目标：从 `start` 线性扫到区间末尾，用分支目标与分支后一条
 * 指令切块。对静态分诊场景这是够用的近似——它不会漏掉短跳转造成的块边界（那是
 * 纯线性清单最容易错的地方），也不会因为一个间接分支就丢掉函数体剩下的部分。
 */

import { decodeRange } from "./insn";
import type { DecodedInstruction, DisasmArch } from "./insn";

export type EdgeKind = "taken" | "fallthrough" | "jump" | "call" | "indirect" | "return";

export interface BlockEdge {
	/** 后继块起点；没有静态目标时为 null。 */
	to: number | null;
	kind: EdgeKind;
}

export interface BasicBlock {
	start: number;
	end: number;
	insns: DecodedInstruction[];
	successors: BlockEdge[];
}

export interface FunctionStats {
	bytes: number;
	instructions: number;
	blocks: number;
	calls: number;
	/** 由函数序言估算的栈帧字节数；看不出来时为 null。 */
	stackFrame: number | null;
}

export interface FunctionView {
	start: number;
	end: number;
	name: string | null;
	blocks: BasicBlock[];
	stats: FunctionStats;
	truncated: boolean;
	warnings: string[];
}

export interface FunctionOptions {
	start: number;
	/** 函数体的上界（不含），通常是下一个函数起点或所在可执行节的末尾。 */
	end?: number;
	name?: string | null;
	maxInstructions?: number;
	maxBlocks?: number;
}

const DEFAULT_SPAN = 8192;
const MAX_INSTRUCTIONS = 8192;
const MAX_BLOCKS = 512;

/**
 * 序言启发式：只读前几条指令，识别两种最常见的开栈形态。
 * 这是展示用的估算值，不参与任何判定，所以按渲染文本匹配是可以接受的。
 */
function prologueBytes(text: string): number | null {
	const preIndex = /^stp x29, x30, \[sp, #-0x([0-9a-f]+)\]!$/.exec(text);
	if (preIndex) return Number.parseInt(preIndex[1]!, 16);
	const subSp = /^sub sp, sp, #0x([0-9a-f]+)$/.exec(text);
	if (subSp) return Number.parseInt(subSp[1]!, 16);
	const subRsp = /^sub rsp, 0x([0-9a-f]+)$/.exec(text);
	if (subRsp) return Number.parseInt(subRsp[1]!, 16);
	if (/^push (r[a-z0-9]+)$/.test(text)) return 8;
	// 不占栈空间但属于序言的动作：帧寄存器建立、栈指针对齐。
	if (/^(mov (rbp|rsp|x[0-9]+|[re]?[a-z]+[0-9]*), (sp|rsp)|add x29, sp(, #0x[0-9a-f]+)?|and rsp, 0x[0-9a-f]+|and sp, sp, #0x[0-9a-f]+|endbr64|nop|bti [a-z]+)$/.test(text)) return 0;
	return null;
}

function estimateStackFrame(insns: DecodedInstruction[]): number | null {
	let frame = 0;
	let matched = false;
	for (const insn of insns.slice(0, 16)) {
		const amount = prologueBytes(insn.text);
		// 序言一旦结束就停：再往后遇到的 sub rsp 大多属于局部代码块，算进来会偏大。
		if (amount === null) {
			if (matched) break;
			continue;
		}
		frame += amount;
		matched = true;
	}
	return matched && frame > 0 ? frame : null;
}

function successorsOf(insn: DecodedInstruction, nextOffset: number): { edges: BlockEdge[]; terminal: boolean } {
	const { flow } = insn;
	if (flow.kind === "ret") return { edges: [{ to: null, kind: "return" }], terminal: true };
	if (flow.kind === "jump") return { edges: [{ to: flow.target ?? null, kind: "jump" }], terminal: true };
	if (flow.kind === "cond") {
		return {
			edges: [
				{ to: flow.target ?? null, kind: "taken" },
				{ to: nextOffset, kind: "fallthrough" },
			],
			terminal: false,
		};
	}
	if (flow.kind === "indirect") return { edges: [{ to: null, kind: "indirect" }], terminal: true };
	if (flow.kind === "call") {
		// 调用不是块边界：返回后才继续执行同一段直线代码，调用目标单独统计。
		return { edges: [{ to: nextOffset, kind: "fallthrough" }], terminal: false };
	}
	return { edges: [{ to: nextOffset, kind: "fallthrough" }], terminal: false };
}

export function buildFunctionView(bytes: Uint8Array, arch: DisasmArch, options: FunctionOptions): FunctionView {
	const warnings: string[] = [];
	const start = Math.max(0, Math.min(bytes.byteLength, options.start));
	const requestedEnd = options.end ?? start + DEFAULT_SPAN;
	const end = Math.max(start, Math.min(bytes.byteLength, requestedEnd));
	const maxInstructions = Math.max(1, Math.min(MAX_INSTRUCTIONS, options.maxInstructions ?? MAX_INSTRUCTIONS));
	const maxBlocks = Math.max(1, Math.min(MAX_BLOCKS, options.maxBlocks ?? MAX_BLOCKS));

	const run = decodeRange(bytes, arch, start, end, maxInstructions);
	warnings.push(...run.warnings);
	const insns = run.instructions;

	if (insns.length === 0) {
		return {
			start,
			end,
			name: options.name ?? null,
			blocks: [],
			stats: { bytes: 0, instructions: 0, blocks: 0, calls: 0, stackFrame: null },
			truncated: run.truncated,
			warnings,
		};
	}

	const startOffsets = new Map<number, number>();
	insns.forEach((insn, index) => startOffsets.set(insn.offset, index));

	// leaders：函数入口、范围内的分支目标、任何流指令的下一条。
	const leaderSet = new Set<number>([start]);
	for (let index = 0; index < insns.length; index += 1) {
		const insn = insns[index]!;
		const flow = insn.flow;
		if (flow.kind === "cond" || flow.kind === "jump" || flow.kind === "call") {
			if (flow.target !== undefined && startOffsets.has(flow.target)) leaderSet.add(flow.target);
		}
		const next = insns[index + 1];
		if (!next) continue;
		if (flow.kind === "cond" || flow.kind === "jump") leaderSet.add(next.offset);
	}

	const blocks: BasicBlock[] = [];
	let current: DecodedInstruction[] = [];
	const flush = (): void => {
		if (current.length === 0) return;
		const last = current[current.length - 1]!;
		const nextOffset = last.offset + last.size;
		const { edges } = successorsOf(last, nextOffset);
		blocks.push({ start: current[0]!.offset, end: nextOffset, insns: current, successors: edges });
		current = [];
	};

	let stoppedAtPadding = false;
	let consumed = 0;
	for (const insn of insns) {
		if (current.length > 0 && leaderSet.has(insn.offset)) flush();
		current.push(insn);
		consumed += 1;
		if (insn.flow.kind !== "none" && insn.flow.kind !== "call") flush();
		// 终结指令后面跟着成片填充，几乎就是函数边界。不停下来会把下一批函数
		// 当成当前函数的一部分，尺寸和块数都会虚高。
		if ((insn.flow.kind === "ret" || insn.flow.kind === "jump") && paddingRunAt(bytes, insn.offset + insn.size)) {
			stoppedAtPadding = true;
			break;
		}
		if (blocks.length >= maxBlocks) {
			warnings.push(`block budget reached (${maxBlocks}); function view truncated`);
			break;
		}
	}
	flush();

	// 提前停下时，统计只能算真正进了基本块的那些指令，否则尺寸会指向没展示的代码。
	const reached = consumed < insns.length ? insns.slice(0, consumed) : insns;

	let calls = 0;
	for (const insn of reached) if (insn.flow.kind === "call") calls += 1;

	const lastInsn = reached[reached.length - 1]!;
	const functionEnd = lastInsn.offset + lastInsn.size;

	return {
		start,
		end: functionEnd,
		name: options.name ?? null,
		blocks,
		stats: {
			bytes: functionEnd - start,
			instructions: reached.length,
			blocks: blocks.length,
			calls,
			stackFrame: estimateStackFrame(reached),
		},
		// 因填充而停是正常结尾，不是“扫描被截断”。
		truncated: run.truncated && !stoppedAtPadding,
		warnings,
	};
}

/** 终结指令后是否跟着成片填充（`00` 或 `cc`）：函数边界最可靠的局部信号。 */
function paddingRunAt(bytes: Uint8Array, offset: number, min = 8): boolean {
	if (offset < 0 || offset + min > bytes.byteLength) return false;
	const first = bytes[offset]!;
	if (first !== 0x00 && first !== 0xcc) return false;
	for (let index = 1; index < min; index += 1) if (bytes[offset + index] !== first) return false;
	return true;
}

/** `branch` 视图用的结构化过滤：控制流指令 + 比较类指令，比按文本关键字 grep 更准。 */
const COMPARE_MNEMONICS = new Set(["cmp", "cmn", "tst", "test", "subs", "adds", "ands"]);

export function isControlRelevant(insn: DecodedInstruction): boolean {
	if (insn.flow.kind !== "none") return true;
	return COMPARE_MNEMONICS.has(insn.mnemonic);
}

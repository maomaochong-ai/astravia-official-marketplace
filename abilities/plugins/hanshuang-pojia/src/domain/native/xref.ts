/**
 * 全局交叉引用索引。
 *
 * 一次线性扫描把所有可执行区间过一遍，顺手记下两件事：谁调用了哪个地址（callers），
 * 谁引用了哪个数据地址（refs）。有了它，函数视图才能回答「这个函数被谁调用」和
 * 「这个常量/字符串被哪里用到」——这两个问题只靠单函数视图永远答不出来，而这正是
 * 静态分诊里最花时间的一步。
 *
 * 索引是预算受限的：指令数和引用条数都有上限，超出时置 `truncated`，调用方必须在
 * 输出里带上这个事实，不能把「扫到这里为止」当成「只有这么多」。
 */

import { decodeRange } from "./insn";
import type { DisasmArch } from "./insn";

// 区间形状与 `AddressMap.executable` 一致（[start, end)），避免调用方来回转换。
export interface XrefRange {
	start: number;
	end: number;
}

export interface XrefIndex {
	arch: DisasmArch;
	/** 调用目标 → 调用点（指令起始偏移）。 */
	callers: Map<number, number[]>;
	/** 数据目标 → 引用点（指令起始偏移）。 */
	refs: Map<number, number[]>;
	/** 扫描中遇到的 call / jump 目标，作为「可能的函数入口」候选。 */
	discovered: Set<number>;
	scanned: number;
	truncated: boolean;
	warnings: string[];
}

export interface XrefOptions {
	maxInstructions?: number;
	maxRefs?: number;
}

const MAX_INSTRUCTIONS = 400_000;
const MAX_REFS = 60_000;

function push(map: Map<number, number[]>, key: number, value: number, cap: number): boolean {
	const list = map.get(key);
	if (list) {
		if (list.length < cap) list.push(value);
		return true;
	}
	if (map.size >= cap) return false;
	map.set(key, [value]);
	return true;
}

export function buildXrefIndex(bytes: Uint8Array, arch: DisasmArch, ranges: readonly XrefRange[], options: XrefOptions = {}): XrefIndex {
	const budget = Math.max(1, Math.min(MAX_INSTRUCTIONS, options.maxInstructions ?? MAX_INSTRUCTIONS));
	const maxRefs = Math.max(1, Math.min(MAX_REFS, options.maxRefs ?? MAX_REFS));

	const callers = new Map<number, number[]>();
	const refs = new Map<number, number[]>();
	const discovered = new Set<number>();
	const warnings: string[] = [];
	let scanned = 0;
	let truncated = false;
	let exhausted = false;

	const ordered = [...ranges].filter(range => range.end > range.start).sort((left, right) => left.start - right.start);

	for (const range of ordered) {
		if (exhausted) {
			truncated = true;
			break;
		}
		const start = Math.max(0, range.start);
		const end = Math.min(bytes.byteLength, range.end);
		if (end <= start) continue;
		const remaining = budget - scanned;
		if (remaining <= 0) {
			truncated = true;
			break;
		}
		const run = decodeRange(bytes, arch, start, end, remaining);
		warnings.push(...run.warnings);
		// run.end < end 意味着本区间没扫完（预算用尽或遇到无法解码的残尾）。
		if (run.truncated || run.end < end) truncated = true;

		for (const insn of run.instructions) {
			scanned += 1;
			const flow = insn.flow;
			if (flow.kind === "call" && flow.target !== undefined) {
				discovered.add(flow.target);
				if (!push(callers, flow.target, insn.offset, maxRefs)) exhausted = true;
			} else if (flow.kind === "jump" && flow.target !== undefined) {
				discovered.add(flow.target);
			}
			for (const ref of insn.refs) {
				if (!push(refs, ref, insn.offset, maxRefs)) exhausted = true;
			}
		}

	}

	return { arch, callers, refs, discovered, scanned, truncated, warnings };
}

export function callersOf(index: XrefIndex, target: number): number[] {
	return [...(index.callers.get(target) ?? [])].sort((left, right) => left - right);
}

export function refsTo(index: XrefIndex, target: number): number[] {
	return [...(index.refs.get(target) ?? [])].sort((left, right) => left - right);
}

/**
 * 函数入口候选：符号表里的入口 + 索引里被调用/跳转到的地址。
 * 结果按地址升序去重，供页面列表使用。
 */
export function candidateStarts(index: XrefIndex, seeds: Iterable<number> = []): number[] {
	const all = new Set<number>(seeds);
	for (const target of index.discovered) all.add(target);
	return [...all].sort((left, right) => left - right);
}

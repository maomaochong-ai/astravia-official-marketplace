/**
 * 深层反汇编：把「一堆指令」变成「一个函数的可读报告」。
 *
 * 三种输出档位对应三种处境：
 *  - `summary`  先判断这是不是自己关心的函数（大小、调用关系、引用了哪些字符串）；
 *  - `branch`   只看控制流骨架，几十行内看清分支结构；
 *  - `full`     完整线性清单，带块分隔。
 *
 * 字符预算不是装饰：面板里一行指令几十个字符，一个稍大的函数轻松上千行，直接倒进
 * 对话就会把有用的上下文冲掉。所以输出一律经过 `applyBudget`，被截断时明确写出
 * 截断点，让调用方知道「还有东西没看到」。
 */

import { buildFunctionView, isControlRelevant } from "./cfg";
import type { FunctionView } from "./cfg";
import { isExecutableOffset, vaddrToOffset } from "./image";
import type { AddressMap } from "./image";
import { decodeAt } from "./insn";
import type { DisasmArch } from "./insn";
import { callersOf } from "./xref";
import type { XrefIndex } from "./xref";
import type { CodeSymbol } from "./symbols";
import type { NativeFacts } from "./types";

export type DeepMode = "summary" | "branch" | "full";

export interface DeepTarget {
	start: number;
	end?: number;
	name?: string | null;
}

export interface RefHit {
	offset: number;
	name: string | null;
}

export interface StringHit {
	offset: number;
	text: string;
}

export interface DeepOptions {
	mode?: DeepMode;
	/** 字符预算，超出后按行截断。 */
	budget?: number;
	index?: XrefIndex;
	names?: Map<number, string>;
	maxInstructions?: number;
}

export interface DeepResult {
	arch: DisasmArch;
	mode: DeepMode;
	start: number;
	end: number;
	name: string | null;
	text: string;
	truncated: boolean;
	budget: number;
	instructions: number;
	blocks: number;
	calls: number;
	stackFrame: number | null;
	callers: RefHit[];
	callees: RefHit[];
	stringRefs: StringHit[];
	warnings: string[];
}

export const DEFAULT_BUDGET = 4000;
const MIN_BUDGET = 500;
const MAX_BUDGET = 200_000;
const MAX_STRING_HITS = 40;

/** 读一个可打印 C 字符串；不足 4 个字符就当这里不是字符串。 */
export function peekCString(bytes: Uint8Array, offset: number, maxLength = 60): string | null {
	if (offset < 0 || offset >= bytes.byteLength) return null;
	let end = offset;
	const limit = Math.min(bytes.byteLength, offset + maxLength);
	while (end < limit) {
		const byte = bytes[end]!;
		if (byte === 0) break;
		if (byte !== 0x09 && (byte < 0x20 || byte > 0x7e)) return null;
		end += 1;
	}
	if (end - offset < 4) return null;
	return new TextDecoder().decode(bytes.subarray(offset, end));
}

function padRight(text: string, width: number): string {
	return text.length >= width ? text : text + " ".repeat(width - text.length);
}

function offsetLabel(offset: number, width: number): string {
	return `0x${offset.toString(16).padStart(width, "0")}`;
}

function nameOf(names: Map<number, string> | undefined, offset: number): string | null {
	return names?.get(offset) ?? null;
}

function renderHeader(view: FunctionView, arch: DisasmArch, name: string | null): string[] {
	const title = name ? `${name} @ 0x${view.start.toString(16)}` : `function @ 0x${view.start.toString(16)}`;
	const stats = [
		`arch ${arch}`,
		`${view.stats.instructions} instructions`,
		`${view.stats.blocks} blocks`,
		`${view.stats.calls} calls`,
		view.stats.stackFrame === null ? null : `frame 0x${view.stats.stackFrame.toString(16)}`,
	].filter((item): item is string => item !== null);
	return [`; ${title}`, `; ${stats.join(" | ")}`];
}

function renderInsnLines(view: FunctionView, filter: boolean): string[] {
	const lines: string[] = [];
	const offsets = view.blocks.flatMap(block => block.insns);
	const width = Math.max(4, Math.max(...offsets.map(insn => insn.offset.toString(16).length)));
	const hexWidth = Math.max(2, Math.max(...offsets.map(insn => insn.hex.length)));

	for (const block of view.blocks) {
		const selected = filter ? block.insns.filter(isControlRelevant) : block.insns;
		if (selected.length === 0) continue;
		lines.push(`; block 0x${block.start.toString(16)} → ${block.successors.map(edge => (edge.to === null ? edge.kind : `0x${edge.to.toString(16)}`)).join(", ") || "end"}`);
		for (const insn of selected) {
			lines.push(`${offsetLabel(insn.offset, width)}  ${padRight(insn.hex, hexWidth)}  ${insn.text}`);
		}
	}
	return lines;
}

function renderRefList(title: string, hits: RefHit[], names: Map<number, string> | undefined): string[] {
	if (hits.length === 0) return [];
	const lines = [`; ${title} (${hits.length})`];
	for (const hit of hits) {
		const label = hit.name ?? nameOf(names, hit.offset) ?? "";
		lines.push(`  0x${hit.offset.toString(16)}${label ? `  ${label}` : ""}`);
	}
	return lines;
}

function renderSummary(view: FunctionView, arch: DisasmArch, name: string | null, callers: RefHit[], callees: RefHit[], stringRefs: StringHit[], names: Map<number, string> | undefined): string[] {
	const lines = renderHeader(view, arch, name);
	lines.push(...renderRefList("callers", callers, names));
	lines.push(...renderRefList("callees", callees, names));
	if (stringRefs.length > 0) {
		lines.push(`; string references (${stringRefs.length})`);
		for (const hit of stringRefs) lines.push(`  0x${hit.offset.toString(16)}  "${hit.text}"`);
	}
	if (callers.length === 0 && callees.length === 0 && stringRefs.length === 0) lines.push("; no callers, callees or string references found in the indexed ranges");
	return lines;
}

function applyBudget(text: string, budget: number): { text: string; truncated: boolean } {
	if (text.length <= budget) return { text, truncated: false };
	const cut = text.lastIndexOf("\n", budget);
	const head = cut > 0 ? text.slice(0, cut) : text.slice(0, budget);
	return { text: `${head}\n... [TRUNCATED at ${budget} chars — raise the budget to see the rest]`, truncated: true };
}

export function deepAnalyse(bytes: Uint8Array, arch: DisasmArch, target: DeepTarget, options: DeepOptions = {}): DeepResult {
	const mode = options.mode ?? "branch";
	const budget = Math.max(MIN_BUDGET, Math.min(MAX_BUDGET, options.budget ?? DEFAULT_BUDGET));
	const names = options.names;

	const view = buildFunctionView(bytes, arch, {
		start: target.start,
		end: target.end,
		name: target.name ?? null,
		maxInstructions: options.maxInstructions,
	});

	const name = target.name ?? nameOf(names, view.start) ?? null;
	const callers: RefHit[] = options.index
		? callersOf(options.index, view.start).map(offset => ({ offset, name: nameOf(names, offset) }))
		: [];

	const seenCallees = new Set<number>();
	const callees: RefHit[] = [];
	for (const block of view.blocks) {
		for (const insn of block.insns) {
			if (insn.flow.kind !== "call" || insn.flow.target === undefined) continue;
			if (seenCallees.has(insn.flow.target)) continue;
			seenCallees.add(insn.flow.target);
			callees.push({ offset: insn.flow.target, name: nameOf(names, insn.flow.target) });
		}
	}

	const stringRefs: StringHit[] = [];
	const seenRefs = new Set<number>();
	for (const block of view.blocks) {
		for (const insn of block.insns) {
			for (const ref of insn.refs) {
				if (seenRefs.has(ref)) continue;
				seenRefs.add(ref);
				const text = peekCString(bytes, ref);
				if (text !== null) stringRefs.push({ offset: ref, text });
				if (stringRefs.length >= MAX_STRING_HITS) break;
			}
			if (stringRefs.length >= MAX_STRING_HITS) break;
		}
	}

	const warnings = [...view.warnings];
	if (options.index?.truncated) warnings.push(`cross-reference index truncated after ${options.index.scanned} instructions; caller lists may be incomplete`);

	let lines: string[];
	if (mode === "summary") {
		lines = renderSummary(view, arch, name, callers, callees, stringRefs, names);
	} else {
		lines = renderHeader(view, arch, name);
		if (mode === "full") {
			lines.push(...renderInsnLines(view, false));
		} else {
			const total = view.stats.instructions;
			const shown = view.blocks.reduce((sum, block) => sum + block.insns.filter(isControlRelevant).length, 0);
			lines.push(...renderInsnLines(view, true));
			if (total > shown) lines.push(`; filtered ${total - shown} of ${total} lines (data movement and arithmetic dropped)`);
		}
		if (view.truncated) lines.push("; listing stopped at the instruction budget before the end of the range");
	}

	const rendered = applyBudget(lines.join("\n"), budget);

	return {
		arch,
		mode,
		start: view.start,
		end: view.end,
		name,
		text: rendered.text,
		truncated: rendered.truncated || view.truncated,
		budget,
		instructions: view.stats.instructions,
		blocks: view.stats.blocks,
		calls: view.stats.calls,
		stackFrame: view.stats.stackFrame,
		callers,
		callees,
		stringRefs,
		warnings,
	};
}

export type CandidateSource = "entry" | "symbol" | "call";

export interface FunctionCandidate {
	offset: number;
	name: string | null;
	source: CandidateSource;
}

const MAX_CANDIDATES = 2000;

/**
 * 页面上「可分析的函数」列表：入口点、符号表里的函数、以及交叉引用索引里被调用到的地址。
 * 没有符号表也能用——这正是混淆样本的常态。
 */
export function listFunctionCandidates(
	bytes: Uint8Array,
	facts: NativeFacts,
	symbols: readonly CodeSymbol[],
	map: AddressMap,
	index?: XrefIndex,
	limit = MAX_CANDIDATES,
): FunctionCandidate[] {
	const seen = new Map<number, FunctionCandidate>();
	const add = (offset: number, name: string | null, source: CandidateSource): void => {
		if (offset < 0 || offset >= bytes.byteLength) return;
		const existing = seen.get(offset);
		if (existing) {
			if (existing.source !== "entry" && source === "entry") seen.set(offset, { offset, name, source });
			else if (existing.name === null && name !== null) seen.set(offset, { offset, name, source: existing.source });
			return;
		}
		seen.set(offset, { offset, name, source });
	};

	if (facts.entryOffset !== undefined && facts.entryOffset !== null) add(facts.entryOffset, "entry", "entry");

	for (const symbol of symbols) {
		if (symbol.kind !== "function" || symbol.name === "") continue;
		const offset = vaddrToOffset(map, symbol.address);
		if (offset === null) continue;
		add(offset, symbol.name, "symbol");
	}

	if (index) {
		for (const target of index.discovered) {
			if (!isExecutableOffset(map, target)) continue;
			add(target, null, "call");
		}
	}

	const cap = Math.max(1, Math.min(MAX_CANDIDATES, limit));
	// 入口点排最前，其次是有名字的符号，最后才是扫描出来的调用目标：
	// 页面列表的第一屏应该是最值得看的函数。
	const rank: Record<CandidateSource, number> = { entry: 0, symbol: 1, call: 2 };
	return [...seen.values()]
		.sort((left, right) => rank[left.source] - rank[right.source] || left.offset - right.offset)
		.slice(0, cap);
}

/** 取函数体的默认上界：下一个候选函数起点，或所在可执行区间末尾。 */
export function functionBoundFor(start: number, candidates: readonly FunctionCandidate[], map: AddressMap, fallbackSpan = 8192): number {
	let bound = Number.POSITIVE_INFINITY;
	for (const candidate of candidates) {
		if (candidate.offset > start && candidate.offset < bound) bound = candidate.offset;
	}
	const range = map.executable.find(item => start >= item.start && start < item.end);
	if (range && range.end < bound) bound = range.end;
	if (!Number.isFinite(bound)) bound = start + fallbackSpan;
	return bound;
}

/** 确认 `offset` 处确实能解码出指令（页面上点击前做一次守卫）。 */
export function isCodeOffset(bytes: Uint8Array, arch: DisasmArch, offset: number): boolean {
	return decodeAt(bytes, arch, offset) !== null;
}

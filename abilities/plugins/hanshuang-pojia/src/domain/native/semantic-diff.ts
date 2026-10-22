/**
 * 语义二进制 diff：按函数比对两个构建，而不是按字节。
 *
 * 上游用 `radiff2 -C` 做同一件事：把两个镜像的函数各自指纹化，再回答「哪个函数新增、
 * 哪个消失、哪个改了」。插件没有 r2 进程，所以指纹从自己的解码器来：
 *
 * - `exact`  —— 指令字节流（含操作数），两边完全一致才算相同；
 * - `shape`  —— 助记符 + 操作数形状（寄存器名、立即数、分支目标抹平），用来识别
 *                「换了寄存器分配 / 地址变了但逻辑没变」的函数；
 * - `callees`—— 调用目标集合，作为判定的旁证。
 *
 * 抹平立即数是必要之恶：不做这一步，跨构建的所有地址都会变，什么都匹配不上。代价是
 * 「只改了判定常量」也会被 shape 判成相同，所以报告里 `exact` 的差异单独计数，改动
 * 函数会明确写 `constants only` —— 这类改动恰恰是补丁最常出现的地方，不能被抹平掩盖。
 */

import { sha256Hex } from "../digest";
import { decodeRange, disasmArchFor, isDecodable } from "./insn";
import type { DisasmArch } from "./insn";
import { functionBoundFor, listFunctionCandidates, trimTrailingData } from "./deep";
import { readNativeFacts } from "./detect";
import { addressMapFor } from "./image";
import { listSymbols } from "./symbols";
import { buildXrefIndex } from "./xref";

export interface FunctionEntry {
	start: number;
	name: string;
	size: number;
	instructions: number;
	calls: number;
	exact: string;
	shape: string;
	callees: number[];
}

export interface FunctionSet {
	arch: DisasmArch;
	functions: FunctionEntry[];
	warnings: string[];
}

export type MatchStatus = "same" | "constants-only" | "changed" | "renamed";

export interface FunctionMatch {
	name: string;
	leftStart: number;
	rightStart: number;
	status: MatchStatus;
	leftInstructions: number;
	rightInstructions: number;
	leftCalls: number;
	rightCalls: number;
}

export interface SemanticDiffResult {
	arch: DisasmArch | null;
	left: FunctionSet;
	right: FunctionSet;
	matches: FunctionMatch[];
	added: FunctionEntry[];
	removed: FunctionEntry[];
	identical: boolean;
	archMismatch: string | null;
}

export interface SemanticDiffOptions {
	maxFunctions?: number;
}

const MAX_FUNCTIONS = 400;

const REGISTER_PATTERN =
	/^(?:r(?:ax|bx|cx|dx|si|di|sp|bp|ip)|e(?:ax|bx|cx|dx|si|di|sp|bp|ip)|x(?:[0-9]|[12][0-9]|30)|w(?:[0-9]|[12][0-9]|30)|r(?:[0-9]|[12][0-9]|3[01])[dwb]?|sp|lr|fp|pc|xzr|wzr)$/;

/**
 * 一条指令的形状：助记符保留，寄存器按位宽归一（`w0`/`r0d` → `r32`，`x0`/`rax` → `r64`），
 * 立即数与分支目标 → `#`，其余记号原样保留。
 *
 * 位宽要留下：`mov w0, #1` 和 `mov x0, #1` 是同一形状就会把 32 位溢出回归当成「只改了常量」。
 * 逗号要留下：`cmp w0, #1` 与 `cmp w0, w1` 都压成 `cmp r32 #` 属于归一过度。
 */
export function shapeOfInstruction(text: string): string {
	const [mnemonic = "", ...rest] = text.split(/\s+/);
	const operands = rest.join(" ").replace(/\s*,\s*/g, ", ");
	const tokens = operands.split(/[, ]+/).filter(token => token !== "");
	const shape = tokens.map(token => {
		const bare = token.replace(/^#/, "").replace(/^\[|\]$/g, "");
		if (/^(?:file\+)?0x[0-9a-f]+$/i.test(bare) || /^[-+]?0x[0-9a-f]+$/i.test(bare)) return "#";
		if (/^\d+$/.test(bare)) return "#";
		const width = widthOfRegister(bare.toLowerCase());
		if (width) return width;
		return bare;
	});
	// 逗号位置由 token 边界重建，丢掉原始空白的差异（`a,  b` 与 `a, b` 同一形状）。
	return [mnemonic.toLowerCase(), ...shape].join(" ").replace(/,(?= |$)/g, ",");
}

/** 寄存器名 → 位宽标签；认不出返回 null，让记号原样参与比对。 */
function widthOfRegister(name: string): string | null {
	if (!REGISTER_PATTERN.test(name)) return null;
	if (/^(?:xzr|wzr)$/.test(name)) return name === "xzr" ? "r64" : "r32";
	if (/^(?:x|lr|fp|sp|pc)/.test(name)) return "r64";
	if (/^(?:w|e|ax|bx|cx|dx|si|di|bp|ip)/.test(name) || /^r(?:[0-9]|[12][0-9]|3[01])d$/.test(name)) return "r32";
	if (/^r(?:[0-9]|[12][0-9]|3[01])w$/.test(name)) return "r16";
	if (/^r(?:[0-9]|[12][0-9]|3[01])b$/.test(name)) return "r8";
	return "reg";
}

function hashOf(parts: string): string {
	return sha256Hex(new TextEncoder().encode(parts));
}

/** 读一个镜像的函数集。符号缺失时用调用目标候选补齐，stripped 样本也有东西可比。 */
export function fingerprintFunctions(bytes: Uint8Array, options: SemanticDiffOptions = {}): FunctionSet {
	const parsed = readNativeFacts(bytes);
	if (!parsed) throw new Error("not a native image: expected ELF, PE or Mach-O");
	const facts = parsed.value;
	if (!facts) throw new Error(`unreadable native image: ${parsed.warnings.join("; ") || "unknown format"}`);
	const arch = disasmArchFor(facts.arch ?? "");
	if (!isDecodable(arch)) throw new Error(`no decoder for ${facts.arch}; only aarch64, x86 and x86-64 are supported`);

	const limit = Math.max(1, Math.min(MAX_FUNCTIONS, options.maxFunctions ?? MAX_FUNCTIONS));
	const map = addressMapFor(facts);
	const symbols = listSymbols(bytes, facts.format, { limit });
	const index = buildXrefIndex(bytes, arch, map.executable, {});
	const candidates = listFunctionCandidates(bytes, facts, symbols.symbols, map, index, limit);

	const functions: FunctionEntry[] = [];
	for (const candidate of candidates.slice(0, limit)) {
		// 与 decompile_function 用同一条边界规则：不然「最后一个函数」的指纹会把
		// 尾随数据算进去，改动一个常量反而显示成 changed。
		const end = trimTrailingData(bytes, arch, candidate.offset, functionBoundFor(candidate.offset, candidates, map));
		const run = decodeRange(bytes, arch, candidate.offset, end, 4096);
		if (run.instructions.length === 0) continue;
		const exact = hashOf(run.instructions.map(instruction => instruction.hex).join(" "));
		const shape = hashOf(run.instructions.map(instruction => shapeOfInstruction(instruction.text)).join("\n"));
		const callees = [...new Set(run.instructions.map(instruction => instruction.flow.target).filter((target): target is number => target !== undefined))].sort(
			(left, right) => left - right,
		);
		functions.push({
			start: candidate.offset,
			name: candidate.name ?? `sub_${candidate.offset.toString(16)}`,
			size: run.instructions.length === 0 ? 0 : run.instructions.at(-1)!.offset + run.instructions.at(-1)!.size - candidate.offset,
			instructions: run.instructions.length,
			calls: run.instructions.filter(instruction => instruction.flow.kind === "call").length,
			exact,
			shape,
			callees,
		});
	}

	return { arch, functions, warnings: [...parsed.warnings, ...symbols.warnings].slice(0, 12) };
}

function byName(functions: readonly FunctionEntry[]): Map<string, FunctionEntry> {
	const map = new Map<string, FunctionEntry>();
	for (const entry of functions) if (!map.has(entry.name)) map.set(entry.name, entry);
	return map;
}

/** 比对两份已取好的指纹。拆出来是为了能脱离真实二进制测匹配规则本身。 */
export function compareFunctionSets(left: FunctionSet, right: FunctionSet): SemanticDiffResult {
	const matches: FunctionMatch[] = [];
	const rightNames = byName(right.functions);
	const consumedRight = new Set<string>();

	const statusFor = (leftEntry: FunctionEntry, rightEntry: FunctionEntry): MatchStatus => {
		if (leftEntry.exact === rightEntry.exact) return "same";
		if (leftEntry.shape === rightEntry.shape) return "constants-only";
		return "changed";
	};

	for (const leftEntry of left.functions) {
		const rightEntry = rightNames.get(leftEntry.name);
		if (!rightEntry || consumedRight.has(rightEntry.name)) continue;
		consumedRight.add(rightEntry.name);
		matches.push({
			name: leftEntry.name,
			leftStart: leftEntry.start,
			rightStart: rightEntry.start,
			status: statusFor(leftEntry, rightEntry),
			leftInstructions: leftEntry.instructions,
			rightInstructions: rightEntry.instructions,
			leftCalls: leftEntry.calls,
			rightCalls: rightEntry.calls,
		});
	}

	// 第二轮：符号名不同但形状相同 —— 重命名、内联或链接顺序变化。
	const matchedLeft = new Set(matches.map(match => match.leftStart));
	const rightByShape = new Map<string, FunctionEntry>();
	for (const entry of right.functions) {
		if (consumedRight.has(entry.name)) continue;
		const existing = rightByShape.get(entry.shape);
		if (!existing || entry.instructions > existing.instructions) rightByShape.set(entry.shape, entry);
	}
	for (const leftEntry of left.functions) {
		if (matchedLeft.has(leftEntry.start)) continue;
		const rightEntry = rightByShape.get(leftEntry.shape);
		if (!rightEntry || consumedRight.has(rightEntry.name)) continue;
		consumedRight.add(rightEntry.name);
		matchedLeft.add(leftEntry.start);
		matches.push({
			name: `${leftEntry.name} → ${rightEntry.name}`,
			leftStart: leftEntry.start,
			rightStart: rightEntry.start,
			status: "renamed",
			leftInstructions: leftEntry.instructions,
			rightInstructions: rightEntry.instructions,
			leftCalls: leftEntry.calls,
			rightCalls: rightEntry.calls,
		});
	}

	const removed = left.functions.filter(entry => !matchedLeft.has(entry.start));
	const added = right.functions.filter(entry => !consumedRight.has(entry.name));

	return {
		arch: left.arch === right.arch ? left.arch : null,
		left,
		right,
		matches,
		added,
		removed,
		// 一个函数都没指纹出来时不能说「相同」：两边都是 0 个匹配，那条结论没有证据。
		identical:
			left.arch === right.arch &&
			matches.length > 0 &&
			added.length === 0 &&
			removed.length === 0 &&
			matches.every(match => match.status === "same"),
		archMismatch: left.arch === right.arch ? null : `${left.arch} vs ${right.arch}`,
	};
}

export function semanticDiff(leftBytes: Uint8Array, rightBytes: Uint8Array, options: SemanticDiffOptions = {}): SemanticDiffResult {
	return compareFunctionSets(fingerprintFunctions(leftBytes, options), fingerprintFunctions(rightBytes, options));
}

export function renderSemanticDiff(diff: SemanticDiffResult): string {
	const lines = [
		`# semantic diff — ${diff.left.functions.length} function(s) vs ${diff.right.functions.length}`,
		"",
		"Fingerprints are instruction-level: `same` means identical instruction bytes, `constants-only` means the",
		"same instruction shapes with different operands (a changed constant, offset or register), `changed` means",
		"the shape itself differs. Rows are matched by symbol name first, then by shape.",
		"",
	];
	if (diff.archMismatch) lines.push(`Architecture mismatch (${diff.archMismatch}): only same-architecture builds are comparable.`, "");

	if (diff.left.functions.length === 0 && diff.right.functions.length === 0) {
		lines.push("No functions could be fingerprinted on either side: the image has no code in an executable range, or nothing the symbol/call scan can anchor on.", "");
	}
	const changed = diff.matches.filter(match => match.status !== "same");
	const same = diff.matches.filter(match => match.status === "same");
	lines.push(`Matched ${diff.matches.length} function(s): ${same.length} unchanged, ${changed.length} different.`);
	lines.push(`Added ${diff.added.length}, removed ${diff.removed.length}.`);

	if (changed.length > 0) {
		lines.push("", "| function | left | right | status | instructions | calls |", "| --- | --- | --- | --- | --- | --- |");
		for (const match of changed.slice(0, 80)) {
			lines.push(
				`| ${match.name.replace(/\|/g, "\\|")} | file+0x${match.leftStart.toString(16)} | file+0x${match.rightStart.toString(16)} | ${match.status} | ${match.leftInstructions} → ${match.rightInstructions} | ${match.leftCalls} → ${match.rightCalls} |`,
			);
		}
		if (changed.length > 80) lines.push("", `${changed.length - 80} more differing function(s) are not listed.`);
	}

	const section = (title: string, entries: readonly FunctionEntry[]): void => {
		if (entries.length === 0) return;
		lines.push("", `## ${title}`, "");
		for (const entry of entries.slice(0, 40)) {
			lines.push(`- \`${entry.name}\` at file+0x${entry.start.toString(16)} · ${entry.instructions} instruction(s) · ${entry.calls} call(s)`);
		}
		if (entries.length > 40) lines.push(`- … ${entries.length - 40} more`);
	};
	section("Added", diff.added);
	section("Removed", diff.removed);

	lines.push("", "A shape match is evidence, not proof: read the changed function with decompile_function before explaining what changed.");
	return lines.join("\n");
}

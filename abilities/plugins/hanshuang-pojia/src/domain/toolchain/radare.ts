/**
 * radare2 / rabin2 / radiff2 / rasm2 invocations, plus the output shaping that
 * keeps a decompiled function from eating the whole context window.
 *
 * Every plan is pure: it names the executables and arguments, and renders the
 * text a command produced. Nothing here spawns anything — the caller decides
 * whether the process bridge is usable, so the same code is exercised in tests
 * without radare2 installed.
 */
import type { CommandResult, Invocation, ToolId } from "./catalog";

export type { Invocation } from "./catalog";

export type RadareOperation =
	| "info"
	| "strings"
	| "functions"
	| "disasm"
	| "decompile"
	| "xrefs"
	| "asm"
	| "diff"
	| "cmd";

export type RadareOutputMode = "full" | "fold" | "summary";
export type DiffMode = "code" | "hex" | "stats";

export interface RadareRequest {
	operation: RadareOperation;
	/** Target binary. Empty for `asm`, which works on text only. */
	path?: string;
	otherPath?: string;
	target?: string;
	outputMode?: RadareOutputMode;
	limit?: number;
	/** Row cap for disassembly; defaults to {@link DEFAULT_LINES}. */
	lines?: number;
	maxChars?: number;
	allSections?: boolean;
	filter?: string;
	command?: string;
	analyze?: boolean;
	code?: string;
	arch?: string;
	bits?: number;
	disassemble?: boolean;
	diffMode?: DiffMode;
}

export interface RadarePlan {
	operation: RadareOperation;
	invocations: readonly Invocation[];
	render(results: readonly CommandResult[]): string;
}

export const DEFAULT_LINES = 60;
export const DEFAULT_LIMIT = 100;
export const DEFAULT_MAX_CHARS = 8_000;
export const MAX_LINES = 4_000;
export const MAX_LIMIT = 500;
export const MAX_CHARS = 200_000;
export const R2_TIMEOUT = 120_000;
export const RASM_TIMEOUT = 30_000;

const BRANCH_KEYWORDS = [
	"cmp ", "test ", "tzcnt", "cbz ", "cbnz ", "tbz ", "tbnz ",
	" je ", " jne ", " jz ", " jnz ", " jb ", " jbe ", " ja ", " jae ",
	" jl ", " jle ", " jg ", " jge ", " jmp ", " js ", " jns ", " jo ", " jno ",
	" b.eq", " b.ne", " b.gt", " b.lt", " b.ge", " b.le", " b.hi", " b.ls", " b.mi", " b.pl",
	" b ", " bl ", " bx ", " blr ", " br ", " call ", " ret", " leave", " csel ", " csinc ", " cset ",
];

const FOLD_KEYWORDS = [
	"if ", "else", "switch", "case ", "return", "while ", "for ", "do {", "goto ",
	"break", "continue", "call ", "(", "->",
];


function normalizeLimit(value: number | undefined, fallback: number, max: number): number {
	if (value === undefined || !Number.isFinite(value)) return fallback;
	return Math.max(1, Math.min(max, Math.trunc(value)));
}


export function r2Invocation(command: string, path: string, timeoutMs = R2_TIMEOUT): Invocation {
	return { file: "r2", args: ["-q", "-e", "scr.color=0", "-c", command, path], timeoutMs };
}

/** Radare2 analysis is the expensive part, so every command asks for it explicitly once. */
export function analyzed(command: string): string {
	return `aaa; ${command}`;
}

export function stripNoise(text: string): string {
	return text
		.split(/\r?\n/)
		.filter(line => !/^(?:INFO|WARN|ERROR):/.test(line.trim()))
		.join("\n")
		.trim();
}

/** Output rows with r2's `INFO:` / `WARN:` / `ERROR:` chatter gone and blank lines dropped. */
export function outputLines(text: string): string[] {
	return stripNoise(text)
		.split(/\r?\n/)
		.filter(line => line.trim().length > 0);
}

export function paginate(lines: readonly string[], limit: number, unit: string): string {
	const shown = lines.slice(0, limit);
	if (lines.length <= limit) return shown.join("\n");
	return [...shown, `... [truncated: showing ${limit} of ${lines.length} ${unit}]`].join("\n");
}

export function filterLines(lines: readonly string[], keywords: readonly string[]): string[] {
	const lowered = keywords.map(keyword => keyword.toLowerCase());
	return lines.filter(line => {
		const padded = ` ${line.toLowerCase()} `;
		return lowered.some(keyword => padded.includes(keyword));
	});
}

export function branchSkeleton(lines: readonly string[]): string[] {
	return filterLines(lines, BRANCH_KEYWORDS);
}

export function foldStatements(lines: readonly string[]): string[] {
	return filterLines(lines, FOLD_KEYWORDS);
}

export function truncateChars(text: string, maxChars: number, hint: string): string {
	if (maxChars <= 0 || text.length <= maxChars) return text;
	return `${text.slice(0, maxChars)}\n... [TRUNCATED at ${maxChars} chars — ${hint}]`;
}

function failure(results: readonly CommandResult[]): string | null {
	const broken = results.find(result => result.exitCode !== 0 && !stripNoise(result.stdout));
	if (!broken) return null;
	// radare2 reports real diagnostics as `WARN:` / `ERROR:` lines, so stderr must survive noise stripping.
	const detail = broken.stderr.trim() || stripNoise(broken.stdout) || "no output";
	return `radare2 exited ${broken.exitCode === null ? "on a signal" : broken.exitCode}: ${detail.slice(0, 800)}`;
}

function renderListing(
	results: readonly CommandResult[],
	mode: RadareOutputMode,
	unit: string,
	maxChars: number,
	limit: number,
): string {
	const broken = failure(results);
	if (broken) return broken;
	const lines = outputLines(results[0]?.stdout ?? "");
	if (lines.length === 0) return "[no output — the symbol may not exist or the binary is stripped]";
	if (mode === "fold") {
		const folded = foldStatements(lines);
		const header = `[fold — kept ${folded.length}/${lines.length} control-flow and call statements]`;
		return truncateChars([header, ...folded].join("\n"), maxChars, "narrow the target or use output_mode=summary");
	}
	if (mode === "summary") {
		return truncateChars(paginate(lines, limit, unit), maxChars, "narrow the target");
	}
	return truncateChars(paginate(lines, Math.max(limit, 1), unit), maxChars, "narrow the target or use output_mode=fold");
}

function renderBranch(
	results: readonly CommandResult[],
	maxChars: number,
): string {
	const broken = failure(results);
	if (broken) return broken;
	const lines = outputLines(results[0]?.stdout ?? "");
	if (lines.length === 0) return "[no output — the symbol may not exist or the binary is stripped]";
	const kept = branchSkeleton(lines);
	const header = `[branch — kept ${kept.length}/${lines.length} lines: compare, branch, call and return only]`;
	return truncateChars([header, ...kept].join("\n"), maxChars, "use output_mode=full for every instruction");
}

function summarize(
	results: readonly CommandResult[],
	target: string,
	maxChars: number,
): string {
	const [info, callers, callees] = results.map(result => stripNoise(result.stdout));
	const body = [
		`[summary — no instructions, only shape]`,
		`target: ${target}`,
		"--- function info ---",
		(info ?? "").slice(0, 800) || "(no afi output)",
		"--- callers (xrefs to) ---",
		(callers ?? "").slice(0, 600) || "(none)",
		"--- callees (calls from) ---",
		(callees ?? "").slice(0, 600) || "(none)",
		"hint: output_mode='fold' for branches-only detail, or 'full' for every instruction.",
	].join("\n");
	return truncateChars(body, maxChars, "the summary is already minimal");
}

function targetOf(request: RadareRequest, fallback = "main"): string {
	const target = (request.target ?? fallback).trim();
	return target.length > 0 ? target : fallback;
}

export function planRadare(request: RadareRequest): RadarePlan {
	const path = request.path ?? "";
	const mode = request.outputMode ?? "full";
	const limit = normalizeLimit(request.limit, DEFAULT_LIMIT, MAX_LIMIT);
	const maxChars = normalizeLimit(request.maxChars, DEFAULT_MAX_CHARS, MAX_CHARS);
	const lines = normalizeLimit(request.lines ?? request.limit, DEFAULT_LINES, MAX_LINES);

	switch (request.operation) {
		case "info":
			return {
				operation: request.operation,
				invocations: [{ file: "rabin2", args: ["-I", path], timeoutMs: R2_TIMEOUT }],
				render: results => failure(results) ?? (stripNoise(results[0]?.stdout ?? "") || "[no rabin2 output]"),
			};

		case "strings": {
			const flag = request.allSections ? "-zz" : "-z";
			return {
				operation: request.operation,
				invocations: [{ file: "rabin2", args: [flag, path], timeoutMs: R2_TIMEOUT }],
				render: results => {
					const broken = failure(results);
					if (broken) return broken;
					const all = outputLines(results[0]?.stdout ?? "");
					const needle = (request.filter ?? "").toLowerCase();
					const matched = needle ? all.filter(line => line.toLowerCase().includes(needle)) : all;
					if (matched.length === 0) return `[no strings matched ${JSON.stringify(request.filter ?? "")}]`;
					return paginate(matched, limit, needle ? "matching strings" : "strings");
				},
			};
		}

		case "functions":
			return {
				operation: request.operation,
				invocations: [r2Invocation(analyzed("afl"), path)],
				render: results => {
					const broken = failure(results);
					if (broken) return broken;
					const all = outputLines(results[0]?.stdout ?? "");
					const needle = (request.filter ?? "").toLowerCase();
					const matched = needle ? all.filter(line => line.toLowerCase().includes(needle)) : all;
					if (matched.length === 0) return "[no matching functions]";
					return paginate(matched, limit, "functions");
				},
			};

		case "disasm":
		case "decompile": {
			const target = targetOf(request);
			const command = `${request.operation === "disasm" ? "pdf" : "pdc"} @ ${target}`;
			if (mode === "summary") {
				return {
					operation: request.operation,
					invocations: [
						r2Invocation(analyzed(`afi @ ${target}`), path),
						r2Invocation(analyzed(`axt @ ${target}`), path),
						r2Invocation(analyzed(`axf @ ${target}`), path),
					],
					render: results => summarize(results, target, maxChars),
				};
			}
			return {
				operation: request.operation,
				invocations: [r2Invocation(analyzed(command), path)],
				render: results => {
					const text =
						request.operation === "disasm" && mode === "fold"
							? renderBranch(results, maxChars)
							: renderListing(results, mode, request.operation === "disasm" ? "instructions" : "statements", maxChars, lines);
					// `pdc` is missing from some r2 builds; an empty result then means "unsupported", not "nothing here".
					if (request.operation === "decompile" && text.startsWith("[no output")) {
						return `${text}\n[note: this r2 build may not ship pdc — try operation=disasm for the same target]`;
					}
					return text;
				},
			};
		}

		case "xrefs": {
			const target = targetOf(request);
			const direction = (request.filter ?? "to") === "from" ? "axf" : "axt";
			return {
				operation: request.operation,
				invocations: [r2Invocation(analyzed(`${direction} @ ${target}`), path)],
				render: results => {
					const broken = failure(results);
					if (broken) return broken;
					const all = outputLines(results[0]?.stdout ?? "");
					if (all.length === 0) return `[no xrefs ${direction === "axt" ? "to" : "from"} ${target}]`;
					const shown = all.slice(0, limit);
					const header = `[xrefs ${direction === "axt" ? "to" : "from"} ${target} — ${all.length} reference(s), showing ${shown.length}]`;
					const tail = all.length > limit ? [`... [${all.length - limit} more references not shown]`] : [];
					return [header, ...shown, ...tail].join("\n");
				},
			};
		}

		case "asm": {
			const arch = (request.arch ?? "x86").trim() || "x86";
			const bits = request.bits === 16 || request.bits === 32 ? request.bits : 64;
			const code = (request.code ?? "").trim();
			const args = ["-a", arch, "-b", String(bits)];
			if (request.disassemble) args.push("-d", code);
			else args.push(code);
			return {
				operation: request.operation,
				invocations: [{ file: "rasm2", args, timeoutMs: RASM_TIMEOUT }],
				render: results => failure(results) ?? (stripNoise(results[0]?.stdout ?? "").trim() || "[no rasm2 output]"),
			};
		}

		case "diff": {
			const flag = request.diffMode === "hex" ? "-x" : request.diffMode === "stats" ? "-s" : "-C";
			return {
				operation: request.operation,
				invocations: [{ file: "radiff2", args: [flag, path, request.otherPath ?? ""], timeoutMs: R2_TIMEOUT }],
				render: results => {
					const broken = failure(results);
					if (broken) return broken;
					const rows = outputLines(results[0]?.stdout ?? "");
					if (rows.length === 0) return "[no differences reported]";
					return truncateChars(paginate(rows, limit, "diff lines"), maxChars, "use diff_mode=stats for a summary");
				},
			};
		}

		case "cmd": {
			const command = (request.command ?? "").trim();
			if (command === "") throw new Error("empty radare2 command");
			const full = request.analyze === false ? command : analyzed(command);
			return {
				operation: request.operation,
				invocations: [r2Invocation(full, path)],
				render: results =>
					failure(results) ??
					truncateChars(
						paginate(outputLines(results[0]?.stdout ?? ""), Math.max(limit, 1), "lines"),
						maxChars,
						"ask for a narrower command",
					),
			};
		}
	}
}

/** The executable each operation actually needs, so an error names the right missing tool. */
export const OPERATION_TOOL: Record<RadareOperation, ToolId> = {
	info: "rabin2",
	strings: "rabin2",
	functions: "r2",
	disasm: "r2",
	decompile: "r2",
	xrefs: "r2",
	cmd: "r2",
	diff: "radiff2",
	asm: "rasm2",
};

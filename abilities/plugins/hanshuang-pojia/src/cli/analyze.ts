/**
 * 命令行入口：把插件自己的领域引擎暴露成一个可执行物。
 *
 * 存在的理由不是「再做一个 CLI」，而是三件具体的事：
 * 1. 面板里的每个数字都能在终端里用同一个引擎复现——出问题时不用怀疑 UI；
 * 2. 新能力靠可执行物自证，而不是靠文档描述（`node scripts/analyze.mjs decompile …`）；
 * 3. 真实样本上的批量与比对能进脚本和 CI，不必手点。
 *
 * 因此这里**只 import `src/domain`**：不碰插件 SDK、不碰面板 React、不起子进程。
 * 宿主能力之外的部分（读文件、argv、退出码）留在 `scripts/analyze.mjs` 里，让这份
 * 文件本身也能被打包进任何 node 环境。
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { triage } from "../domain/triage";
import { renderMarkdown } from "../domain/report/report";
import { extractStrings } from "../domain/strings";
import { readNativeFacts } from "../domain/native/detect";
import { addressMapFor, vaddrToOffset } from "../domain/native/image";
import { disasmArchFor, isDecodable } from "../domain/native/insn";
import { disassemble } from "../domain/native/disasm";
import { decompileFunction, type PseudoMode } from "../domain/native/pseudo";
import { symbolBoundFor, trimTrailingData } from "../domain/native/deep";
import { semanticDiff, renderSemanticDiff } from "../domain/native/semantic-diff";
import { listSymbols, type SymbolKind } from "../domain/native/symbols";
import { looksLikeDex } from "../domain/android/dex";
import { dexStrings, indexDex, searchDex } from "../domain/android/dex-index";
import { buildHookScript, hookRunHint, hookTargetsFromHits } from "../domain/android/hook-template";
import { findZipEntries, looksLikeZip, readZipEntry, readZipIndex } from "../domain/archive/zip";

export const COMMANDS = ["triage", "strings", "symbols", "disasm", "decompile", "diff", "hook", "docs"] as const;
export type Command = (typeof COMMANDS)[number];

export interface CliOutput {
	write(text: string): void;
	writeError(text: string): void;
}

export const USAGE = [
	"analyze.mjs <command> [file] [options]",
	"",
	"Commands:",
	"  triage <file> [--mode summary|full] [--json]         static triage and risk score",
	"  strings <file> [--query <text>] [--min 6] [--json]   printable strings, optionally grepped",
	"  symbols <file> [--query <text>] [--kind all|function|export|import] [--json]",
	"  disasm <file> [--offset <n> | --symbol <name>] [--length 256] [--json]",
	"  decompile <file> [--offset <n> | --symbol <name>] [--mode full|fold|summary] [--budget 6000]",
	"  diff <file> <other> [--json]                        function-level semantic diff",
	"  hook <file> --query <text> [--backtrace] [--package <name>]",
	"  docs <query> [--read <id>] [--group kb|manual|kit-docs] [--json]",
	"",
	"Every command prints markdown by default; --json prints the underlying structure.",
	"Exit codes: 0 ok · 1 usage error · 2 analysis failure.",
].join("\n");

interface Args {
	command: Command;
	positional: string[];
	flags: Map<string, string | true>;
}

class UsageError extends Error {}

function parseArgs(argv: readonly string[]): Args {
	const [command, ...rest] = argv;
	if (!command || command === "--help" || command === "-h") throw new UsageError("no command given");
	if (!(COMMANDS as readonly string[]).includes(command)) throw new UsageError(`unknown command: ${command}`);
	const positional: string[] = [];
	const flags = new Map<string, string | true>();
	for (let index = 0; index < rest.length; index += 1) {
		const token = rest[index]!;
		if (!token.startsWith("--")) {
			positional.push(token);
			continue;
		}
		const body = token.slice(2);
		const equals = body.indexOf("=");
		if (equals > 0) {
			flags.set(body.slice(0, equals), body.slice(equals + 1));
			continue;
		}
		// 布尔开关只有这几个；其余一律吃掉下一个 token 作为值。
		if (["json", "backtrace", "help"].includes(body)) {
			flags.set(body, true);
			continue;
		}
		const next = rest[index + 1];
		if (next === undefined || next.startsWith("--")) throw new UsageError(`--${body} needs a value`);
		flags.set(body, next);
		index += 1;
	}
	return { command: command as Command, positional, flags };
}

function textFlag(args: Args, name: string): string | null {
	const value = args.flags.get(name);
	return typeof value === "string" ? value : null;
}

function numberFlag(args: Args, name: string, fallback: number): number {
	const raw = textFlag(args, name);
	if (raw === null) return fallback;
	const parsed = Number.parseInt(raw, raw.startsWith("0x") ? 16 : 10);
	if (!Number.isFinite(parsed)) throw new UsageError(`--${name} must be a number`);
	return parsed;
}

function boolFlag(args: Args, name: string): boolean {
	return args.flags.get(name) === true;
}

async function readBytes(path: string): Promise<Uint8Array> {
	const buffer = await readFile(path);
	return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

function nameOf(path: string): string {
	return path.slice(path.lastIndexOf("/") + 1);
}

/** 前端三个命令都需要「镜像 + 架构 + 符号偏移表」，这里统一取一次。 */
async function nativeContext(path: string) {
	const bytes = await readBytes(path);
	const parsed = readNativeFacts(bytes);
	if (!parsed) throw new Error(`${path} is not an ELF, PE or Mach-O image`);
	if (!parsed.value) throw new Error(`${path} could not be parsed: ${parsed.warnings.join("; ")}`);
	const facts = parsed.value;
	const arch = disasmArchFor(facts.arch);
	if (!isDecodable(arch)) throw new Error(`${path} is ${facts.arch}; only aarch64, x86 and x86-64 are decoded`);
	const map = addressMapFor(facts);
	const surface = listSymbols(bytes, facts.format, { limit: 1200, imports: facts.imports });
	const names = new Map<number, string>();
	for (const symbol of surface.symbols) {
		if (symbol.kind === "import") continue;
		const offset = vaddrToOffset(map, symbol.address);
		if (offset !== null && offset >= 0) names.set(offset, symbol.name);
	}
	return { bytes, facts, arch, map, surface, names, warnings: [...parsed.warnings, ...surface.warnings] };
}

function requirePositional(args: Args, index: number, what: string): string {
	const value = args.positional[index];
	if (!value) throw new UsageError(`${args.command} needs ${what}`);
	return value;
}

async function commandTriage(args: Args, out: CliOutput): Promise<number> {
	const path = requirePositional(args, 0, "a file path");
	const bytes = await readBytes(path);
	const report = await triage({ path, name: nameOf(path), bytes }, { mode: textFlag(args, "mode") === "full" ? "full" : "summary" });
	out.write(boolFlag(args, "json") ? JSON.stringify(report, null, 2) : renderMarkdown(report, { mode: report.mode }));
	return 0;
}

async function commandStrings(args: Args, out: CliOutput): Promise<number> {
	const path = requirePositional(args, 0, "a file path");
	const bytes = await readBytes(path);
	const query = textFlag(args, "query");
	const minLength = numberFlag(args, "min", 6);
	const rows = extractStrings(bytes, { minLength, maxResults: 5000 });
	const filtered = query ? rows.filter(row => row.value.toLowerCase().includes(query.toLowerCase())) : rows;
	if (boolFlag(args, "json")) {
		out.write(JSON.stringify({ file: path, minLength, query, hits: filtered.length, strings: filtered.slice(0, 500) }, null, 2));
		return 0;
	}
	const lines = [`# strings — ${nameOf(path)}`, `${rows.length} string(s) at min length ${minLength}, ${filtered.length} matching${query ? ` \`${query}\`` : ""}.`, ""];
	for (const row of filtered.slice(0, 200)) lines.push(`0x${row.offset.toString(16)}  ${row.encoding.padEnd(6)}  ${row.value.slice(0, 200)}`);
	if (filtered.length > 200) lines.push("", `… ${filtered.length - 200} more (raise the filter instead of the limit)`);
	out.write(lines.join("\n"));
	return 0;
}

async function commandSymbols(args: Args, out: CliOutput): Promise<number> {
	const path = requirePositional(args, 0, "a file path");
	const context = await nativeContext(path);
	const query = (textFlag(args, "query") ?? "").toLowerCase();
	const kinds = textFlag(args, "kind") ?? "all";
	const rows = context.surface.symbols.filter(symbol => {
		if (kinds !== "all") {
			if (kinds === "function" && symbol.kind !== "function") return false;
			if (kinds === "export" && !symbol.exported) return false;
			if (kinds === "import" && symbol.kind !== ("import" satisfies SymbolKind)) return false;
		}
		return query === "" || symbol.name.toLowerCase().includes(query);
	});
	if (boolFlag(args, "json")) {
		out.write(JSON.stringify({ file: path, arch: context.arch, total: context.surface.total, symbols: rows.slice(0, 400) }, null, 2));
		return 0;
	}
	const lines = [
		`# symbols — ${nameOf(path)} · ${context.facts.arch} · ${context.facts.format}`,
		`${context.surface.total} symbol(s) in the file, ${context.surface.functions} function(s), ${context.surface.exports} export(s), ${context.surface.imports} import(s).`,
		"",
	];
	if (context.facts.stripped) lines.push("This image is stripped: names come from dynamic exports/imports only.", "");
	for (const symbol of rows.slice(0, 200)) lines.push(`${String(symbol.kind).padEnd(8)} ${symbol.source.padEnd(7)} ${symbol.exported ? "export" : "      "} 0x${symbol.address.toString(16)}  ${symbol.name}`);
	if (rows.length > 200) lines.push("", `… ${rows.length - 200} more`);
	for (const warning of context.warnings.slice(0, 6)) lines.push("", `note: ${warning}`);
	out.write(lines.join("\n"));
	return 0;
}

/** `--symbol name` 比记 vaddr 更实际：符号表里已有的名字不该让用户自己换算偏移。 */
function offsetForSymbol(context: { names: Map<number, string> }, wanted: string): number {
	const needle = wanted.toLowerCase();
	for (const [offset, name] of context.names) {
		if (name.toLowerCase() === needle) return offset;
	}
	for (const [offset, name] of context.names) {
		if (name.toLowerCase().includes(needle)) return offset;
	}
	throw new UsageError(`no symbol matching ${wanted}`);
}

async function commandDisasm(args: Args, out: CliOutput): Promise<number> {
	const path = requirePositional(args, 0, "a file path");
	const context = await nativeContext(path);
	const symbol = textFlag(args, "symbol");
	const offset = symbol !== null ? offsetForSymbol(context, symbol) : numberFlag(args, "offset", context.facts.entryOffset ?? 0);
	const length = numberFlag(args, "length", 256);
	const result = disassemble(context.bytes, context.arch, { offset, length, max: numberFlag(args, "max", 512) });
	if (boolFlag(args, "json")) {
		out.write(JSON.stringify({ file: path, arch: result.arch, offset, length, instructions: result.instructions }, null, 2));
		return 0;
	}
	const lines = [`# disasm — ${nameOf(path)} · ${result.arch} · file+0x${offset.toString(16)} (+${length})`, ""];
	for (const instruction of result.instructions) {
		lines.push(`file+0x${instruction.offset.toString(16).padEnd(6)}  ${instruction.hex.padEnd(20)}  ${instruction.text}`);
	}
	if (result.truncated) lines.push("", `stopped at the instruction budget (${result.instructions.length} shown)`);
	if (result.instructions.length === 0) lines.push("nothing decoded in this range — check the offset and the architecture");
	out.write(lines.join("\n"));
	return 0;
}

async function commandDecompile(args: Args, out: CliOutput): Promise<number> {
	const path = requirePositional(args, 0, "a file path");
	const context = await nativeContext(path);
	const symbol = textFlag(args, "symbol");
	const start = symbol !== null ? offsetForSymbol(context, symbol) : numberFlag(args, "offset", context.facts.entryOffset ?? -1);
	if (start < 0) throw new UsageError("decompile needs --offset or --symbol: this image declares no entry point");
	const mode = (textFlag(args, "mode") ?? "full") as PseudoMode;
	const result = decompileFunction(context.bytes, context.arch, {
		start,
		end:
			textFlag(args, "end") !== null
				? numberFlag(args, "end", 0)
				: trimTrailingData(context.bytes, context.arch, start, symbolBoundFor(start, context.names.keys(), context.map)),
		name: textFlag(args, "name"),
		mode: ["full", "fold", "summary"].includes(mode) ? mode : "full",
		budget: numberFlag(args, "budget", 6000),
		names: context.names,
	});
	if (boolFlag(args, "json")) {
		out.write(JSON.stringify({ ...result, text: result.text }, null, 2));
		return 0;
	}
	out.write(result.text.trimEnd());
	if (result.strings.length > 0) {
		out.write(["", "# string references", ...result.strings.slice(0, 12).map(entry => `file+0x${entry.offset.toString(16)} ← file+0x${entry.from.toString(16)}: ${entry.text}`)].join("\n"));
	}
	if (result.warnings.length > 0) out.write(["", ...result.warnings.map(warning => `note: ${warning}`)].join("\n"));
	return 0;
}

async function commandDiff(args: Args, out: CliOutput): Promise<number> {
	const left = requirePositional(args, 0, "a baseline file");
	const right = requirePositional(args, 1, "a second file");
	const diff = semanticDiff(await readBytes(left), await readBytes(right));
	if (boolFlag(args, "json")) {
		out.write(JSON.stringify(diff, null, 2));
		return 0;
	}
	out.write([`# ${nameOf(left)} → ${nameOf(right)}`, "", renderSemanticDiff(diff)].join("\n"));
	return 0;
}

async function commandHook(args: Args, out: CliOutput): Promise<number> {
	const path = requirePositional(args, 0, "an APK or DEX path");
	const query = textFlag(args, "query");
	if (!query) throw new UsageError("hook needs --query <text>");
	const sample = await readBytes(path);
	const dexFiles: { name: string; bytes: Uint8Array }[] = [];
	if (looksLikeDex(sample)) dexFiles.push({ name: nameOf(path), bytes: sample });
	else if (looksLikeZip(sample)) {
		const index = readZipIndex(sample);
		for (const entry of findZipEntries(index, name => /^classes\d*\.dex$/.test(name)).slice(0, 3)) {
			dexFiles.push({ name: entry.name, bytes: await readZipEntry(sample, entry) });
		}
	}
	if (dexFiles.length === 0) throw new Error(`${path} contains no Dalvik code to hook`);

	const hits = [];
	for (const file of dexFiles) {
		const index = indexDex(file.bytes);
		hits.push(...searchDex(index, dexStrings(file.bytes), query, "any", 120).hits);
	}
	const { targets, classes } = hookTargetsFromHits(hits);
	const script = buildHookScript(targets, classes, { source: nameOf(path), query, backtrace: boolFlag(args, "backtrace") });
	if (boolFlag(args, "json")) {
		out.write(JSON.stringify({ file: path, query, targets, classes, hits: hits.length, script }, null, 2));
		return 0;
	}
	out.write(script.trimEnd());
	out.write(["", hookRunHint(textFlag(args, "package"))].join("\n"));
	return 0;
}

interface DocIndexEntry {
	id: string;
	group: string;
	topic: string;
	title: string;
	path: string;
}

async function commandDocs(args: Args, out: CliOutput): Promise<number> {
	const index = JSON.parse(await readFile(join(process.cwd(), "src/content/docs/index.json"), "utf8")) as DocIndexEntry[];
	const read = textFlag(args, "read");
	if (read) {
		const entry = index.find(item => item.id === read);
		if (!entry) throw new UsageError(`no document with id ${read}`);
		out.write(await readFile(join(process.cwd(), entry.path), "utf8"));
		return 0;
	}
	const query = (args.positional[0] ?? "").toLowerCase();
	const group = textFlag(args, "group");
	const hits = index
		.filter(entry => (group === null || entry.group === group) && (query === "" || `${entry.title} ${entry.id} ${entry.topic}`.toLowerCase().includes(query)))
		.slice(0, 40);
	if (boolFlag(args, "json")) {
		out.write(JSON.stringify({ query, group, total: index.length, hits }, null, 2));
		return 0;
	}
	const lines = [`# docs — ${index.length} bundled document(s)`, `${hits.length} match(es)${query ? ` for \`${query}\`` : ""}${group ? ` in ${group}` : ""}.`, ""];
	for (const entry of hits) lines.push(`${entry.id.padEnd(48)}  ${entry.group.padEnd(8)}  ${entry.title}`);
	if (hits.length === 0) lines.push("nothing matched — try a shorter fragment of the title");
	lines.push("", "Print a body with: analyze.mjs docs --read <id>");
	out.write(lines.join("\n"));
	return 0;
}

const HANDLERS: Record<Command, (args: Args, out: CliOutput) => Promise<number>> = {
	triage: commandTriage,
	strings: commandStrings,
	symbols: commandSymbols,
	disasm: commandDisasm,
	decompile: commandDecompile,
	diff: commandDiff,
	hook: commandHook,
	docs: commandDocs,
};

export async function runCli(argv: readonly string[], out: CliOutput): Promise<number> {
	// `--help` 是唯一在命令之前就要生效的开关：`analyze.mjs --help` 与 `analyze.mjs triage --help`
	// 都该打出用法并退出 0，而不是先报「没有命令」。
	if (argv.some(token => token === "--help" || token === "-h" || token === "help")) {
		out.write(USAGE);
		return 0;
	}
	try {
		const args = parseArgs(argv);
		return await HANDLERS[args.command](args, out);
	} catch (error) {
		if (error instanceof UsageError) {
			out.writeError(`error: ${error.message}\n\n${USAGE}`);
			return 1;
		}
		out.writeError(`analysis failed: ${error instanceof Error ? error.message : String(error)}`);
		return 2;
	}
}

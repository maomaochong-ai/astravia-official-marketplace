import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { readNativeFacts } from "../domain/native/detect";
import { addressMapFor, vaddrToOffset } from "../domain/native/image";
import { disasmArchFor, isDecodable } from "../domain/native/insn";
import { symbolBoundFor, trimTrailingData } from "../domain/native/deep";
import { decompileFunction, DEFAULT_PSEUDO_BUDGET, type PseudoMode } from "../domain/native/pseudo";
import { listSymbols } from "../domain/native/symbols";
import { loadSample } from "./read-sample";

interface DecompileFunctionInput {
	path?: string;
	offset?: number;
	end?: number;
	name?: string;
	mode?: PseudoMode;
	budget?: number;
}

const MAX_NAMES = 1200;

export function registerDecompileFunctionTool(ctx: PluginContext): Disposable {
	return ctx.agent.registerTool<DecompileFunctionInput>({
		id: "decompile_function",
		name: "decompile_function",
		label: "%tool.decompile.label%",
		description: [
			"Rebuild one function of an ELF / PE / Mach-O image as register-level pseudo-C: basic blocks with",
			"`L_<offset>` labels, `if (…) goto` from compare + conditional branch, calls resolved to symbol names",
			"or `sub_<offset>`, stack slots as `var_<offset>`, and string references as trailing comments.",
			"",
			"This is the r2 `pdc` layer, not Hex-Rays: there is NO type recovery, NO SSA, NO variable merging and",
			"NO struct reconstruction. Operands keep their register names, and signedness of a comparison is",
			"marked unresolved rather than guessed. Read it as control flow you can follow, not as source.",
			"",
			"`mode` trades detail for budget: `full` (default) keeps every statement, `fold` keeps only control",
			"flow, calls, memory access and the comparisons that drive branches, `summary` keeps the block and",
			"call skeleton. The output always states which mode produced it and where it was truncated.",
			"",
			"For DEX / APK code use search_dex_symbols instead — Dalvik bytecode is not decoded here. For a raw",
			"instruction listing use disassemble_range.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				path: { type: "string", description: "ELF / PE / Mach-O path, absolute or relative to the session working directory." },
				offset: { type: "integer", description: "Function start as a file offset. Defaults to the image entry point." },
				end: { type: "integer", description: "Optional exclusive end offset; defaults to the next function candidate or the end of the executable range." },
				name: { type: "string", description: "Optional display name for the function header." },
				mode: { type: "string", enum: ["full", "fold", "summary"], description: "Detail level (default full)." },
				budget: { type: "integer", description: `Character budget for the text (default ${DEFAULT_PSEUDO_BUDGET}); truncation is marked in the output.` },
			},
			required: ["path"],
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"],
		context: { conversation: "summary" },
		timeoutMs: 120_000,
		handler: async context => {
			try {
				const input = context.trigger.input;
				const sample = await loadSample(context.host.fs, context.session.cwd, input.path ?? "");
				const parsed = readNativeFacts(sample.bytes);
				if (!parsed) {
					return `${sample.name} is not an ELF, PE or Mach-O image, so there is no native function to decompile. Use triage_binary to identify it, or search_dex_symbols for Dalvik code.`;
				}
				if (!parsed.value) return `${sample.name} could not be parsed: ${parsed.warnings.join("; ")}`;
				const facts = parsed.value;
				const arch = disasmArchFor(facts.arch);
				if (!isDecodable(arch)) {
					return `${sample.name} is ${facts.arch}, and this plugin only decodes aarch64, x86 and x86-64. Use disassemble_range for a raw listing, or analyse it with an external disassembler.`;
				}

				const map = addressMapFor(facts);
				const surface = listSymbols(sample.bytes, facts.format, { limit: MAX_NAMES, imports: facts.imports });
				const names = new Map<number, string>();
				for (const symbol of surface.symbols) {
					if (symbol.kind === "import") continue;
					const offset = vaddrToOffset(map, symbol.address);
					if (offset !== null && offset >= 0) names.set(offset, symbol.name);
				}

				const start = input.offset ?? facts.entryOffset ?? null;
				if (start === null || start < 0) {
					return `${sample.name} declares no entry point, so an \`offset\` is required. list_code_symbols returns function offsets to pick from.`;
				}

				// 没有显式 end 时按「下一个符号 → 可执行段末尾 → 兜底跨度」推边界，
				// 再剪掉 ret 之后的填充数据；否则小函数会把后半段数据一并读成指令。
				const bound = input.end ?? trimTrailingData(sample.bytes, arch, start, symbolBoundFor(start, names.keys(), map));
				const result = decompileFunction(sample.bytes, arch, {
					start,
					end: bound,
					name: input.name ?? null,
					mode: input.mode ?? "full",
					budget: input.budget,
					names,
				});

				const head = [
					`# ${result.name} · file+0x${result.start.toString(16)} · ${arch} · ${result.mode}`,
					`${result.instructions} instruction(s) in ${result.blocks} block(s), ${result.calls} call(s).`,
					"",
					"```c",
					result.text.trimEnd(),
					"```",
				];
				if (result.strings.length > 0) {
					head.push("", "## String references", "");
					for (const entry of result.strings.slice(0, 12)) {
						head.push(`- file+0x${entry.offset.toString(16)} ← file+0x${entry.from.toString(16)}: \`${entry.text.replace(/\n/g, "\\n")}\``);
					}
					if (result.strings.length > 12) head.push(`- … ${result.strings.length - 12} more`);
				}
				const notes = [...result.warnings];
				if (result.truncated) notes.push(`text stopped at the ${result.budget}-character budget; narrow the range or lower the mode`);
				if (notes.length > 0) head.push("", "Notes:", ...notes.map(note => `- ${note}`));
				head.push("", "Register-level pseudo-C: names and types are NOT recovered. Confirm any conclusion against the listing from disassemble_range.");
				return head.join("\n");
			} catch (error) {
				return `Decompilation failed: ${error instanceof Error ? error.message : String(error)}`;
			}
		},
	});
}

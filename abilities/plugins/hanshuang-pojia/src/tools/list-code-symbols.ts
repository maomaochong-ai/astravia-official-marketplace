import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { readNativeFacts } from "../domain/native/detect";
import { listSymbols, type CodeSymbol } from "../domain/native/symbols";
import { loadSample } from "./read-sample";

interface ListCodeSymbolsInput {
	path?: string;
	query?: string;
	kind?: "all" | "function" | "export" | "import";
	limit?: number;
}

const MAX_ROWS = 400;

function quote(value: string): string {
	return value.length > 120 ? `${value.slice(0, 119)}…` : value.replace(/\|/g, "\\|");
}

function addressText(symbol: CodeSymbol): string {
	return symbol.address === 0 ? "—" : `0x${symbol.address.toString(16)}`;
}

export function registerListCodeSymbolsTool(ctx: PluginContext): Disposable {
	return ctx.agent.registerTool<ListCodeSymbolsInput>({
		id: "list_code_symbols",
		name: "list_code_symbols",
		label: "%tool.symbols.label%",
		description: [
			"Enumerate the named code surface of a native image: functions from ELF `.symtab` / `.dynsym`,",
			"PE exports, Mach-O `LC_SYMTAB` entries, plus imported routines grouped by library and the",
			"image entry point. Symbol addresses are virtual addresses from the file's own tables.",
			"",
			"Use it to answer 'is this binary stripped?', 'what does it export?', 'which crypto or network",
			"library does it call?', or to turn an anonymous sample into a list of named capabilities before",
			"reading any disassembly. It reads only the file, so a stripped sample simply yields fewer names",
			"and a warning saying so.",
			"",
			"It does not decompile, does not resolve C++ demangled names beyond what the file stores, does",
			"not follow relocations across modules, and does not execute the sample.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				path: { type: "string", description: "File path, absolute or relative to the session working directory." },
				query: { type: "string", description: "Optional case-insensitive substring filter on the symbol name." },
				kind: {
					type: "string",
					enum: ["all", "function", "export", "import"],
					description: "all (default), function, export or import.",
				},
				limit: { type: "integer", description: `Maximum symbols to return (default 200, max ${MAX_ROWS}).` },
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
				if (!parsed || !parsed.value) {
					return `${sample.name} is not an ELF, PE or Mach-O image, so it has no native symbol table. Use triage_binary for container formats or search_dex_symbols for DEX/APK input.`;
				}
				const facts = parsed.value;
				const limit = Math.max(1, Math.min(MAX_ROWS, input.limit ?? 200));
				const surface = listSymbols(sample.bytes, facts.format, { limit, imports: facts.imports });
				const needle = (input.query ?? "").trim().toLowerCase();
				const kind = input.kind ?? "all";
				const filtered = surface.symbols.filter(symbol => {
					if (needle !== "" && !symbol.name.toLowerCase().includes(needle)) return false;
					if (kind === "function") return symbol.kind === "function";
					if (kind === "export") return symbol.exported;
					if (kind === "import") return symbol.kind === "import";
					return true;
				});
				const sorted = [...filtered].sort((a, b) => {
					if (a.kind === "import" && b.kind !== "import") return 1;
					if (b.kind === "import" && a.kind !== "import") return -1;
					return a.address - b.address;
				});

				const lines = [
					`# Code symbols in ${sample.name}`,
					"",
					`${facts.format} · ${facts.arch} · ${facts.bits}-bit · entry ${facts.entryPoint === 0 ? "—" : `0x${facts.entryPoint.toString(16)}`}`,
					"",
					`${surface.total} symbol(s) read: ${surface.functions} function(s), ${surface.exports} exported, ${surface.imports} imported.` +
						(needle || kind !== "all" ? ` ${sorted.length} match the filter.` : ""),
				];
				if (surface.warnings.length > 0) lines.push("", ...surface.warnings.map(warning => `- ${warning}`));
				if (sorted.length === 0) {
					lines.push("", "No symbol matched. A stripped image keeps its imports but drops most names — say so rather than inventing function names.");
					return lines.join("\n");
				}
				lines.push("", "| address | kind | name |", "| --- | --- | --- |");
				for (const symbol of sorted) lines.push(`| ${addressText(symbol)} | ${symbol.kind}${symbol.exported ? " / export" : ""} | ${quote(symbol.name)} |`);
				if (surface.total >= limit) lines.push("", `The list stopped at the ${limit}-symbol budget; raise \`limit\` or filter with \`query\`.`);
				lines.push("", "Names come from the file's own tables. Presence of a name is evidence about the toolchain and libraries, not proof that the code path is reachable.");
				return lines.join("\n");
			} catch (error) {
				return `Symbol listing failed: ${error instanceof Error ? error.message : String(error)}`;
			}
		},
	});
}

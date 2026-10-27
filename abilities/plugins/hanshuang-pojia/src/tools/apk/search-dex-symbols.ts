import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { dexStrings, indexDex, searchDex, type DexSearchKind, type DexSearchHit } from "../../domain/android/dex-index";
import { looksLikeDex } from "../../domain/android/dex";
import { findZipEntries, looksLikeZip, readZipEntry, readZipIndex } from "../../domain/archive/zip";
import { loadSample } from "../lib/read-sample";

interface SearchDexSymbolsInput {
	path?: string;
	query?: string;
	kind?: DexSearchKind;
	limit?: number;
}

const MAX_DEX_FILES = 3;
const MAX_HITS = 200;

function quote(value: string): string {
	return (value.length > 160 ? `${value.slice(0, 159)}…` : value).replace(/\|/g, "\\|");
}

export function registerSearchDexSymbolsTool(ctx: PluginContext): Disposable {
	return ctx.agent.registerTool<SearchDexSymbolsInput>({
		id: "search_dex_symbols",
		name: "search_dex_symbols",
		label: "%tool.dex.label%",
		description: [
			"Search the class, method and string tables of a DEX file — or of `classes*.dex` inside an APK —",
			"by case-insensitive substring, and return the matching classes, method signatures with their",
			"declaring class, and string-pool entries. This is the index a smali search would give you,",
			"without materialising smali: descriptors are read straight from `class_defs`, `method_ids`,",
			"`proto_ids`, `type_ids` and `string_ids`.",
			"",
			"Use it to find the code that names a gate: `license`, `vip`, `subscri`, `verify`, `pay`, `token`,",
			"`root`, `debug`, `emulator`, an API host, or an SDK class. Owner attribution is exact for classes",
			"and methods; a plain string hit has no owner because strings are a shared pool.",
			"",
			"It does not decompile to Java, does not emit smali, does not read code items, annotations or",
			"try/catch tables, and does not execute the DEX. Indexing stops at each table's documented cap",
			"and says so when it truncates. Only the first three `classes*.dex` are read.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				path: { type: "string", description: "APK, ZIP or `.dex` file, absolute or relative to the session working directory." },
				query: { type: "string", description: "Case-insensitive substring, e.g. `license`, `vip`, `Lcom/example/`. Required." },
				kind: {
					type: "string",
					enum: ["any", "class", "method", "string"],
					description: "Restrict to one table (default any).",
				},
				limit: { type: "integer", description: `Maximum hits (default 60, max ${MAX_HITS}).` },
			},
			required: ["path", "query"],
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"],
		context: { conversation: "summary" },
		timeoutMs: 120_000,
		handler: async context => {
			try {
				const input = context.trigger.input;
				const query = (input.query ?? "").trim();
				if (query === "") return "search_dex_symbols needs a non-empty `query`.";
				const sample = await loadSample(context.host.fs, context.session.cwd, input.path ?? "");
				const limit = Math.max(1, Math.min(MAX_HITS, Math.trunc(input.limit ?? 60)));
				const kind: DexSearchKind = input.kind ?? "any";

				const dexFiles: { name: string; bytes: Uint8Array }[] = [];
				if (looksLikeDex(sample.bytes)) {
					dexFiles.push({ name: sample.name, bytes: sample.bytes });
				} else if (looksLikeZip(sample.bytes)) {
					const index = readZipIndex(sample.bytes);
					const entries = findZipEntries(index, name => /^classes\d*\.dex$/.test(name)).slice(0, MAX_DEX_FILES);
					for (const entry of entries) dexFiles.push({ name: entry.name, bytes: await readZipEntry(sample.bytes, entry) });
					if (dexFiles.length === 0) return `${sample.name} contains no classes*.dex entry, so there is no DEX symbol table to search.`;
				} else {
					return `${sample.name} is neither a DEX file nor a ZIP/APK archive.`;
				}

				const hits: (DexSearchHit & { dex: string })[] = [];
				const notes: string[] = [];
				let truncated = false;
				for (const file of dexFiles) {
					if (hits.length >= limit) {
						truncated = true;
						break;
					}
					const index = indexDex(file.bytes);
					notes.push(...index.comments.map(comment => `${file.name}: ${comment}`));
					const strings = dexStrings(file.bytes);
					const found = searchDex(index, strings, query, kind, limit - hits.length);
					for (const hit of found.hits) hits.push({ ...hit, dex: file.name });
					if (found.truncated) truncated = true;
					notes.push(`${file.name}: ${index.classCount} class(es), ${index.methodCount} method(s), ${index.stringCount} string(s) in the header tables.`);
				}

				const lines = [`# DEX symbol search in ${sample.name}`, "", `Query \`${query}\` · kind ${kind} · ${hits.length} hit(s)`];
				if (hits.length === 0) {
					lines.push("", "Nothing matched. DEX string pools keep the literals you usually look for (`license`, hosts, key names) even when all identifiers are obfuscated — try a shorter fragment before concluding the feature is absent.");
				} else {
					lines.push("", "| dex | kind | owner | value |", "| --- | --- | --- | --- |");
					for (const hit of hits) lines.push(`| ${hit.dex} | ${hit.kind} | ${hit.owner ? quote(hit.owner) : "—"} | ${quote(hit.value)} |`);
				}
				if (notes.length > 0) lines.push("", ...notes.map(note => `- ${note}`));
				if (truncated) lines.push("", `Stopped at the ${limit}-hit budget; narrow the query instead of raising the limit blindly.`);
				lines.push("", "An owner means the DEX itself declares that method on that class. A string hit has no owner — the pool is shared, so it does not prove which class uses it.");
				return lines.join("\n");
			} catch (error) {
				return `DEX symbol search failed: ${error instanceof Error ? error.message : String(error)}`;
			}
		},
	});
}
